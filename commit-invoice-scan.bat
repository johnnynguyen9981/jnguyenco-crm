@echo off
cd /d "%~dp0"
echo Pushing AI invoice scanning feature to GitHub...
git push origin main
echo.
echo Done! Vercel will redeploy in ~1 minute.
echo.
echo NEXT STEP: Add ANTHROPIC_API_KEY to Vercel:
echo   1. Go to https://vercel.com/dashboard
echo   2. Open jnguyenco-crm ^> Settings ^> Environment Variables
echo   3. Add: ANTHROPIC_API_KEY = sk-ant-...
echo   4. Redeploy
pause
