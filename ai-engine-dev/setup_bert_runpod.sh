#!/bin/bash

echo "========================================="
echo "🚀 RunPod BERT 설정 스크립트"
echo "========================================="

# BERT 모델 디렉토리로 이동
cd /workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/

# config.json 생성
echo "📄 Creating config.json..."
cat > config.json << 'EOF'
{
  "architectures": [
    "BertForSequenceClassification"
  ],
  "attention_probs_dropout_prob": 0.3,
  "classifier_dropout": null,
  "hidden_act": "gelu",
  "hidden_dropout_prob": 0.3,
  "hidden_size": 768,
  "initializer_range": 0.02,
  "intermediate_size": 3072,
  "layer_norm_eps": 1e-12,
  "max_position_embeddings": 512,
  "model_type": "bert",
  "num_attention_heads": 12,
  "num_hidden_layers": 12,
  "pad_token_id": 0,
  "position_embedding_type": "absolute",
  "problem_type": "single_label_classification",
  "torch_dtype": "float32",
  "transformers_version": "4.53.2",
  "type_vocab_size": 2,
  "use_cache": true,
  "vocab_size": 32002,
  "id2label": {
    "0": "valid",
    "1": "noise"
  },
  "label2id": {
    "valid": 0,
    "noise": 1
  }
}
EOF

# tokenizer_config.json 생성
echo "📝 Creating tokenizer_config.json..."
cat > tokenizer_config.json << 'EOF'
{
  "added_tokens_decoder": {
    "0": {
      "content": "[PAD]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "1": {
      "content": "[UNK]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "2": {
      "content": "[CLS]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "3": {
      "content": "[SEP]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "4": {
      "content": "[MASK]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "32000": {
      "content": "[TGT]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    },
    "32001": {
      "content": "[/TGT]",
      "lstrip": false,
      "normalized": false,
      "rstrip": false,
      "single_word": false,
      "special": true
    }
  },
  "additional_special_tokens": [
    "[TGT]",
    "[/TGT]"
  ],
  "clean_up_tokenization_spaces": false,
  "cls_token": "[CLS]",
  "do_basic_tokenize": true,
  "do_lower_case": false,
  "mask_token": "[MASK]",
  "model_max_length": 512,
  "pad_token": "[PAD]",
  "sep_token": "[SEP]",
  "tokenize_chinese_chars": true,
  "tokenizer_class": "BertTokenizer",
  "unk_token": "[UNK]"
}
EOF

# ai-engine-dev 디렉토리로 이동
cd /workspace/SKN12-FINAL-3TEAM/ai-engine-dev/

# simple_bert_filter.py가 없으면 생성
if [ ! -f "simple_bert_filter.py" ]; then
    echo "🔧 Creating simple_bert_filter.py..."
    cat > simple_bert_filter.py << 'EOF'
"""간단한 BERT 필터링 대체 모듈"""
import torch
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class SimpleBertFilter:
    """BERT 모델 로드 실패시 사용할 간단한 필터"""
    
    def __init__(self):
        logger.info("📦 Simple BERT Filter 초기화")
        self.noise_keywords = [
            "음", "어", "그", "저기", "아", "네", "예", 
            "하하", "ㅋㅋ", "ㅎㅎ", "음음", "어어",
            "그래서", "그니까", "그러니까", "뭐지"
        ]
        
    def filter_text(self, text: str) -> Dict[str, Any]:
        """텍스트 필터링"""
        
        sentences = text.split('.')
        filtered_sentences = []
        noise_count = 0
        
        for sent in sentences:
            sent = sent.strip()
            if not sent or len(sent) < 5:
                noise_count += 1
                continue
                
            # 노이즈 키워드 체크
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
            "triplet_data": {
                "noise_segments": [],
                "valid_segments": filtered_sentences
            },
            "processing_stats": {
                "total_sentences": len(sentences),
                "filtered_sentences": len(filtered_sentences),
                "noise_count": noise_count,
                "filtering_ratio": noise_count / len(sentences) if sentences else 0
            }
        }

class SimpleTripletProcessor:
    """Triplet Processor 대체"""
    
    def __init__(self):
        logger.info("🔧 Simple Triplet 프로세서 초기화")
        self.bert_filter = SimpleBertFilter()
        
    def process_whisperx_result(self, whisperx_result, enable_bert_filtering=True, save_noise_log=False):
        """WhisperX 결과 처리"""
        
        try:
            full_text = whisperx_result.get("full_text", "")
            
            if enable_bert_filtering:
                return self.bert_filter.filter_text(full_text)
            else:
                return {
                    "success": True,
                    "filtered_transcript": full_text,
                    "triplet_data": {},
                    "processing_stats": {}
                }
                
        except Exception as e:
            logger.error(f"Simple Triplet 처리 오류: {e}")
            return {
                "success": False,
                "filtered_transcript": whisperx_result.get("full_text", ""),
                "error": str(e)
            }

class SimpleBertClassifier:
    """BERT Classifier 대체"""
    
    def __init__(self):
        logger.info("🧠 Simple BERT 분류기 초기화")
        
    def load_model(self):
        """모델 로드 (더미)"""
        logger.info("✅ Simple BERT 분류기 준비 완료")
        return True
EOF
fi

# 파일 확인
echo ""
echo "📋 파일 확인..."
echo "-------------------"

# BERT 모델 디렉토리 파일들
echo "📁 /workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/:"
ls -la /workspace/SKN12-FINAL-3TEAM/Bert모델/Ttalkkak_model_v2/ | grep -E "(config|tokenizer|\.pt)"

echo ""
echo "📁 /workspace/SKN12-FINAL-3TEAM/ai-engine-dev/:"
ls -la | grep -E "(bert|simple|process)"

echo ""
echo "========================================="
echo "✅ 설정 완료!"
echo "========================================="
echo ""
echo "실행:"
echo "  python process_file_standalone.py test.MP3"
echo ""