#!/bin/bash

echo "================================================"
echo "Ngrok 설정 - 메인 AI 서버만 외부 노출"
echo "================================================"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Ngrok 설치 확인
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}📦 Ngrok 설치 중...${NC}"
    
    # Ngrok 다운로드 및 설치
    wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
    tar -xzf ngrok-v3-stable-linux-amd64.tgz
    rm ngrok-v3-stable-linux-amd64.tgz
    sudo mv ngrok /usr/local/bin/
    
    echo -e "${GREEN}✅ Ngrok 설치 완료${NC}"
else
    echo -e "${GREEN}✅ Ngrok가 이미 설치되어 있습니다${NC}"
fi

# Ngrok 인증 토큰 설정 (필요한 경우)
echo -e "${YELLOW}📝 Ngrok 인증 토큰 설정${NC}"
echo -e "${BLUE}토큰이 있으시면 입력하세요 (없으면 Enter):${NC}"
read -r NGROK_TOKEN

if [ ! -z "$NGROK_TOKEN" ]; then
    ngrok config add-authtoken "$NGROK_TOKEN"
    echo -e "${GREEN}✅ Ngrok 토큰 설정 완료${NC}"
fi

# Ngrok 실행 스크립트 생성
echo -e "${YELLOW}📝 Ngrok 실행 스크립트 생성${NC}"

cat > start_ngrok.sh << 'EOF'
#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}🌐 Ngrok 터널 시작 - 메인 AI 서버 (포트 8000)${NC}"
echo -e "${BLUE}================================================${NC}"

# 메인 서버 실행 확인
MAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$MAIN_STATUS" != "200" ]; then
    echo -e "${RED}❌ 메인 AI 서버가 실행되지 않았습니다!${NC}"
    echo -e "${YELLOW}먼저 ./start_all_servers.sh를 실행하세요${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 메인 AI 서버 확인됨${NC}"

# WhisperX 서버 확인 (선택사항)
WHISPER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health)
if [ "$WHISPER_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ WhisperX 서버 확인됨 (내부 전용)${NC}"
else
    echo -e "${YELLOW}⚠️  WhisperX 서버가 실행되지 않았습니다 (음성 전사 불가)${NC}"
fi

echo ""
echo -e "${YELLOW}🚀 Ngrok 터널 시작 중...${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Ngrok 실행 (포트 8000만 노출)
ngrok http 8000 --log=stdout | while IFS= read -r line; do
    if echo "$line" | grep -q "url="; then
        URL=$(echo "$line" | grep -oP 'url=\K[^ ]+')
        if [[ $URL == https* ]]; then
            echo ""
            echo -e "${GREEN}✅ Ngrok 터널 생성 완료!${NC}"
            echo -e "${BLUE}================================================${NC}"
            echo -e "${GREEN}🌐 공개 URL:${NC} $URL"
            echo -e "${GREEN}📡 API 엔드포인트:${NC}"
            echo -e "  • 헬스체크: $URL/health"
            echo -e "  • API 문서: $URL/docs"
            echo -e "  • 음성전사: $URL/transcribe"
            echo -e "  • 노션생성: $URL/generate-notion-project"
            echo -e "${BLUE}================================================${NC}"
            echo ""
            echo -e "${YELLOW}💡 백엔드 연동 방법:${NC}"
            echo -e "  1. 위 URL을 백엔드 설정에 추가"
            echo -e "  2. WhisperX는 내부에서 자동 처리됨"
            echo -e "  3. 모든 요청은 메인 서버로만 보내면 됨"
            echo ""
            echo -e "${YELLOW}⚠️  주의: 이 터미널을 닫으면 터널이 종료됩니다${NC}"
            echo -e "${BLUE}================================================${NC}"
        fi
    fi
    echo "$line"
done
EOF

chmod +x start_ngrok.sh

# 백그라운드 실행 스크립트 생성
cat > start_ngrok_background.sh << 'EOF'
#!/bin/bash

# 로그 디렉토리
LOG_DIR="/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/logs"
mkdir -p $LOG_DIR

# 타임스탬프
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🌐 Ngrok을 백그라운드로 시작합니다..."
nohup ngrok http 8000 > "${LOG_DIR}/ngrok_${TIMESTAMP}.log" 2>&1 &
NGROK_PID=$!

echo "✅ Ngrok PID: $NGROK_PID"
echo "📝 로그 파일: ${LOG_DIR}/ngrok_${TIMESTAMP}.log"
echo ""
echo "URL 확인 방법:"
echo "  1. curl http://localhost:4040/api/tunnels"
echo "  2. tail -f ${LOG_DIR}/ngrok_${TIMESTAMP}.log"
echo "  3. ngrok 대시보드: http://localhost:4040"
EOF

chmod +x start_ngrok_background.sh

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ Ngrok 설정 완료!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}사용 방법:${NC}"
echo -e "  ${YELLOW}1. 서버 시작:${NC} ./start_all_servers.sh"
echo -e "  ${YELLOW}2. Ngrok 시작:${NC} ./start_ngrok.sh"
echo -e "  ${YELLOW}   또는 백그라운드:${NC} ./start_ngrok_background.sh"
echo ""
echo -e "${GREEN}구조:${NC}"
echo -e "  ${BLUE}[백엔드] → [Ngrok] → [메인 AI:8000] → [WhisperX:8001]${NC}"
echo -e "  ${YELLOW}• WhisperX는 내부 전용 (ngrok 불필요)${NC}"
echo -e "  ${YELLOW}• 메인 서버만 외부 노출${NC}"
echo -e "${BLUE}================================================${NC}"