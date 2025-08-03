import json
import os
import tiktoken
from typing import List, Dict, Any
from openai import OpenAI
from datetime import datetime
from pathlib import Path
from prd_generation_prompts import generate_notion_project_prompt, generate_task_master_prd_prompt

class ChunkedGoldStandardGenerator:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.tokenizer = tiktoken.encoding_for_model("gpt-4o")
        self.max_tokens = 30000  # GPT-4o 토큰 제한
        self.chunk_size = 8000   # 각 청크당 토큰 수
        
        # 골드 스탠다드 결과 디렉토리
        self.gold_standard_dir = "ttalkkac_gold_standard_results_20250731_104912"
    
    def count_tokens(self, text: str) -> int:
        """텍스트의 토큰 수를 계산"""
        return len(self.tokenizer.encode(text))
    
    def chunk_text(self, text: str, chunk_size: int = 8000) -> List[str]:
        """텍스트를 토큰 단위로 청킹"""
        tokens = self.tokenizer.encode(text)
        chunks = []
        
        for i in range(0, len(tokens), chunk_size):
            chunk_tokens = tokens[i:i + chunk_size]
            chunk_text = self.tokenizer.decode(chunk_tokens)
            chunks.append(chunk_text)
        
        return chunks
    
    def summarize_chunk(self, chunk: str) -> str:
        """개별 청크를 요약"""
        summarize_prompt = """다음 회의록 내용을 핵심 정보를 보존하면서 간결하게 요약해주세요. 
중요한 결정사항, 액션 아이템, 주요 논의사항을 포함하세요.

회의록:
{chunk}

요약:"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "user", "content": summarize_prompt.format(chunk=chunk)}
                ],
                max_tokens=1500,
                temperature=0.1
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"청크 요약 실패: {e}")
            return chunk[:2000]  # 실패시 앞부분만 반환
    
    def process_long_transcript(self, transcript: str) -> str:
        """긴 회의록을 청킹하고 요약하여 처리"""
        token_count = self.count_tokens(transcript)
        print(f"원본 토큰 수: {token_count}")
        
        if token_count <= self.max_tokens:
            return transcript
        
        # 청킹 처리
        chunks = self.chunk_text(transcript, self.chunk_size)
        print(f"총 {len(chunks)}개 청크로 분할")
        
        # 각 청크 요약
        summarized_chunks = []
        for i, chunk in enumerate(chunks):
            print(f"청크 {i+1}/{len(chunks)} 요약 중...")
            summary = self.summarize_chunk(chunk)
            summarized_chunks.append(summary)
        
        # 요약된 청크들을 합치기
        combined_summary = "\n\n=== 청크 구분 ===\n\n".join(summarized_chunks)
        
        final_token_count = self.count_tokens(combined_summary)
        print(f"요약 후 토큰 수: {final_token_count}")
        
        return combined_summary
    
    def get_failed_folders(self) -> List[str]:
        """result.json이 없는 실패한 폴더들을 찾기"""
        failed_folders = []
        gold_standard_path = Path(self.gold_standard_dir)
        
        if not gold_standard_path.exists():
            print(f"골드 스탠다드 디렉토리를 찾을 수 없습니다: {self.gold_standard_dir}")
            return []
        
        for folder in gold_standard_path.iterdir():
            if folder.is_dir():
                result_file = folder / "result.json"
                if not result_file.exists():
                    # 폴더명에서 원본 회의 이름 추출 (train_xxx_result_ 이후 부분)
                    folder_name = folder.name
                    if "_result_" in folder_name:
                        original_name = folder_name.split("_result_", 1)[1]
                        # 원본 폴더명이 result_로 시작하는지 확인
                        if self.check_original_folder_exists(original_name):
                            failed_folders.append(original_name)
                        elif self.check_original_folder_exists(f"result_{original_name}"):
                            failed_folders.append(f"result_{original_name}")
                        else:
                            print(f"원본 폴더를 찾을 수 없습니다: {original_name}")
        
        return failed_folders
    
    def check_original_folder_exists(self, folder_name: str) -> bool:
        """batch_triplet_results에서 원본 폴더 존재 확인"""
        base_dir = "../batch_triplet_results"  # ai-engine-dev에서 상위 디렉토리 참조
        target_path = os.path.join(base_dir, folder_name)
        return os.path.exists(target_path)
    
    def load_meeting_data_from_failed(self, original_meeting_name: str) -> Dict[str, Any]:
        """실패한 폴더에서 원본 회의 데이터 찾기"""
        # batch_triplet_results에서 해당 폴더 찾기
        base_dir = "../batch_triplet_results"  # ai-engine-dev에서 상위 디렉토리 참조
        target_file = os.path.join(base_dir, original_meeting_name, "05_final_result.json")
        
        if not os.path.exists(target_file):
            print(f"파일을 찾을 수 없습니다: {target_file}")
            return None
        
        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 회의 내용을 텍스트로 변환
            meeting_text = ""
            for item in data:
                timestamp = item.get('timestamp', 'Unknown')
                speaker = item.get('speaker', 'Unknown')
                text = item.get('text', '')
                meeting_text += f"[{timestamp}] {speaker}: {text}\n"
            
            return {
                "transcript": meeting_text.strip(),
                "metadata": {
                    "source_file": target_file,
                    "utterance_count": len(data),
                    "transcript_length": len(meeting_text),
                    "speakers": list(set(item.get('speaker', 'Unknown') for item in data))
                }
            }
        except Exception as e:
            print(f"파일 로드 오류 ({target_file}): {e}")
            return None
    
    def generate_gold_standard_response(self, meeting_data: Dict[str, Any]) -> Dict[str, Any]:
        """골드 스탠다드 응답 생성 (5단계 개선 프로세스)"""
        transcript = meeting_data["transcript"]
        
        # 긴 회의록 처리
        processed_transcript = self.process_long_transcript(transcript)
        
        # 1단계: 초기 생성
        print("1단계: 초기 노션 프로젝트 생성...")
        notion_result = self.call_gpt4o(generate_notion_project_prompt(processed_transcript))
        
        if not notion_result:
            return None
        
        print("2단계: 태스크 마스터 PRD 생성...")
        task_master_result = self.call_gpt4o(generate_task_master_prd_prompt(notion_result))
        
        if not task_master_result:
            return None
        
        # 3-5단계: 반복 개선 프로세스
        current_result = {
            "notion_project": notion_result,
            "task_master_prd": task_master_result
        }
        
        for stage in range(3, 6):
            print(f"{stage}단계: 품질 평가 및 개선...")
            current_result = self.improve_result_stage(processed_transcript, current_result, stage)
            
            if not current_result:
                print(f"{stage}단계에서 실패")
                return None
        
        return current_result
    
    def call_gpt4o(self, prompt: str, max_retries: int = 3) -> Dict[str, Any]:
        """GPT-4o API 호출"""
        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=4000,
                    temperature=0.1
                )
                
                content = response.choices[0].message.content.strip()
                
                # JSON 파싱 시도
                try:
                    # ```json ``` 블록에서 JSON 추출
                    if "```json" in content:
                        json_start = content.find("```json") + 7
                        json_end = content.find("```", json_start)
                        json_content = content[json_start:json_end].strip()
                    else:
                        json_content = content
                    
                    return json.loads(json_content)
                    
                except json.JSONDecodeError as e:
                    print(f"JSON 파싱 실패 (시도 {attempt + 1}): {e}")
                    if attempt == max_retries - 1:
                        print("원본 응답:", content[:500] + "...")
                        return None
                    continue
                    
            except Exception as e:
                print(f"API 호출 실패 (시도 {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return None
                continue
        
        return None
    
    def improve_result_stage(self, transcript: str, current_result: Dict[str, Any], stage: int) -> Dict[str, Any]:
        """결과 개선 단계"""
        evaluation_prompt = f"""다음 회의록과 생성된 결과를 평가하고 개선해주세요.

