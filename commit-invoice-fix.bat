@echo off
del /f ".git\index.lock" 2>nul
git add "app/(dashboard)/invoices/new/page.tsx"
git commit -m "fix: invoice booking summary panel - d.data client autoload, booking fetch error visibility"
git push
pause
