@echo off
del /f ".git\index.lock" 2>nul
git add "app/api/bookings/[id]/route.ts"
git commit -m "fix: remove non-existent film_duration_min/max columns from packages select"
git push
pause
