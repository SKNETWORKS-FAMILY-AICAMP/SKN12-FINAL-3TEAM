#!/bin/bash

echo "================================"
echo "TtalKkak AI 서버 시작"
echo "================================"

# 기존 프로세스 종료
echo "기존 서버 종료 중..."
pkill -f "python whisper_server.py"
pkill -f "python qwen_bert_server.py"
pkill -f "python main_gateway.py"
sleep 2

# WhisperX 서버 시작 (포트 8001)
echo -e "\n1. WhisperX 서버 시작 (포트 8001)..."
python whisper_server.py &
WHISPER_PID=$!
echo "WhisperX PID: $WHISPER_PID"
sleep 5

# Qwen3+BERT 서버 시작 (포트 8002)
echo -e "\n2. Qwen3+BERT 서버 시작 (포트 8002)..."
python qwen_bert_server.py &
QWEN_PID=$!
echo "Qwen3+BERT PID: $QWEN_PID"
sleep 10

# 메인 게이트웨이 시작 (포트 8000)
echo -e "\n3. 메인 게이트웨이 시작 (포트 8000)..."
python main_gateway.py &
GATEWAY_PID=$!
echo "Gateway PID: $GATEWAY_PID"

echo -e "\n================================"
echo "✅ 모든 서버 시작 완료!"
echo "================================"
echo "서비스 URL:"
echo "  - 메인 게이트웨이: http://localhost:8000"
echo "  - WhisperX: http://localhost:8001"
echo "  - Qwen3+BERT: http://localhost:8002"
echo ""
echo "헬스 체크: curl http://localhost:8000/health"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."
echo "================================"

# 프로세스 대기
wait $WHISPER_PID $QWEN_PID $GATEWAY_PID