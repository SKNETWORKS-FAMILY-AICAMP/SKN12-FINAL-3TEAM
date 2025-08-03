"""
런팟에서 단일 모델로 실제 회의록 요약 테스트
실제 TtalKkac 프롬프트와 로직 사용
"""

import os
import json
import time
import torch
from typing import Dict, Any, List
from datetime import datetime
import logging
from pathlib import Path
import random

# 실제 프로젝트 모듈 임포트
from meeting_analysis_prompts import (
    generate_meeting_analysis_system_prompt,
    generate_meeting_analysis_user_prompt
)
from prd_generation_prompts import (
    NOTION_PROJECT_SCHEMA
)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SingleModelTester:
    """단일 모델 테스트 클래스"""
    
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.current_model = None
        self.current_tokenizer = None
        
        # GPU 메모리 체크
        if torch.cuda.is_available():
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"🎮 GPU 메모리: {gpu_memory:.1f}GB")
        
        # 실제 프로젝트 프롬프트 사용
        self.system_prompt = generate_meeting_analysis_system_prompt()
        
    def load_real_meeting_data(self, data_dir: str = "batch_triplet_results", num_samples: int = None) -> List[Dict[str, Any]]:
        """실제 회의록 데이터 로드"""
        logger.info(f"📁 Loading real meeting data from {data_dir}...")
        
        data_path = Path(data_dir)
        if not data_path.exists():
            logger.error(f"❌ Data directory not found: {data_dir}")
            return []
        
        meeting_data = []
        
        # result_ 폴더들에서 05_final_result.json 파일 찾기
        result_folders = [f for f in data_path.iterdir() if f.is_dir() and f.name.startswith("result_")]
        
        if not result_folders:
            logger.error(f"❌ No result folders found in {data_dir}")
            return []
        
        # 모든 데이터 또는 샘플 선택
        if num_samples is None:
            selected_folders = result_folders
            logger.info(f"📊 Processing ALL {len(result_folders)} folders")
        else:
            selected_folders = random.sample(result_folders, min(num_samples, len(result_folders)))
            logger.info(f"📊 Processing {len(selected_folders)} random samples")
        
        for folder in selected_folders:
            final_result_file = folder / "05_final_result.json"
            
            if final_result_file.exists():
                try:
                    with open(final_result_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # 회의록 텍스트 구성
                    meeting_text = ""
                    for item in data:
                        timestamp = item.get('timestamp', 'Unknown')
                        speaker = item.get('speaker', 'Unknown')
                        text = item.get('text', '')
                        meeting_text += f"[{timestamp}] {speaker}: {text}\n"
                    
                    meeting_data.append({
                        "folder_name": folder.name,
                        "meeting_text": meeting_text.strip(),
                        "total_segments": len(data),
                        "total_length": len(meeting_text)
                    })
                    
                    logger.info(f"✅ Loaded: {folder.name} ({len(data)} segments, {len(meeting_text)} chars)")
                    
                except Exception as e:
                    logger.error(f"❌ Failed to load {folder.name}: {e}")
                    continue
            else:
                logger.warning(f"⚠️ {folder.name}: 05_final_result.json not found")
        
        logger.info(f"📊 Loaded {len(meeting_data)} real meeting samples")
        return meeting_data
        
    def load_model(self, use_vllm: bool = True):
        """모델 로딩 (VLLM 우선, Transformers 백업)"""
        try:
            logger.info(f"🔄 Loading {self.model_name}...")
            start_time = time.time()
            
            if use_vllm:
                try:
                    from vllm import LLM
                    from transformers import AutoTokenizer
                    
                    # VLLM 모델 로딩
                    self.current_model = LLM(
                        model=self.model_name,
                        tensor_parallel_size=1,
                        gpu_memory_utilization=0.8,
                        trust_remote_code=True,
                        max_model_len=8192,  # 테스트용으로 적당한 길이
                        enforce_eager=True,
                        swap_space=2
                    )
                    
                    self.current_tokenizer = AutoTokenizer.from_pretrained(
                        self.model_name, trust_remote_code=True
                    )
                    
                    load_time = time.time() - start_time
                    logger.info(f"✅ VLLM {self.model_name} loaded in {load_time:.2f}s")
                    return True, "vllm"
                    
                except Exception as e:
                    logger.warning(f"⚠️ VLLM failed: {e}")
                    use_vllm = False
            
            if not use_vllm:
                # Transformers 백업
                from transformers import AutoTokenizer, AutoModelForCausalLM
                
                self.current_tokenizer = AutoTokenizer.from_pretrained(
                    self.model_name, trust_remote_code=True
                )
                
                if self.current_tokenizer.pad_token is None:
                    self.current_tokenizer.pad_token = self.current_tokenizer.eos_token
                
                self.current_model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    device_map="auto",
                    torch_dtype=torch.float16,
                    trust_remote_code=True
                )
                
                load_time = time.time() - start_time
                logger.info(f"✅ Transformers {self.model_name} loaded in {load_time:.2f}s")
                return True, "transformers"
                
        except Exception as e:
            logger.error(f"❌ Failed to load {self.model_name}: {e}")
            return False, str(e)
    
    def generate_with_model(
        self, 
        meeting_text: str, 
        backend: str,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """실제 TtalKkac 로직으로 응답 생성"""
        try:
            start_time = time.time()
            
            # 실제 프로젝트 프롬프트 사용
            user_prompt = generate_meeting_analysis_user_prompt(meeting_text)
            
            # 스키마 포함 프롬프트 (실제 generate_structured_response 로직)
            schema_prompt = f"""
{self.system_prompt}

**Response Schema:**
You must respond with a JSON object following this exact structure:
```json
{json.dumps(NOTION_PROJECT_SCHEMA, indent=2, ensure_ascii=False)}
```

**Important Rules:**
1. Always return valid JSON format
2. Use Korean for all text content unless technical terms require English
3. Follow the exact schema structure
4. Include all required fields
5. Use appropriate data types for each field

{user_prompt}

**Response:**
```json
"""
            
            messages = [{"role": "user", "content": schema_prompt}]
            
            if backend == "vllm":
                # VLLM 추론
                from vllm import SamplingParams
                
                sampling_params = SamplingParams(
                    max_tokens=2048,
                    temperature=temperature,
                    top_p=0.9,
                    repetition_penalty=1.1
                )
                
                text = self.current_tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
                
                outputs = self.current_model.generate([text], sampling_params)
                response = outputs[0].outputs[0].text
                
            else:
                # Transformers 추론
                text = self.current_tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
                
                inputs = self.current_tokenizer([text], return_tensors="pt").to(self.current_model.device)
                
                with torch.no_grad():
                    outputs = self.current_model.generate(
                        **inputs,
                        max_new_tokens=2048,
                        temperature=temperature,
                        do_sample=True,
                        pad_token_id=self.current_tokenizer.eos_token_id,
                        repetition_penalty=1.1,
                        top_p=0.9
                    )
                
                response = self.current_tokenizer.decode(
                    outputs[0][len(inputs["input_ids"][0]):], 
                    skip_special_tokens=True
                )
            
            inference_time = time.time() - start_time
            
            # JSON 추출 및 파싱 (실제 로직)
            try:
                if "```json" in response:
                    json_start = response.find("```json") + 7
                    json_end = response.find("```", json_start)
                    if json_end == -1:
                        json_content = response[json_start:].strip()
                    else:
                        json_content = response[json_start:json_end].strip()
                else:
                    json_content = response.strip()
                
                parsed_result = json.loads(json_content)
                
                return {
                    "success": True,
                    "result": parsed_result,
                    "inference_time": inference_time,
                    "raw_response": response,
                    "backend": backend
                }
                
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": f"JSON parsing failed: {str(e)}",
                    "inference_time": inference_time,
                    "raw_response": response,
                    "backend": backend
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Generation failed: {str(e)}",
                "inference_time": 0,
                "backend": backend
            }
    
    def test_single_meeting(self, meeting_data: Dict[str, Any], backend: str) -> Dict[str, Any]:
        """단일 회의록 테스트"""
        logger.info(f"📝 Testing: {meeting_data['folder_name']}")
        logger.info(f"   📊 {meeting_data['total_segments']} segments, {meeting_data['total_length']} chars")
        
        # 생성 테스트
        result = self.generate_with_model(meeting_data['meeting_text'], backend)
        
        return {
            "meeting_info": {
                "folder_name": meeting_data['folder_name'],
                "total_segments": meeting_data['total_segments'],
                "total_length": meeting_data['total_length']
            },
            "generation_result": result
        }
    
    def save_test_results(self, test_results: List[Dict[str, Any]], backend: str):
        """테스트 결과 저장"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name_clean = self.model_name.replace("/", "_").replace("-", "_")
        
        # 결과 저장 폴더 생성
        results_dir = Path("model_test_results")
        results_dir.mkdir(exist_ok=True)
        
        # 전체 결과 저장
        output_file = results_dir / f"test_results_{model_name_clean}_{backend}_{timestamp}.json"
        
        full_results = {
            "test_info": {
                "model_name": self.model_name,
                "backend": backend,
                "timestamp": timestamp,
                "total_tests": len(test_results)
            },
            "results": test_results
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(full_results, f, ensure_ascii=False, indent=2)
        
        logger.info(f"💾 Full results saved to: {output_file}")
        
        # 성공한 결과만 따로 저장 (보기 좋게)
        successful_results = [r for r in test_results if r["generation_result"]["success"]]
        if successful_results:
            success_file = results_dir / f"successful_results_{model_name_clean}_{backend}_{timestamp}.json"
            
            formatted_results = []
            for result in successful_results:
                formatted_results.append({
                    "folder_name": result["meeting_info"]["folder_name"],
                    "segments": result["meeting_info"]["total_segments"],
                    "chars": result["meeting_info"]["total_length"],
                    "inference_time": result["generation_result"]["inference_time"],
                    "generated_project": result["generation_result"]["result"]
                })
            
            with open(success_file, 'w', encoding='utf-8') as f:
                json.dump(formatted_results, f, ensure_ascii=False, indent=2)
            
            logger.info(f"✅ Success-only results saved to: {success_file}")
        
        # 요약 통계
        successful_count = len(successful_results)
        total_count = len(test_results)
        success_rate = successful_count / total_count * 100 if total_count > 0 else 0
        
        if successful_results:
            avg_time = sum(r["generation_result"]["inference_time"] for r in successful_results) / len(successful_results)
            logger.info(f"📊 Summary: {successful_count}/{total_count} success ({success_rate:.1f}%), avg time: {avg_time:.2f}s")
        else:
            logger.info(f"📊 Summary: {successful_count}/{total_count} success ({success_rate:.1f}%)")
    
    def run_test(self, data_dir: str = "batch_triplet_results", num_samples: int = None, save_results: bool = True):
        """테스트 실행"""
        logger.info(f"🚀 Starting test with {self.model_name}...")
        
        # 실제 회의록 데이터 로드
        meeting_data_list = self.load_real_meeting_data(data_dir, num_samples)
        if not meeting_data_list:
            logger.error("❌ No meeting data loaded. Test aborted.")
            return
        
        # 모델 로딩
        success, backend = self.load_model()
        if not success:
            logger.error(f"❌ Model loading failed: {backend}")
            return
        
        # 각 회의록에 대해 테스트
        test_results = []
        
        for i, meeting_data in enumerate(meeting_data_list):
            logger.info(f"\n{'='*60}")
            logger.info(f"🧪 Test {i+1}/{len(meeting_data_list)} - {meeting_data['folder_name']}")
            
            result = self.test_single_meeting(meeting_data, backend)
            test_results.append(result)
            
            # 간단한 상태만 출력 (전체 결과는 파일로 저장)
            if result["generation_result"]["success"]:
                logger.info(f"✅ Success ({result['generation_result']['inference_time']:.2f}s)")
            else:
                logger.error(f"❌ Failed: {result['generation_result']['error']}")
        
        # 최종 요약
        successful_tests = [r for r in test_results if r["generation_result"]["success"]]
        logger.info(f"\n🎉 Test completed!")
        logger.info(f"📊 Success rate: {len(successful_tests)}/{len(test_results)} ({len(successful_tests)/len(test_results)*100:.1f}%)")
        
        if successful_tests:
            avg_time = sum(r["generation_result"]["inference_time"] for r in successful_tests) / len(successful_tests)
            logger.info(f"⏱️  Average inference time: {avg_time:.2f}s")
        
        # 결과 저장
        if save_results:
            self.save_test_results(test_results, backend)
        
        # 메모리 정리
        del self.current_model
        del self.current_tokenizer
        torch.cuda.empty_cache()
        logger.info("🧹 Memory cleaned up")
        
        return test_results


def main():
    """메인 실행 함수"""
    
    # 테스트할 모델명 (직접 수정해서 사용)
    MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"  # ← 이 부분을 바꿔가며 테스트
    
    # 설정
    DATA_DIR = "batch_triplet_results"  # 실제 회의록 데이터 폴더
    NUM_SAMPLES = None  # None = 모든 데이터, 숫자 = 샘플 개수
    
    logger.info(f"🎯 Testing model: {MODEL_NAME}")
    logger.info(f"📁 Data directory: {DATA_DIR}")
    logger.info(f"🔢 Number of samples: {'ALL' if NUM_SAMPLES is None else NUM_SAMPLES}")
    
    # 테스트 실행
    tester = SingleModelTester(MODEL_NAME)
    tester.run_test(DATA_DIR, NUM_SAMPLES)

if __name__ == "__main__":
    main()