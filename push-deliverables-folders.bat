@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add app/api/clients/[id]/create-drive-folder/route.ts
git commit -m "feat: add Deliverables/Photos/Videos subfolders to Drive structure"
git push
echo Done!
pause
