#!/usr/bin/env python3
"""
LoRA 어댑터를 베이스 모델과 병합하는 스크립트
VLLM에서 사용하기 위해 필요
"""

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch
import os

# 경로 설정
base_model_name = "Qwen/Qwen3-4B"
lora_path = "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/qwen3_lora_ttalkkac_4b"
merged_path = "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/qwen3-4b-merged"

print("=" * 50)
print("🔄 LoRA 어댑터 병합 시작")
print("=" * 50)

# LoRA 어댑터 파일 확인
if not os.path.exists(lora_path):
    print(f"❌ LoRA 경로를 찾을 수 없습니다: {lora_path}")
    exit(1)

if not os.path.exists(f"{lora_path}/adapter_config.json"):
    print(f"❌ adapter_config.json을 찾을 수 없습니다: {lora_path}/adapter_config.json")
    exit(1)

print(f"✅ LoRA 경로 확인: {lora_path}")
print(f"📦 베이스 모델: {base_model_name}")
print(f"💾 저장 경로: {merged_path}")
print()

# 베이스 모델 로드
print("1️⃣ 베이스 모델 로딩 중... (약 1-2분 소요)")
try:
    # accelerate가 있는지 확인
    try:
        import accelerate
        print("✅ accelerate 발견, device_map 사용")
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=torch.float16,
            trust_remote_code=True,
            device_map="auto"
        )
    except ImportError:
        print("⚠️ accelerate 없음, 기본 로드")
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=torch.float16,
            trust_remote_code=True
        )
        if torch.cuda.is_available():
            base_model = base_model.cuda()
    
    print("✅ 베이스 모델 로드 완료")
except Exception as e:
    print(f"❌ 베이스 모델 로드 실패: {e}")
    exit(1)

# LoRA 어댑터 적용
print("2️⃣ LoRA 어댑터 적용 중...")
try:
    model_with_lora = PeftModel.from_pretrained(base_model, lora_path)
    print("✅ LoRA 어댑터 적용 완료")
except Exception as e:
    print(f"❌ LoRA 어댑터 로드 실패: {e}")
    print(f"   어댑터 파일이 손상되었거나 호환되지 않을 수 있습니다.")
    exit(1)

# 병합
print("3️⃣ 모델 병합 중...")
try:
    merged_model = model_with_lora.merge_and_unload()
    print("✅ 모델 병합 완료")
except Exception as e:
    print(f"❌ 병합 실패: {e}")
    exit(1)

# 병합된 모델 저장
print("4️⃣ 병합된 모델 저장 중... (약 1-2분 소요)")
try:
    # 디렉토리 생성
    os.makedirs(merged_path, exist_ok=True)
    
    # 모델 저장
    merged_model.save_pretrained(merged_path)
    print("✅ 모델 저장 완료")
    
    # 토크나이저 저장
    print("5️⃣ 토크나이저 저장 중...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    tokenizer.save_pretrained(merged_path)
    print("✅ 토크나이저 저장 완료")
    
except Exception as e:
    print(f"❌ 저장 실패: {e}")
    exit(1)

print()
print("=" * 50)
print("🎉 병합 완료!")
print(f"📁 병합된 모델 위치: {merged_path}")
print("🚀 이제 서버를 재시작하면 VLLM이 병합된 모델을 사용합니다.")
print("   실행: python ai_server_final_with_triplets.py")
print("=" * 50)