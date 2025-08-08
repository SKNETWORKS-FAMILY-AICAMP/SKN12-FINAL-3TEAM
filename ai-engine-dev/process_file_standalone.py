"""
RunPod 스탠드얼론 파일 처리 스크립트
서버 없이 직접 파일을 처리하고 결과를 저장
"""

import os
import sys
import json
import time
import asyncio
import logging
from datetime import datetime
from pathlib import Path
import argparse
import tempfile
from typing import Optional, Dict, Any, List

import torch
import numpy as np

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 로컬 모듈 임포트
from task_schemas import (
    TaskItem, SubTask, MeetingAnalysisResult, ComplexityAnalysis,
    calculate_task_complexity_advanced, validate_task_dependencies,
    generate_task_id_sequence, TASK_SCHEMA_EXAMPLE
)
from meeting_analysis_prompts import (
    generate_meeting_analysis_system_prompt,
    generate_meeting_analysis_user_prompt,
    generate_task_expansion_system_prompt,
    generate_complexity_analysis_prompt,
    validate_meeting_analysis
)
from prd_generation_prompts import (
    generate_notion_project_prompt,
    generate_task_master_prd_prompt,
    format_notion_project,
    format_task_master_prd,
    validate_notion_project,
    validate_task_master_prd,
    NOTION_PROJECT_SCHEMA,
    TASK_MASTER_PRD_SCHEMA
)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 글로벌 모델 변수
whisper_model = None
qwen_model = None
qwen_tokenizer = None
triplet_processor = None
bert_classifier = None

# BERT 모델 경로 설정
BERT_MODEL_PATH = r"C:\Users\SH\Desktop\TtalKkac\Bert모델\Ttalkkak_model_v2\Ttalkkak_model_v3.pt"

# 결과 저장 디렉토리
RESULT_DIR = Path("pipeline_results")
RESULT_DIR.mkdir(exist_ok=True)

def save_result(filename: str, data: Any, session_dir: Path):
    """결과를 JSON 파일로 저장"""
    filepath = session_dir / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        if isinstance(data, str):
            f.write(data)
        else:
            json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info(f"✅ Saved: {filepath}")
    return filepath

def load_whisperx():
    """WhisperX 모델 로딩"""
    global whisper_model
    
    if whisper_model is None:
        logger.info("🎤 Loading WhisperX large-v3...")
        try:
            import whisperx
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            whisper_model = whisperx.load_model(
                "large-v3", 
                device, 
                compute_type=compute_type,
                language="ko"
            )
            logger.info(f"✅ WhisperX loaded successfully (device: {device})")
            
        except Exception as e:
            logger.error(f"❌ WhisperX loading failed: {e}")
            raise e
    
    return whisper_model

def load_bert_model():
    """BERT 분류 모델 로딩"""
    global bert_classifier, triplet_processor
    
    if bert_classifier is None:
        logger.info("🔬 Loading BERT classifier...")
        try:
            # TripletProcessor와 BertClassifier 임포트 시도
            try:
                from triplet_processor import TripletProcessor
                from bert_classifier import TtalkkakBERTClassifier
                
                # 모델 초기화
                triplet_processor = TripletProcessor()
                bert_classifier = TtalkkakBERTClassifier()
                bert_classifier.load_model()
                
                logger.info("✅ BERT model loaded successfully")
            except Exception as e:
                logger.warning(f"⚠️ 전체 BERT 모듈 로드 실패: {e}")
                logger.info("🔄 간단한 필터로 대체")
                
                # 간단한 필터 사용
                from simple_bert_filter import SimpleTripletProcessor, SimpleBertClassifier
                
                triplet_processor = SimpleTripletProcessor()
                bert_classifier = SimpleBertClassifier()
                bert_classifier.load_model()
                
                logger.info("✅ Simple BERT filter loaded successfully")
                
        except Exception as e:
            logger.error(f"❌ All BERT loading failed: {e}")
            # 모든 로드 실패시 None 유지
    
    return bert_classifier, triplet_processor

