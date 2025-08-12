# TtalKkak AI 서버 - 가상환경 분리 가이드

## 📋 개요
WhisperX와 Qwen3의 패키지 충돌을 완전히 해결하기 위해 2개의 독립된 가상환경을 사용합니다.

## 🏗️ 시스템 구조

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   WhisperX Server (8001)    │     │   Main AI Server (8000)     │
├─────────────────────────────┤     ├─────────────────────────────┤
│ 가상환경: venv_whisperx     │     │ 가상환경: venv_main         │
│ Python: 3.10                │     │ Python: 3.10                │
│ PyTorch: 2.1.0+cu118       │     │ PyTorch: 2.1.0+cu118        │
│ Transformers: 4.39.3       │     │ Transformers: 4.51.0        │
│ Tokenizers: 0.15.2         │     │ Tokenizers: 0.21.4          │
│ WhisperX: 3.2.0            │     │ Qwen3, BERT, Triplet        │
└─────────────────────────────┘     └─────────────────────────────┘
```

## 🚀 초기 설정

### 1. 가상환경 설정
```bash
# WhisperX 서버 가상환경 설정
chmod +x setup_venv_whisperx.sh
./setup_venv_whisperx.sh

# 메인 서버 가상환경 설정
chmod +x setup_venv_main.sh
./setup_venv_main.sh
```

### 2. 서버 시작
```bash
# 모든 서버 한번에 시작 (각각의 가상환경 사용)
chmod +x start_all_servers.sh
./start_all_servers.sh

# 서버 종료
./stop_all_servers.sh
```

## 📦 개별 서버 실행

### WhisperX 서버 (터미널 1)
```bash
# 가상환경 활성화
source venv_whisperx/bin/activate

# 서버 실행
python whisperx_server.py

# 또는 스크립트 사용
./run_whisperx_server.sh
```

### 메인 AI 서버 (터미널 2)
```bash
# 가상환경 활성화
source venv_main/bin/activate

# 서버 실행
python ai_server_final_with_triplets.py

# 또는 스크립트 사용
./run_main_server.sh
```

## 📊 패키지 버전 상세

### venv_whisperx (WhisperX 전용)
- **목적**: 음성 파일 전사
- **주요 패키지**:
  - torch==2.1.0+cu118
  - transformers==4.39.3
  - tokenizers==0.15.2
  - faster-whisper==1.0.0
  - whisperx==3.2.0

### venv_main (메인 서버)
- **목적**: Qwen3, BERT, Triplet 처리
- **주요 패키지**:
  - torch==2.1.0+cu118
  - transformers==4.51.0
  - tokenizers==0.21.4
  - peft==0.7.1
  - accelerate==0.25.0
  - httpx==0.28.1 (WhisperX 원격 호출용)

## 🔧 문제 해결

### 가상환경이 활성화되지 않을 때
```bash
# Python 버전 확인
python3 --version

# venv 모듈 설치 (필요시)
apt-get update && apt-get install python3-venv

# 가상환경 재생성
rm -rf venv_whisperx venv_main
./setup_venv_whisperx.sh
./setup_venv_main.sh
```

### CUDA 관련 오류
```bash
# CUDA 버전 확인
nvidia-smi

# PyTorch CUDA 호환성 확인
python -c "import torch; print(torch.cuda.is_available())"
```

### 포트 충돌
```bash
# 사용 중인 포트 확인
lsof -i :8000
lsof -i :8001

# 강제 종료
kill -9 $(lsof -t -i:8000)
kill -9 $(lsof -t -i:8001)
```

## 📝 로그 확인
```bash
# 실시간 로그 모니터링
tail -f logs/whisperx_*.log
tail -f logs/main_*.log

# 에러만 확인
grep ERROR logs/*.log
```

## ✅ 테스트

### 헬스 체크
```bash
# WhisperX 서버
curl http://localhost:8001/health | python3 -m json.tool

# 메인 서버
curl http://localhost:8000/health | python3 -m json.tool

# 모델 상태
curl http://localhost:8000/models/status | python3 -m json.tool
```

### 음성 전사 테스트
```bash
# 테스트 파일로 전사 요청
curl -X POST http://localhost:8000/transcribe \
  -F "audio=@test.wav" \
  | python3 -m json.tool
```

## 💡 장점

1. **완전한 패키지 격리**: 각 서버가 독립된 환경에서 실행
2. **충돌 방지**: Transformers/Tokenizers 버전 충돌 완전 해결
3. **유지보수 용이**: 각 서버별로 독립적인 패키지 관리
4. **확장성**: 필요시 서버별로 다른 Python 버전도 사용 가능

## 🚨 주의사항

- 각 가상환경은 약 2-3GB의 디스크 공간 필요
- 가상환경을 활성화하지 않고 실행하면 패키지 충돌 발생
- 서버 시작 순서: WhisperX → 메인 서버
- 모델 로딩 시간: 약 1-2분 소요