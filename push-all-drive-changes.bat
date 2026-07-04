@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add app/api/clients/[id]/create-drive-folder/route.ts
git add app/api/admin/migrate-drive-folders/route.ts
git status
git commit -m "feat: Drive folder year/month structure + one-time migration route"
git push
echo Done!
pause