def load_qwen3():
    """Qwen3-32B-AWQ 모델 로딩"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None or qwen_tokenizer is None:
        logger.info("🚀 Loading Qwen3-32B-AWQ...")
        try:
            use_vllm = os.getenv("USE_VLLM", "true").lower() == "true"
            
            if use_vllm:
                try:
                    logger.info("⚡ Using VLLM for ultra-fast inference")
                    from vllm import LLM, SamplingParams
                    from transformers import AutoTokenizer
                    
                    model_name = "Qwen/Qwen3-32B-AWQ"
                    
                    qwen_model = LLM(
                        model=model_name,
                        tensor_parallel_size=1,
                        gpu_memory_utilization=0.8,
                        trust_remote_code=True,
                        quantization="awq",
                        max_model_len=20000,
                        enforce_eager=True,
                        swap_space=4
                    )
                    
                    qwen_tokenizer = AutoTokenizer.from_pretrained(
                        model_name, trust_remote_code=True
                    )

                    logger.info("✅ VLLM Qwen3-32B-AWQ loaded successfully")

                except Exception as e:
                    logger.warning(f"⚠️ VLLM failed: {e}, falling back to Transformers")
                    use_vllm = False
            
            if not use_vllm:
                from transformers import AutoTokenizer, AutoModelForCausalLM
                
                model_name = "Qwen/Qwen3-32B-AWQ"
                
                qwen_tokenizer = AutoTokenizer.from_pretrained(
                    model_name, trust_remote_code=True
                )
                
                qwen_model = AutoModelForCausalLM.from_pretrained(
                    model_name,
                    device_map="auto",
                    torch_dtype=torch.float16,
                    trust_remote_code=True
                )
                
                logger.info("✅ Transformers Qwen3-32B-AWQ loaded")
                
        except Exception as e:
            logger.error(f"❌ Qwen3-32B-AWQ loading failed: {e}")
            raise e
    
    return qwen_model, qwen_tokenizer

def load_triplet_bert():
    """Triplet + BERT 모듈 로딩"""
    global triplet_processor, bert_classifier
    
    try:
        from triplet_processor import get_triplet_processor
        from bert_classifier import get_bert_classifier
        
        triplet_processor = get_triplet_processor()
        bert_classifier = get_bert_classifier()
        
        logger.info("✅ Triplet + BERT modules loaded")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Triplet + BERT not available: {e}")
        return False

def generate_with_qwen(prompt: str, max_tokens: int = 2048, temperature: float = 0.3) -> str:
    """Qwen 모델로 텍스트 생성"""
    global qwen_model, qwen_tokenizer
    
    if not qwen_model:
        raise RuntimeError("Qwen model not loaded")
    
    # VLLM 사용 여부 확인 (VLLM은 LLM 클래스)
    if type(qwen_model).__name__ == 'LLM':
        # VLLM 방식
        from vllm import SamplingParams
        
        sampling_params = SamplingParams(
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.95
        )
        
        # VLLM의 generate 메서드는 프롬프트 리스트를 받음
        outputs = qwen_model.generate([prompt], sampling_params)
        response = outputs[0].outputs[0].text
    else:
        # Transformers 방식
        if not qwen_tokenizer:
            raise RuntimeError("Qwen tokenizer not loaded")
            
        messages = [{"role": "user", "content": prompt}]
        text = qwen_tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        
        inputs = qwen_tokenizer([text], return_tensors="pt")
        if torch.cuda.is_available():
            inputs = inputs.to("cuda")
        
        with torch.no_grad():
            outputs = qwen_model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                pad_token_id=qwen_tokenizer.eos_token_id
            )
        
        response = qwen_tokenizer.decode(
            outputs[0][len(inputs["input_ids"][0]):], 
            skip_special_tokens=True
        )
    
    return response

async def process_audio_file(audio_path: str, session_dir: Path) -> Dict[str, Any]:
    """Step 1: 음성 파일 처리"""
    logger.info(f"\n{'='*60}")
    logger.info("STEP 1: WhisperX Transcription")
    logger.info(f"{'='*60}")
    
    try:
        model = load_whisperx()
        
        logger.info(f"📝 Transcribing: {audio_path}")
        result = model.transcribe(audio_path, batch_size=16)
        
        # 화자 구분 (Diarization) 추가
        try:
            logger.info("👥 Adding speaker diarization...")
            import whisperx
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            
            # Alignment 먼저 수행 (diarization 전 필수)
            model_a, metadata = whisperx.load_align_model(
                language_code=result.get("language", "ko"), 
                device=device
            )
            result = whisperx.align(
                result["segments"], 
                model_a, 
                metadata, 
                audio_path, 
                device,
                return_char_alignments=False
            )
            
            # Diarization 수행
            hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN") or os.getenv("HF_ACCESS_TOKEN")
            
            # 디버깅: 토큰 상태 확인
            if not hf_token:
                logger.warning("⚠️ No HF_TOKEN found in environment variables")
                logger.info("Please set one of: HF_TOKEN, HUGGING_FACE_HUB_TOKEN, or HF_ACCESS_TOKEN")
                logger.info("Example: export HF_TOKEN='hf_xxxxxxxxxxxxxxxxxxxxx'")
            
            if hf_token:
                logger.info(f"🔑 HF Token found: {hf_token[:10]}...")
                # pyannote 직접 사용 (간단한 방법)
                from pyannote.audio import Pipeline
                
                # 파이프라인 로드
                pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=hf_token
                )
                
                # GPU 사용 가능하면 GPU로
                if torch.cuda.is_available():
                    pipeline.to(torch.device("cuda"))
                
                # 화자 구분 실행 (원본 파일 직접 사용)
                logger.info("🎯 Running speaker diarization on audio file...")
                diarization = pipeline(audio_path)
                
                # WhisperX에 화자 정보 할당
                result = whisperx.assign_word_speakers(
                    diarization, 
                    result
                )
                
                # 화자 정보 요약
                speakers = set()
                for seg in result.get("segments", []):
                    if "speaker" in seg:
                        speakers.add(seg["speaker"])
                
                logger.info(f"✅ Speaker diarization completed - Found {len(speakers)} speakers: {', '.join(sorted(speakers))}")
            else:
                logger.warning("⚠️ No HF_TOKEN found, skipping speaker diarization")
                logger.info("Set HF_TOKEN environment variable to enable speaker detection")
                logger.info("Get token from: https://huggingface.co/pyannote/speaker-diarization-3.1")
            
        except ImportError as e:
            logger.warning(f"⚠️ Diarization module not found: {e}")
            logger.info("Install with: pip install pyannote.audio")
        except Exception as e:
            import traceback
            logger.warning(f"⚠️ Speaker diarization failed: {str(e)}")
            logger.debug(f"Full error trace: {traceback.format_exc()}")
            logger.info("Continuing without speaker information...")
        
        segments = result.get("segments", [])
        full_text = " ".join([seg.get("text", "") for seg in segments])
        
        transcription_data = {
            "full_text": full_text,
            "segments": segments,
            "language": result.get("language", "ko"),
            "duration": sum([seg.get("end", 0) - seg.get("start", 0) for seg in segments]),
            "character_count": len(full_text)
        }
        
        save_result("step1_whisperx_transcription.json", transcription_data, session_dir)
        save_result("step1_whisperx_transcription.txt", full_text, session_dir)
        
        logger.info(f"✅ Transcription completed: {len(full_text)} characters")
        
        return transcription_data
        
    except Exception as e:
        logger.error(f"❌ Transcription failed: {e}")
        raise

async def process_bert_filtering(transcription_data: Dict, session_dir: Path) -> str:
    """Step 2-3-4: Triplet 변환 → BERT 분류 → 필터링"""
    logger.info(f"\n{'='*60}")
    logger.info("STEP 2-3-4: Triplet Processing & BERT Filtering")
    logger.info(f"{'='*60}")
    
    full_text = transcription_data["full_text"]
    
    # BERT 모델 로드 시도
    load_bert_model()
    
    try:
        if triplet_processor and bert_classifier:
            logger.info("🔬 Starting Triplet + BERT processing...")
            
            # Step 2: WhisperX → Triplet 변환 (whisperX_parser.py + create_triplets.py)
            logger.info("📝 Step 2: Creating triplets...")
            triplets = triplet_processor.whisperx_to_triplets(transcription_data)
            
            # Step 2 저장: Triplet 구조
            step2_data = {
                "original_text": full_text,
                "triplets_count": len(triplets),
                "triplets": triplets,  # 전체 triplets 저장
                "segments_count": len(transcription_data.get("segments", []))
            }
            save_result("step2_triplet_creation.json", step2_data, session_dir)
            logger.info(f"✅ Step 2 완료: {len(transcription_data.get('segments', []))} segments → {len(triplets)} triplets")
            
            # Step 3: BERT 분류 (각 triplet에 label 부여)
            logger.info("🧠 Step 3: BERT classification...")
            classified_triplets = triplet_processor.classify_triplets(triplets)
            
            # 라벨별 분리
            label_0_triplets = [t for t in classified_triplets if t.get("label") == 0]  # 유효
            label_1_triplets = [t for t in classified_triplets if t.get("label") == 1]  # 노이즈
            
            # Step 3 저장: BERT 분류 결과
            step3_data = {
                "total_triplets": len(classified_triplets),
                "valid_count": len(label_0_triplets),
                "noise_count": len(label_1_triplets),
                "noise_ratio": len(label_1_triplets) / len(classified_triplets) if classified_triplets else 0,
                "valid_triplets": label_0_triplets,  # 전체 유효 triplets
                "noise_triplets": label_1_triplets   # 전체 노이즈 triplets
            }
            save_result("step3_bert_classification.json", step3_data, session_dir)
            
            # 라벨 1 (노이즈) 전체 저장
            save_result("step3_noise_triplets.json", label_1_triplets, session_dir)
            logger.info(f"✅ Step 3 완료: {len(label_0_triplets)} 유효, {len(label_1_triplets)} 노이즈")
            
            # Step 4: 필터링 (triplet_preprocessor.py - label 0만 추출)
            logger.info("🧹 Step 4: Filtering with triplet_preprocessor...")
            filtered_triplets = triplet_processor.filter_important_triplets(
                classified_triplets, 
                save_noise_log=True
            )
            
            # 필터링된 텍스트 재구성
            filtered_text = " ".join([
                t.get("text", t.get("target", "").replace("[TGT]", "").replace("[/TGT]", "").strip())
                for t in filtered_triplets
            ])
            
            # Step 4 저장: 최종 필터링 결과
            step4_data = {
                "filtered_text": filtered_text,
                "filtered_triplets_count": len(filtered_triplets),
                "original_length": len(full_text),
                "filtered_length": len(filtered_text),
                "reduction_ratio": 1 - (len(filtered_text) / len(full_text)) if full_text else 0,
                "filtered_triplets": filtered_triplets  # 전체 필터링된 triplets
            }
            save_result("step4_filtered_result.json", step4_data, session_dir)
            save_result("step4_filtered_text.txt", filtered_text, session_dir)
            
            logger.info(f"✅ BERT filtering complete: {len(full_text)} → {len(filtered_text)} chars ({100*(1-len(filtered_text)/len(full_text)):.1f}% 감소)")
            return filtered_text
            
        else:
            logger.warning("⚠️ BERT module not available, using original text")
            return full_text
            
    except Exception as e:
        logger.error(f"❌ BERT filtering error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return full_text

async def process_llm_postprocessing(filtered_text: str, session_dir: Path) -> str:
    """Step 5: LLM 후처리"""
    logger.info(f"\n{'='*60}")
    logger.info("STEP 5: LLM Post-processing")
    logger.info(f"{'='*60}")
    
    try:
        # 텍스트 정제
        cleaned_text = ' '.join(filtered_text.split())
        
        # 문장 정리
        sentences = cleaned_text.split('.')
        cleaned_sentences = []
        for sent in sentences:
            sent = sent.strip()
            if sent and len(sent) > 5:
                cleaned_sentences.append(sent + '.')
        
        # 단락 구성
        paragraphs = []
        current_para = []
        
        for sent in cleaned_sentences:
            current_para.append(sent)
            if len(current_para) >= 5:
                paragraphs.append(' '.join(current_para))
                current_para = []
        
        if current_para:
            paragraphs.append(' '.join(current_para))
        
        refined_text = '\n\n'.join(paragraphs)
        
        # 토큰 추정
        estimated_tokens = int(len(refined_text) * 1.5)
        
        postprocessing_data = {
            "original_filtered_text": filtered_text,  # 전체 필터링된 텍스트
            "refined_text": refined_text,  # 전체 정제된 텍스트
            "stats": {
                "original_length": len(filtered_text),
                "refined_length": len(refined_text),
                "sentence_count": len(cleaned_sentences),
                "paragraph_count": len(paragraphs),
                "estimated_tokens": estimated_tokens
            },
            "cleaned_sentences": cleaned_sentences,  # 전체 문장 리스트
            "paragraphs": paragraphs  # 전체 단락 리스트
        }
        
        save_result("step5_llm_postprocessing.json", postprocessing_data, session_dir)
        save_result("step5_llm_postprocessing.txt", refined_text, session_dir)
        
        logger.info(f"✅ Post-processing: {len(filtered_text)} → {len(refined_text)} chars")
        
        return refined_text
        
    except Exception as e:
        logger.error(f"❌ Post-processing error: {e}")
        return filtered_text

async def generate_notion_project(transcript: str, session_dir: Path) -> Dict:
    """Step 6: 노션 기획안 생성"""
    logger.info(f"\n{'='*60}")
    logger.info("STEP 6: Generating Notion Project")
    logger.info(f"{'='*60}")
    
    try:
        # Qwen 모델 로드
        load_qwen3()
        
        # 프롬프트 생성
        system_prompt = generate_meeting_analysis_system_prompt()
        user_prompt = generate_meeting_analysis_user_prompt(transcript)
        
        # 스키마 포함 프롬프트
        full_prompt = f"""
{system_prompt}

