"""
TtalKkac AI Engine Configuration
RunPod 및 로컬 환경 통합 설정
"""

import os
from pathlib import Path

class Config:
    """AI 엔진 설정 클래스"""
    
    # 기본 경로 설정
    BASE_DIR = Path(__file__).parent.absolute()
    MODEL_DIR = Path(os.getenv("MODEL_DIR", str(BASE_DIR / "models")))
    DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
    RESULT_DIR = Path(os.getenv("RESULT_DIR", str(BASE_DIR / "results")))
    
    # 모델 경로 설정
    BERT_MODEL_DIR = MODEL_DIR / "bert"
    BERT_MODEL_PATH = Path(os.getenv("BERT_MODEL_PATH", 
                                     str(BERT_MODEL_DIR / "Ttalkkac_model_v3.pt")))
    BERT_CONFIG_PATH = Path(os.getenv("BERT_CONFIG_PATH", 
                                      str(BERT_MODEL_DIR / "bert_model_config.json")))
    BERT_TOKENIZER_PATH = Path(os.getenv("BERT_TOKENIZER_PATH", 
                                         str(BERT_MODEL_DIR / "bert_tokenizer_config.json")))
    
    # Qwen LoRA 어댑터 경로
    QWEN_LORA_BASE = MODEL_DIR / "qwen_lora"
    QWEN_LORA_1B = Path(os.getenv("QWEN_LORA_1B", 
                                  str(QWEN_LORA_BASE / "qwen3_lora_ttalkkac_1.7b")))
    QWEN_LORA_4B = Path(os.getenv("QWEN_LORA_4B", 
                                  str(QWEN_LORA_BASE / "qwen3_lora_ttalkkac_4b")))
    QWEN_LORA_8B = Path(os.getenv("QWEN_LORA_8B", 
                                  str(QWEN_LORA_BASE / "qwen3_lora_ttalkkac_8b")))
    
    # Qwen 베이스 모델
    QWEN_BASE_MODEL = os.getenv("QWEN_BASE_MODEL", "Qwen/Qwen2.5-32B-Instruct-AWQ")
    QWEN_USE_VLLM = os.getenv("USE_VLLM", "true").lower() == "true"
    
    # WhisperX 설정
    WHISPERX_MODEL = os.getenv("WHISPERX_MODEL", "large-v3")
    WHISPERX_LANGUAGE = os.getenv("WHISPERX_LANGUAGE", "ko")
    WHISPERX_BATCH_SIZE = int(os.getenv("WHISPERX_BATCH_SIZE", "16"))
    WHISPERX_COMPUTE_TYPE = os.getenv("WHISPERX_COMPUTE_TYPE", "float16")
    
    # API 서버 설정
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", "8000"))
    API_WORKERS = int(os.getenv("API_WORKERS", "1"))
    
    # CORS 설정
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
    CORS_ALLOW_METHODS = os.getenv("CORS_ALLOW_METHODS", "*").split(",")
    CORS_ALLOW_HEADERS = os.getenv("CORS_ALLOW_HEADERS", "*").split(",")
    
    # GPU 설정
    CUDA_DEVICE = os.getenv("CUDA_VISIBLE_DEVICES", "0")
    CUDA_MEMORY_FRACTION = float(os.getenv("CUDA_MEMORY_FRACTION", "0.9"))
    
    # 배치 처리 설정
    BERT_BATCH_SIZE = int(os.getenv("BERT_BATCH_SIZE", "32"))
    QWEN_BATCH_SIZE = int(os.getenv("QWEN_BATCH_SIZE", "1"))
    
    # 토큰 제한
    MAX_INPUT_TOKENS = int(os.getenv("MAX_INPUT_TOKENS", "32000"))
    MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "4096"))
    
    # 청킹 설정
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "8000"))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "500"))
    
    # HuggingFace 설정
    HF_TOKEN = os.getenv("HF_TOKEN", "")
    HF_CACHE_DIR = Path(os.getenv("HF_CACHE_DIR", str(MODEL_DIR / ".cache")))
    
    # 로깅 설정
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = Path(os.getenv("LOG_FILE", str(BASE_DIR / "ai_server.log")))
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # 타임아웃 설정
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "300"))  # 5분
    MODEL_LOAD_TIMEOUT = int(os.getenv("MODEL_LOAD_TIMEOUT", "600"))  # 10분
    
    # 캐싱 설정
    ENABLE_CACHE = os.getenv("ENABLE_CACHE", "false").lower() == "true"
    CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))  # 1시간
    
    # 성능 최적화 설정
    USE_MIXED_PRECISION = os.getenv("USE_MIXED_PRECISION", "true").lower() == "true"
    USE_GRADIENT_CHECKPOINTING = os.getenv("USE_GRADIENT_CHECKPOINTING", "false").lower() == "true"
    
    # 파일 업로드 제한
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "104857600"))  # 100MB
    ALLOWED_AUDIO_FORMATS = os.getenv("ALLOWED_AUDIO_FORMATS", "mp3,wav,m4a,mp4").split(",")
    
    # Triplet 처리 설정
    TRIPLET_CONTEXT_SIZE = int(os.getenv("TRIPLET_CONTEXT_SIZE", "2"))
    TRIPLET_FILTER_THRESHOLD = float(os.getenv("TRIPLET_FILTER_THRESHOLD", "0.5"))
    
    # Task 생성 설정
    DEFAULT_NUM_TASKS = int(os.getenv("DEFAULT_NUM_TASKS", "5"))
    MAX_SUBTASKS_PER_TASK = int(os.getenv("MAX_SUBTASKS_PER_TASK", "10"))
    
    # 복잡도 임계값
    HIGH_COMPLEXITY_THRESHOLD = int(os.getenv("HIGH_COMPLEXITY_THRESHOLD", "8"))
    MEDIUM_COMPLEXITY_THRESHOLD = int(os.getenv("MEDIUM_COMPLEXITY_THRESHOLD", "5"))
    
    # 디버그 모드
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    
    @classmethod
    def validate(cls):
        """설정 유효성 검사"""
        errors = []
        
        # 필수 디렉토리 생성
        for dir_path in [cls.MODEL_DIR, cls.DATA_DIR, cls.RESULT_DIR, cls.HF_CACHE_DIR]:
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                errors.append(f"Failed to create directory {dir_path}: {e}")
        
        # HF 토큰 확인
        if not cls.HF_TOKEN and cls.QWEN_USE_VLLM:
            errors.append("HF_TOKEN is required for VLLM models")
        
        # GPU 확인
        try:
            import torch
            if not torch.cuda.is_available():
                errors.append("CUDA is not available")
            else:
                device_count = torch.cuda.device_count()
                device_id = int(cls.CUDA_DEVICE)
                if device_id >= device_count:
                    errors.append(f"CUDA device {device_id} not found (available: 0-{device_count-1})")
        except ImportError:
            errors.append("PyTorch is not installed")
        except Exception as e:
            errors.append(f"GPU check failed: {e}")
        
        # 모델 파일 확인 (선택적)
        if cls.BERT_MODEL_PATH.exists():
            print(f"✅ BERT model found: {cls.BERT_MODEL_PATH}")
        else:
            print(f"⚠️ BERT model not found: {cls.BERT_MODEL_PATH}")
        
        if errors:
            for error in errors:
                print(f"❌ Config Error: {error}")
            return False
        
        print("✅ Configuration validated successfully")
        return True
    
    @classmethod
    def get_env_info(cls):
        """환경 정보 출력"""
        info = {
            "Environment": "RunPod" if "/workspace" in str(cls.BASE_DIR) else "Local",
            "Base Directory": str(cls.BASE_DIR),
            "Model Directory": str(cls.MODEL_DIR),
            "GPU Device": cls.CUDA_DEVICE,
            "VLLM Enabled": cls.QWEN_USE_VLLM,
            "API Port": cls.API_PORT,
            "Debug Mode": cls.DEBUG,
            "Log Level": cls.LOG_LEVEL
        }
        
        return info
    
    @classmethod
    def print_config(cls):
        """설정 정보 출력"""
        print("=" * 60)
        print("TtalKkac AI Engine Configuration")
        print("=" * 60)
        
        for key, value in cls.get_env_info().items():
            print(f"{key:20}: {value}")
        
        print("=" * 60)

# 설정 검증 실행
if __name__ == "__main__":
    Config.print_config()
    Config.validate()