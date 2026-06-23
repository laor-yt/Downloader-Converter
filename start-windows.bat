@echo off
echo ==============================================
echo   Download-Converter Setup ^& Start Script
echo ==============================================

:: Check if Node.js is installed
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Attempting to install via winget...
    winget install OpenJS.NodeJS
    IF %ERRORLEVEL% NEQ 0 (
        echo Failed to install Node.js automatically.
        echo Opening download page...
        start https://nodejs.org/
        echo Please install Node.js and run this script again.
        pause
        exit /b
    )
    echo Node.js installed successfully. Please restart the script.
    pause
    exit /b
)

echo Node.js is installed.

:: Check Backend Dependencies
if not exist "backend\node_modules\" (
    echo Installing Backend dependencies...
    cd backend
    call npm install
    cd ..
) else (
    echo Backend dependencies already installed.
)

:: Check Frontend Dependencies
if not exist "frontend\node_modules\" (
    echo Installing Frontend dependencies...
    cd frontend
    call npm install
    cd ..
) else (
    echo Frontend dependencies already installed.
)

echo Starting Backend Server...
start cmd /k "title Backend Server && cd backend && node server.js"

echo Starting Frontend Server...
start cmd /k "title Frontend Server && cd frontend && npm run dev"

echo Waiting for servers to start...
timeout /t 3 /nobreak >nul

echo Opening Browser...
start http://localhost:5173

echo All done! You can close this window.
exit
