#!/bin/bash

# RunPod 스탠드얼론 실행 스크립트
echo "==========================================="
echo "TtalKkak Standalone Pipeline Processor"
echo "==========================================="
echo ""

# Python 환경 확인
python3 --version

# 필요한 패키지 설치 (처음 실행 시)
if [ "$1" == "--install" ]; then
    echo "Installing required packages..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    pip install transformers accelerate
    pip install vllm  # GPU가 있는 경우
    pip install whisperx
    pip install fastapi uvicorn pydantic
    echo "Installation complete!"
    echo ""
fi

# 입력 파일 확인
INPUT_FILE="${1:-test.MP3}"

if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Error: Input file not found: $INPUT_FILE"
    echo ""
    echo "Usage: ./run_standalone.sh [input_file] [options]"
    echo ""
    echo "Examples:"
    echo "  ./run_standalone.sh test.MP3           # Process audio file"
    echo "  ./run_standalone.sh meeting.txt        # Process text file"
    echo "  ./run_standalone.sh audio.wav --use-vllm  # Use VLLM"
    echo "  ./run_standalone.sh --install          # Install packages"
    exit 1
fi

# VLLM 사용 여부
if [ "$2" == "--use-vllm" ]; then
    export USE_VLLM=true
    echo "✅ Using VLLM for acceleration"
else
    export USE_VLLM=false
    echo "ℹ️ Using standard Transformers"
fi

# GPU 메모리 설정
export CUDA_VISIBLE_DEVICES=0
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# 모델 캐시 디렉토리 설정
export HF_HOME=/workspace/.cache/huggingface
export TORCH_HOME=/workspace/.cache/torch

echo ""
echo "📁 Input file: $INPUT_FILE"
echo "📂 Output directory: pipeline_results/"
echo ""
echo "Starting processing..."
echo "==========================================="
echo ""

# Python 스크립트 실행
python3 process_file_standalone.py "$INPUT_FILE" $2

echo ""
echo "==========================================="
echo "✅ Processing complete!"
echo "📁 Check results in: pipeline_results/"
echo "==========================================="

# 결과 디렉토리 내용 표시
echo ""
echo "Generated files:"
ls -la pipeline_results/session_*/