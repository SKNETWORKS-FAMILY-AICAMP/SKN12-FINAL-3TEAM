#!/bin/bash

echo "================================================"
echo "TtalKkak AI 2-서버 시스템 종료"
echo "================================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# WhisperX 서버 종료
WHISPER_PID=$(pgrep -f "python whisperx_server.py")
if [ ! -z "$WHISPER_PID" ]; then
    kill -9 $WHISPER_PID 2>/dev/null
    echo -e "${GREEN}✅ WhisperX 서버 종료 (PID: $WHISPER_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  WhisperX 서버가 실행 중이 아닙니다${NC}"
fi

# 메인 AI 서버 종료
MAIN_PID=$(pgrep -f "python ai_server_final_with_triplets.py")
if [ ! -z "$MAIN_PID" ]; then
    kill -9 $MAIN_PID 2>/dev/null
    echo -e "${GREEN}✅ 메인 AI 서버 종료 (PID: $MAIN_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  메인 AI 서버가 실행 중이 아닙니다${NC}"
fi

# 임시 스크립트 정리
rm -f /tmp/start_whisperx.sh /tmp/start_main.sh 2>/dev/null

echo ""
echo -e "${GREEN}✅ 모든 서버가 종료되었습니다${NC}"
echo "================================================"