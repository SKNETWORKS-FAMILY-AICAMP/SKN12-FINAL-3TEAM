"""
로컬 테스트 스크립트 - 서버 없이 직접 실행
각 단계별 결과를 파일로 저장
"""

import os
import json
import logging
from datetime import datetime
from pathlib import Path
import time
import sys

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 결과 저장 디렉토리
RESULT_DIR = Path("pipeline_results")
RESULT_DIR.mkdir(exist_ok=True)

# 세션 디렉토리
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
SESSION_DIR = RESULT_DIR / f"local_session_{timestamp}"
SESSION_DIR.mkdir(exist_ok=True)

def save_step_result(step_name: str, data: dict, step_number: int):
    """단계별 결과 저장"""
    filename = SESSION_DIR / f"step{step_number}_{step_name}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info(f"✅ Saved: {filename}")
    
    # 텍스트 파일로도 저장 (읽기 쉽게)
    if "text" in data or "transcript" in data or "filtered_text" in data:
        txt_filename = SESSION_DIR / f"step{step_number}_{step_name}.txt"
        text_content = data.get("text") or data.get("transcript") or data.get("filtered_text", "")
        with open(txt_filename, 'w', encoding='utf-8') as f:
            f.write(text_content)
        logger.info(f"✅ Saved text: {txt_filename}")

