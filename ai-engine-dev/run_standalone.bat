@echo off
echo ===========================================
echo TtalKkak Standalone Pipeline Processor
echo ===========================================
echo.

REM Python 확인
python --version
if errorlevel 1 (
    echo [ERROR] Python not found!
    pause
    exit /b 1
)

REM 입력 파일 설정
set INPUT_FILE=%1
if "%INPUT_FILE%"=="" set INPUT_FILE=test.MP3

REM 파일 존재 확인
if not exist "%INPUT_FILE%" (
    echo [ERROR] Input file not found: %INPUT_FILE%
    echo.
    echo Usage: run_standalone.bat [input_file] [options]
    echo.
    echo Examples:
    echo   run_standalone.bat test.MP3
    echo   run_standalone.bat meeting.txt
    echo   run_standalone.bat audio.wav --use-vllm
    pause
    exit /b 1
)

REM VLLM 옵션 확인
set USE_VLLM=false
if "%2"=="--use-vllm" (
    set USE_VLLM=true
    echo [OK] Using VLLM for acceleration
) else (
    echo [INFO] Using standard Transformers
)

echo.
echo Input file: %INPUT_FILE%
echo Output directory: pipeline_results\
echo.
echo Starting processing...
echo ===========================================
echo.

REM Python 스크립트 실행
python process_file_standalone.py "%INPUT_FILE%" %2

echo.
echo ===========================================
echo Processing complete!
echo Check results in: pipeline_results\
echo ===========================================
echo.

REM 결과 폴더 열기
explorer pipeline_results

pause