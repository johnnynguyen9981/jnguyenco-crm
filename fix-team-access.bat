@echo off
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul

:: Stage everything — esign fixes (if not yet pushed) + team access
git add ^
  "lib/generate-contract.tsx" ^
  "lib/google/auth.ts" ^
  "lib/google/drive.ts" ^
  "app/api/sign/[token]/route.ts" ^
  "app/(dashboard)/bookings/[id]/ContractCard.tsx" ^
  "lib/team.ts" ^
  "middleware.ts" ^
  "app/(dashboard)/layout.tsx" ^
  "components/layout/Sidebar.tsx" ^
  "app/(dashboard)/bookings/page.tsx" ^
  "app/(dashboard)/bookings/[id]/page.tsx" ^
  "app/(dashboard)/clients/page.tsx" ^
  "app/(dashboard)/clients/[id]/page.tsx" ^
  "supabase/migrations/20260630_staff_role_access.sql"

git commit -m "feat: staff access + e-sig fixes

E-signature fixes:
- extract ContractDocProps interface to fix SWC JSX parse error on Vercel
- fix gdrive_folder_id relational join error in public sign route
- add Drive scope + uploadToDriveWithOAuth for signed PDF storage
- ContractCard: show Download Signed Contract button when URL available

Staff / team access:
- add lib/team.ts with getCurrentTeamMember() and getOwnerUserId()
- middleware: forward x-pathname header for layout role-checks
- layout: detect role, redirect non-founders from admin paths
- Sidebar: filter nav items based on role (VIDEOGRAPHER sees Dashboard/Clients/Bookings only)
- bookings + clients pages: use getOwnerUserId() so staff see founder data
- booking detail: hide payments, invoices, contract, edit/delete for non-founders
- client detail: hide invoices, revenue, contract, delete for non-founders
- RLS migration: bookings/clients SELECT for all team, write FOUNDER only;
  invoices/payments/deliverables FOUNDER only
- Thujey email updated to thujeyb8@gmail.com"

git push
pause
