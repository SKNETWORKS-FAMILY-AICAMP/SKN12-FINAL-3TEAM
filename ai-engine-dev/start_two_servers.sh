#!/bin/bash

echo "================================================"
echo "TtalKkak AI 2-서버 시스템 시작"
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
pkill -f "python whisperx_server.py" 2>/dev/null
pkill -f "python ai_server_modified_v2.py" 2>/dev/null
pkill -f "python ai_server_final_with_triplets.py" 2>/dev/null
sleep 2

# 로그 디렉토리 생성
LOG_DIR="/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/logs"
mkdir -p $LOG_DIR

# 타임스탬프
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📦 Step 1: WhisperX 서버 시작 (포트 8001)${NC}"
echo -e "${BLUE}================================================${NC}"

# WhisperX 서버 시작
echo -e "${YELLOW}🎤 WhisperX 서버 시작...${NC}"
echo -e "${YELLOW}   패키지: transformers==4.39.3, tokenizers==0.15.2${NC}"
nohup python whisperx_server.py > "${LOG_DIR}/whisperx_${TIMESTAMP}.log" 2>&1 &
WHISPER_PID=$!
echo -e "${GREEN}✅ WhisperX PID: $WHISPER_PID${NC}"

# WhisperX 서버 시작 대기
echo -e "${YELLOW}⏳ WhisperX 모델 로딩 대기 (10초)...${NC}"
sleep 10

# WhisperX 헬스 체크
echo -e "${YELLOW}🔍 WhisperX 헬스 체크...${NC}"
WHISPER_HEALTH=$(curl -s http://localhost:8001/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ WhisperX 서버 정상 작동${NC}"
    echo "$WHISPER_HEALTH" | python -c "import sys, json; data=json.load(sys.stdin); print(f'  Device: {data.get(\"device\")}, Model Loaded: {data.get(\"whisperx_loaded\")}')" 2>/dev/null
else
    echo -e "${RED}❌ WhisperX 서버 응답 없음${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}📦 Step 2: 메인 AI 서버 시작 (포트 8000)${NC}"
echo -e "${BLUE}================================================${NC}"

# 메인 서버 시작
echo -e "${YELLOW}🧠 메인 AI 서버 시작...${NC}"
echo -e "${YELLOW}   패키지: transformers==4.51.0, tokenizers==0.21.4${NC}"
echo -e "${YELLOW}   모델: Qwen3-4B LoRA, BERT, Triplet${NC}"
nohup python ai_server_modified_v2.py > "${LOG_DIR}/main_${TIMESTAMP}.log" 2>&1 &
MAIN_PID=$!
echo -e "${GREEN}✅ Main Server PID: $MAIN_PID${NC}"

# 메인 서버 시작 대기
echo -e "${YELLOW}⏳ Qwen3 모델 로딩 대기 (20초)...${NC}"
sleep 20

# 메인 서버 헬스 체크
echo -e "${YELLOW}🔍 메인 서버 헬스 체크...${NC}"
MAIN_HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 메인 AI 서버 정상 작동${NC}"
    echo "$MAIN_HEALTH" | python -c "import sys, json; data=json.load(sys.stdin); models=data.get('models_loaded', {}); print(f'  WhisperX: {models.get(\"whisperx\")}, Qwen3: {models.get(\"qwen3\")}, BERT/Triplet: {models.get(\"triplet_bert\")}')" 2>/dev/null
else
    echo -e "${RED}❌ 메인 서버 응답 없음${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}🔍 전체 시스템 상태${NC}"
echo -e "${BLUE}================================================${NC}"

# 모델 상태 확인
echo -e "${YELLOW}📊 모델 로딩 상태:${NC}"
MODEL_STATUS=$(curl -s http://localhost:8000/models/status 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$MODEL_STATUS" | python -m json.tool 2>/dev/null
else
    echo -e "${RED}모델 상태 확인 실패${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ 2-서버 시스템 시작 완료!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}📍 서비스 엔드포인트:${NC}"
echo -e "  ${BLUE}메인 AI 서버:${NC} http://localhost:8000"
echo -e "  ${BLUE}API 문서:${NC} http://localhost:8000/docs"
echo -e "  ${BLUE}WhisperX 서버:${NC} http://localhost:8001 (내부용)"
echo ""
echo -e "${GREEN}📋 주요 기능:${NC}"
echo -e "  • /transcribe - 음성 파일 전사"
echo -e "  • /transcribe-enhanced - Triplet 필터링 전사"
echo -e "  • /generate-notion-project - 노션 기획안 생성"
echo -e "  • /generate-task-master-prd - Task Master PRD 생성"
echo -e "  • /two-stage-pipeline - 전체 파이프라인"
echo ""
echo -e "${GREEN}📝 로그 파일:${NC}"
echo -e "  WhisperX: ${LOG_DIR}/whisperx_${TIMESTAMP}.log"
echo -e "  Main: ${LOG_DIR}/main_${TIMESTAMP}.log"
echo ""
echo -e "${GREEN}🔧 유용한 명령어:${NC}"
echo -e "  ${YELLOW}헬스 체크:${NC} curl http://localhost:8000/health | python -m json.tool"
echo -e "  ${YELLOW}로그 확인:${NC} tail -f ${LOG_DIR}/*.log"
echo -e "  ${YELLOW}프로세스 확인:${NC} ps aux | grep -E 'whisperx_server|ai_server_modified'"
echo -e "  ${YELLOW}서버 중지:${NC} ./stop_two_servers.sh"
echo ""
echo -e "${YELLOW}⚠️  주의사항:${NC}"
echo -e "  • WhisperX: transformers 4.39.3 + tokenizers 0.15.2 사용"
echo -e "  • 메인 서버: transformers 4.51.0 + tokenizers 0.21.4 사용"
echo -e "  • 패키지 충돌이 완전히 해결되었습니다!"
echo -e "${BLUE}================================================${NC}"