#!/bin/bash

echo "==============================================="
echo "TtalKkac AI Server Startup Script"
echo "==============================================="
echo ""

# 환경 변수 설정
export PYTHONPATH=$(pwd)
export USE_VLLM=true
export PRELOAD_MODELS=true
export HOST=0.0.0.0
export PORT=8000

echo "[1/4] Checking Python environment..."
python3 --version

echo ""
echo "[2/4] Checking GPU availability..."
python3 -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'GPU Count: {torch.cuda.device_count()}') if torch.cuda.is_available() else print('No GPU detected')"

echo ""
echo "[3/4] Loading environment variables..."
if [ -f .env ]; then
    echo "Environment file found: .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Warning: No .env file found. Using default settings."
fi

echo ""
echo "[4/4] Starting AI server..."
echo "Server will be available at: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "==============================================="
echo ""

# AI 서버 실행
python3 ai_server_final_with_triplets.py