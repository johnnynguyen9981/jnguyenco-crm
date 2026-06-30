@echo off
del /f ".git\index.lock" 2>nul
git add "app/(dashboard)/invoices/[id]/InvoiceDetailActions.tsx"
git commit -m "fix: keep Send Invoice button visible after marking invoice as paid"
git push
pause
