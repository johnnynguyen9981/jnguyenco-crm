@echo off
del /f ".git\index.lock" 2>nul
git add "app/(dashboard)/bookings/[id]/ContractCard.tsx" "app/(dashboard)/bookings/[id]/page.tsx" "lib/supabase/types.ts"
git commit -m "feat: Contract card on booking page - status tracking, mark sent/signed, signed copy URL"
git push
pause
