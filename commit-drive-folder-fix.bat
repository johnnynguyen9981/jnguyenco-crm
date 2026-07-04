@echo off
cd /d J:\CRM\jnguyenco-crm

echo Removing git locks if present...
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock

echo Staging changes...
git add "app/api/clients/[id]/create-drive-folder/route.ts"

echo Committing...
git commit -m "fix: use getOwnerUserId in create-drive-folder + better error logging"

echo Pushing to GitHub...
git push

echo Done! Vercel will auto-deploy in ~1-2 minutes.
pause
