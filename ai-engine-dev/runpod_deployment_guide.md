# RunPod 배포 가이드 및 개선사항

## 🚨 주요 개선 필요사항

### 1. 하드코딩된 경로 제거
현재 Windows 경로가 하드코딩되어 있어 Linux 환경에서 실행 불가:
- `C:/Users/SH/Desktop/TtalKkac/...` → 환경변수 또는 상대경로로 변경 필요

### 2. 환경 설정 파일 (config.py)
```python
import os
from pathlib import Path

class Config:
    # 기본 경로 설정
    BASE_DIR = Path(__file__).parent.absolute()
    MODEL_DIR = os.getenv("MODEL_DIR", BASE_DIR / "models")
    DATA_DIR = os.getenv("DATA_DIR", BASE_DIR / "data")
    
    # 모델 경로
    BERT_MODEL_PATH = os.getenv("BERT_MODEL_PATH", MODEL_DIR / "Ttalkkac_model_v3.pt")
    BERT_CONFIG_PATH = os.getenv("BERT_CONFIG_PATH", MODEL_DIR / "bert_model_config.json")
    BERT_TOKENIZER_PATH = os.getenv("BERT_TOKENIZER_PATH", MODEL_DIR / "bert_tokenizer_config.json")
    
    # Qwen LoRA 경로
    QWEN_LORA_1B = os.getenv("QWEN_LORA_1B", MODEL_DIR / "qwen3_lora_ttalkkac_1.7b")
    QWEN_LORA_4B = os.getenv("QWEN_LORA_4B", MODEL_DIR / "qwen3_lora_ttalkkac_4b")
    QWEN_LORA_8B = os.getenv("QWEN_LORA_8B", MODEL_DIR / "qwen3_lora_ttalkkac_8b")
    
    # API 설정
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", 8000))
    
    # HuggingFace 토큰
    HF_TOKEN = os.getenv("HF_TOKEN", "")
    
    # GPU 설정
    CUDA_DEVICE = os.getenv("CUDA_VISIBLE_DEVICES", "0")
    USE_VLLM = os.getenv("USE_VLLM", "true").lower() == "true"
    
    # 로깅
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "ai_server.log")
```

### 3. RunPod 설치 스크립트 (setup_runpod.sh)
```bash
#!/bin/bash

echo "🚀 TtalKkac AI Engine RunPod Setup"

# 1. 시스템 패키지 업데이트
apt-get update && apt-get install -y \
    ffmpeg \
    git \
    wget \
    curl \
    vim \
    htop \
    screen \
    && rm -rf /var/lib/apt/lists/*

# 2. Python 환경 설정
pip install --upgrade pip setuptools wheel

# 3. 프로젝트 클론
cd /workspace
git clone https://github.com/yourusername/TtalKkac.git
cd TtalKkac/ai-engine-dev

# 4. 의존성 설치
pip install -r requirements.txt
pip install -r requirements_api_server.txt

# 5. 모델 다운로드
python download_models.py

# 6. 환경변수 설정
cat > .env << EOF
MODEL_DIR=/workspace/TtalKkac/ai-engine-dev/models
DATA_DIR=/workspace/TtalKkac/ai-engine-dev/data
HF_TOKEN=${HF_TOKEN}
USE_VLLM=true
CUDA_VISIBLE_DEVICES=0
API_PORT=8000
LOG_LEVEL=INFO
EOF

# 7. ngrok 설치
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
chmod +x ngrok
mv ngrok /usr/local/bin/

# 8. ngrok 설정
ngrok config add-authtoken ${NGROK_AUTH_TOKEN}

echo "✅ Setup complete!"
```

### 4. 모델 다운로드 스크립트 (download_models.py)
```python
import os
import torch
from huggingface_hub import snapshot_download
from pathlib import Path

def download_models():
    """RunPod에서 필요한 모델 다운로드"""
    
    model_dir = Path(os.getenv("MODEL_DIR", "./models"))
    model_dir.mkdir(parents=True, exist_ok=True)
    
    print("📥 Downloading models...")
    
    # 1. BERT 모델 다운로드 (HuggingFace에 업로드 필요)
    if os.getenv("HF_TOKEN"):
        try:
            snapshot_download(
                repo_id="your-username/ttalkkac-bert-classifier",
                local_dir=model_dir / "bert",
                token=os.getenv("HF_TOKEN")
            )
            print("✅ BERT model downloaded")
        except Exception as e:
            print(f"⚠️ BERT download failed: {e}")
    
    # 2. Qwen LoRA 어댑터 다운로드
    lora_models = [
        "qwen3_lora_ttalkkac_1.7b",
        "qwen3_lora_ttalkkac_4b", 
        "qwen3_lora_ttalkkac_8b"
    ]
    
    for lora in lora_models:
        try:
            snapshot_download(
                repo_id=f"your-username/{lora}",
                local_dir=model_dir / lora,
                token=os.getenv("HF_TOKEN")
            )
            print(f"✅ {lora} downloaded")
        except Exception as e:
            print(f"⚠️ {lora} download failed: {e}")
    
    print("✅ All models downloaded")

if __name__ == "__main__":
    download_models()
```

### 5. 개선된 서버 시작 스크립트 (start_server.sh)
```bash
#!/bin/bash

# 환경변수 로드
source .env

# GPU 확인
nvidia-smi

# 서버와 ngrok을 screen 세션으로 실행
screen -dmS ai_server bash -c "python ai_server_final_with_triplets.py"
screen -dmS ngrok bash -c "ngrok http 8000 --log=stdout"

# 로그 확인
echo "🔍 Checking server status..."
sleep 5

# ngrok URL 가져오기
NGROK_URL=$(curl -s localhost:4040/api/tunnels | python -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])")
echo "✅ Ngrok URL: $NGROK_URL"

# backend .env에 URL 업데이트
echo "AI_SERVER_URL=$NGROK_URL" >> /workspace/TtalKkac/backend/.env

echo "✅ Server started!"
echo "📝 View logs:"
echo "  - AI Server: screen -r ai_server"
echo "  - Ngrok: screen -r ngrok"
```

