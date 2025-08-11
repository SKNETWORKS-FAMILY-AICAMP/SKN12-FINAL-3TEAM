# TtalKkak AI Engine 설치 및 실행 가이드

## 📋 사전 요구사항

1. **Python 3.8 이상** 설치
2. **CUDA 11.8** (GPU 사용 시)
3. **최소 16GB RAM** (32GB 권장)
4. **GPU VRAM 8GB 이상** (Qwen 모델 실행 시)

## 🚀 빠른 시작 (Windows)

### 1. 첫 실행 (환경 설정)
```bash
# 전체 환경 설정 (첫 실행 시 필수)
setup_environment.bat
```

### 2. 이후 실행
```bash
# 빠른 실행 (환경변수 자동 설정)
quick_start.bat

# 파일 처리
python process_file_standalone.py sample.mp3
```

## 📦 수동 설치

### 1. 가상환경 생성
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 2. 패키지 설치
```bash
pip install -r requirements.txt
```

### 3. 환경변수 설정
`.env` 파일이 자동으로 로드됩니다:
```env
HF_TOKEN=your_huggingface_token_here
USE_VLLM=true
CUDA_VISIBLE_DEVICES=0
```

## 🎯 실행 옵션

### 기본 실행
```bash
python process_file_standalone.py audio.mp3
```

### 메모리 정리 옵션
```bash
python process_file_standalone.py audio.mp3 --cleanup
```

### VLLM 사용 (빠른 추론)
```bash
python process_file_standalone.py audio.mp3 --use-vllm
```

### 텍스트 파일 처리
```bash
python process_file_standalone.py transcript.txt --type text
```

## 🔧 문제 해결

### 1. CUDA 오류
```bash
# CPU로 실행
set CUDA_VISIBLE_DEVICES=-1
python process_file_standalone.py audio.mp3
```

### 2. 메모리 부족
```bash
# 메모리 사용량 줄이기
set GPU_MEMORY_UTILIZATION=0.5
python process_file_standalone.py audio.mp3 --cleanup
```

### 3. 화자 분리 안 됨
- HF_TOKEN이 설정되었는지 확인
- pyannote.audio가 설치되었는지 확인
```bash
pip install pyannote.audio
```

### 4. WhisperX 설치 실패
```bash
# 직접 설치
pip install git+https://github.com/m-bain/whisperx.git
```

## 📊 처리 단계

1. **음성 인식** (WhisperX)
   - 한국어 음성을 텍스트로 변환
   - 화자 분리 (diarization)

2. **BERT 필터링**
   - Triplet 생성
   - 노이즈 필터링
   
3. **LLM 후처리**
   - 텍스트 정제
   - 문단 구성

4. **노션 기획안 생성**
   - Qwen 모델로 분석
   - 구조화된 문서 생성

5. **Task 생성**
   - 작업 분해
   - 우선순위 설정

## 📁 결과 파일

결과는 `pipeline_results/session_YYYYMMDD_HHMMSS/` 폴더에 저장됩니다:

- `step1_whisperx_transcription.json` - 음성 인식 결과
- `step2_triplet_creation.json` - Triplet 변환
- `step3_bert_classification.json` - BERT 분류
- `step4_filtered_text.txt` - 필터링된 텍스트
- `step5_llm_postprocessing.txt` - 정제된 텍스트
- `step6_notion_project.json` - 노션 기획안
- `step7_tasks_and_subtasks.json` - 작업 목록
- `pipeline_summary.json` - 전체 요약

## 💡 팁

1. **GPU 메모리 관리**
   - 처리 후 `--cleanup` 옵션 사용
   - 다른 GPU 프로그램 종료

2. **빠른 처리**
   - `--use-vllm` 옵션 사용
   - SSD에서 실행

3. **대용량 파일**
   - 오디오를 여러 부분으로 나누기
   - 충분한 RAM 확보

## 📞 지원

문제 발생 시:
1. `error_summary.json` 확인
2. 로그 메시지 확인
3. GPU/CUDA 버전 확인