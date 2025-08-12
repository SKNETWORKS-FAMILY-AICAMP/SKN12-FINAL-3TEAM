#!/bin/bash

# =====================================
# WhisperX + PyTorch 2.1.0 호환 설치 스크립트
# RunPod 환경용
# =====================================

echo "🚀 WhisperX Compatible Installation for RunPod"
echo "=============================================="

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 기존 패키지 정리
echo -e "${YELLOW}[1/7] Cleaning existing packages...${NC}"
pip uninstall torch torchvision torchaudio whisperx pyannote.audio pytorch-lightning -y

# 2. 캐시 정리
echo -e "${GREEN}[2/7] Clearing pip cache...${NC}"
pip cache purge

# 3. NumPy 1.x 설치 (중요!)
echo -e "${GREEN}[3/7] Installing NumPy 1.x...${NC}"
pip install numpy==1.24.4

# 4. PyTorch 2.1.0 설치
echo -e "${GREEN}[4/7] Installing PyTorch 2.1.0 with CUDA 11.8...${NC}"
pip install torch==2.1.0+cu118 torchvision==0.16.0+cu118 torchaudio==2.1.0+cu118 \
  --index-url https://download.pytorch.org/whl/cu118

# 5. WhisperX 호환 의존성 설치
echo -e "${GREEN}[5/7] Installing WhisperX compatible dependencies...${NC}"

# faster-whisper와 ctranslate2 호환 버전
pip install faster-whisper==0.10.1 ctranslate2==3.24.0

# pyannote.audio 구버전 (pytorch-lightning 의존성 문제 회피)
pip install pyannote.audio==3.0.1 pytorch-lightning==1.9.5

# Transformers 등 핵심 패키지
pip install \
  transformers==4.36.2 \
  peft==0.7.1 \
  accelerate==0.25.0 \
  openai-whisper==20231117

# FastAPI
pip install \
  fastapi==0.110.0 \
  uvicorn[standard]==0.24.0.post1 \
  python-multipart==0.0.6

# 기타 필수 패키지
pip install \
  librosa==0.10.1 \
  soundfile==0.12.1 \
  ffmpeg-python==0.2.0 \
  pandas==2.1.4 \
  scipy==1.11.4 \
  huggingface-hub==0.20.1

# 6. WhisperX v3.1.1 설치 (의존성 무시)
echo -e "${GREEN}[6/7] Installing WhisperX v3.1.1...${NC}"
pip install git+https://github.com/m-bain/whisperx.git@v3.1.1 --no-deps

# 7. 설치 확인
echo -e "${GREEN}[7/7] Verifying installation...${NC}"
python -c "
import sys
print('Python:', sys.version)
print('='*50)

try:
    import numpy as np
    print(f'✅ NumPy: {np.__version__}')
except ImportError as e:
    print(f'❌ NumPy failed: {e}')

try:
    import torch
    print(f'✅ PyTorch: {torch.__version__}')
    print(f'   CUDA available: {torch.cuda.is_available()}')
    if torch.cuda.is_available():
        print(f'   GPU: {torch.cuda.get_device_name(0)}')
except ImportError as e:
    print(f'❌ PyTorch failed: {e}')

try:
    import whisperx
    print('✅ WhisperX installed successfully')
except ImportError as e:
    print(f'❌ WhisperX failed: {e}')

try:
    import faster_whisper
    print('✅ faster-whisper installed')
except ImportError as e:
    print(f'❌ faster-whisper failed: {e}')

try:
    import transformers
    print(f'✅ Transformers: {transformers.__version__}')
except ImportError as e:
    print(f'❌ Transformers failed: {e}')

try:
    import peft
    print(f'✅ PEFT: {peft.__version__}')
except ImportError as e:
    print(f'❌ PEFT failed: {e}')

try:
    import fastapi
    print('✅ FastAPI installed')
except ImportError as e:
    print(f'❌ FastAPI failed: {e}')

print('='*50)
"

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Installation completed!${NC}"
echo "=============================================="
echo ""
echo "📋 Notes:"
echo "- WhisperX v3.1.1 installed (PyTorch 2.1.0 compatible)"
echo "- Using faster-whisper 0.10.1 (compatible version)"
echo "- NumPy 1.24.4 (avoiding 2.x compatibility issues)"
echo ""
echo "🔧 If you encounter issues:"
echo "1. Try restarting the Python kernel"
echo "2. Check GPU memory: nvidia-smi"
echo "3. Test with smaller models first"
echo ""
echo "🚀 Ready to run:"
echo "   python ai_server_final_with_triplets.py"
echo "=============================================="