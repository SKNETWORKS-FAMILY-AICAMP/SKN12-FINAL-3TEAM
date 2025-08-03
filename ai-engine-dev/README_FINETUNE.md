# 🤖 Ttalkkac Qwen3 LoRA 파인튜닝 가이드

실제 프로젝트에서 사용하는 프롬프트와 데이터 형식을 그대로 사용하여 Qwen3 모델을 파인튜닝하는 방법입니다.

## 📋 준비사항

### 시스템 요구사항
- **GPU**: NVIDIA GPU 24GB+ VRAM 권장 (RTX 4090, A100, H100 등)
- **CPU**: 8 코어 이상
- **RAM**: 32GB 이상
- **Storage**: 50GB 이상 여유 공간

### 필수 패키지 설치
```bash
pip install -r requirements_finetune.txt
```

## 🚀 파인튜닝 실행

### 방법 1: 자동 실행 스크립트 사용
```bash
chmod +x run_finetune.sh
./run_finetune.sh
```

### 방법 2: 수동 실행
```bash
python qwen3_finetune.py
```

## 📊 데이터 구조

### 입력 데이터 (골드 스탠다드)
- **위치**: `ttalkkac_gold_standard_results_20250731_104912/`
- **구조**: `train_*/result.json`, `val_*/result.json`
- **총 데이터**: 237개 (성공한 골드 스탠다드)
- **고품질 데이터**: 7점 이상만 사용

### 실제 프로젝트 프롬프트 형식
```python
system_prompt = """당신은 회의록을 분석하여 체계적인 노션 프로젝트 기획안을 생성하는 전문가입니다. 
회의 내용을 정확히 분석하고 실무에서 바로 활용할 수 있는 구조화된 프로젝트 계획을 만들어주세요."""

user_prompt = """다음 회의록을 바탕으로 노션에서 사용할 수 있는 체계적인 프로젝트 기획안을 JSON 형식으로 생성해주세요.

**요구사항:**
1. 프로젝트명과 목적을 명확히 정의
2. 핵심 아이디어와 실행 계획 수립  
3. 구체적인 목표와 기대 효과 도출
4. 실무진과 일정 계획 포함
5. JSON 형식으로 응답

**회의록:**
{meeting_content}

**응답 형식:**
JSON 형식으로 프로젝트 기획안을 생성해주세요."""
```

## ⚙️ 파인튜닝 설정

### LoRA 설정
```python
LoraConfig(
    r=16,                # LoRA rank
    lora_alpha=32,       # LoRA scaling
    lora_dropout=0.1,    # Dropout
    target_modules=[     # 타겟 모듈
        "q_proj", "v_proj", "k_proj", "o_proj", 
        "gate_proj", "up_proj", "down_proj"
    ],
)
```

### 학습 설정
```python
TrainingArguments(
    num_train_epochs=3,              # 에포크 수
    per_device_train_batch_size=1,   # 배치 크기
    gradient_accumulation_steps=8,   # 그래디언트 누적
    learning_rate=2e-4,              # 학습률
    warmup_steps=100,                # 워밍업 스텝
    fp16=True,                       # 혼합 정밀도
)
```

## 🎯 학습 결과

### 출력 파일
- **모델**: `./qwen3_lora_ttalkkac_YYYYMMDD_HHMMSS/`
- **어댑터**: `adapter_model.bin`
- **설정**: `adapter_config.json`
- **결과**: `training_results.json`

### 성능 모니터링
- 학습 중 loss 감소 추이 확인
- 검증 데이터에서 성능 평가
- 10 스텝마다 로깅

## 🔍 모델 사용법

### 추론 테스트
```bash
python qwen3_inference.py
```

### 프로그래밍 방식 사용
```python
from qwen3_inference import TtalkkacQwenInference

# LoRA 어댑터 경로 지정
inferencer = TtalkkacQwenInference(
    lora_path="./qwen3_lora_ttalkkac_20250801_143000"
)
inferencer.load_model()

# 회의록 기반 프로젝트 기획안 생성
result = inferencer.generate_project_plan(meeting_content)
```

## 📈 성능 최적화

### GPU 메모리 최적화
- **Gradient Checkpointing**: 메모리 사용량 감소
- **Flash Attention**: 어텐션 연산 최적화
- **FP16**: 혼합 정밀도로 메모리 절약

### 배치 처리
- **작은 배치 크기**: 1-2개 샘플
- **그래디언트 누적**: 8 스텝으로 효율적 학습
- **데이터 로더 핀**: 메모리 핀 사용 비활성화

## ⚠️ 주의사항

1. **데이터 품질**: 7점 이상 고품질 데이터만 사용
2. **토큰 길이**: 최대 2048 토큰으로 제한
3. **모델 크기**: Qwen2.5-14B-AWQ 기준 24GB+ VRAM 필요
4. **저장 공간**: 모델 + 어댑터 + 로그 = 약 20GB

## 🔧 트러블슈팅

### CUDA 메모리 부족
```bash
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
```

### Flash Attention 오류
```bash
pip install flash-attn --no-build-isolation
```

### 모델 로딩 실패
- transformers 버전 확인: `>=4.37.0`
- PEFT 버전 확인: `>=0.8.0`

## 📊 예상 결과

### 학습 데이터 분할
- **Train**: ~190개 고품질 샘플
- **Validation**: ~47개 고품질 샘플
- **성공률**: 90%+ (237/263)

### 성능 지표
- **Training Loss**: 1.5 이하
- **Validation Loss**: 1.8 이하
- **JSON 파싱 성공률**: 95%+

## 🎉 완료 후 체크리스트

- [ ] 모델이 정상적으로 저장되었는가?
- [ ] 추론 테스트가 성공했는가?
- [ ] JSON 형식 출력이 올바른가?
- [ ] 실제 프로젝트 프롬프트 형식과 일치하는가?
- [ ] 회의록 → 프로젝트 기획안 변환이 자연스러운가?