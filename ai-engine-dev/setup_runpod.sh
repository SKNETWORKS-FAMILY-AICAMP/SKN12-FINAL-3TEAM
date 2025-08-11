#!/bin/bash

echo "🚀 TtalKkac AI Engine RunPod Setup Script"
echo "========================================="

# 색상 코드 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 기본 디렉토리 설정
WORKSPACE="/workspace"
PROJECT_DIR="$WORKSPACE/TtalKkac"
AI_ENGINE_DIR="$PROJECT_DIR/ai-engine-dev"

echo -e "${GREEN}[1/10] Setting up directories...${NC}"
mkdir -p $PROJECT_DIR
cd $WORKSPACE

# 2. 시스템 패키지 업데이트 및 설치
echo -e "${GREEN}[2/10] Installing system packages...${NC}"
apt-get update && apt-get install -y \
    ffmpeg \
    git \
    git-lfs \
    wget \
    curl \
    vim \
    nano \
    htop \
    screen \
    tmux \
    python3-pip \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 3. Git LFS 초기화
git lfs install

# 4. Python 환경 설정
echo -e "${GREEN}[3/10] Setting up Python environment...${NC}"
pip install --upgrade pip setuptools wheel

# 5. 프로젝트 클론 또는 업데이트
echo -e "${GREEN}[4/10] Cloning/Updating project...${NC}"
if [ -d "$PROJECT_DIR/.git" ]; then
    echo "Project exists, pulling latest changes..."
    cd $PROJECT_DIR
    git pull
else
    echo "Cloning project..."
    git clone https://github.com/yourusername/TtalKkac.git $PROJECT_DIR
fi

cd $AI_ENGINE_DIR

# 6. Python 의존성 설치
echo -e "${GREEN}[5/10] Installing Python dependencies...${NC}"
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
pip install -r requirements_api_server.txt

# VLLM 설치 (선택적)
if [ "$USE_VLLM" = "true" ]; then
    echo -e "${GREEN}Installing VLLM...${NC}"
    pip install vllm
fi

# 7. 모델 디렉토리 구조 생성
echo -e "${GREEN}[6/10] Creating model directories...${NC}"
mkdir -p models/bert
mkdir -p models/qwen_lora
mkdir -p data
mkdir -p results
mkdir -p logs

# 8. Qwen3 4B LoRA 모델 복사 또는 다운로드
echo -e "${GREEN}[7/10] Setting up Qwen3 4B LoRA model...${NC}"

# 로컬에서 복사된 모델이 있는지 확인
if [ -d "qwen3_lora_ttalkkac_4b" ]; then
    echo "Moving existing Qwen3 4B LoRA model..."
    mv qwen3_lora_ttalkkac_4b models/qwen_lora/
else
    echo -e "${YELLOW}Qwen3 4B LoRA model not found. Please upload manually.${NC}"
fi

