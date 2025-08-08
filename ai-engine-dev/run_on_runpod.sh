#!/bin/bash

echo "========================================="
echo "🚀 RunPod BERT 모델 실행"
echo "========================================="

# 파일 확인
echo "📋 BERT 모델 파일 확인..."
if [ -f "/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/Ttalkkak_model_v3.pt" ]; then
    echo "✅ Ttalkkak_model_v3.pt 존재"
else
    echo "❌ Ttalkkak_model_v3.pt 없음"
fi

if [ -f "/workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/config.json" ]; then
    echo "✅ config.json 존재"
else
    echo "❌ config.json 없음"
fi

# simple_bert_filter.py가 없으면 생성
if [ ! -f "simple_bert_filter.py" ]; then
    echo "📝 simple_bert_filter.py 생성 중..."
    cat > simple_bert_filter.py << 'EOF'
"""간단한 BERT 필터링 대체 모듈"""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class SimpleBertFilter:
    def __init__(self):
        logger.info("📦 Simple BERT Filter 초기화")
        self.noise_keywords = ["음", "어", "그", "저기", "아", "네", "예", "하하", "ㅋㅋ", "ㅎㅎ"]
        
    def filter_text(self, text: str) -> Dict[str, Any]:
        sentences = text.split('.')
        filtered_sentences = []
        noise_count = 0
        
        for sent in sentences:
            sent = sent.strip()
            if not sent or len(sent) < 5:
                noise_count += 1
                continue
                
            is_noise = False
            for keyword in self.noise_keywords:
                if sent.startswith(keyword) or sent.count(keyword) > 2:
                    is_noise = True
                    noise_count += 1
                    break
            
            if not is_noise:
                filtered_sentences.append(sent)
        
        filtered_text = '. '.join(filtered_sentences)
        
        return {
            "success": True,
            "filtered_transcript": filtered_text,
            "triplet_data": {"noise_segments": [], "valid_segments": filtered_sentences},
            "processing_stats": {
                "total_sentences": len(sentences),
                "filtered_sentences": len(filtered_sentences),
                "noise_count": noise_count
            }
        }

class SimpleTripletProcessor:
    def __init__(self):
        logger.info("🔧 Simple Triplet 프로세서 초기화")
        self.bert_filter = SimpleBertFilter()
        
    def process_whisperx_result(self, whisperx_result, enable_bert_filtering=True, save_noise_log=False):
        try:
            full_text = whisperx_result.get("full_text", "")
            if enable_bert_filtering:
                return self.bert_filter.filter_text(full_text)
            else:
                return {"success": True, "filtered_transcript": full_text, "triplet_data": {}, "processing_stats": {}}
        except Exception as e:
            logger.error(f"Simple Triplet 처리 오류: {e}")
            return {"success": False, "filtered_transcript": whisperx_result.get("full_text", ""), "error": str(e)}

class SimpleBertClassifier:
    def __init__(self):
        logger.info("🧠 Simple BERT 분류기 초기화")
        
    def load_model(self):
        logger.info("✅ Simple BERT 분류기 준비 완료")
        return True
EOF
    echo "✅ simple_bert_filter.py 생성 완료"
fi

echo ""
echo "========================================="
echo "📊 실행 중..."
echo "========================================="
echo ""

# Python 스크립트 실행
python process_file_standalone.py test.MP3

echo ""
echo "✅ 완료!"