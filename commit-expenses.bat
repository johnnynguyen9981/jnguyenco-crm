@echo off
echo Committing expenses feature...
cd /d J:\CRM\jnguyenco-crm

:: Clear stale lock if present
if exist .git\index.lock del /f .git\index.lock

git add -A

git commit -m "feat: add business expenses tracker with Google Drive receipt storage

- expenses table + RLS in Supabase (owner-only policy)
- 4 categories: Software & Subscriptions, Equipment, Vehicle, Marketing
- Monthly auto-recurring expenses (auto-generated on page load)
- Google Drive receipt upload: Business Expenses / FY YYYY-YY /
- Australian FY (Jul-Jun) grouping with per-category totals
- API: GET+POST /api/expenses, PATCH+DELETE /api/expenses/[id]
- API: POST /api/expenses/upload to Google Drive
- Expenses page: FY summary cards, table, search, filters, pagination
- Sidebar: Expenses nav item (FOUNDER-only, hidden from staff)
- lib/expenses.ts: getAustralianFY, generateDueRecurringExpenses, category metadata
- TypeScript: fixed truncated types.ts, Sidebar.tsx, team.ts
- InvoiceWithDetails type for invoice PDF route"

git push origin main

echo.
echo Done! Expenses feature pushed to GitHub.
pause
