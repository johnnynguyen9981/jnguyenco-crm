// Registered business details (ASIC business name registered 12/10/2026, renew by 12/10/2027).
// Env var still wins if set in Vercel; these are the fallbacks so invoices/contracts never show a blank ABN.
export const BUSINESS_NAME = "JNguyen Co.";
export const BUSINESS_ABN = process.env.NEXT_PUBLIC_BUSINESS_ABN || "17 806 783 014";
export const BUSINESS_OWNER_LEGAL = "Thanh Nhan (Johnny) Nguyen";
