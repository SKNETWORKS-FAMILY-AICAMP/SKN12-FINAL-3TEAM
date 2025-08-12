#!/bin/bash

echo "================================================"
echo "TtalKkak AI 분산 서버 시작"
echo "================================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기존 프로세스 종료
echo -e "${YELLOW}🔄 기존 서버 종료 중...${NC}"
pkill -f "python whisper_dedicated_server.py" 2>/dev/null
pkill -f "python qwen_bert_triplet_server.py" 2>/dev/null
pkill -f "python main_gateway_server.py" 2>/dev/null
pkill -f "python ai_server_final_with_triplets.py" 2>/dev/null
sleep 3

# 로그 디렉토리 생성
LOG_DIR="/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/logs"
mkdir -p $LOG_DIR

# 타임스탬프
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📦 Stage 1: WhisperX 서버 시작${NC}"
echo -e "${BLUE}================================================${NC}"

# WhisperX 서버 시작 (포트 8001)
echo -e "${YELLOW}🎤 WhisperX 서버 시작 (포트 8001)...${NC}"
nohup python whisper_dedicated_server.py > "${LOG_DIR}/whisper_${TIMESTAMP}.log" 2>&1 &
WHISPER_PID=$!
echo -e "${GREEN}✅ WhisperX PID: $WHISPER_PID${NC}"

# WhisperX 서버 시작 대기
echo -e "${YELLOW}⏳ WhisperX 모델 로딩 대기 (15초)...${NC}"
sleep 15

# WhisperX 헬스 체크
echo -e "${YELLOW}🔍 WhisperX 헬스 체크...${NC}"
WHISPER_HEALTH=$(curl -s http://localhost:8001/health | python -m json.tool 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ WhisperX 서버 정상 작동${NC}"
    echo "$WHISPER_HEALTH" | grep -E "model_loaded|gpu_available"
else
    echo -e "${RED}❌ WhisperX 서버 응답 없음${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📦 Stage 2: Qwen3+BERT+Triplet 서버 시작${NC}"
echo -e "${BLUE}================================================${NC}"

# Qwen3+BERT+Triplet 서버 시작 (포트 8002)
echo -e "${YELLOW}🧠 Qwen3+BERT+Triplet 서버 시작 (포트 8002)...${NC}"
nohup python qwen_bert_triplet_server.py > "${LOG_DIR}/qwen_bert_${TIMESTAMP}.log" 2>&1 &
QWEN_PID=$!
echo -e "${GREEN}✅ Qwen3+BERT PID: $QWEN_PID${NC}"

# Qwen 서버 시작 대기 (모델 로딩 시간)
echo -e "${YELLOW}⏳ Qwen3 모델 로딩 대기 (30초)...${NC}"
sleep 30

# Qwen 헬스 체크
echo -e "${YELLOW}🔍 Qwen3+BERT 헬스 체크...${NC}"
QWEN_HEALTH=$(curl -s http://localhost:8002/health | python -m json.tool 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Qwen3+BERT 서버 정상 작동${NC}"
    echo "$QWEN_HEALTH" | grep -E "models_loaded"
else
    echo -e "${RED}❌ Qwen3+BERT 서버 응답 없음${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📦 Stage 3: 메인 게이트웨이 서버 시작${NC}"
echo -e "${BLUE}================================================${NC}"

# 메인 게이트웨이 시작 (포트 8000)
echo -e "${YELLOW}🌐 메인 게이트웨이 시작 (포트 8000)...${NC}"
nohup python main_gateway_server.py > "${LOG_DIR}/gateway_${TIMESTAMP}.log" 2>&1 &
GATEWAY_PID=$!
echo -e "${GREEN}✅ Gateway PID: $GATEWAY_PID${NC}"

# 게이트웨이 시작 대기
echo -e "${YELLOW}⏳ 게이트웨이 초기화 대기 (5초)...${NC}"
sleep 5

# 전체 시스템 헬스 체크
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}🔍 전체 시스템 상태 확인${NC}"
echo -e "${BLUE}================================================${NC}"

GATEWAY_HEALTH=$(curl -s http://localhost:8000/health | python -m json.tool 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 게이트웨이 서버 정상 작동${NC}"
    echo "$GATEWAY_HEALTH" | grep -E "models_loaded"
else
    echo -e "${RED}❌ 게이트웨이 서버 응답 없음${NC}"
fi

# 모델 상태 확인
echo ""
echo -e "${YELLOW}📊 모델 로딩 상태:${NC}"
MODEL_STATUS=$(curl -s http://localhost:8000/models/status | python -m json.tool 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$MODEL_STATUS"
else
    echo -e "${RED}모델 상태 확인 실패${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ 모든 서버 시작 완료!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}📍 서비스 URL:${NC}"
echo -e "  ${BLUE}메인 게이트웨이:${NC} http://localhost:8000"
echo -e "  ${BLUE}API 문서:${NC} http://localhost:8000/docs"
echo -e "  ${BLUE}WhisperX 서버:${NC} http://localhost:8001"
echo -e "  ${BLUE}Qwen+BERT 서버:${NC} http://localhost:8002"
echo ""
echo -e "${GREEN}📝 로그 파일:${NC}"
echo -e "  WhisperX: ${LOG_DIR}/whisper_${TIMESTAMP}.log"
echo -e "  Qwen+BERT: ${LOG_DIR}/qwen_bert_${TIMESTAMP}.log"
echo -e "  Gateway: ${LOG_DIR}/gateway_${TIMESTAMP}.log"
echo ""
echo -e "${GREEN}🔧 유용한 명령어:${NC}"
echo -e "  ${YELLOW}헬스 체크:${NC} curl http://localhost:8000/health | python -m json.tool"
echo -e "  ${YELLOW}로그 확인:${NC} tail -f ${LOG_DIR}/*.log"
echo -e "  ${YELLOW}프로세스 확인:${NC} ps aux | grep -E 'whisper|qwen|gateway'"
echo -e "  ${YELLOW}서버 중지:${NC} pkill -f 'python (whisper|qwen|main)_.*server.py'"
echo ""
echo -e "${YELLOW}⚠️  주의: 모든 모델이 완전히 로드되기까지 1-2분 정도 걸릴 수 있습니다.${NC}"
echo -e "${BLUE}================================================${NC}"

# 프로세스 모니터링 (선택적)
echo ""
echo -e "${YELLOW}프로세스를 백그라운드에서 실행 중입니다.${NC}"
echo -e "${YELLOW}종료하려면 다음 명령어를 사용하세요:${NC}"
echo -e "${GREEN}./stop_distributed_servers.sh${NC}"