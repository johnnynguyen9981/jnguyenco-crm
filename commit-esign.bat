@echo off
del /f ".git\index.lock" 2>nul

git add ^
  "lib/supabase/types.ts" ^
  "lib/generate-contract.tsx" ^
  "lib/google/gmail.ts" ^
  "app/api/google/gmail/send/route.ts" ^
  "app/api/bookings/[id]/sign-request/route.ts" ^
  "app/sign/[token]/page.tsx" ^
  "app/sign/[token]/SigningForm.tsx" ^
  "app/api/sign/[token]/route.ts" ^
  "app/(dashboard)/bookings/[id]/ContractCard.tsx" ^
  "app/(dashboard)/bookings/[id]/page.tsx" ^
  "supabase-migration-esign.sql"

git commit -m "feat: Built-in e-signature system - clients sign contracts directly in browser

- Send for E-Signature button on booking page generates secure token
- Emails client a unique signing link (/sign/[token])
- Public signing page shows contract summary + canvas/typed signature pad
- On submit: generates signed PDF (with client signature), emails both parties, saves to Drive, marks booking as signed
- Token expires in 30 days and is invalidated after signing
- ContractCard updated: e-sign flow (primary), manual fallback
- New emails: contractSigningRequestHtml, contractSignedConfirmationHtml
- DB migration: contract_sign_token (unique), contract_sign_expires_at
- No third-party tools required"

git push
pause
