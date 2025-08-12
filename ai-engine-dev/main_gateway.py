#!/usr/bin/env python3
"""
메인 게이트웨이 서버 (포트 8000)
WhisperX 서버와 Qwen3+BERT 서버를 연결
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx
import logging
import asyncio
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TtalKkak AI Gateway", version="1.0.0")

# 서브 서버 URL
WHISPER_SERVER = "http://localhost:8001"
QWEN_BERT_SERVER = "http://localhost:8002"

class ProcessRequest(BaseModel):
    text: Optional[str] = None
    task: str = "classify"  # classify, generate, transcribe

@app.get("/health")
async def health_check():
    """전체 시스템 헬스 체크"""
    health_status = {
        "gateway": "healthy",
        "services": {}
    }
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        # WhisperX 서버 체크
        try:
            response = await client.get(f"{WHISPER_SERVER}/health")
            health_status["services"]["whisper"] = response.json()
        except:
            health_status["services"]["whisper"] = {"status": "offline"}
        
        # Qwen3+BERT 서버 체크
        try:
            response = await client.get(f"{QWEN_BERT_SERVER}/health")
            health_status["services"]["qwen_bert"] = response.json()
        except:
            health_status["services"]["qwen_bert"] = {"status": "offline"}
    
    return health_status

@app.post("/process/audio")
async def process_audio(file: UploadFile = File(...)):
    """
    음성 파일 처리 파이프라인:
    1. WhisperX로 전사
    2. BERT로 분류
    3. Qwen3로 응답 생성
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 1. WhisperX 전사
            logger.info("🎤 Transcribing audio...")
            files = {"file": (file.filename, await file.read(), file.content_type)}
            transcribe_response = await client.post(
                f"{WHISPER_SERVER}/transcribe",
                files=files
            )
            transcribe_result = transcribe_response.json()
            
            if not transcribe_result.get("success"):
                raise HTTPException(status_code=500, detail="Transcription failed")
            
            transcribed_text = transcribe_result["text"]
            logger.info(f"📝 Transcribed: {transcribed_text}")
            
            # 2. BERT 분류
            logger.info("🔍 Classifying text...")
            classify_response = await client.post(
                f"{QWEN_BERT_SERVER}/classify",
                json={"text": transcribed_text}
            )
            classify_result = classify_response.json()
            
            # 3. Qwen3 응답 생성 (선택적)
            generated_response = None
            if classify_result.get("success"):
                classification = classify_result["classification"]
                
                # 분류에 따른 프롬프트 생성
                prompt = f"사용자: {transcribed_text}\n분류: {classification}\n응답:"
                
                logger.info("💬 Generating response...")
                generate_response = await client.post(
                    f"{QWEN_BERT_SERVER}/generate",
                    json={
                        "prompt": prompt,
                        "max_length": 256,
                        "temperature": 0.7
                    }
                )
                
                if generate_response.status_code == 200:
                    generate_result = generate_response.json()
                    generated_response = generate_result.get("generated_text")
            
            return {
                "success": True,
                "transcription": transcribed_text,
                "classification": classify_result.get("classification"),
                "generated_response": generated_response
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Server timeout")
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process/text")
async def process_text(request: ProcessRequest):
    """텍스트 처리 (분류 또는 생성)"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if request.task == "classify":
                response = await client.post(
                    f"{QWEN_BERT_SERVER}/classify",
                    json={"text": request.text}
                )
            elif request.task == "generate":
                response = await client.post(
                    f"{QWEN_BERT_SERVER}/generate",
                    json={
                        "prompt": request.text,
                        "max_length": 512,
                        "temperature": 0.7
                    }
                )
            else:
                raise HTTPException(status_code=400, detail="Invalid task")
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Server timeout")
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)