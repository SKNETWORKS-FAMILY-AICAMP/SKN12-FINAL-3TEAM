#!/bin/bash

echo "================================================"
echo "메인 AI 서버용 가상환경 설정 (Qwen3 + BERT + Triplet)"
echo "================================================"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 가상환경 생성
VENV_NAME="venv_main"
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

# 4. PyTorch 2.1.0 설치 (CUDA 11.8) - WhisperX와 동일한 PyTorch 버전
echo -e "${GREEN}🔧 PyTorch 2.1.0+cu118 설치${NC}"
pip install torch==2.1.0+cu118 torchvision==0.16.0+cu118 torchaudio==2.1.0+cu118 --index-url https://download.pytorch.org/whl/cu118

# 5. 필수 패키지 설치
echo -e "${GREEN}📦 Transformers 최신 버전 설치 (Qwen3 지원)${NC}"
pip install numpy==1.24.4
pip install transformers==4.51.0
pip install tokenizers==0.21.4
pip install huggingface-hub==0.26.0
pip install accelerate==0.25.0
pip install safetensors==0.5.2
pip install sentencepiece==0.2.0
pip install protobuf==5.29.3

# 6. PEFT & LoRA
echo -e "${GREEN}🎯 PEFT/LoRA 설치${NC}"
pip install peft==0.7.1
pip install bitsandbytes==0.44.2

# 7. BERT & NLP
echo -e "${GREEN}🧠 BERT & NLP 패키지 설치${NC}"
pip install scikit-learn==1.6.1
pip install scipy==1.14.1
pip install klue-transformers==0.1.0  # Korean BERT
pip install konlpy==0.6.0
pip install soynlp==0.0.493

# 8. 웹 서버 관련
echo -e "${GREEN}🌐 FastAPI 설치${NC}"
pip install fastapi==0.115.6
pip install uvicorn[standard]==0.34.0
pip install python-multipart==0.0.20
pip install httpx==0.28.1  # WhisperX 원격 호출용

# 9. 기타 유틸리티
echo -e "${GREEN}🔧 유틸리티 패키지 설치${NC}"
pip install pandas==2.2.3
pip install matplotlib==3.10.0
pip install tqdm==4.67.1
pip install pyyaml==6.0.2
pip install python-dotenv==1.0.1

# 10. 로컬 모듈이 있는 경우 경로 추가
echo -e "${YELLOW}📁 로컬 모듈 경로 설정${NC}"
if [ -d "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev" ]; then
    export PYTHONPATH="/workspace/SKN12-FINAL-3TEAM/ai-engine-dev:$PYTHONPATH"
    echo "export PYTHONPATH='/workspace/SKN12-FINAL-3TEAM/ai-engine-dev:$PYTHONPATH'" >> $VENV_NAME/bin/activate
fi

# 11. 설치 확인
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ 설치된 패키지 확인${NC}"
echo -e "${BLUE}================================================${NC}"
python -c "
import torch
import transformers
import peft
import httpx
print(f'✅ PyTorch: {torch.__version__}')
print(f'✅ CUDA Available: {torch.cuda.is_available()}')
print(f'✅ Transformers: {transformers.__version__}')
print(f'✅ PEFT: {peft.__version__}')
print(f'✅ httpx: {httpx.__version__}')
"

# 12. 실행 스크립트 생성
echo -e "${YELLOW}🚀 실행 스크립트 생성${NC}"
cat > run_main_server.sh << 'EOF'
#!/bin/bash
source venv_main/bin/activate
echo "🧠 Starting Main AI Server on port 8000..."
python ai_server_final_with_triplets.py
EOF
chmod +x run_main_server.sh

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ 메인 서버 가상환경 설정 완료!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}사용법:${NC}"
echo -e "  ${YELLOW}가상환경 활성화:${NC} source venv_main/bin/activate"
echo -e "  ${YELLOW}서버 실행:${NC} ./run_main_server.sh"
echo -e "  ${YELLOW}또는:${NC} python ai_server_final_with_triplets.py"
echo -e "${BLUE}================================================${NC}"