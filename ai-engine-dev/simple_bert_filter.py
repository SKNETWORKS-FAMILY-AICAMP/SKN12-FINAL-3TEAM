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