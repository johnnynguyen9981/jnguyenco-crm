@echo off
echo Enabling Windows Developer Mode (required for Electron builds)...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" ^
    /t REG_DWORD /f /v AllowDevelopmentWithoutDevLicense /d 1
if errorlevel 1 (
    echo.
    echo FAILED - make sure you right-clicked and chose "Run as administrator"
) else (
    echo.
    echo Done! Developer Mode is now enabled.
    echo You can now run build-desktop.bat normally (no admin needed).
)
pause
