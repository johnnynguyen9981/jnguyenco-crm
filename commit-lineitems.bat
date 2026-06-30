@echo off
del /f ".git\index.lock" 2>nul
git add "app/(dashboard)/invoices/new/page.tsx"
git commit -m "feat: add description datalist to invoice line items for quick selection"
git push
pause
