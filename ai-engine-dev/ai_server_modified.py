"""
Modified load_qwen3 function to use local qwen3_lora_ttalkkac_4b model
This file contains only the modified function to replace in ai_server_final_with_triplets.py
"""

import os
import torch
import logging
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

logger = logging.getLogger(__name__)

def load_qwen3():
    """Qwen3 4B LoRA 모델 로딩 (로컬 모델 사용)"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None or qwen_tokenizer is None:
        logger.info("🚀 Loading Qwen3 4B LoRA model...")
        
        try:
            # Config 임포트 (있는 경우)
            try:
                from config import Config
                lora_path = Config.QWEN_LORA_4B
                base_model_name = Config.QWEN_BASE_MODEL
                use_vllm = Config.QWEN_USE_VLLM
            except ImportError:
                # Config 없으면 직접 경로 설정
                # RunPod에서는 /workspace 경로 사용
                if os.path.exists("/workspace"):
                    lora_path = "/workspace/TtalKkac/ai-engine-dev/models/qwen_lora/qwen3_lora_ttalkkac_4b"
                else:
                    # 로컬 Windows 경로
                    lora_path = "C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/qwen3_lora_ttalkkac_4b"
                
                # 베이스 모델 (LoRA가 학습된 베이스 모델과 일치해야 함)
                # 4B 모델은 보통 Qwen2.5-7B-Instruct 베이스 사용
                base_model_name = os.getenv("QWEN_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
                use_vllm = os.getenv("USE_VLLM", "false").lower() == "true"
            
            # 경로 확인
            lora_path = Path(lora_path)
            if not lora_path.exists():
                raise FileNotFoundError(f"LoRA model not found at {lora_path}")
            
            logger.info(f"📁 LoRA path: {lora_path}")
            logger.info(f"🤖 Base model: {base_model_name}")
            
            # VLLM 사용 시도
            if use_vllm:
                try:
                    logger.info("⚡ Attempting to use VLLM for inference...")
                    from vllm import LLM
                    from vllm.lora.request import LoRARequest
                    
                    # VLLM with LoRA support
                    qwen_model = LLM(
                        model=base_model_name,
                        enable_lora=True,
                        max_lora_rank=64,
                        tensor_parallel_size=1,
                        gpu_memory_utilization=0.8,
                        trust_remote_code=True,
                        max_model_len=8192,  # 4B 모델용 축소
                        dtype="float16"
                    )
                    
                    # LoRA 어댑터 등록
                    lora_request = LoRARequest(
                        "ttalkkac_4b",
                        1,
                        str(lora_path)
                    )
                    
                    # 토크나이저 로드
                    qwen_tokenizer = AutoTokenizer.from_pretrained(
                        str(lora_path),  # LoRA 폴더에서 토크나이저 로드
                        trust_remote_code=True
                    )
                    
                    # 토크나이저가 없으면 베이스 모델에서 로드
                    if qwen_tokenizer is None or not hasattr(qwen_tokenizer, 'apply_chat_template'):
                        qwen_tokenizer = AutoTokenizer.from_pretrained(
                            base_model_name,
                            trust_remote_code=True
                        )
                    
                    logger.info("✅ VLLM with LoRA loaded successfully")
                    
                except Exception as e:
                    logger.warning(f"⚠️ VLLM loading failed: {e}")
                    logger.info("🔄 Falling back to Transformers + PEFT...")
                    use_vllm = False
            
            # Transformers + PEFT 방식 (기본)
            if not use_vllm:
                logger.info("📚 Using Transformers + PEFT for LoRA model")
                
                # 1. 토크나이저 로드 (LoRA 폴더에서 먼저 시도)
                try:
                    qwen_tokenizer = AutoTokenizer.from_pretrained(
                        str(lora_path),
                        trust_remote_code=True
                    )
                    logger.info(f"✅ Tokenizer loaded from LoRA path")
                except Exception as e:
                    logger.info(f"⚠️ Loading tokenizer from base model instead: {e}")
                    qwen_tokenizer = AutoTokenizer.from_pretrained(
                        base_model_name,
                        trust_remote_code=True
                    )
                
                # 패딩 토큰 설정
                if qwen_tokenizer.pad_token is None:
                    qwen_tokenizer.pad_token = qwen_tokenizer.eos_token
                
                # 2. 베이스 모델 로드
                logger.info(f"Loading base model: {base_model_name}")
                
                # 메모리 효율적인 로딩
                qwen_model = AutoModelForCausalLM.from_pretrained(
                    base_model_name,
                    torch_dtype=torch.float16,  # FP16 사용
                    device_map="auto",  # 자동 디바이스 매핑
                    trust_remote_code=True,
                    use_cache=True,  # KV 캐시 사용
                    low_cpu_mem_usage=True  # CPU 메모리 절약
                )
                
                # 3. LoRA 어댑터 로드
                logger.info(f"Loading LoRA adapter from {lora_path}")
                qwen_model = PeftModel.from_pretrained(
                    qwen_model,
                    str(lora_path),
                    torch_dtype=torch.float16
                )
                
                # 4. 추론 모드 설정 (선택적 병합)
                merge_adapter = os.getenv("MERGE_LORA_ADAPTER", "false").lower() == "true"
                if merge_adapter:
                    logger.info("🔀 Merging LoRA adapter with base model...")
                    qwen_model = qwen_model.merge_and_unload()
                    logger.info("✅ LoRA adapter merged")
                else:
                    # 병합하지 않고 그대로 사용 (메모리 절약)
                    qwen_model.eval()
                
                # GPU로 이동 (device_map="auto"가 처리 못한 경우)
                if torch.cuda.is_available() and not hasattr(qwen_model, 'device'):
                    qwen_model = qwen_model.cuda()
                    logger.info("🎮 Model moved to GPU")
                
                logger.info("✅ Qwen3 4B LoRA model loaded successfully")
                
                # 모델 정보 출력
                total_params = sum(p.numel() for p in qwen_model.parameters())
                trainable_params = sum(p.numel() for p in qwen_model.parameters() if p.requires_grad)
                logger.info(f"📊 Model info:")
                logger.info(f"   - Total parameters: {total_params:,}")
                logger.info(f"   - Trainable parameters: {trainable_params:,}")
                logger.info(f"   - Device: {next(qwen_model.parameters()).device}")
                
        except FileNotFoundError as e:
            logger.error(f"❌ LoRA model file not found: {e}")
            logger.error(f"Please ensure the model exists at: {lora_path}")
            raise e
            
        except Exception as e:
            logger.error(f"❌ Qwen3 4B LoRA loading failed: {e}")
            
            # 디버깅 정보
            logger.error("Debug info:")
            logger.error(f"  - LoRA path exists: {lora_path.exists() if isinstance(lora_path, Path) else os.path.exists(lora_path)}")
            logger.error(f"  - Current directory: {os.getcwd()}")
            logger.error(f"  - Python path: {sys.path}")
            
            # 대체 방안 제시
            logger.info("💡 Alternatives:")
            logger.info("1. Check if the LoRA model path is correct")
            logger.info("2. Ensure PEFT is installed: pip install peft")
            logger.info("3. Try using the base model without LoRA")
            
            raise e
    
    return qwen_model, qwen_tokenizer

# 추가 헬퍼 함수: 모델 정보 확인
def check_model_info():
    """로드된 모델 정보 확인"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None:
        return {"status": "not_loaded", "message": "Model not loaded"}
    
    info = {
        "status": "loaded",
        "model_type": type(qwen_model).__name__,
        "has_lora": hasattr(qwen_model, 'peft_config'),
    }
    
    if hasattr(qwen_model, 'peft_config'):
        info["lora_config"] = {
            "r": qwen_model.peft_config.r if hasattr(qwen_model.peft_config, 'r') else None,
            "lora_alpha": qwen_model.peft_config.lora_alpha if hasattr(qwen_model.peft_config, 'lora_alpha') else None,
        }
    
    if qwen_tokenizer:
        info["tokenizer"] = {
            "vocab_size": qwen_tokenizer.vocab_size,
            "model_max_length": qwen_tokenizer.model_max_length,
        }
    
    # GPU 메모리 상태
    if torch.cuda.is_available():
        info["gpu_memory"] = {
            "allocated": f"{torch.cuda.memory_allocated() / 1024**3:.2f} GB",
            "reserved": f"{torch.cuda.memory_reserved() / 1024**3:.2f} GB",
        }
    
    return info