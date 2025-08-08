#!/bin/bash

echo "========================================="
echo "📦 Triplet 모듈 설정 스크립트"
echo "========================================="

# 필수 파일 목록
FILES=(
    "whisperX_parser.py"
    "create_triplets.py"
    "triplet_preprocessor.py"
)

echo "📋 필수 파일 확인..."
echo "-------------------"

MISSING_FILES=0

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - 존재"
    else
        echo "❌ $file - 없음"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ $MISSING_FILES -gt 0 ]; then
    echo ""
    echo "⚠️  필수 파일이 없습니다!"
    echo ""
    echo "다음 파일들이 필요합니다:"
    echo "  1. whisperX_parser.py - WhisperX 결과 파싱"
    echo "  2. create_triplets.py - Triplet 구조 생성"
    echo "  3. triplet_preprocessor.py - BERT 전처리"
    echo ""
    echo "파일 복사 방법:"
    echo "  cp /path/to/original/1.\\ whisperX_parser.py ./whisperX_parser.py"
    echo "  cp /path/to/original/2.\\ create_triplets.py ./create_triplets.py"
    echo "  cp /path/to/original/3.\\ triplet_preprocessor.py ./triplet_preprocessor.py"
else
    echo ""
    echo "✅ 모든 필수 파일이 준비되었습니다!"
fi

# natsort 설치 확인
echo ""
echo "📦 필요한 패키지 설치..."
pip install natsort --quiet

echo ""
echo "========================================="
echo "✅ 설정 완료!"
echo "========================================="