@echo off
cd /d "J:\CRM\jnguyenco-crm"

echo Removing any git lock files...
if exist .git\index.lock del /f .git\index.lock && echo Removed index.lock
if exist .git\HEAD.lock  del /f .git\HEAD.lock  && echo Removed HEAD.lock
if exist .git\COMMIT_EDITMSG.lock del /f .git\COMMIT_EDITMSG.lock

echo.
echo Staging bulk import files...
git add "app/(dashboard)/expenses/BulkImportModal.tsx"
git add "app/(dashboard)/expenses/ExpenseActions.tsx"
git add "app/(dashboard)/expenses/page.tsx"
git add "app/api/expenses/bulk/route.ts"

echo.
echo Committing...
git commit -m "feat: bulk invoice import with duplicate detection"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo Done! Check output above for any errors.
echo ========================================
pause
