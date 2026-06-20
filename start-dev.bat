@echo off
cd /d "%~dp0"
echo Starting JNguyen Co. CRM from: %CD%
if exist .next rmdir /s /q .next
npm run dev
pause
