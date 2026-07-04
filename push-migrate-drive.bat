@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add app/api/admin/migrate-drive-folders/route.ts
git commit -m "feat: add one-time Drive folder migration route"
git push
echo Done!
pause
