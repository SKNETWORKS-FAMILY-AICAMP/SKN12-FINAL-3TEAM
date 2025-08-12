#!/bin/bash

echo "================================================"
echo "TtalKkak AI 분산 서버 종료"
echo "================================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 프로세스 종료
echo -e "${YELLOW}🛑 서버 종료 중...${NC}"

# WhisperX 서버 종료
WHISPER_PID=$(pgrep -f "python whisper_dedicated_server.py")
if [ ! -z "$WHISPER_PID" ]; then
    kill -9 $WHISPER_PID 2>/dev/null
    echo -e "${GREEN}✅ WhisperX 서버 종료 (PID: $WHISPER_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  WhisperX 서버가 실행 중이 아닙니다${NC}"
fi

# Qwen+BERT 서버 종료
QWEN_PID=$(pgrep -f "python qwen_bert_triplet_server.py")
if [ ! -z "$QWEN_PID" ]; then
    kill -9 $QWEN_PID 2>/dev/null
    echo -e "${GREEN}✅ Qwen+BERT 서버 종료 (PID: $QWEN_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Qwen+BERT 서버가 실행 중이 아닙니다${NC}"
fi

# 게이트웨이 서버 종료
GATEWAY_PID=$(pgrep -f "python main_gateway_server.py")
if [ ! -z "$GATEWAY_PID" ]; then
    kill -9 $GATEWAY_PID 2>/dev/null
    echo -e "${GREEN}✅ 게이트웨이 서버 종료 (PID: $GATEWAY_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  게이트웨이 서버가 실행 중이 아닙니다${NC}"
fi

# 기존 통합 서버도 종료 (혹시 실행 중인 경우)
OLD_PID=$(pgrep -f "python ai_server_final_with_triplets.py")
if [ ! -z "$OLD_PID" ]; then
    kill -9 $OLD_PID 2>/dev/null
    echo -e "${GREEN}✅ 기존 통합 서버 종료 (PID: $OLD_PID)${NC}"
fi

echo ""
echo -e "${GREEN}✅ 모든 서버가 종료되었습니다${NC}"
echo "================================================"