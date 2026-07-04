@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add .
git status
git commit -m "feat: OAuth-based Drive document sync — uploads contract + invoice PDFs for all clients"
git push
echo.
echo === DONE ===
pause