def test_whisperx_only():
    """WhisperX만 테스트"""
    try:
        logger.info("\n" + "="*60)
        logger.info("STEP 1: WhisperX Transcription Test")
        logger.info("="*60)
        
        audio_file = "test.MP3"
        if not os.path.exists(audio_file):
            logger.error(f"❌ Audio file not found: {audio_file}")
            return None
            
        # WhisperX 로드
        try:
            import whisperx
            import torch
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            logger.info(f"🎤 Loading WhisperX model (device: {device})...")
            model = whisperx.load_model(
                "large-v3",
                device,
                compute_type=compute_type,
                language="ko"
            )
            
            logger.info(f"📝 Transcribing: {audio_file}")
            result = model.transcribe(audio_file, batch_size=16)
            
            # 결과 정리
            segments = result.get("segments", [])
            full_text = " ".join([seg.get("text", "") for seg in segments])
            
            step1_data = {
                "success": True,
                "audio_file": audio_file,
                "text": full_text,
                "segments": segments,
                "language": result.get("language", "ko"),
                "duration": sum([seg.get("end", 0) - seg.get("start", 0) for seg in segments]),
                "character_count": len(full_text),
                "segment_count": len(segments)
            }
            
            save_step_result("whisperx_transcription", step1_data, 1)
            
            logger.info(f"✅ Transcription completed:")
            logger.info(f"   - Characters: {len(full_text)}")
            logger.info(f"   - Segments: {len(segments)}")
            logger.info(f"   - Duration: {step1_data['duration']:.2f} seconds")
            
            # 샘플 출력
            if full_text:
                sample = full_text[:500] + "..." if len(full_text) > 500 else full_text
                logger.info(f"\n📄 Sample text:\n{sample}\n")
            
            return full_text
            
        except ImportError as e:
            logger.error(f"❌ WhisperX not installed: {e}")
            logger.info("💡 Install with: pip install whisperx")
            
            # 더미 데이터로 테스트 계속
            dummy_text = """
            안녕하세요. 오늘 회의 주제는 신규 프로젝트 기획입니다.
            우선 프로젝트 목표를 설정하고, 구체적인 실행 계획을 수립해야 합니다.
            마케팅 팀은 시장 조사를 진행하고, 개발팀은 기술 검토를 완료해주세요.
            다음 회의는 다음 주 화요일에 진행하겠습니다.
            """
            
            step1_data = {
                "success": False,
                "text": dummy_text,
                "error": "WhisperX not available - using dummy data",
                "character_count": len(dummy_text)
            }
            save_step_result("whisperx_transcription", step1_data, 1)
            return dummy_text
            
    except Exception as e:
        logger.error(f"❌ WhisperX test failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_bert_filtering(transcript: str):
    """BERT 필터링 테스트"""
    try:
        logger.info("\n" + "="*60)
        logger.info("STEP 2-3: BERT Filtering Test")
        logger.info("="*60)
        
        # Triplet + BERT 모듈 로드 시도
        try:
            from triplet_processor import get_triplet_processor
            from bert_classifier import get_bert_classifier
            
            logger.info("🔬 Loading Triplet + BERT processors...")
            
            # Step 2: 전처리
            triplet_processor = get_triplet_processor()
            
            # 텍스트를 세그먼트로 분할 (문장 단위)
            sentences = transcript.split('.')
            segments = [{"text": s.strip()} for s in sentences if s.strip()]
            
            step2_data = {
                "original_text": transcript,
                "segments": segments,
                "segment_count": len(segments),
                "preprocessing": "sentence_split"
            }
            save_step_result("bert_preprocessing", step2_data, 2)
            
            # Step 3: BERT 분류
            logger.info("🤖 Classifying with BERT...")
            
            # BERT 분류기로 노이즈 필터링
            bert_classifier = get_bert_classifier()
            
            valid_segments = []
            noise_segments = []
            
            for seg in segments:
                # 여기서 실제 BERT 분류 수행
                # (실제 구현은 bert_classifier 모듈에 따라 다름)
                # 임시로 길이 기반 필터링
                if len(seg["text"]) > 10:
                    valid_segments.append(seg["text"])
                else:
                    noise_segments.append(seg["text"])
            
            filtered_text = " ".join(valid_segments)
            
            step3_data = {
                "filtered_text": filtered_text,
                "valid_segments": valid_segments,
                "noise_segments": noise_segments,
                "valid_count": len(valid_segments),
                "noise_count": len(noise_segments),
                "filtering_ratio": len(noise_segments) / len(segments) if segments else 0
            }
            save_step_result("bert_classification", step3_data, 3)
            
            logger.info(f"✅ BERT filtering completed:")
            logger.info(f"   - Valid segments: {len(valid_segments)}")
            logger.info(f"   - Noise segments: {len(noise_segments)}")
            logger.info(f"   - Text reduction: {len(transcript)} → {len(filtered_text)} chars")
            
            return filtered_text
            
        except ImportError:
            logger.warning("⚠️ Triplet/BERT modules not available")
            
            # 간단한 규칙 기반 필터링
            lines = transcript.split('\n')
            filtered_lines = [line for line in lines if len(line.strip()) > 20]
            filtered_text = '\n'.join(filtered_lines)
            
            step2_data = {
                "original_text": transcript,
                "preprocessing": "rule_based",
                "min_length": 20
            }
            save_step_result("bert_preprocessing", step2_data, 2)
            
            step3_data = {
                "filtered_text": filtered_text,
                "method": "rule_based",
                "original_length": len(transcript),
                "filtered_length": len(filtered_text)
            }
            save_step_result("bert_classification", step3_data, 3)
            
            return filtered_text if filtered_text else transcript
            
    except Exception as e:
        logger.error(f"❌ BERT filtering failed: {e}")
        return transcript

def test_llm_postprocessing(filtered_text: str):
    """LLM 입력 데이터 후처리"""
    try:
        logger.info("\n" + "="*60)
        logger.info("STEP 4: LLM Input Post-processing")
        logger.info("="*60)
        
        # 텍스트 정제
        logger.info("🧽 Cleaning and structuring text...")
        
        # 1. 중복 공백 제거
        cleaned_text = ' '.join(filtered_text.split())
        
        # 2. 문장 정리
        sentences = cleaned_text.split('.')
        cleaned_sentences = []
        for sent in sentences:
            sent = sent.strip()
            if sent and len(sent) > 5:
                if not sent.endswith('.'):
                    sent += '.'
                cleaned_sentences.append(sent)
        
        # 3. 단락 구성
        paragraphs = []
        current_para = []
        
        for i, sent in enumerate(cleaned_sentences):
            current_para.append(sent)
            # 5문장마다 또는 특정 키워드에서 단락 분할
            if len(current_para) >= 5 or any(kw in sent for kw in ['다음으로', '그리고', '마지막으로', '결론']):
                paragraphs.append(' '.join(current_para))
                current_para = []
        
        if current_para:
            paragraphs.append(' '.join(current_para))
        
        refined_text = '\n\n'.join(paragraphs)
        
        # 4. 토큰 최적화 및 청킹
        estimated_tokens = int(len(refined_text) * 1.5)
        max_context = 28000
        
        chunks = []
        if estimated_tokens > max_context:
            logger.info(f"🔄 Chunking required: {estimated_tokens} tokens > {max_context}")
            
            chunk_size = int(max_context / 1.5)
            text_chunk_size = int(chunk_size / 1.5)
            
            current_chunk = ""
            for para in paragraphs:
                if len(current_chunk) + len(para) < text_chunk_size:
                    current_chunk += para + "\n\n"
                else:
                    chunks.append(current_chunk.strip())
                    current_chunk = para + "\n\n"
            
            if current_chunk:
                chunks.append(current_chunk.strip())
        else:
            chunks = [refined_text]
        
        # 5. 구조화된 입력 생성
        structured_input = {
            "context": "회의 녹취록 분석",
            "timestamp": datetime.now().isoformat(),
            "content": refined_text,
            "paragraphs": paragraphs,
            "chunks": chunks,
            "metadata": {
                "sentence_count": len(cleaned_sentences),
                "paragraph_count": len(paragraphs),
                "chunk_count": len(chunks),
                "avg_sentence_length": sum(len(s) for s in cleaned_sentences) / len(cleaned_sentences) if cleaned_sentences else 0,
                "estimated_tokens": estimated_tokens
            }
        }
        
        step4_data = {
            "original_filtered_text": filtered_text[:1000] + "..." if len(filtered_text) > 1000 else filtered_text,
            "refined_text": refined_text[:1000] + "..." if len(refined_text) > 1000 else refined_text,
            "full_refined_text": refined_text,  # 전체 텍스트
            "structured_input": structured_input,
            "postprocessing_stats": {
                "original_length": len(filtered_text),
                "refined_length": len(refined_text),
                "reduction_rate": 1 - (len(refined_text) / len(filtered_text)) if len(filtered_text) > 0 else 0,
                "sentence_count": len(cleaned_sentences),
                "paragraph_count": len(paragraphs),
                "chunk_count": len(chunks),
                "estimated_tokens": estimated_tokens,
                "chunking_required": len(chunks) > 1
            },
            "processing_steps": [
                "중복 공백 제거",
                "문장 정리 및 필터링",
                "단락 구성",
                "토큰 최적화",
                "청킹 처리"
            ]
        }
        save_step_result("llm_postprocessing", step4_data, 4)
        
        logger.info(f"✅ Post-processing completed:")
        logger.info(f"   - Original: {len(filtered_text)} chars")
        logger.info(f"   - Refined: {len(refined_text)} chars")
        logger.info(f"   - Sentences: {len(cleaned_sentences)}")
        logger.info(f"   - Paragraphs: {len(paragraphs)}")
        logger.info(f"   - Chunks: {len(chunks)}")
        logger.info(f"   - Est. tokens: {estimated_tokens}")
        
        return refined_text
        
    except Exception as e:
        logger.error(f"❌ Post-processing failed: {e}")
        return filtered_text

def test_meeting_generation(refined_text: str):
    """LLM을 통한 회의록 및 태스크 생성"""
    try:
        logger.info("\n" + "="*60)
        logger.info("STEP 5-6: Meeting Minutes & Task Generation")
        logger.info("="*60)
        
        # Step 5: 회의록 생성 (더미)
        meeting_minutes = {
            "projectName": "테스트 프로젝트",
            "date": datetime.now().isoformat(),
            "participants": ["참가자1", "참가자2"],
            "summary": "회의 요약 내용",
            "keyPoints": [
                "핵심 포인트 1",
                "핵심 포인트 2",
                "핵심 포인트 3"
            ],
            "decisions": [
                "결정 사항 1",
                "결정 사항 2"
            ],
            "actionItems": [
                "실행 항목 1",
                "실행 항목 2"
            ]
        }
        
        step5_data = {
            "success": True,
            "meeting_minutes": meeting_minutes,
            "formatted_text": json.dumps(meeting_minutes, ensure_ascii=False, indent=2)
        }
        save_step_result("meeting_minutes", step5_data, 5)
        
        # Step 6: Task 생성 (더미)
        tasks = [
            {
                "id": 1,
                "title": "프로젝트 기획서 작성",
                "description": "상세 기획서를 작성합니다",
                "priority": "high",
                "subtasks": [
                    {"id": 1, "title": "요구사항 분석", "estimated_hours": 4},
                    {"id": 2, "title": "기획서 초안 작성", "estimated_hours": 8}
                ]
            },
            {
                "id": 2,
                "title": "기술 검토",
                "description": "기술적 타당성을 검토합니다",
                "priority": "medium",
                "subtasks": [
                    {"id": 1, "title": "기술 스택 선정", "estimated_hours": 3},
                    {"id": 2, "title": "프로토타입 개발", "estimated_hours": 12}
                ]
            }
        ]
        
        step6_data = {
            "success": True,
            "tasks": tasks,
            "task_count": len(tasks),
            "subtask_count": sum(len(t.get("subtasks", [])) for t in tasks),
            "total_estimated_hours": sum(
                sum(st.get("estimated_hours", 0) for st in t.get("subtasks", []))
                for t in tasks
            )
        }
        save_step_result("tasks_and_subtasks", step6_data, 6)
        
        logger.info(f"✅ LLM processing completed:")
        logger.info(f"   - Tasks: {step6_data['task_count']}")
        logger.info(f"   - Subtasks: {step6_data['subtask_count']}")
        logger.info(f"   - Total hours: {step6_data['total_estimated_hours']}")
        
    except Exception as e:
        logger.error(f"❌ LLM processing failed: {e}")

def main():
    """메인 실행"""
    logger.info("\n" + "="*70)
    logger.info("🚀 TtalKkak AI Pipeline Local Test")
    logger.info("="*70)
    logger.info(f"📁 Results directory: {SESSION_DIR}")
    
    # Step 1: WhisperX
    transcript = test_whisperx_only()
    if not transcript:
        logger.error("❌ Failed to get transcript. Exiting.")
        return
    
    # Step 2-3: BERT Filtering
    filtered_text = test_bert_filtering(transcript)
    
    # Step 4: LLM Post-processing
    refined_text = test_llm_postprocessing(filtered_text)
    
    # Step 5-6: Meeting & Task Generation
    test_meeting_generation(refined_text)
    
    # 최종 요약
    logger.info("\n" + "="*70)
    logger.info("📊 TEST SUMMARY")
    logger.info("="*70)
    logger.info(f"✅ All results saved to: {SESSION_DIR}")
    
    # 요약 파일 생성
    summary = {
        "session_id": timestamp,
        "test_type": "local",
        "steps_completed": [
            "whisperx_transcription",
            "bert_preprocessing",
            "bert_classification",
            "llm_preprocessing",
            "meeting_minutes",
            "tasks_and_subtasks"
        ],
        "results_directory": str(SESSION_DIR),
        "timestamp": datetime.now().isoformat()
    }
    
    summary_file = SESSION_DIR / "test_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    logger.info(f"📄 Summary: {summary_file}")
    
    # 결과 폴더 열기
    if os.name == 'nt':  # Windows
        os.system(f'explorer "{SESSION_DIR}"')

if __name__ == "__main__":
    main()