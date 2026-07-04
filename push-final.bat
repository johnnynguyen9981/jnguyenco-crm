@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add .
git status
git commit -m "feat: Drive folder full structure — Clients/YYYY/Month + Deliverables/Photos/Videos + migration route"
git push
echo.
echo === DONE ===
pause
