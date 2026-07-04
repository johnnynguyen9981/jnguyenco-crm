@echo off
cd /d J:\CRM\jnguyenco-crm

echo Removing git locks if present...
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock

echo Staging changes...
git add "app/api/clients/[id]/create-drive-folder/route.ts"
git add "run-gdrive-migration.bat"
git add "supabase/migrations/20260704_add_gdrive_folder_id.sql"

echo Committing...
git commit -m "fix: skip gdrive_folder_id select until migration runs (idempotent findOrCreate)"

echo Pushing to GitHub...
git push

echo Done! Vercel will auto-deploy in ~1-2 minutes.
pause
