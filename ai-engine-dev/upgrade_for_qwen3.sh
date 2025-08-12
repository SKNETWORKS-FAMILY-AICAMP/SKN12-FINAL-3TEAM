#!/bin/bash

echo "================================"
echo "Qwen3 지원을 위한 Transformers 업그레이드"
echo "================================"

# 1. 현재 버전 확인
echo -e "\n현재 버전:"
python -c "import transformers; print(f'Transformers: {transformers.__version__}')"

# 2. Transformers 업그레이드 (Qwen3 지원)
echo -e "\n1. Transformers 4.51.0+ 설치 중..."
pip install transformers>=4.51.0

# 3. 호환 패키지 업그레이드
echo -e "\n2. 관련 패키지 업그레이드..."
pip install accelerate>=0.25.0
pip install huggingface-hub>=0.19.0

# 4. 버전 확인
echo -e "\n업그레이드 후 버전:"
python -c "
import transformers
import torch

print(f'Transformers: {transformers.__version__}')
print(f'PyTorch: {torch.__version__}')

# Qwen3 지원 확인
if hasattr(transformers, '__version__'):
    ver = transformers.__version__.split('.')
    major, minor = int(ver[0]), int(ver[1])
    if major >= 4 and minor >= 51:
        print('✅ Qwen3 지원 가능!')
    else:
        print('⚠️ Transformers 버전이 낮습니다')
"

echo -e "\n================================"
echo "✅ 업그레이드 완료!"
echo "이제 Qwen3를 사용할 수 있습니다."
echo "서버 재시작: python ai_server_final_with_triplets.py"
echo "================================"