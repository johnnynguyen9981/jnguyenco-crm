@echo off
setlocal
cd /d "%~dp0"
echo.
echo  =====================================================
echo    JNguyen Co. CRM  -  Desktop App Builder
echo  =====================================================
echo.

REM ── Step 1: Install Electron dev dependencies ────────────────────────────
echo [1/5] Installing Electron dependencies...
call npm install
if errorlevel 1 ( echo. & echo ERROR: npm install failed & pause & exit /b 1 )
echo      Done.
echo.

REM ── Step 2: Build Next.js in standalone mode ─────────────────────────────
echo [2/5] Building Next.js (this takes ~1-2 minutes)...
call npm run build
if errorlevel 1 ( echo. & echo ERROR: Next.js build failed & pause & exit /b 1 )
echo      Done.
echo.

REM ── Step 3: Copy static assets into the standalone folder ────────────────
echo [3/5] Copying static assets...
if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
xcopy /E /I /Y ".next\static"  ".next\standalone\.next\static" >nul
xcopy /E /I /Y "public"        ".next\standalone\public"       >nul
echo      Done.
echo.

REM ── Step 4: Bundle .env.local into the build ─────────────────────────────
echo [4/5] Copying environment config...
if exist ".env.local" (
    copy /Y ".env.local" ".env.production" >nul
    echo      .env.local copied to .env.production
) else (
    echo      WARNING: .env.local not found - packaged app will have no env vars
    echo      Create .env.local with your Supabase/SMTP keys before building.
)
echo.

REM ── Step 5: Package with Electron Builder ────────────────────────────────
echo [5/5] Packaging desktop app...
REM Disable code signing — skips winCodeSign download (avoids symlink permission errors on Windows)
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
call npx electron-builder --win
if errorlevel 1 ( echo. & echo ERROR: Electron packaging failed & pause & exit /b 1 )
echo.

echo  =====================================================
echo    Build complete!
echo    Installer: dist-electron\JNguyen Co. CRM Setup.exe
echo  =====================================================
echo.
pause
endlocal
