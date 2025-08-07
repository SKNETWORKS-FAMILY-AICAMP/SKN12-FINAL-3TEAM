import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType

print("1. AWQ 모델 로딩 전:", torch.cuda.memory_allocated(0)/1024**3, "GB")

# 실제 모델 이름
model_name = "Qwen/Qwen3-4B-AWQ"

model = AutoModelForCausalLM.from_pretrained(model_name, device_map={'': 0}, torch_dtype=torch.float16, trust_remote_code=True)
print("2. AWQ 모델 로딩 후:", torch.cuda.memory_allocated(0)/1024**3, "GB")

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    inference_mode=False,
    r=16,
    lora_alpha=32,
    lora_dropout=0.1,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    bias="none",
)
model = get_peft_model(model, lora_config)
print("3. LoRA 적용 후:", torch.cuda.memory_allocated(0)/1024**3, "GB")

tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
print("4. 토크나이저 로딩 후:", torch.cuda.memory_allocated(0)/1024**3, "GB")

# 샘플 데이터 토크나이징
sample_text = "안녕하세요 " * 2000  # 긴 텍스트
inputs = tokenizer(sample_text, return_tensors="pt", max_length=12000, truncation=True, padding=True)
inputs = {k: v.to('cuda') for k, v in inputs.items()}
print("5. 샘플 토크나이징 후:", torch.cuda.memory_allocated(0)/1024**3, "GB")

# 포워드 패스 (학습 모드)
model.train()
outputs = model(**inputs, labels=inputs["input_ids"])
print("6. 포워드 패스 후:", torch.cuda.memory_allocated(0)/1024**3, "GB")

# 백워드 패스 (그래디언트 계산)
loss = outputs.loss
loss.backward()
print("7. 백워드 패스 후:", torch.cuda.memory_allocated(0)/1024**3, "GB")