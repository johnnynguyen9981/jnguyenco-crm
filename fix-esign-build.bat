@echo off
del /f ".git\index.lock" 2>nul

git add ^
  "lib/generate-contract.tsx" ^
  "lib/google/auth.ts" ^
  "lib/google/drive.ts" ^
  "app/api/sign/[token]/route.ts" ^
  "app/(dashboard)/bookings/[id]/ContractCard.tsx"

git commit -m "fix: e-signature bug fixes + Google Drive upload for signed contracts

- extract ContractDocProps interface to fix SWC JSX parse error on Vercel
- fix gdrive_folder_id relational join error in public sign route
- add Drive scope to Google OAuth (requires re-consent)
- add getAuthenticatedClientByOwnerId() for use in public routes
- add uploadToDriveWithOAuth() — uploads signed PDF to personal Google Drive
- signed PDF saved to JNguyen Co. CRM / [Client] / Contracts/ in Drive
- ContractCard: show Download Signed Contract button when URL available"

git push
pause