**회의록:**
{transcript[:2000]}...

**현재 결과:**
{json.dumps(current_result, ensure_ascii=False, indent=2)[:2000]}...

**평가 기준 (각 10점 만점):**
1. 완전성(Completeness): 회의 내용이 얼마나 완전히 반영되었는가?
2. 정확성(Accuracy): 생성된 내용이 얼마나 정확한가?
3. 구조화(Structure): 정보가 얼마나 체계적으로 구성되었는가?
4. 실용성(Practicality): 실제 업무에 얼마나 유용한가?
5. 명확성(Clarity): 내용이 얼마나 명확하고 이해하기 쉬운가?

**개선된 결과를 JSON 형식으로 제공하고, 각 평가 기준에 대한 점수도 포함해주세요.**
"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "user", "content": evaluation_prompt}
                ],
                max_tokens=4000,
                temperature=0.1
            )
            
            content = response.choices[0].message.content.strip()
            
            # JSON 추출 시도
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                json_content = content[json_start:json_end].strip()
            else:
                json_content = content
            
            improved_result = json.loads(json_content)
            
            # 평가 점수 확인
            if "evaluation_scores" in improved_result:
                scores = improved_result["evaluation_scores"]
                avg_score = sum(scores.values()) / len(scores)
                print(f"평균 점수: {avg_score:.1f}/10")
                
                if avg_score >= 7.0:
                    print(f"목표 점수 달성! (7.0점 이상)")
                    return improved_result
            
            return improved_result
            
        except Exception as e:
            print(f"개선 단계 실패: {e}")
            return current_result
    
    def save_result(self, original_meeting_name: str, result: Dict[str, Any], metadata: Dict[str, Any]):
        """결과를 파일로 저장"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = f"ttalkkac_gold_standard_results_chunked_{timestamp}"
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # 원본 폴더명 형식으로 저장 (train_xxx_result_원본명)
        folder_name = f"chunked_result_{original_meeting_name}"
        folder_path = os.path.join(output_dir, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        
        # 결과 저장
        result_data = {
            "result": result,
            "metadata": metadata,
            "generation_info": {
                "processed_with_chunking": True,
                "generation_time": datetime.now().isoformat(),
                "model": "gpt-4o"
            }
        }
        
        with open(os.path.join(folder_path, "result.json"), 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)
        
        print(f"결과 저장: {folder_path}")
    
    def process_all_failed_items(self):
        """실패한 모든 항목 처리"""
        # 실패한 폴더들 동적 검색
        failed_folders = self.get_failed_folders()
        print(f"실패한 {len(failed_folders)}개 항목 처리 시작...")
        
        success_count = 0
        failed_count = 0
        
        for original_meeting_name in failed_folders:
            print(f"\n=== {original_meeting_name} 처리 중 ===")
            
            # 원본 데이터 로드
            meeting_data = self.load_meeting_data_from_failed(original_meeting_name)
            if not meeting_data:
                print(f"{original_meeting_name}: 원본 데이터 로드 실패")
                failed_count += 1
                continue
            
            # 골드 스탠다드 생성
            result = self.generate_gold_standard_response(meeting_data)
            if not result:
                print(f"{original_meeting_name}: 골드 스탠다드 생성 실패")
                failed_count += 1
                continue
            
            # 결과 저장
            self.save_result(original_meeting_name, result, meeting_data["metadata"])
            success_count += 1
            print(f"{original_meeting_name}: 성공")
        
        print(f"\n=== 처리 완료 ===")
        print(f"성공: {success_count}개")
        print(f"실패: {failed_count}개")

def main():
    # API 키 설정 (환경변수에서 가져오기)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        api_key = input("OpenAI API 키를 입력하세요: ").strip()
        if not api_key:
            print("API 키가 입력되지 않았습니다.")
            return
    
    generator = ChunkedGoldStandardGenerator(api_key)
    generator.process_all_failed_items()

if __name__ == "__main__":
    main()