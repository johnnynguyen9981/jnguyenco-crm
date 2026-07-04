@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add app/api/clients/[id]/create-drive-folder/route.ts
git commit -m "feat: organise Drive client folders by event year and month"
git push
echo Done!
pause
