@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git checkout HEAD -- "app/api/clients/[id]/create-drive-folder/route.ts"
git status --short
echo Done!
pause
