@echo off
del /f ".git\index.lock" 2>nul
git add "app/(dashboard)/invoices/[id]/InvoiceDetailActions.tsx" "app/(dashboard)/invoices/new/page.tsx" "app/api/bookings/[id]/route.ts"
git commit -m "fix: send invoice button - fetch PDF then email with attachment; fix create invoice payload; fix packages select columns"
git push
pause
