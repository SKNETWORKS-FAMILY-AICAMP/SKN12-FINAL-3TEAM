#!/usr/bin/env python3
"""
WhisperX 전용 서버 (포트 8001)
ai_server_final_with_triplets.py의 WhisperX 부분만 분리
"""

import os
import tempfile
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import time

import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 글로벌 모델 변수
whisper_model = None

# 응답 모델 (원본과 동일)
class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    gpu_count: int
    model_loaded: bool
    memory_info: Optional[Dict[str, float]] = None

def load_whisperx():
    """WhisperX 모델 로딩 (원본과 동일한 로직)"""
    global whisper_model
    
    if whisper_model is None:
        logger.info("🎤 Loading WhisperX...")
        try:
            # faster-whisper를 직접 사용
            from faster_whisper import WhisperModel
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            # faster-whisper 모델 로드
            try:
                whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
                logger.info(f"✅ Faster-Whisper base model loaded (device: {device})")
                return whisper_model
            except Exception as e:
                logger.warning(f"GPU 로드 실패: {e}, CPU 시도...")
                whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
                logger.info("✅ Faster-Whisper base model loaded on CPU")
                return whisper_model
            
        except ImportError:
            # whisperx fallback
            try:
                import whisperx
                whisper_model = whisperx.load_model("base")
                logger.info("✅ WhisperX base model loaded (fallback)")
                return whisper_model
            except Exception as e:
                logger.error(f"❌ Both faster-whisper and whisperx failed: {e}")
                whisper_model = None
        except Exception as e:
            logger.error(f"❌ WhisperX loading failed: {e}")
            whisper_model = None
    
    return whisper_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리"""
    # 시작 시
    logger.info("🚀 Starting WhisperX Dedicated Server...")
    logger.info("🔧 Model preloading: Enabled")
    
    # WhisperX 사전 로딩
    start_time = time.time()
    try:
        load_whisperx()
        load_time = time.time() - start_time
        logger.info(f"✅ WhisperX loaded in {load_time:.2f} seconds")
    except Exception as e:
        logger.error(f"❌ WhisperX preloading failed: {e}")
    
    yield
    
    # 종료 시
    logger.info("👋 Shutting down WhisperX server...")
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

# FastAPI 앱 생성
app = FastAPI(
    title="WhisperX Dedicated Server",
    description="Speech-to-Text service for TtalKkak",
    version="1.0.0",
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
    """루트 엔드포인트"""
    return {
        "service": "WhisperX Dedicated Server",
        "version": "1.0.0",
        "port": 8001,
        "features": [
            "WhisperX/Faster-Whisper Speech-to-Text",
            "Korean language support",
            "Segment-based transcription"
        ],
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스 체크"""
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
    
    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        gpu_count=gpu_count,
        model_loaded=whisper_model is not None,
        memory_info=memory_info
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """음성 파일 전사 (WhisperX) - 원본과 동일한 인터페이스"""
    try:
        logger.info(f"🎤 Transcribing audio: {audio.filename}")
        
        # 모델 로딩
        model = load_whisperx()
        if model is None:
            raise HTTPException(status_code=503, detail="WhisperX model not loaded")
        
        # 오디오 파일 임시 저장
        audio_content = await audio.read()
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name
        
        try:
            # faster-whisper 방식
            if hasattr(model, 'transcribe') and 'WhisperModel' in str(type(model)):
                # faster-whisper transcribe
                segments_generator, info = model.transcribe(
                    temp_path,
                    language="ko",
                    task="transcribe",
                    beam_size=5,
                    best_of=5,
                    patience=1,
                    length_penalty=1,
                    temperature=0.0,
                    compression_ratio_threshold=2.4,
                    log_prob_threshold=-1.0,
                    no_speech_threshold=0.6
                )
                
                # 세그먼트 리스트로 변환
                segments = []
                for segment in segments_generator:
                    segments.append({
                        "id": len(segments),
                        "start": segment.start,
                        "end": segment.end,
                        "text": segment.text.strip(),
                        "tokens": segment.tokens if hasattr(segment, 'tokens') else None,
                        "temperature": segment.temperature if hasattr(segment, 'temperature') else 0.0,
                        "avg_logprob": segment.avg_logprob if hasattr(segment, 'avg_logprob') else 0.0,
                        "compression_ratio": segment.compression_ratio if hasattr(segment, 'compression_ratio') else 1.0,
                        "no_speech_prob": segment.no_speech_prob if hasattr(segment, 'no_speech_prob') else 0.0
                    })
                
                full_text = " ".join([seg["text"] for seg in segments])
                
                result = {
                    "segments": segments,
                    "full_text": full_text,
                    "language": info.language if hasattr(info, 'language') else "ko",
                    "duration": info.duration if hasattr(info, 'duration') else sum([seg["end"] - seg["start"] for seg in segments])
                }
            else:
                # whisperx 방식 (fallback)
                result_raw = model.transcribe(temp_path, batch_size=16)
                segments = result_raw.get("segments", [])
                full_text = " ".join([seg.get("text", "") for seg in segments])
                
                result = {
                    "segments": segments,
                    "full_text": full_text,
                    "language": result_raw.get("language", "ko"),
                    "duration": sum([seg.get("end", 0) - seg.get("start", 0) for seg in segments])
                }
            
            logger.info(f"✅ Transcription completed: {len(full_text)} characters")
            
            return TranscriptionResponse(
                success=True,
                transcription=result
            )
            
        finally:
            # 임시 파일 정리
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return TranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/transcribe-segments")
async def transcribe_segments(audio: UploadFile = File(...)):
    """세그먼트별 상세 전사 (추가 기능)"""
    try:
        result = await transcribe_audio(audio)
        
        if result.success and result.transcription:
            # 세그먼트별 상세 정보 추가
            segments_detail = []
            for seg in result.transcription.get("segments", []):
                segments_detail.append({
                    "id": seg.get("id"),
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                    "duration": seg.get("end", 0) - seg.get("start", 0),
                    "text": seg.get("text", ""),
                    "confidence": seg.get("avg_logprob", 0) if "avg_logprob" in seg else None
                })
            
            return {
                "success": True,
                "segments": segments_detail,
                "total_duration": result.transcription.get("duration"),
                "language": result.transcription.get("language"),
                "full_text": result.transcription.get("full_text")
            }
        else:
            return result
            
    except Exception as e:
        logger.error(f"❌ Segment transcription error: {e}")
        return {"success": False, "error": str(e)}

@app.get("/models/status")
async def model_status():
    """모델 상태 확인"""
    return {
        "whisperx": {
            "loaded": whisper_model is not None,
            "type": str(type(whisper_model)) if whisper_model else None,
            "device": "cuda" if torch.cuda.is_available() else "cpu"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)