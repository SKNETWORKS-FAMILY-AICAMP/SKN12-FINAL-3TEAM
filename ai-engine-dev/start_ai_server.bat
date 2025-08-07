@echo off
echo ===============================================
echo TtalKkac AI Server Startup Script
echo ===============================================
echo.

REM 환경 변수 설정
set PYTHONPATH=%cd%
set USE_VLLM=true
set PRELOAD_MODELS=true
set HOST=0.0.0.0
set PORT=8000

echo [1/4] Checking Python environment...
python --version

echo.
echo [2/4] Checking GPU availability...
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'GPU Count: {torch.cuda.device_count()}') if torch.cuda.is_available() else print('No GPU detected')"

echo.
echo [3/4] Loading environment variables...
if exist .env (
    echo Environment file found: .env
) else (
    echo Warning: No .env file found. Using default settings.
)

echo.
echo [4/4] Starting AI server...
echo Server will be available at: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo ===============================================
echo.

REM AI 서버 실행
python ai_server_final_with_triplets.py

pause