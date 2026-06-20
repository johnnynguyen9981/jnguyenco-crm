@echo off
title JNguyen Co. CRM
cd /d "%~dp0"

echo Starting JNguyen Co. CRM...

:: Kill anything already on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Open browser after 5 seconds (background)
start "" cmd /c "timeout /t 5 >nul && start http://localhost:3000"

:: Start the server (keep this window open - closing it stops the CRM)
npm run dev
