@echo off
setlocal
title SproutAsk
set "ROOT=%~dp0"
set "APP=%ROOT%app"
set "NODE=%ROOT%node\node.exe"

rem Data lives outside the install directory. SPROUTASK_DATA_ROOT is a test
rem override; normal installs always use %LOCALAPPDATA%\SproutAsk\data.
if "%SPROUTASK_DATA_ROOT%"=="" set "SPROUTASK_DATA_ROOT=%LOCALAPPDATA%\SproutAsk\data"
set "DSH_HOME=%SPROUTASK_DATA_ROOT%\dsh-home"
set "EDU_DATA_ROOT=%SPROUTASK_DATA_ROOT%\learner-data"
set "EDU_RUNTIME_LOG=%SPROUTASK_DATA_ROOT%\logs\runtime.jsonl"
set "DSH_DISABLE_UPDATE_CHECK=1"
set "DSH_TELEMETRY_DISABLED=1"
set "DEEPSEEK_API_KEY="
set "DEEPSEEK_BASE_URL="

if not exist "%NODE%" (
  echo [SproutAsk] node.exe is missing: "%NODE%"
  pause
  exit /b 3
)
if not exist "%APP%\node_modules\@deepseek-ai\dsh\lib\bin.js" (
  echo [SproutAsk] DSH runtime is missing: "%APP%\node_modules\@deepseek-ai\dsh\lib\bin.js"
  pause
  exit /b 4
)
if not exist "%DSH_HOME%" mkdir "%DSH_HOME%"
if not exist "%EDU_DATA_ROOT%" mkdir "%EDU_DATA_ROOT%"
if not exist "%SPROUTASK_DATA_ROOT%\logs" mkdir "%SPROUTASK_DATA_ROOT%\logs"
cd /d "%SPROUTASK_DATA_ROOT%"

if not exist "%DSH_HOME%\profiles\edu-web\package.json" (
  echo [SproutAsk] first run: creating the local education profile...
  "%NODE%" "%APP%\runtime\scripts\setup-education-home.mjs" --home "%DSH_HOME%"
  if errorlevel 1 (
    echo [SproutAsk] profile setup failed.
    pause
    exit /b 5
  )
)

"%NODE%" "%APP%\runtime\scripts\start-student-web.mjs" --home "%DSH_HOME%" --out "%SPROUTASK_DATA_ROOT%\logs"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [SproutAsk] the local service exited with code %EXIT_CODE%.
  echo Logs: "%SPROUTASK_DATA_ROOT%\logs"
  pause
)
endlocal & exit /b %EXIT_CODE%
