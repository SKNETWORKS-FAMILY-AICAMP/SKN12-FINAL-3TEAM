#!/bin/bash

echo "========================================="
echo "📦 BERT 모델 파일 복사 스크립트"
echo "========================================="

# BERT 모델 디렉토리 생성
mkdir -p ./Bert모델/Ttalkkak_model_v2

# 필요한 파일들 목록
FILES=(
    "Ttalkkak_model_v3.pt"
    "config.json"
    "tokenizer_config.json"
    "tokenizer.json"
    "special_tokens_map.json"
    "added_tokens.json"
)

echo "📁 필요한 파일들:"
for file in "${FILES[@]}"; do
    echo "  - $file"
done

echo ""
echo "RunPod에서 이 파일들이 필요합니다:"
echo "/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/"
echo ""
echo "파일 업로드 방법:"
echo "1. RunPod 웹 인터페이스에서 직접 업로드"
echo "2. 또는 로컬에서 scp 사용:"
echo "   scp -r C:\\Users\\SH\\Desktop\\TtalKkac\\Bert모델\\Ttalkkak_model_v2\\* user@runpod:/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/"
echo ""

# 파일 확인
echo "📋 현재 파일 상태:"
for file in "${FILES[@]}"; do
    if [ -f "/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/$file" ]; then
        echo "  ✅ $file - 존재"
    else
        echo "  ❌ $file - 없음"
    fi
done

echo ""
echo "========================================="