#!/bin/bash

# RunPod GPU 환경 설정 스크립트
echo "=========================================="
echo "RunPod Environment Setup for TtalKkak"
echo "=========================================="
echo ""

# 1. 시스템 업데이트
echo "[1/6] Updating system packages..."
apt-get update && apt-get install -y \
    ffmpeg \
    git \
    vim \
    htop \
    wget \
    curl

# 2. Python 패키지 설치
echo ""
echo "[2/6] Installing Python packages..."
pip install --upgrade pip

# 기본 패키지
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate datasets
pip install fastapi uvicorn pydantic

# WhisperX 설치
echo ""
echo "[3/6] Installing WhisperX..."
pip install git+https://github.com/m-bain/whisperx.git

# VLLM 설치 (GPU 환경)
echo ""
echo "[4/6] Installing VLLM..."
pip install vllm

# 추가 패키지
pip install sentencepiece protobuf
pip install tiktoken
pip install numpy scipy pandas

# 3. 모델 다운로드
echo ""
echo "[5/6] Downloading models..."

# Hugging Face 캐시 설정
export HF_HOME=/workspace/.cache/huggingface
mkdir -p $HF_HOME

# Qwen 모델 다운로드 (백그라운드)
python3 -c "
from transformers import AutoTokenizer, AutoModelForCausalLM
print('Downloading Qwen2.5-32B-Instruct-AWQ...')
try:
    tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen2.5-32B-Instruct-AWQ', trust_remote_code=True)
    print('✅ Tokenizer downloaded')
    # 모델은 VLLM이 자동으로 다운로드
except Exception as e:
    print(f'⚠️ Download failed: {e}')
"

# WhisperX 모델 다운로드
python3 -c "
import whisperx
import torch
print('Downloading WhisperX large-v3...')
try:
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = whisperx.load_model('large-v3', device, compute_type='float16' if device=='cuda' else 'int8')
    print('✅ WhisperX model downloaded')
except Exception as e:
    print(f'⚠️ Download failed: {e}')
"

# 4. 작업 디렉토리 설정
echo ""
echo "[6/6] Setting up working directory..."
cd /workspace

# 프로젝트 파일 복사 (이미 업로드된 경우)
if [ -f "process_file_standalone.py" ]; then
    echo "✅ Project files found"
else
    echo "⚠️ Please upload project files:"
    echo "  - process_file_standalone.py"
    echo "  - task_schemas.py"
    echo "  - meeting_analysis_prompts.py"
    echo "  - prd_generation_prompts.py"
    echo "  - (optional) triplet_processor.py"
    echo "  - (optional) bert_classifier.py"
fi

# 5. 환경 변수 설정
echo ""
echo "Setting environment variables..."
cat > /workspace/.env << EOF
# RunPod 환경 변수
USE_VLLM=true
CUDA_VISIBLE_DEVICES=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# 모델 캐시
HF_HOME=/workspace/.cache/huggingface
TORCH_HOME=/workspace/.cache/torch

# VLLM 설정
VLLM_USE_MODELSCOPE=false
TENSOR_PARALLEL_SIZE=1
GPU_MEMORY_UTILIZATION=0.8
MAX_MODEL_LEN=16384
EOF

source /workspace/.env

# 6. 테스트 스크립트 생성
echo ""
echo "Creating test script..."
cat > /workspace/test_gpu.py << 'EOF'
import torch
import os

print("="*50)
print("GPU Environment Test")
print("="*50)

# GPU 확인
if torch.cuda.is_available():
    print(f"✅ GPU Available: {torch.cuda.get_device_name()}")
    print(f"   CUDA Version: {torch.version.cuda}")
    print(f"   Device Count: {torch.cuda.device_count()}")
    print(f"   Current Device: {torch.cuda.current_device()}")
    
    # 메모리 정보
    total_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
    allocated = torch.cuda.memory_allocated() / 1024**3
    reserved = torch.cuda.memory_reserved() / 1024**3
    
    print(f"\n💾 Memory Info:")
    print(f"   Total VRAM: {total_memory:.1f} GB")
    print(f"   Allocated: {allocated:.1f} GB")
    print(f"   Reserved: {reserved:.1f} GB")
    print(f"   Available: {total_memory - reserved:.1f} GB")
else:
    print("❌ No GPU detected")

# 환경 변수
print(f"\n🔧 Environment:")
print(f"   USE_VLLM: {os.getenv('USE_VLLM', 'false')}")
print(f"   HF_HOME: {os.getenv('HF_HOME', 'not set')}")

print("="*50)
EOF

# 7. 실행 권한 설정
chmod +x run_standalone.sh

# 8. 완료 메시지
echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Quick Start:"
echo "  1. Upload your audio/text file"
echo "  2. Run: ./run_standalone.sh your_file.mp3"
echo ""
echo "🔧 Test GPU:"
echo "  python test_gpu.py"
echo ""
echo "📁 File Structure:"
echo "  /workspace/"
echo "  ├── process_file_standalone.py  (main script)"
echo "  ├── run_standalone.sh           (runner)"
echo "  ├── test.MP3                    (your audio)"
echo "  └── pipeline_results/           (output)"
echo ""
echo "💡 Tips:"
echo "  - Use --use-vllm flag for faster inference"
echo "  - Results saved to pipeline_results/session_*/"
echo "  - Check GPU usage with: nvidia-smi"
echo "=========================================="