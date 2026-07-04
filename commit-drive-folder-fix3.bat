@echo off
cd /d J:\CRM\jnguyenco-crm
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add "app/api/clients/[id]/create-drive-folder/route.ts"
git commit -m "fix: restore complete route.ts (was truncated by tool)"
git push
echo Done! Vercel auto-deploys in ~1-2 min.
pause
