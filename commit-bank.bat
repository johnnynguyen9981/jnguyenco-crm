@echo off
del /f ".git\index.lock" 2>nul
git add "lib/pdf/InvoiceTemplate.tsx" "lib/generate-contract.tsx" "lib/generate-quote.tsx" "app/(dashboard)/invoices/[id]/page.tsx"
git commit -m "update: bank details - Thanh Nhan Nguyen, BSB 082-902, Account 890398777"
git push
pause
