#!/usr/bin/env python3
"""
WhisperX 전용 서버 (포트 8001)
음성 전사만 담당 - 패키지 충돌 방지
"""

import os
import tempfile
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
import time

import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 글로벌 모델 변수
whisper_model = None

class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

def load_whisperx():
    """WhisperX 모델 로딩"""
    global whisper_model
    
    if whisper_model is None:
        logger.info("🎤 Loading WhisperX...")
        try:
            from faster_whisper import WhisperModel
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"  # GPU는 float16이 더 안정적
            
            # GPU 메모리 확인
            if device == "cuda":
                logger.info(f"🎮 GPU Available: {torch.cuda.get_device_name(0)}")
                logger.info(f"💾 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
            
            whisper_model = WhisperModel(
                "base", 
                device=device, 
                compute_type=compute_type,
                cpu_threads=8 if device == "cpu" else 0,  # CPU일 때만 스레드 설정
                num_workers=1  # 단일 워커로 안정화
            )
            logger.info(f"✅ Faster-Whisper base model loaded (device: {device}, compute_type: {compute_type})")
            return whisper_model
            
        except Exception as e:
            logger.error(f"❌ WhisperX loading failed: {e}")
            whisper_model = None
    
    return whisper_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시
    logger.info("🚀 Starting WhisperX Server...")
    start_time = time.time()
    load_whisperx()
    logger.info(f"✅ WhisperX loaded in {time.time() - start_time:.2f} seconds")
    yield
    # 종료 시
    logger.info("👋 Shutting down WhisperX server...")

app = FastAPI(
    title="WhisperX Server",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "whisperx_loaded": whisper_model is not None,
        "device": "cuda" if torch.cuda.is_available() else "cpu"
    }

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """음성 파일 전사"""
    try:
        logger.info(f"🎤 Transcribing: {audio.filename}")
        
        model = load_whisperx()
        if model is None:
            raise HTTPException(status_code=503, detail="WhisperX model not loaded")
        
        # 오디오 파일 임시 저장
        audio_content = await audio.read()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name
        
        try:
            # faster-whisper transcribe
            # GPU 사용 확인 로깅
            logger.info(f"🖥️ Using device: {model.device}")
            logger.info(f"📊 Model compute type: {model.model.compute_type if hasattr(model.model, 'compute_type') else 'unknown'}")
            
            segments_generator, info = model.transcribe(
                temp_path,
                language="ko",
                task="transcribe",
                beam_size=1  # 빠른 처리를 위해 beam_size 축소
            )
            
            # 세그먼트 리스트로 변환 (진행 상황 로깅)
            segments = []
            segment_count = 0
            last_log_time = time.time()
            
            for segment in segments_generator:
                segments.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip()
                })
                segment_count += 1
                
                # 5초마다 진행 상황 로깅
                if time.time() - last_log_time > 5:
                    logger.info(f"📝 Processing... {segment_count} segments, current time: {segment.end:.1f}s")
                    last_log_time = time.time()
            
            full_text = " ".join([seg["text"] for seg in segments])
            
            logger.info(f"✅ Transcription completed: {len(full_text)} chars")
            
            return TranscriptionResponse(
                success=True,
                transcription={
                    "segments": segments,
                    "full_text": full_text,
                    "language": "ko",
                    "duration": info.duration if hasattr(info, 'duration') else 0
                }
            )
            
        finally:
            os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return TranscriptionResponse(success=False, error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)