**Response Schema:**
{json.dumps(NOTION_PROJECT_SCHEMA, indent=2, ensure_ascii=False)}

{user_prompt}

**Response (JSON format):**
```json
"""
        
        logger.info("🧠 Generating with Qwen...")
        response = generate_with_qwen(full_prompt, max_tokens=2048)
        
        # JSON 파싱
        if "```json" in response:
            json_start = response.find("```json") + 7
            json_end = response.find("```", json_start)
            json_content = response[json_start:json_end].strip() if json_end != -1 else response[json_start:].strip()
        else:
            json_content = response.strip()
            if json_content.startswith("```"):
                json_content = json_content[3:]
            if json_content.endswith("```"):
                json_content = json_content[:-3]
        
        notion_project = json.loads(json_content)
        
        # 검증 및 포맷팅
        validated = validate_notion_project(notion_project)
        formatted = format_notion_project(validated)
        
        result = {
            "notion_project": validated,
            "formatted_notion": formatted
        }
        
        save_result("step6_notion_project.json", result, session_dir)
        save_result("step6_notion_project_formatted.md", formatted, session_dir)
        
        logger.info(f"✅ Notion project generated: {validated.get('projectName', 'Unknown')}")
        
        return validated
        
    except Exception as e:
        logger.error(f"❌ Notion generation error: {e}")
        return {}

