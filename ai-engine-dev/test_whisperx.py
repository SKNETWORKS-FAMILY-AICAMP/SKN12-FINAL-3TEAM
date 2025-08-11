#!/usr/bin/env python3
"""
WhisperX 단독 테스트 스크립트
문제를 격리하여 디버깅
"""

import os
import sys
import logging
import torch
from pathlib import Path

# 로깅 설정
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_whisperx():
    """WhisperX 테스트"""
    
    # 1. GPU 확인
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name()}")
        logger.info(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    
    # 2. WhisperX 임포트
    try:
        logger.info("Importing WhisperX...")
        import whisperx
        logger.info("✅ WhisperX imported successfully")
    except Exception as e:
        logger.error(f"❌ Failed to import WhisperX: {e}")
        return
    
    # 3. 모델 로드
    try:
        logger.info("Loading WhisperX model...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        
        model = whisperx.load_model(
            "large-v3",
            device,
            compute_type=compute_type,
            language="ko"
        )
        logger.info(f"✅ Model loaded (device: {device}, compute: {compute_type})")
    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return
    
    # 4. 테스트 파일 확인
    test_file = "test2.mp3"
    if not os.path.exists(test_file):
        logger.error(f"❌ Test file not found: {test_file}")
        logger.info(f"Current directory: {os.getcwd()}")
        logger.info(f"Files: {os.listdir('.')}")
        return
    
    # 5. 음성 인식 테스트
    try:
        logger.info(f"Transcribing {test_file}...")
        
        # 작은 배치로 시작
        for batch_size in [1, 2, 4, 8]:
            try:
                logger.info(f"Trying batch_size={batch_size}...")
                result = model.transcribe(test_file, batch_size=batch_size)
                logger.info(f"✅ Success with batch_size={batch_size}")
                break
            except Exception as e:
                logger.warning(f"Failed with batch_size={batch_size}: {e}")
                if batch_size == 1:
                    raise
        
        # 결과 출력
        segments = result.get("segments", [])
        logger.info(f"✅ Transcription completed: {len(segments)} segments")
        
        if segments:
            logger.info("First 3 segments:")
            for i, seg in enumerate(segments[:3]):
                logger.info(f"  [{i}] {seg.get('start', 0):.1f}s - {seg.get('end', 0):.1f}s: {seg.get('text', '')}")
        
        # 전체 텍스트
        full_text = " ".join([seg.get("text", "") for seg in segments])
        logger.info(f"Total text length: {len(full_text)} characters")
        logger.info(f"First 200 chars: {full_text[:200]}...")
        
    except Exception as e:
        logger.error(f"❌ Transcription failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # 메모리 정보
        if torch.cuda.is_available():
            logger.info(f"GPU memory: {torch.cuda.memory_allocated() / 1024**3:.1f} GB used")
            logger.info(f"GPU memory cached: {torch.cuda.memory_reserved() / 1024**3:.1f} GB")

if __name__ == "__main__":
    test_whisperx()