# BERT 모델 확인
if [ -f "Bert모델/Ttalkkac_model_v2/Ttalkkac_model_v3.pt" ]; then
    echo "Moving BERT model..."
    cp -r Bert모델/Ttalkkac_model_v2/* models/bert/
elif [ -f "Ttalkkac_model_v3.pt" ]; then
    mv Ttalkkac_model_v3.pt models/bert/
else
    echo -e "${YELLOW}BERT model not found. Please upload manually.${NC}"
fi

# 9. 환경변수 파일 생성
echo -e "${GREEN}[8/10] Creating environment configuration...${NC}"
cat > .env << EOF
# TtalKkac AI Engine Configuration for RunPod

# Paths
MODEL_DIR=$AI_ENGINE_DIR/models
DATA_DIR=$AI_ENGINE_DIR/data
RESULT_DIR=$AI_ENGINE_DIR/results

# Model Paths
BERT_MODEL_PATH=$AI_ENGINE_DIR/models/bert/Ttalkkac_model_v3.pt
BERT_CONFIG_PATH=$AI_ENGINE_DIR/models/bert/bert_model_config.json
BERT_TOKENIZER_PATH=$AI_ENGINE_DIR/models/bert/bert_tokenizer_config.json

# Qwen LoRA - Using 4B model as decided
QWEN_LORA_4B=$AI_ENGINE_DIR/models/qwen_lora/qwen3_lora_ttalkkac_4b
QWEN_BASE_MODEL=Qwen/Qwen2.5-7B-Instruct

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# GPU Settings
CUDA_VISIBLE_DEVICES=0
USE_VLLM=${USE_VLLM:-false}

# HuggingFace Token (set by user)
HF_TOKEN=${HF_TOKEN}

# WhisperX Settings
WHISPERX_MODEL=large-v3
WHISPERX_LANGUAGE=ko
WHISPERX_BATCH_SIZE=16

# Performance Settings
BERT_BATCH_SIZE=32
USE_MIXED_PRECISION=true

# Logging
LOG_LEVEL=INFO
LOG_FILE=$AI_ENGINE_DIR/logs/ai_server.log

# Debug
DEBUG=false
EOF

# 10. ngrok 설치
echo -e "${GREEN}[9/10] Installing ngrok...${NC}"
if ! command -v ngrok &> /dev/null; then
    wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
    tar xzf ngrok-v3-stable-linux-amd64.tgz
    chmod +x ngrok
    mv ngrok /usr/local/bin/
    rm ngrok-v3-stable-linux-amd64.tgz
fi

# ngrok 설정
if [ ! -z "$NGROK_AUTH_TOKEN" ]; then
    ngrok config add-authtoken $NGROK_AUTH_TOKEN
    echo -e "${GREEN}ngrok configured with auth token${NC}"
else
    echo -e "${YELLOW}NGROK_AUTH_TOKEN not set. Please configure manually.${NC}"
fi

# 11. 시작 스크립트 생성
echo -e "${GREEN}[10/10] Creating startup scripts...${NC}"

# start_server.sh 생성
cat > start_server.sh << 'SCRIPT'
#!/bin/bash

# 색상 코드
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting TtalKkac AI Server...${NC}"

# 환경변수 로드
source .env

# GPU 상태 확인
echo -e "${GREEN}GPU Status:${NC}"
nvidia-smi

# 기존 프로세스 종료
pkill -f "ai_server_final_with_triplets.py"
pkill -f "ngrok"

# 서버 시작 (screen 세션)
echo -e "${GREEN}Starting AI server in screen session...${NC}"
screen -dmS ai_server bash -c "python ai_server_final_with_triplets.py 2>&1 | tee logs/server.log"

# ngrok 시작
echo -e "${GREEN}Starting ngrok tunnel...${NC}"
screen -dmS ngrok bash -c "ngrok http 8000 --log=stdout | tee logs/ngrok.log"

# 잠시 대기
sleep 5

# ngrok URL 가져오기
echo -e "${GREEN}Getting ngrok URL...${NC}"
for i in {1..10}; do
    NGROK_URL=$(curl -s localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data['tunnels'] else '')" 2>/dev/null)
    if [ ! -z "$NGROK_URL" ]; then
        break
    fi
    sleep 2
done

if [ ! -z "$NGROK_URL" ]; then
    echo -e "${GREEN}✅ Ngrok URL: $NGROK_URL${NC}"
    echo "AI_SERVER_URL=$NGROK_URL" > ngrok_url.txt
    
    # Backend .env 업데이트 (있는 경우)
    if [ -f "../backend/.env" ]; then
        sed -i "s|AI_SERVER_URL=.*|AI_SERVER_URL=$NGROK_URL|" ../backend/.env
        echo -e "${GREEN}Updated backend .env with ngrok URL${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Could not get ngrok URL. Check manually.${NC}"
fi

echo ""
echo "========================================="
echo "✅ Server started successfully!"
echo "========================================="
echo "📝 View logs:"
echo "  - AI Server: screen -r ai_server"
echo "  - Ngrok: screen -r ngrok"
echo ""
echo "🔍 Check status:"
echo "  - Server health: curl http://localhost:8000/health"
echo "  - GPU usage: nvidia-smi"
echo "========================================="
SCRIPT

chmod +x start_server.sh

# stop_server.sh 생성
cat > stop_server.sh << 'SCRIPT'
#!/bin/bash

echo "Stopping TtalKkac AI Server..."

# 프로세스 종료
pkill -f "ai_server_final_with_triplets.py"
pkill -f "ngrok"

# Screen 세션 종료
screen -S ai_server -X quit 2>/dev/null
screen -S ngrok -X quit 2>/dev/null

echo "✅ Server stopped"
SCRIPT

chmod +x stop_server.sh

# test_api.sh 생성
cat > test_api.sh << 'SCRIPT'
#!/bin/bash

echo "Testing TtalKkac AI Server API..."

# Health check
echo "1. Health Check:"
curl -s http://localhost:8000/health | python3 -m json.tool

# Model status
echo -e "\n2. Model Status:"
curl -s http://localhost:8000/model-status | python3 -m json.tool

# Test with sample audio (if exists)
if [ -f "test.MP3" ]; then
    echo -e "\n3. Testing transcription:"
    curl -X POST http://localhost:8000/transcribe-enhanced \
         -F "file=@test.MP3" \
         | python3 -m json.tool
fi
SCRIPT

chmod +x test_api.sh

# 12. 최종 확인
echo ""
echo "========================================="
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo "========================================="
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables:"
echo "   export HF_TOKEN='your-huggingface-token'"
echo "   export NGROK_AUTH_TOKEN='your-ngrok-token'"
echo ""
echo "2. Upload models if not present:"
echo "   - BERT model to: models/bert/Ttalkkac_model_v3.pt"
echo "   - Qwen LoRA to: models/qwen_lora/qwen3_lora_ttalkkac_4b/"
echo ""
echo "3. Start the server:"
echo "   ./start_server.sh"
echo ""
echo "4. Test the API:"
echo "   ./test_api.sh"
echo "========================================="

# GPU 정보 출력
if command -v nvidia-smi &> /dev/null; then
    echo ""
    echo "GPU Information:"
    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv
fi