#!/bin/bash

echo "========================================="
echo "🚀 RunPod BERT Model Setup Script"
echo "========================================="

# BERT 모델 디렉토리 생성
echo "📁 Creating BERT model directory..."
mkdir -p Bert모델/Ttalkkak_model_v2

# BERT 모델 다운로드 정보
echo ""
echo "⚠️  BERT 모델 파일 업로드 필요:"
echo "    로컬 경로: C:\\Users\\SH\\Desktop\\TtalKkac\\Bert모델\\Ttalkkak_model_v2\\Ttalkkak_model_v3.pt"
echo "    RunPod 경로: ./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
echo ""
echo "업로드 방법:"
echo "1. RunPod 웹 인터페이스에서 파일 업로드"
echo "2. 또는 wget/curl로 다운로드 (URL이 있는 경우)"
echo "3. 또는 scp로 전송"
echo ""

# process_file_standalone.py의 경로 수정
echo "📝 Updating BERT model path for RunPod..."
cat > update_bert_path.py << 'EOF'
import sys

# process_file_standalone.py 읽기
with open('process_file_standalone.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Windows 경로를 Linux 경로로 변경
old_path = r'BERT_MODEL_PATH = r"C:\Users\SH\Desktop\TtalKkac\Bert모델\Ttalkkak_model_v2\Ttalkkak_model_v3.pt"'
new_path = 'BERT_MODEL_PATH = "./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"'

content = content.replace(old_path, new_path)

# 파일 저장
with open('process_file_standalone.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ BERT model path updated for RunPod")
EOF

python update_bert_path.py
rm update_bert_path.py

# BERT 관련 의존성 설치
echo ""
echo "📦 Installing BERT dependencies..."
pip install transformers sentence-transformers torch

# 파일 확인
echo ""
echo "📋 Checking files..."
if [ -f "./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt" ]; then
    echo "✅ BERT model found!"
    ls -lh "./Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt"
else
    echo "⚠️  BERT model not found. Please upload Ttalkkak_model_v3.pt"
fi

echo ""
echo "========================================="
echo "✅ Setup complete!"
echo "========================================="
echo ""
echo "실행 방법:"
echo "  python process_file_standalone.py test.MP3"
echo "  python process_file_standalone.py test.MP3 --use-vllm"
echo ""