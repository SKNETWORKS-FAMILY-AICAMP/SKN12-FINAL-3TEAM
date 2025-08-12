#!/usr/bin/env python3
"""
WhisperX 전용 서버 (포트 8001)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import whisperx
import torch
import numpy as np
import io
import soundfile as sf
import logging
import gc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="WhisperX Server", version="1.0.0")

# WhisperX 모델 전역 변수
whisper_model = None
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 WhisperX 모델 로드"""
    global whisper_model
    try:
        logger.info(f"🎤 Loading WhisperX on {device}...")
        from faster_whisper import WhisperModel
        whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
        logger.info("✅ WhisperX loaded successfully!")
    except Exception as e:
        logger.error(f"❌ WhisperX loading failed: {e}")

@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {
        "status": "healthy",
        "service": "whisper",
        "model_loaded": whisper_model is not None,
        "device": device
    }

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """음성 파일 전사"""
    if not whisper_model:
        raise HTTPException(status_code=503, detail="WhisperX model not loaded")
    
    try:
        # 오디오 파일 읽기
        audio_bytes = await file.read()
        audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes))
        
        # 모노로 변환
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # 전사
        segments, info = whisper_model.transcribe(
            audio_data,
            language="ko",
            task="transcribe"
        )
        
        # 결과 정리
        text = " ".join([segment.text for segment in segments])
        
        return {
            "success": True,
            "text": text,
            "language": info.language,
            "duration": info.duration
        }
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)