### 6. 개선된 ai_server_final_with_triplets.py 수정사항

```python
# 파일 상단에 추가
import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
sys.path.append(str(Path(__file__).parent))

# Config 임포트
from config import Config

# 모든 하드코딩된 경로를 Config로 대체
# 예시:
# 기존: bert_model_path = "C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/Bert모델/Ttalkkac_model_v3.pt"
# 변경: bert_model_path = Config.BERT_MODEL_PATH

# BERT 분류기 초기화 수정
def load_bert():
    global bert_classifier
    try:
        from bert_classifier import BertClassifier
        bert_classifier = BertClassifier(
            model_path=str(Config.BERT_MODEL_PATH),
            config_path=str(Config.BERT_CONFIG_PATH),
            tokenizer_config_path=str(Config.BERT_TOKENIZER_PATH)
        )
        logger.info("✅ BERT classifier loaded")
    except Exception as e:
        logger.error(f"❌ BERT loading failed: {e}")
        bert_classifier = None

# 서버 시작 부분 수정
if __name__ == "__main__":
    uvicorn.run(
        app,
        host=Config.API_HOST,
        port=Config.API_PORT,
        log_level=Config.LOG_LEVEL.lower()
    )
```

### 7. Docker 컨테이너 방식 (선택사항)
```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /workspace

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    ffmpeg git wget curl vim htop screen \
    && rm -rf /var/lib/apt/lists/*

# 프로젝트 복사
COPY . /workspace/TtalKkac/

# Python 패키지 설치
WORKDIR /workspace/TtalKkac/ai-engine-dev
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r requirements_api_server.txt

# 포트 노출
EXPOSE 8000

# 시작 스크립트
CMD ["bash", "start_server.sh"]
```

### 8. backend/.env 업데이트
```env
# AI 서버 설정 (RunPod)
AI_SERVER_URL=https://your-ngrok-url.ngrok-free.app
AI_SERVER_TIMEOUT=300

# 백업 AI 서버 (로컬)
AI_SERVER_BACKUP_URL=http://localhost:8000
```

### 9. Slack 통합 개선사항

#### backend/src/services/ai-service.ts
```typescript
import axios from 'axios';

class AIService {
  private aiServerUrl: string;
  private backupUrl: string;
  
  constructor() {
    this.aiServerUrl = process.env.AI_SERVER_URL || '';
    this.backupUrl = process.env.AI_SERVER_BACKUP_URL || '';
  }
  
  async processAudio(audioBuffer: Buffer): Promise<any> {
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
    
    try {
      // 메인 서버 시도
      const response = await axios.post(
        `${this.aiServerUrl}/pipeline-final`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000, // 5분
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      return response.data;
    } catch (error) {
      console.error('Main AI server failed, trying backup...');
      
      // 백업 서버 시도
      const response = await axios.post(
        `${this.backupUrl}/pipeline-final`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000
        }
      );
      return response.data;
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.aiServerUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
```

## 🚀 RunPod 실행 순서

1. **RunPod GPU Pod 생성**
   - RTX 4090 또는 A100 추천
   - 최소 24GB VRAM 필요
   - PyTorch 2.1.0 템플릿 선택

2. **초기 설정**
   ```bash
   cd /workspace
   wget https://raw.githubusercontent.com/yourusername/TtalKkac/main/ai-engine-dev/setup_runpod.sh
   chmod +x setup_runpod.sh
   export HF_TOKEN="your-huggingface-token"
   export NGROK_AUTH_TOKEN="your-ngrok-token"
   ./setup_runpod.sh
   ```

3. **서버 시작**
   ```bash
   cd /workspace/TtalKkac/ai-engine-dev
   ./start_server.sh
   ```

4. **Backend 환경변수 업데이트**
   ```bash
   # ngrok URL 확인 후 backend/.env 수정
   vim /workspace/TtalKkac/backend/.env
   # AI_SERVER_URL=https://your-ngrok-url.ngrok-free.app
   ```

5. **테스트**
   ```bash
   # Health check
   curl http://localhost:8000/health
   
   # API 테스트
   curl -X POST http://localhost:8000/transcribe-enhanced \
     -F "file=@test.MP3"
   ```

## ⚠️ 주의사항

1. **GPU 메모리 관리**
   - VLLM 사용 시 최소 24GB VRAM 필요
   - batch_size 조정으로 OOM 방지

2. **모델 캐싱**
   - 첫 실행 시 모델 다운로드에 시간 소요
   - /workspace/models에 캐시 저장

3. **보안**
   - ngrok URL을 공개하지 않기
   - API 키 환경변수로 관리
   - Rate limiting 적용 권장

4. **모니터링**
   - GPU 사용률: `watch -n 1 nvidia-smi`
   - 서버 로그: `screen -r ai_server`
   - ngrok 상태: `screen -r ngrok`

## 📊 성능 최적화

1. **VLLM 활성화**
   ```env
   USE_VLLM=true
   ```

2. **배치 처리**
   ```python
   BERT_BATCH_SIZE=64  # GPU 메모리에 따라 조정
   ```

3. **모델 양자화**
   - AWQ 또는 GPTQ 사용으로 메모리 절약

4. **캐싱**
   - Redis 추가로 반복 요청 최적화