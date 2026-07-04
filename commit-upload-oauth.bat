@echo off
cd /d "%~dp0"
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock  del /f .git\HEAD.lock
git add "app/api/expenses/upload/route.ts"
git add "app/(dashboard)/expenses/ExpenseForm.tsx"
git add "app/(dashboard)/expenses/ExpenseActions.tsx"
git add "app/(dashboard)/expenses/page.tsx"
git commit -m "fix: expense form pre-fills date from viewed FY to prevent wrong-FY filing"
git push origin main
echo.
echo Done! Vercel will redeploy in ~1 minute.
pause