async def generate_tasks(notion_project: Dict, session_dir: Path) -> List[Dict]:
    """Step 7: Task 생성"""
    logger.info(f"\n{'='*60}")
    logger.info("STEP 7: Generating Tasks and Subtasks")
    logger.info(f"{'='*60}")
    
    try:
        # Task Master PRD 생성
        system_prompt = "당신은 기획안을 Task Master PRD 형식으로 변환하는 전문가입니다."
        user_prompt = generate_task_master_prd_prompt(notion_project)
        
        full_prompt = f"""
{system_prompt}

**Response Schema:**
{json.dumps(TASK_MASTER_PRD_SCHEMA, indent=2, ensure_ascii=False)}

{user_prompt}

**Response (JSON format):**
```json
"""
        
        logger.info("🎯 Generating tasks with Qwen...")
        response = generate_with_qwen(full_prompt, max_tokens=3000)
        
        # JSON 파싱
        if "```json" in response:
            json_start = response.find("```json") + 7
            json_end = response.find("```", json_start)
            json_content = response[json_start:json_end].strip() if json_end != -1 else response[json_start:].strip()
        else:
            json_content = response.strip()
        
        prd_data = json.loads(json_content)
        
        # PRD에서 태스크 생성
        tasks = []
        for i, section in enumerate(prd_data.get("coreFunctionalities", [])):
            task = {
                "id": i + 1,
                "title": section.get("title", f"Task {i+1}"),
                "description": section.get("description", ""),
                "priority": section.get("priority", "medium"),
                "complexity_score": section.get("complexity", 5),
                "subtasks": []
            }
            
            # 서브태스크 생성
            for j, req in enumerate(section.get("requirements", [])[:3]):
                subtask = {
                    "id": j + 1,
                    "title": req,
                    "estimated_hours": 4
                }
                task["subtasks"].append(subtask)
            
            tasks.append(task)
        
        # 결과 저장
        tasks_data = {
            "prd": prd_data,
            "tasks": tasks,
            "task_count": len(tasks),
            "subtask_count": sum(len(t["subtasks"]) for t in tasks),
            "total_estimated_hours": sum(
                sum(st.get("estimated_hours", 0) for st in t["subtasks"])
                for t in tasks
            )
        }
        
        save_result("step7_tasks_and_subtasks.json", tasks_data, session_dir)
        
        # Task 요약 저장
        task_summary = "\n\n".join([
            f"## Task {t['id']}: {t['title']}\n" +
            f"Priority: {t['priority']}\n" +
            f"Complexity: {t['complexity_score']}/10\n" +
            f"Subtasks:\n" +
            "\n".join([f"  - {st['title']} ({st['estimated_hours']}h)" for st in t['subtasks']])
            for t in tasks
        ])
        save_result("step7_tasks_summary.md", task_summary, session_dir)
        
        logger.info(f"✅ Generated {len(tasks)} tasks with {tasks_data['subtask_count']} subtasks")
        
        return tasks
        
    except Exception as e:
        logger.error(f"❌ Task generation error: {e}")
        return []

