@echo off
REM RunPod AI 서버 ngrok 설정 가이드 (Windows 사용자용)

echo =====================================
echo RunPod AI 서버 ngrok 설정 가이드
echo =====================================
echo.
echo 이 가이드는 RunPod GPU 인스턴스에서 AI 서버를 
echo ngrok으로 노출시키는 방법을 설명합니다.
echo.
echo [필요 사항]
echo 1. RunPod 계정 및 GPU Pod
echo 2. ngrok 계정 (무료 가능)
echo.
echo [설정 단계]
echo.
echo 1단계: RunPod Pod에 SSH 연결
echo ----------------------------------------
echo RunPod 콘솔에서 Pod의 SSH 정보 확인 후:
echo ssh root@[POD_IP] -p [PORT]
echo.
echo 2단계: ngrok 설치 및 설정
echo ----------------------------------------
echo # ngrok 다운로드 및 설치
echo wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip
echo unzip ngrok-v3-stable-linux-amd64.zip
echo chmod +x ngrok
echo mv ngrok /usr/local/bin/
echo.
echo # ngrok 인증 (https://dashboard.ngrok.com 에서 토큰 확인)
echo ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
echo.
echo 3단계: AI 서버 시작 스크립트 생성
echo ----------------------------------------
echo # start_server.sh 파일 생성
echo cat ^> start_server.sh ^<^< 'EOF'
echo #!/bin/bash
echo cd /workspace/ai-engine-dev
echo python ai_server_final_with_triplets.py ^&
echo sleep 10
echo ngrok http 8000 --log=stdout ^> ngrok.log 2^>^&1 ^&
echo sleep 5
echo curl -s localhost:4040/api/tunnels ^| grep -o "https://[a-zA-Z0-9]*\.ngrok-free\.app"
echo wait
echo EOF
echo.
echo chmod +x start_server.sh
echo ./start_server.sh
echo.
echo 4단계: ngrok URL 확인 및 설정
echo ----------------------------------------
echo ngrok URL 확인:
echo curl localhost:4040/api/tunnels
echo.
echo backend/.env 파일 수정:
echo RUNPOD_AI_URL=https://YOUR-NGROK-ID.ngrok-free.app
echo.
echo [주의사항]
echo - ngrok 무료 플랜: 8시간마다 URL 변경
echo - 고정 도메인 필요시 ngrok 유료 플랜 사용
echo - 대안: Cloudflare Tunnel (무료, 고정 도메인)
echo.
echo [Cloudflare Tunnel 대안 설정]
echo ----------------------------------------
echo # cloudflared 설치
echo wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
echo chmod +x cloudflared-linux-amd64
echo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
echo.
echo # 터널 시작 (로그인 필요)
echo cloudflared tunnel --url http://localhost:8000
echo.
pause