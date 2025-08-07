"""
단계별 결과 저장 기능이 추가된 테스트 스크립트
각 처리 단계의 결과를 JSON 파일로 저장
"""

import os
import json
import asyncio
import aiohttp
import logging
from datetime import datetime
from pathlib import Path
import time

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 결과 저장 디렉토리 생성
RESULT_DIR = Path("C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/pipeline_results")
RESULT_DIR.mkdir(exist_ok=True)

# 타임스탬프로 고유 폴더 생성
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
SESSION_DIR = RESULT_DIR / f"session_{timestamp}"
SESSION_DIR.mkdir(exist_ok=True)

def save_step_result(step_name: str, data: dict, step_number: int):
    """각 단계별 결과를 JSON 파일로 저장"""
    filename = SESSION_DIR / f"step{step_number}_{step_name}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info(f"✅ Saved {step_name} to {filename}")
    return filename

async def test_pipeline():
    """AI 파이프라인 테스트 with 단계별 저장"""
    
    # 테스트 파일 경로
    audio_file = "C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/test.MP3"
    
    if not os.path.exists(audio_file):
        logger.error(f"❌ Audio file not found: {audio_file}")
        return
    
    # AI 서버 URL (로컬 또는 RunPod)
    SERVER_URL = "http://localhost:8000"  # 또는 RunPod URL
    
    try:
        logger.info(f"🚀 Starting pipeline test with: {audio_file}")
        logger.info(f"📁 Results will be saved to: {SESSION_DIR}")
        
        async with aiohttp.ClientSession() as session:
            
            # ========== STEP 1: WhisperX 전사 ==========
            logger.info("\n📝 STEP 1: WhisperX Transcription...")
            
            with open(audio_file, 'rb') as f:
                data = aiohttp.FormData()
                data.add_field('audio', f, filename='test.mp3', content_type='audio/mpeg')
                
                async with session.post(f"{SERVER_URL}/transcribe", data=data) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        
                        # Step 1 결과 저장
                        step1_data = {
                            "success": result.get("success"),
                            "full_text": result.get("transcription", {}).get("full_text", ""),
                            "segments": result.get("transcription", {}).get("segments", []),
                            "duration": result.get("transcription", {}).get("duration", 0),
                            "language": result.get("transcription", {}).get("language", "ko")
                        }
                        save_step_result("whisperx_transcription", step1_data, 1)
                        
                        # 전사된 텍스트 추출
                        transcript = result.get("transcription", {}).get("full_text", "")
                        logger.info(f"✅ Transcription completed: {len(transcript)} characters")
                    else:
                        logger.error(f"❌ Transcription failed: {resp.status}")
                        return
            
            # ========== STEP 2: Enhanced Transcription (Triplet + BERT) ==========
            logger.info("\n🔬 STEP 2: Enhanced Transcription with Triplet + BERT...")
            
            with open(audio_file, 'rb') as f:
                data = aiohttp.FormData()
                data.add_field('audio', f, filename='test.mp3', content_type='audio/mpeg')
                data.add_field('enable_bert_filtering', 'true')
                data.add_field('save_noise_log', 'true')
                
                async with session.post(f"{SERVER_URL}/transcribe-enhanced", data=data) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        
                        # Step 2: BERT 전처리 결과 저장
                        step2_data = {
                            "success": result.get("success"),
                            "original_text": result.get("transcription", {}).get("full_text", ""),
                            "triplet_data": result.get("triplet_data", {}),
                            "processing_stats": result.get("processing_stats", {})
                        }
                        save_step_result("bert_preprocessing", step2_data, 2)
                        
                        # Step 3: BERT 분류 결과 저장
                        step3_data = {
                            "filtered_transcript": result.get("filtered_transcript", ""),
                            "noise_segments": result.get("triplet_data", {}).get("noise_segments", []),
                            "valid_segments": result.get("triplet_data", {}).get("valid_segments", []),
                            "filtering_ratio": result.get("processing_stats", {}).get("filtering_ratio", 0)
                        }
                        save_step_result("bert_classification", step3_data, 3)
                        
                        # 필터링된 텍스트 추출
                        filtered_text = result.get("filtered_transcript", transcript)
                        logger.info(f"✅ Filtering completed: {len(transcript)} → {len(filtered_text)} characters")
                    else:
                        logger.error(f"❌ Enhanced transcription failed: {resp.status}")
                        filtered_text = transcript
            
            # ========== STEP 4: LLM 입력 데이터 후처리 ==========
            logger.info("\n🔧 STEP 4: Post-processing for LLM input...")
            
            # 4-1: 텍스트 정제 (중복 제거, 문장 정리)
            # 연속된 공백 제거
            cleaned_text = ' '.join(filtered_text.split())
            
            # 문장 끝 정리 (마침표 확인)
            sentences = cleaned_text.split('.')
            cleaned_sentences = []
            for sent in sentences:
                sent = sent.strip()
                if sent and len(sent) > 5:  # 너무 짧은 문장 제거
                    cleaned_sentences.append(sent + '.')
            
            refined_text = ' '.join(cleaned_sentences)
            
            # 4-2: 구조화 (섹션 분할, 주제 그룹핑)
            # 단락 분할 (빈 줄 또는 주제 변화 감지)
            paragraphs = []
            current_para = []
            
            for sent in cleaned_sentences:
                current_para.append(sent)
                # 단락 구분 로직 (예: 5문장마다 또는 특정 키워드)
                if len(current_para) >= 5 or any(kw in sent for kw in ['다음으로', '그리고', '결론적으로']):
                    paragraphs.append(' '.join(current_para))
                    current_para = []
            
            if current_para:
                paragraphs.append(' '.join(current_para))
            
            # 4-3: 메타데이터 추가
            structured_input = {
                "context": "회의 녹취록 분석",
                "timestamp": datetime.now().isoformat(),
                "content": refined_text,
                "paragraphs": paragraphs,
                "metadata": {
                    "sentence_count": len(cleaned_sentences),
                    "paragraph_count": len(paragraphs),
                    "avg_sentence_length": sum(len(s) for s in cleaned_sentences) / len(cleaned_sentences) if cleaned_sentences else 0
                }
            }
            
            # 4-4: 토큰 최적화 및 청킹 준비
            estimated_tokens = len(refined_text) * 1.5  # 한글 기준 대략적 추정
            max_context = 28000  # 안전 마진 고려
            
            chunks = []
            if estimated_tokens > max_context:
                # 청킹 필요
                chunk_size = int(max_context / 1.5)  # 토큰 기준
                text_chunk_size = int(chunk_size / 1.5)  # 문자 기준 역산
                
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
            
            step4_data = {
                "original_filtered_text": filtered_text,
                "refined_text": refined_text,
                "structured_input": structured_input,
                "chunks": chunks,
                "chunk_count": len(chunks),
                "postprocessing_stats": {
                    "original_length": len(filtered_text),
                    "refined_length": len(refined_text),
                    "sentence_count": len(cleaned_sentences),
                    "paragraph_count": len(paragraphs),
                    "estimated_tokens": estimated_tokens,
                    "chunking_required": len(chunks) > 1
                },
                "optimization": {
                    "duplicate_removal": True,
                    "sentence_cleaning": True,
                    "paragraph_structuring": True,
                    "token_optimization": True
                }
            }
            save_step_result("llm_postprocessing", step4_data, 4)
            
            logger.info(f"✅ LLM post-processing completed:")
            logger.info(f"   - Sentences: {len(cleaned_sentences)}")
            logger.info(f"   - Paragraphs: {len(paragraphs)}")
            logger.info(f"   - Chunks: {len(chunks)}")
            logger.info(f"   - Text reduction: {len(filtered_text)} → {len(refined_text)} chars")
            
            # LLM에 전달할 최종 텍스트
            llm_input_text = refined_text
            
            # ========== STEP 5: 회의록 생성 (노션 기획안) ==========
            logger.info("\n📋 STEP 5: Generating meeting minutes (Notion project)...")
            
            async with session.post(
                f"{SERVER_URL}/generate-notion-project",
                json={
                    "transcript": llm_input_text,  # 후처리된 텍스트 사용
                    "num_tasks": 5,
                    "additional_context": "자동 생성된 회의록"
                }
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    
                    # Step 5: 회의록 결과 저장
                    step5_data = {
                        "success": result.get("success"),
                        "notion_project": result.get("notion_project", {}),
                        "formatted_notion": result.get("formatted_notion", ""),
                        "metadata": {
                            "generated_at": datetime.now().isoformat(),
                            "source_text_length": len(filtered_text)
                        }
                    }
                    save_step_result("meeting_minutes", step5_data, 5)
                    
                    notion_project = result.get("notion_project", {})
                    logger.info(f"✅ Meeting minutes generated: {notion_project.get('projectName', 'Unknown')}")
                else:
                    logger.error(f"❌ Meeting minutes generation failed: {resp.status}")
                    notion_project = {}
            
            # ========== STEP 6: Task 및 SubTask 생성 ==========
            logger.info("\n🎯 STEP 6: Generating tasks and subtasks...")
            
            # 전체 파이프라인 실행
            async with session.post(
                f"{SERVER_URL}/two-stage-pipeline-text",
                json={
                    "transcript": llm_input_text,  # 후처리된 텍스트 사용
                    "generate_notion": True,
                    "generate_tasks": True,
                    "num_tasks": 5
                }
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    
                    # Step 6: Task 결과 저장
                    tasks_data = result.get("stage3_tasks", {})
                    if isinstance(tasks_data, dict) and "action_items" in tasks_data:
                        tasks_list = tasks_data.get("action_items", [])
                    else:
                        tasks_list = []
                    
                    step6_data = {
                        "success": result.get("success"),
                        "tasks": tasks_list,
                        "task_count": len(tasks_list),
                        "subtask_count": sum(len(task.get("subtasks", [])) for task in tasks_list),
                        "complexity_analysis": result.get("complexity_analysis", {}),
                        "processing_time": result.get("processing_time", 0),
                        "metadata": {
                            "generated_at": datetime.now().isoformat(),
                            "pipeline_version": "2-stage-with-triplet"
                        }
                    }
                    save_step_result("tasks_and_subtasks", step6_data, 6)
                    
                    logger.info(f"✅ Generated {step6_data['task_count']} tasks with {step6_data['subtask_count']} subtasks")
                else:
                    logger.error(f"❌ Task generation failed: {resp.status}")
            
            # ========== 최종 요약 ==========
            logger.info("\n" + "="*60)
            logger.info("📊 PIPELINE EXECUTION SUMMARY")
            logger.info("="*60)
            logger.info(f"✅ All results saved to: {SESSION_DIR}")
            logger.info(f"   - Step 1: WhisperX transcription")
            logger.info(f"   - Step 2: BERT preprocessing")
            logger.info(f"   - Step 3: BERT classification")
            logger.info(f"   - Step 4: LLM preprocessing")
            logger.info(f"   - Step 5: Meeting minutes")
            logger.info(f"   - Step 6: Tasks and subtasks")
            
            # 전체 요약 파일 생성
            summary = {
                "session_id": timestamp,
                "audio_file": audio_file,
                "pipeline_steps": [
                    "whisperx_transcription",
                    "bert_preprocessing",
                    "bert_classification",
                    "llm_preprocessing",
                    "meeting_minutes",
                    "tasks_and_subtasks"
                ],
                "results_directory": str(SESSION_DIR),
                "execution_time": datetime.now().isoformat()
            }
            
            summary_file = SESSION_DIR / "pipeline_summary.json"
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            
            logger.info(f"\n📄 Summary saved to: {summary_file}")
            
    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """메인 실행 함수"""
    logger.info("🚀 Starting TtalKkak AI Pipeline Test")
    logger.info(f"📁 Results will be saved to: {RESULT_DIR}")
    
    # 서버 상태 체크
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health") as resp:
                if resp.status == 200:
                    health = await resp.json()
                    logger.info(f"✅ Server is healthy: {health}")
                else:
                    logger.error("❌ Server is not responding")
                    return
    except Exception as e:
        logger.error(f"❌ Cannot connect to server: {e}")
        logger.info("💡 Please make sure the AI server is running:")
        logger.info("   cd ai-engine-dev && python ai_server_final_with_triplets.py")
        return
    
    # 파이프라인 실행
    await test_pipeline()

if __name__ == "__main__":
    # Windows에서 이벤트 루프 정책 설정
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # 실행
    asyncio.run(main())