async def process_file(input_file: str, input_type: str = "auto"):
    """메인 처리 함수"""
    # 세션 디렉토리 생성
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir = RESULT_DIR / f"session_{timestamp}"
    session_dir.mkdir(exist_ok=True)
    
    logger.info(f"\n{'='*70}")
    logger.info(f"🚀 TtalKkak Pipeline Processing")
    logger.info(f"{'='*70}")
    logger.info(f"📁 Input: {input_file}")
    logger.info(f"📂 Output: {session_dir}")
    
    start_time = time.time()
    
    try:
        # 입력 타입 자동 감지
        if input_type == "auto":
            if input_file.lower().endswith(('.mp3', '.wav', '.m4a', '.mp4')):
                input_type = "audio"
            else:
                input_type = "text"
        
        # Step 1: 입력 처리
        if input_type == "audio":
            transcription_data = await process_audio_file(input_file, session_dir)
            full_text = transcription_data["full_text"]
        else:
            # 텍스트 파일 읽기
            with open(input_file, 'r', encoding='utf-8') as f:
                full_text = f.read()
            
            transcription_data = {
                "full_text": full_text,
                "character_count": len(full_text)
            }
            save_result("step1_input_text.txt", full_text, session_dir)
        
        # Step 2-3: BERT 필터링
        filtered_text = await process_bert_filtering(transcription_data, session_dir)
        
        # Step 4: LLM 후처리
        refined_text = await process_llm_postprocessing(filtered_text, session_dir)
        
        # Step 5: 노션 기획안 생성
        notion_project = await generate_notion_project(refined_text, session_dir)
        
        # Step 6: Task 생성
        tasks = await generate_tasks(notion_project, session_dir)
        
        # 최종 요약
        total_time = time.time() - start_time
        
        summary = {
            "session_id": timestamp,
            "input_file": input_file,
            "input_type": input_type,
            "processing_time": total_time,
            "steps_completed": [
                "transcription" if input_type == "audio" else "text_input",
                "bert_filtering",
                "llm_postprocessing",
                "notion_generation",
                "task_generation"
            ],
            "statistics": {
                "original_length": len(transcription_data["full_text"]),
                "filtered_length": len(filtered_text),
                "refined_length": len(refined_text),
                "filtering_ratio": 1 - (len(filtered_text) / len(transcription_data["full_text"])),
                "task_count": len(tasks),
                "subtask_count": sum(len(t.get("subtasks", [])) for t in tasks)
            },
            "output_directory": str(session_dir),
            "timestamp": datetime.now().isoformat()
        }
        
        save_result("pipeline_summary.json", summary, session_dir)
        
        logger.info(f"\n{'='*70}")
        logger.info("✅ PROCESSING COMPLETED")
        logger.info(f"{'='*70}")
        logger.info(f"⏱️  Total time: {total_time:.2f} seconds")
        logger.info(f"📊 Statistics:")
        logger.info(f"   - Text reduction: {summary['statistics']['filtering_ratio']:.1%}")
        logger.info(f"   - Tasks created: {summary['statistics']['task_count']}")
        logger.info(f"   - Subtasks: {summary['statistics']['subtask_count']}")
        logger.info(f"📁 Results saved to: {session_dir}")
        
        return summary
        
    except Exception as e:
        logger.error(f"❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        
        # 에러 요약 저장
        error_summary = {
            "session_id": timestamp,
            "input_file": input_file,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat()
        }
        save_result("error_summary.json", error_summary, session_dir)
        
        return error_summary

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description="TtalKkak Pipeline File Processor")
    parser.add_argument("input_file", help="Input audio or text file path")
    parser.add_argument("--type", choices=["audio", "text", "auto"], default="auto",
                      help="Input file type (default: auto-detect)")
    parser.add_argument("--use-vllm", action="store_true", 
                      help="Use VLLM for faster inference")
    parser.add_argument("--output-dir", default="pipeline_results",
                      help="Output directory for results")
    
    args = parser.parse_args()
    
    # 환경 변수 설정
    if args.use_vllm:
        os.environ["USE_VLLM"] = "true"
    
    global RESULT_DIR
    RESULT_DIR = Path(args.output_dir)
    RESULT_DIR.mkdir(exist_ok=True)
    
    # 입력 파일 확인
    if not os.path.exists(args.input_file):
        logger.error(f"❌ Input file not found: {args.input_file}")
        sys.exit(1)
    
    # GPU 정보 출력
    if torch.cuda.is_available():
        logger.info(f"🎮 GPU: {torch.cuda.get_device_name()}")
        logger.info(f"💾 VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    else:
        logger.info("⚠️ No GPU detected, using CPU")
    
    # 비동기 처리 실행
    asyncio.run(process_file(args.input_file, args.type))

if __name__ == "__main__":
    main()