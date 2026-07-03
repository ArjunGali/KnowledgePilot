@echo off
REM ============================================================
REM  KnowledgePilot - one-click launcher
REM  Starts: Docker Desktop -> Qdrant -> backend -> frontend
REM  Then opens the app at http://localhost:5173
REM ============================================================
setlocal
set ROOT=%~dp0

echo.
echo [1/4] Making sure Docker is running...
docker info >nul 2>&1
if errorlevel 1 (
  echo     Docker not ready - launching Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  echo     Waiting for the Docker engine ^(this can take a minute^)...
  :waitdocker
  timeout /t 3 >nul
  docker info >nul 2>&1
  if errorlevel 1 goto waitdocker
)
echo     Docker is ready.

echo.
echo [2/4] Starting Qdrant vector database...
docker start qdrant >nul 2>&1
if errorlevel 1 (
  echo     No qdrant container yet - creating one...
  docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant >nul
)

echo.
echo [3/4] Starting backend  ^(http://localhost:3000^)...
start "KnowledgePilot Backend" cmd /k "cd /d "%ROOT%" && node server.js"

echo.
echo [4/4] Starting frontend ^(http://localhost:5173^)...
start "KnowledgePilot Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo Waiting for the frontend to boot, then opening your browser...
timeout /t 7 >nul
start http://localhost:5173

echo.
echo Done. Two windows opened (Backend + Frontend). Close them to stop the app.
endlocal
