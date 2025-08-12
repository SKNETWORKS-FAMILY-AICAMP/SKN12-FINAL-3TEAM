#!/usr/bin/env python3
"""
메인 게이트웨이 서버 (포트 8000)
ai_server_final_with_triplets.py와 동일한 인터페이스 제공
내부적으로 WhisperX 서버(8001)와 Qwen+BERT+Triplet 서버(8002)로 라우팅
"""

import os
import sys
import json
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import time
import httpx
import asyncio

import torch
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 로컬 모듈 임포트 경로 추가
sys.path.append('/workspace/SKN12-FINAL-3TEAM/ai-engine-dev')

# 로컬 모듈 임포트 (원본과 동일)
from task_schemas import (
    TaskItem, SubTask, MeetingAnalysisResult, ComplexityAnalysis,
    TaskExpansionRequest, TaskExpansionResult, PipelineRequest, PipelineResult
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 서브 서버 URL
WHISPER_SERVER = "http://localhost:8001"
QWEN_BERT_SERVER = "http://localhost:8002"

# 응답 모델들 (원본과 동일)
class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AnalysisRequest(BaseModel):
    transcript: str
    num_tasks: int = 5
    additional_context: Optional[str] = None

class AnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[MeetingAnalysisResult] = None
    error: Optional[str] = None

class NotionProjectResponse(BaseModel):
    success: bool
    notion_project: Optional[Dict[str, Any]] = None
    formatted_notion: Optional[str] = None
    error: Optional[str] = None

class TaskMasterPRDResponse(BaseModel):
    success: bool
    prd_data: Optional[Dict[str, Any]] = None
    formatted_prd: Optional[str] = None
    error: Optional[str] = None

class TwoStageAnalysisRequest(BaseModel):
    transcript: str
    generate_notion: bool = True
    generate_tasks: bool = True
    num_tasks: int = 5
    additional_context: Optional[str] = None
    auto_expand_tasks: bool = True

class TwoStageAnalysisResponse(BaseModel):
    success: bool
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

class EnhancedTranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    triplet_data: Optional[Dict[str, Any]] = None
    filtered_transcript: Optional[str] = None
    processing_stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class EnhancedTwoStageResult(BaseModel):
    success: bool
    triplet_stats: Optional[Dict[str, Any]] = None
    classification_stats: Optional[Dict[str, Any]] = None
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    original_transcript_length: Optional[int] = None
    filtered_transcript_length: Optional[int] = None
    noise_reduction_ratio: Optional[float] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    gpu_count: int
    models_loaded: Dict[str, bool]
    memory_info: Optional[Dict[str, float]] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리"""
    # 시작 시
    logger.info("🚀 Starting TtalKkak Gateway Server...")
    
    # 서브 서버 헬스 체크
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            whisper_health = await client.get(f"{WHISPER_SERVER}/health")
            logger.info(f"✅ WhisperX server: {whisper_health.json()['status']}")
        except:
            logger.warning("⚠️ WhisperX server not responding")
        
        try:
            qwen_health = await client.get(f"{QWEN_BERT_SERVER}/health")
            logger.info(f"✅ Qwen+BERT server: {qwen_health.json()['status']}")
        except:
            logger.warning("⚠️ Qwen+BERT server not responding")
    
    yield
    
    # 종료 시
    logger.info("👋 Shutting down gateway server...")

# FastAPI 앱 생성 (원본과 동일한 설정)
app = FastAPI(
    title="TtalKkak Final AI Server with Triplets",
    description="WhisperX + Triplet + BERT + Qwen3-4B + 2-Stage PRD Process",
    version="3.1.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """루트 엔드포인트 (원본과 동일)"""
    return {
        "message": "TtalKkak Final AI Server with Triplets",
        "version": "3.1.0",
        "features": [
            "WhisperX Speech-to-Text",
            "Triplet Context Analysis",
            "BERT Noise Filtering",
            "2-Stage PRD Process",
            "Notion Project Generation",
            "Task Master PRD Format",
            "Advanced Task Generation"
        ],
        "workflow": "회의록 → Triplet 필터링 → 기획안 → Task Master PRD → 업무생성",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스 체크 (모든 서버 상태 통합)"""
    gpu_available = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if gpu_available else 0
    
    memory_info = None
    if gpu_available:
        try:
            memory_info = {
                "allocated_gb": torch.cuda.memory_allocated() / 1024**3,
                "reserved_gb": torch.cuda.memory_reserved() / 1024**3,
                "total_gb": torch.cuda.get_device_properties(0).total_memory / 1024**3
            }
        except:
            pass
    
    models_loaded = {
        "whisperx": False,
        "qwen3": False,
        "triplet_bert": False
    }
    
    # 서브 서버 상태 확인
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            whisper_status = await client.get(f"{WHISPER_SERVER}/models/status")
            models_loaded["whisperx"] = whisper_status.json()["whisperx"]["loaded"]
        except:
            pass
        
        try:
            qwen_status = await client.get(f"{QWEN_BERT_SERVER}/models/status")
            qwen_data = qwen_status.json()
            models_loaded["qwen3"] = qwen_data["qwen3"]["loaded"]
            models_loaded["triplet_bert"] = qwen_data["bert"]["loaded"] or qwen_data["triplet"]["loaded"]
        except:
            pass
    
    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        gpu_count=gpu_count,
        models_loaded=models_loaded,
        memory_info=memory_info
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """음성 파일 전사 (WhisperX 서버로 전달)"""
    try:
        logger.info(f"🎤 Forwarding transcription request: {audio.filename}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"audio": (audio.filename, await audio.read(), audio.content_type)}
            response = await client.post(f"{WHISPER_SERVER}/transcribe", files=files)
            
            if response.status_code == 200:
                return TranscriptionResponse(**response.json())
            else:
                return TranscriptionResponse(
                    success=False,
                    error=f"WhisperX server error: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        return TranscriptionResponse(
            success=False,
            error="WhisperX server timeout"
        )
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return TranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/transcribe-enhanced", response_model=EnhancedTranscriptionResponse)
async def transcribe_audio_enhanced(
    audio: UploadFile = File(...),
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True
):
    """향상된 음성 파일 전사 (Triplet + BERT 필터링)"""
    try:
        logger.info(f"🎤 Enhanced transcription: {audio.filename}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # 1. WhisperX 전사
            files = {"audio": (audio.filename, await audio.read(), audio.content_type)}
            whisper_response = await client.post(f"{WHISPER_SERVER}/transcribe", files=files)
            
            if whisper_response.status_code != 200:
                return EnhancedTranscriptionResponse(
                    success=False,
                    error="WhisperX transcription failed"
                )
            
            whisper_result = whisper_response.json()
            
            # 2. Triplet 처리
            if enable_bert_filtering:
                triplet_request = {
                    "whisperx_result": whisper_result["transcription"],
                    "enable_bert_filtering": enable_bert_filtering,
                    "save_noise_log": save_noise_log
                }
                
                triplet_response = await client.post(
                    f"{QWEN_BERT_SERVER}/process-triplet",
                    json=triplet_request
                )
                
                if triplet_response.status_code == 200:
                    triplet_result = triplet_response.json()
                    
                    if triplet_result.get("success"):
                        return EnhancedTranscriptionResponse(
                            success=True,
                            transcription=whisper_result["transcription"],
                            triplet_data=triplet_result.get("triplet_data"),
                            filtered_transcript=triplet_result.get("filtered_transcript"),
                            processing_stats=triplet_result.get("processing_stats")
                        )
            
            # Triplet 실패 시 기본 결과 반환
            return EnhancedTranscriptionResponse(
                success=True,
                transcription=whisper_result["transcription"],
                filtered_transcript=whisper_result["transcription"]["full_text"]
            )
            
    except Exception as e:
        logger.error(f"❌ Enhanced transcription error: {e}")
        return EnhancedTranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-notion-project", response_model=NotionProjectResponse)
async def generate_notion_project(request: AnalysisRequest):
    """1단계: 회의록 → 노션 기획안 생성"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{QWEN_BERT_SERVER}/generate-notion",
                json={"transcript": request.transcript, "additional_context": request.additional_context}
            )
            
            if response.status_code == 200:
                return NotionProjectResponse(**response.json())
            else:
                return NotionProjectResponse(
                    success=False,
                    error=f"Server error: {response.status_code}"
                )
                
    except Exception as e:
        logger.error(f"❌ Notion generation error: {e}")
        return NotionProjectResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-task-master-prd", response_model=TaskMasterPRDResponse)
async def generate_task_master_prd(notion_data: Dict[str, Any] = Body(...)):
    """2단계: 노션 → Task Master PRD 생성"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{QWEN_BERT_SERVER}/generate-prd",
                json={"notion_data": notion_data}
            )
            
            if response.status_code == 200:
                return TaskMasterPRDResponse(**response.json())
            else:
                return TaskMasterPRDResponse(
                    success=False,
                    error=f"Server error: {response.status_code}"
                )
                
    except Exception as e:
        logger.error(f"❌ PRD generation error: {e}")
        return TaskMasterPRDResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-analysis", response_model=TwoStageAnalysisResponse)
async def two_stage_analysis(request: TwoStageAnalysisRequest):
    """2단계 분석 파이프라인 (전체 프로세스)"""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{QWEN_BERT_SERVER}/two-stage-analysis",
                json=request.dict()
            )
            
            if response.status_code == 200:
                return TwoStageAnalysisResponse(**response.json())
            else:
                return TwoStageAnalysisResponse(
                    success=False,
                    error=f"Server error: {response.status_code}"
                )
                
    except Exception as e:
        logger.error(f"❌ Two-stage analysis error: {e}")
        return TwoStageAnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-pipeline-text", response_model=EnhancedTwoStageResult)
async def two_stage_pipeline_text(request: TwoStageAnalysisRequest):
    """텍스트 기반 2단계 파이프라인 (Triplet 없이)"""
    try:
        start_time = time.time()
        
        # 직접 2단계 분석 수행
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{QWEN_BERT_SERVER}/two-stage-analysis",
                json=request.dict()
            )
            
            if response.status_code == 200:
                result = response.json()
                processing_time = time.time() - start_time
                
                return EnhancedTwoStageResult(
                    success=result.get("success", False),
                    stage1_notion=result.get("stage1_notion"),
                    stage2_prd=result.get("stage2_prd"),
                    stage3_tasks=result.get("stage3_tasks"),
                    formatted_notion=result.get("formatted_notion"),
                    formatted_prd=result.get("formatted_prd"),
                    original_transcript_length=len(request.transcript),
                    filtered_transcript_length=len(request.transcript),
                    noise_reduction_ratio=0.0,
                    processing_time=processing_time
                )
            else:
                return EnhancedTwoStageResult(
                    success=False,
                    error=f"Server error: {response.status_code}"
                )
                
    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")
        return EnhancedTwoStageResult(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-pipeline", response_model=EnhancedTwoStageResult)
async def two_stage_pipeline(
    audio: UploadFile = File(...),
    num_tasks: int = 5,
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True,
    auto_expand_tasks: bool = True
):
    """음성 파일 기반 전체 파이프라인 (Triplet 포함)"""
    try:
        start_time = time.time()
        
        # 1. 향상된 전사
        enhanced_result = await transcribe_audio_enhanced(
            audio=audio,
            enable_bert_filtering=enable_bert_filtering,
            save_noise_log=save_noise_log
        )
        
        if not enhanced_result.success:
            return EnhancedTwoStageResult(
                success=False,
                error=enhanced_result.error
            )
        
        # 2. 필터링된 텍스트로 2단계 분석
        filtered_text = enhanced_result.filtered_transcript or enhanced_result.transcription["full_text"]
        
        analysis_request = TwoStageAnalysisRequest(
            transcript=filtered_text,
            num_tasks=num_tasks,
            auto_expand_tasks=auto_expand_tasks
        )
        
        analysis_result = await two_stage_analysis(analysis_request)
        
        processing_time = time.time() - start_time
        
        # 통계 계산
        original_length = len(enhanced_result.transcription["full_text"])
        filtered_length = len(filtered_text)
        noise_ratio = 1 - (filtered_length / original_length) if original_length > 0 else 0
        
        return EnhancedTwoStageResult(
            success=analysis_result.success,
            triplet_stats=enhanced_result.triplet_data,
            classification_stats=enhanced_result.processing_stats,
            stage1_notion=analysis_result.stage1_notion,
            stage2_prd=analysis_result.stage2_prd,
            stage3_tasks=analysis_result.stage3_tasks,
            formatted_notion=analysis_result.formatted_notion,
            formatted_prd=analysis_result.formatted_prd,
            original_transcript_length=original_length,
            filtered_transcript_length=filtered_length,
            noise_reduction_ratio=noise_ratio,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ Full pipeline error: {e}")
        return EnhancedTwoStageResult(
            success=False,
            error=str(e)
        )

@app.post("/pipeline-final", response_model=Dict[str, Any])
async def pipeline_final(
    audio: UploadFile = File(...),
    num_tasks: int = 5,
    enable_bert_filtering: bool = True
):
    """최종 파이프라인 (간소화된 응답)"""
    try:
        result = await two_stage_pipeline(
            audio=audio,
            num_tasks=num_tasks,
            enable_bert_filtering=enable_bert_filtering,
            save_noise_log=True,
            auto_expand_tasks=True
        )
        
        if result.success:
            return {
                "success": True,
                "message": "Pipeline completed successfully",
                "notion_project": result.stage1_notion,
                "task_master_prd": result.stage2_prd,
                "tasks": result.stage3_tasks,
                "stats": {
                    "original_length": result.original_transcript_length,
                    "filtered_length": result.filtered_transcript_length,
                    "noise_reduction": f"{result.noise_reduction_ratio:.1%}",
                    "processing_time": f"{result.processing_time:.2f}s"
                }
            }
        else:
            return {
                "success": False,
                "error": result.error
            }
            
    except Exception as e:
        logger.error(f"❌ Final pipeline error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/models/status")
async def model_status():
    """전체 모델 상태 확인"""
    status = {
        "whisperx": {"loaded": False, "server": "offline"},
        "qwen3": {"loaded": False, "server": "offline"},
        "bert": {"loaded": False, "server": "offline"},
        "triplet": {"loaded": False, "server": "offline"}
    }
    
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            whisper_status = await client.get(f"{WHISPER_SERVER}/models/status")
            status["whisperx"] = {
                "loaded": whisper_status.json()["whisperx"]["loaded"],
                "server": "online"
            }
        except:
            pass
        
        try:
            qwen_status = await client.get(f"{QWEN_BERT_SERVER}/models/status")
            qwen_data = qwen_status.json()
            status["qwen3"] = {
                "loaded": qwen_data["qwen3"]["loaded"],
                "server": "online"
            }
            status["bert"] = {
                "loaded": qwen_data["bert"]["loaded"],
                "server": "online"
            }
            status["triplet"] = {
                "loaded": qwen_data["triplet"]["loaded"],
                "server": "online"
            }
        except:
            pass
    
    return status

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)