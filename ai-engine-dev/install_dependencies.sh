#!/bin/bash

# =====================================
# TtalKkac AI Engine 의존성 설치 스크립트
# =====================================

echo "🚀 TtalKkac AI Engine Dependencies Installation"
echo "=============================================="

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# OS 감지
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
else
    OS="unknown"
fi

echo -e "${GREEN}Detected OS: $OS${NC}"

# Python 버전 확인
PYTHON_VERSION=$(python3 --version 2>&1 | grep -Po '(?<=Python )\d+\.\d+' || python --version 2>&1 | grep -Po '(?<=Python )\d+\.\d+')
echo -e "${GREEN}Python version: $PYTHON_VERSION${NC}"

PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
    echo -e "${RED}Error: Python 3.8+ required${NC}"
    exit 1
fi

# CUDA 버전 확인
if command -v nvidia-smi &> /dev/null; then
    CUDA_VERSION=$(nvidia-smi | grep "CUDA Version" | awk '{print $9}')
    echo -e "${GREEN}CUDA version: $CUDA_VERSION${NC}"
    HAS_GPU=true
else
    echo -e "${YELLOW}Warning: CUDA not detected. GPU acceleration will not be available.${NC}"
    HAS_GPU=false
fi

# 가상환경 확인/생성
if [ ! -d "venv" ]; then
    read -p "Create virtual environment? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python3 -m venv venv || python -m venv venv
        echo -e "${GREEN}Virtual environment created${NC}"
    fi
fi

# 가상환경 활성화
if [ -d "venv" ]; then
    if [[ "$OS" == "windows" ]]; then
        source venv/Scripts/activate 2>/dev/null || ./venv/Scripts/activate
    else
        source venv/bin/activate
    fi
    echo -e "${GREEN}Virtual environment activated${NC}"
fi

# 시스템 패키지 설치 (Linux only)
if [[ "$OS" == "linux" ]]; then
    echo -e "${GREEN}[1/8] Installing system packages...${NC}"
    
    # root 권한 확인
    if [ "$EUID" -eq 0 ]; then
        apt-get update
        apt-get install -y \
            ffmpeg \
            libsndfile1 \
            libportaudio2 \
            libasound2-dev \
            sox \
            libsox-fmt-all \
            git \
            git-lfs \
            build-essential \
            python3-dev
    else
        echo -e "${YELLOW}Note: Run with sudo to install system packages${NC}"
        echo "sudo apt-get install ffmpeg libsndfile1 libportaudio2 libasound2-dev sox libsox-fmt-all"
    fi
fi

# pip 업그레이드
echo -e "${GREEN}[2/8] Upgrading pip...${NC}"
pip install --upgrade pip setuptools wheel

# PyTorch 설치
echo -e "${GREEN}[3/8] Installing PyTorch...${NC}"
if [ "$HAS_GPU" = true ]; then
    # CUDA 11.8 버전
    pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118
else
    # CPU 버전
    pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0
fi

# 기본 requirements 설치
echo -e "${GREEN}[4/8] Installing main requirements...${NC}"
pip install -r requirements.txt

# WhisperX 설치
echo -e "${GREEN}[5/8] Installing WhisperX...${NC}"
pip install git+https://github.com/m-bain/whisperx.git

# 선택적 패키지 설치
if [ "$HAS_GPU" = true ]; then
    # GPU 메모리 확인
    GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1)
    echo -e "${GREEN}GPU Memory: ${GPU_MEM}MB${NC}"
    
    if [ "$GPU_MEM" -ge 24000 ]; then
        read -p "Install VLLM for high-performance inference? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${GREEN}Installing VLLM...${NC}"
            pip install vllm==0.2.7
        fi
    fi
    
    # A100/H100 GPU 확인
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
    if [[ "$GPU_NAME" == *"A100"* ]] || [[ "$GPU_NAME" == *"H100"* ]]; then
        read -p "Install Flash Attention for $GPU_NAME? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${GREEN}Installing Flash Attention...${NC}"
            pip install flash-attn --no-build-isolation
        fi
    fi
fi

# 한국어 NLP 데이터 다운로드
echo -e "${GREEN}[6/8] Downloading Korean NLP data...${NC}"
python -c "
import nltk
import ssl
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context
    
nltk.download('punkt')
nltk.download('stopwords')
print('✅ NLTK data downloaded')
" 2>/dev/null || echo -e "${YELLOW}NLTK data download skipped${NC}"

# 설치 확인
echo -e "${GREEN}[7/8] Verifying installation...${NC}"
python -c "
import sys
print('Python:', sys.version)

try:
    import torch
    print('✅ PyTorch version:', torch.__version__)
    print('✅ CUDA available:', torch.cuda.is_available())
    if torch.cuda.is_available():
        print('   GPU:', torch.cuda.get_device_name(0))
        print('   CUDA version:', torch.version.cuda)
except ImportError:
    print('❌ PyTorch not installed')

try:
    import transformers
    print('✅ Transformers version:', transformers.__version__)
except ImportError:
    print('❌ Transformers not installed')

try:
    import whisperx
    print('✅ WhisperX installed')
except ImportError:
    print('⚠️  WhisperX not installed')

try:
    import fastapi
    print('✅ FastAPI installed')
except ImportError:
    print('❌ FastAPI not installed')

try:
    import peft
    print('✅ PEFT version:', peft.__version__)
except ImportError:
    print('❌ PEFT not installed')

try:
    import vllm
    print('✅ VLLM installed')
except ImportError:
    print('ℹ️  VLLM not installed (optional)')
"

# 디렉토리 생성
echo -e "${GREEN}[8/8] Creating necessary directories...${NC}"
mkdir -p models/bert
mkdir -p models/qwen_lora
mkdir -p data
mkdir -p results
mkdir -p logs

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Installation completed!${NC}"
echo "=============================================="
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Download/upload model files:"
echo "   • BERT: models/bert/Ttalkkac_model_v3.pt"
echo "   • LoRA: models/qwen_lora/qwen3_lora_ttalkkac_4b/"
echo ""
echo "2. Set environment variables:"
echo "   export HF_TOKEN='your-huggingface-token'"
echo "   export NGROK_AUTH_TOKEN='your-ngrok-token'"  
echo ""
echo "3. Configure settings (optional):"
echo "   cp .env.example .env"
echo "   # Edit .env file with your settings"
echo ""
echo "4. Run the server:"
echo "   python ai_server_final_with_triplets.py"
echo ""
echo "5. Test the API:"
echo "   curl http://localhost:8000/health"
echo "=============================================="

# 문제 해결 팁
if [ "$HAS_GPU" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  No GPU detected. The server will run in CPU mode.${NC}"
    echo "   Performance will be significantly slower."
fi

# ffmpeg 확인
if ! command -v ffmpeg &> /dev/null; then
    echo ""
    echo -e "${YELLOW}⚠️  ffmpeg not found. Audio processing may not work.${NC}"
    if [[ "$OS" == "linux" ]]; then
        echo "   Install: sudo apt-get install ffmpeg"
    elif [[ "$OS" == "macos" ]]; then
        echo "   Install: brew install ffmpeg"
    elif [[ "$OS" == "windows" ]]; then
        echo "   Download from: https://ffmpeg.org/download.html"
    fi
fi