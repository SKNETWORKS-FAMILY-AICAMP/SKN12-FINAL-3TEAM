#!/bin/bash

echo "================================================"
echo "WhisperX 서버용 가상환경 설정"
echo "================================================"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 가상환경 생성
VENV_NAME="venv_whisperx"
echo -e "${YELLOW}🔧 가상환경 생성: $VENV_NAME${NC}"

if [ -d "$VENV_NAME" ]; then
    echo -e "${YELLOW}⚠️  기존 가상환경 삭제 중...${NC}"
    rm -rf $VENV_NAME
fi

python3 -m venv $VENV_NAME

# 2. 가상환경 활성화
echo -e "${BLUE}📦 가상환경 활성화${NC}"
source $VENV_NAME/bin/activate

# 3. pip 업그레이드
echo -e "${YELLOW}📦 pip 업그레이드${NC}"
pip install --upgrade pip

# 4. PyTorch 2.1.0 설치 (CUDA 11.8)
echo -e "${GREEN}🔧 PyTorch 2.1.0+cu118 설치${NC}"
pip install torch==2.1.0+cu118 torchvision==0.16.0+cu118 torchaudio==2.1.0+cu118 --index-url https://download.pytorch.org/whl/cu118

# 5. 필수 패키지 설치
echo -e "${GREEN}📦 WhisperX 관련 패키지 설치${NC}"
pip install numpy==1.24.4
pip install transformers==4.39.3
pip install tokenizers==0.15.2
pip install faster-whisper==1.0.0
pip install whisperx==3.2.0
pip install openai-whisper==20231117
pip install ctranslate2==4.4.0

# 6. 웹 서버 관련
echo -e "${GREEN}🌐 FastAPI 설치${NC}"
pip install fastapi==0.115.6
pip install uvicorn[standard]==0.34.0
pip install python-multipart==0.0.20

# 7. 오디오 처리
echo -e "${GREEN}🎵 오디오 처리 패키지 설치${NC}"
pip install soundfile==0.12.1
pip install librosa==0.10.2.post1
pip install audioread==3.0.1

# 8. 설치 확인
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ 설치된 패키지 확인${NC}"
echo -e "${BLUE}================================================${NC}"
python -c "
import torch
import transformers
import whisperx
import faster_whisper
print(f'✅ PyTorch: {torch.__version__}')
print(f'✅ CUDA Available: {torch.cuda.is_available()}')
print(f'✅ Transformers: {transformers.__version__}')
print(f'✅ WhisperX: Installed')
print(f'✅ Faster-Whisper: Installed')
"

# 9. 실행 스크립트 생성
echo -e "${YELLOW}🚀 실행 스크립트 생성${NC}"
cat > run_whisperx_server.sh << 'EOF'
#!/bin/bash
source venv_whisperx/bin/activate
echo "🎤 Starting WhisperX Server on port 8001..."
python whisperx_server.py
EOF
chmod +x run_whisperx_server.sh

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ WhisperX 가상환경 설정 완료!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}사용법:${NC}"
echo -e "  ${YELLOW}가상환경 활성화:${NC} source venv_whisperx/bin/activate"
echo -e "  ${YELLOW}서버 실행:${NC} ./run_whisperx_server.sh"
echo -e "  ${YELLOW}또는:${NC} python whisperx_server.py"
echo -e "${BLUE}================================================${NC}"