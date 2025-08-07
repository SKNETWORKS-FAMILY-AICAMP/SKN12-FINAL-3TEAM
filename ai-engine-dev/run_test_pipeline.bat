@echo off
echo ========================================
echo TtalKkac AI Pipeline Test Runner
echo ========================================
echo.

REM Python 환경 확인
python --version
if errorlevel 1 (
    echo [ERROR] Python이 설치되지 않았습니다.
    pause
    exit /b 1
)

REM 필요한 패키지 설치 확인
echo.
echo [1] 필요한 패키지 확인 중...
pip list | findstr "aiohttp" >nul 2>&1
if errorlevel 1 (
    echo aiohttp 설치 중...
    pip install aiohttp
)

REM AI 서버 실행 여부 확인
echo.
echo [2] AI 서버 상태 확인 중...
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo.
    echo [WARNING] AI 서버가 실행되지 않았습니다!
    echo.
    echo 다른 터미널에서 AI 서버를 먼저 실행해주세요:
    echo   cd ai-engine-dev
    echo   python ai_server_final_with_triplets.py
    echo.
    echo 또는 RunPod 서버 URL을 test_pipeline_with_logging.py에서 수정하세요.
    echo.
    pause
    exit /b 1
) else (
    echo [OK] AI 서버가 실행 중입니다.
)

REM 테스트 파일 확인
echo.
echo [3] 테스트 파일 확인 중...
if not exist "test.MP3" (
    echo.
    echo [ERROR] test.MP3 파일이 없습니다!
    echo 현재 디렉토리에 test.MP3 파일을 넣어주세요.
    pause
    exit /b 1
) else (
    echo [OK] test.MP3 파일을 찾았습니다.
)

REM 테스트 실행
echo.
echo ========================================
echo [4] 파이프라인 테스트 시작...
echo ========================================
echo.

python test_pipeline_with_logging.py

echo.
echo ========================================
echo 테스트 완료!
echo 결과는 pipeline_results 폴더를 확인하세요.
echo ========================================
echo.

REM 결과 폴더 열기
explorer pipeline_results

pause