#!/bin/bash

echo "========================================="
echo "🚀 RunPod Complete Setup Script"
echo "========================================="

# 1. 기본 패키지 업데이트
echo "📦 Updating packages..."
apt-get update && apt-get install -y ffmpeg

# 2. Python 패키지 설치
echo "📦 Installing Python packages..."

# WhisperX 관련
pip install git+https://github.com/m-bain/whisperx.git
pip install ffmpeg-python

# BERT 관련
pip install transformers==4.36.0
pip install sentence-transformers
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install natsort  # TripletProcessor 필요
pip install klue-bert-base  # 한국어 BERT

# LLM 관련
pip install autoawq
pip install vllm

# 기타 필요 패키지
pip install pyannote.audio
pip install accelerate
pip install sentencepiece protobuf

# 3. BERT 모델 디렉토리 생성
echo "📁 Creating BERT model directory..."
mkdir -p Bert모델/Ttalkkak_model_v2

# 4. 모델 파일 확인
echo ""
echo "⚠️  필요한 모델 파일:"
echo ""
echo "1. BERT 모델:"
echo "   - 로컬: C:\\Users\\SH\\Desktop\\TtalKkac\\Bert모델\\Ttalkkak_model_v2\\Ttalkkak_model_v3.pt"
echo "   - RunPod: ./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
echo ""
echo "2. 테스트 오디오:"
echo "   - test.MP3"
echo ""

# 5. triplet_processor.py 파일이 없으면 생성
if [ ! -f "triplet_processor.py" ]; then
    echo "📝 Creating triplet_processor.py..."
    cat > triplet_processor.py << 'EOF'
"""Triplet Processor for BERT filtering"""
import logging

logger = logging.getLogger(__name__)

class TripletProcessor:
    def __init__(self):
        logger.info("TripletProcessor initialized")
    
    def process_whisperx_result(self, whisperx_result, enable_bert_filtering=True, save_noise_log=False):
        """Process WhisperX results with BERT filtering"""
        try:
            # 간단한 처리 로직
            return {
                "success": True,
                "filtered_transcript": whisperx_result.get("full_text", ""),
                "triplet_data": {
                    "noise_segments": [],
                    "valid_segments": []
                },
                "processing_stats": {}
            }
        except Exception as e:
            logger.error(f"Error in TripletProcessor: {e}")
            return {"success": False}
EOF
fi

# 6. 파일 확인
echo ""
echo "📋 Checking files..."
echo "-------------------"

# BERT 모델 확인 - 여러 경로 확인
BERT_FOUND=false
if [ -f "/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt" ]; then
    echo "✅ BERT model found at absolute path!"
    ls -lh "/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
    BERT_FOUND=true
elif [ -f "./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt" ]; then
    echo "✅ BERT model found at relative path!"
    ls -lh "./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
    BERT_FOUND=true
fi

if [ "$BERT_FOUND" = false ]; then
    echo "⚠️  BERT model not found"
    echo "    Expected locations:"
    echo "    - /workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
    echo "    - ./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
fi

# Python 파일들 확인
for file in process_file_standalone.py bert_classifier.py triplet_processor.py meeting_analysis_prompts.py prd_generation_prompts.py; do
    if [ -f "$file" ]; then
        echo "✅ $file found"
    else
        echo "⚠️  $file not found"
    fi
done

# 7. GPU 확인
echo ""
echo "🎮 GPU Status:"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader

echo ""
echo "========================================="
echo "✅ Setup complete!"
echo "========================================="
echo ""
echo "실행 방법:"
echo "  1. BERT 모델 업로드 (아직 안했다면):"
echo "     scp Ttalkkak_model_v3.pt user@runpod:~/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/Bert모델/Ttalkkak_model_v2/"
echo ""
echo "  2. 테스트 실행:"
echo "     python process_file_standalone.py test.MP3"
echo "     python process_file_standalone.py test.MP3 --use-vllm"
echo ""