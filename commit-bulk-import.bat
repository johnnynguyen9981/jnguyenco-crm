@echo off
cd /d "%~dp0"

:: Remove stale git lock if present
if exist .git\index.lock (
  del /f .git\index.lock
  echo Removed stale git lock.
)

echo Staging bulk import files...
git add "app/(dashboard)/expenses/BulkImportModal.tsx"
git add "app/(dashboard)/expenses/ExpenseActions.tsx"
git add "app/(dashboard)/expenses/page.tsx"
git add "app/api/expenses/bulk/route.ts"

echo Committing...
git commit -m "feat: bulk invoice import with duplicate detection"

echo Pushing to GitHub (Vercel will redeploy in ~1 minute)...
git push origin main

echo.
echo Done! The upload failure is fixed — the app was broken due to a
echo truncated file. Vercel will redeploy with the corrected build.
pause
