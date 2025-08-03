#!/bin/bash

echo "🚀 Ttalkkac Qwen3 LoRA 파인튜닝 시작"
echo "============================================"

# 가상환경 활성화 (필요한 경우)
# source venv/bin/activate

# GPU 메모리 확인
echo "📊 GPU 상태 확인:"
nvidia-smi

echo ""
echo "💾 필요한 패키지 설치 중..."
pip install -r requirements_finetune.txt

echo ""
echo "🤖 파인튜닝 실행..."
python qwen3_finetune.py

echo ""
echo "✅ 파인튜닝 완료!"
echo "🔍 결과를 확인하려면 다음 명령어를 실행하세요:"
echo "python qwen3_inference.py"