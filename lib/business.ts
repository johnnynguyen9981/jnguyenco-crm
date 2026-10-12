// Registered business details (ASIC business name registered 12/10/2026, renew by 12/10/2027).
// Env var still wins if set in Vercel; these are the fallbacks so invoices/contracts never show a blank ABN.
export const BUSINESS_NAME = "JNguyen Co.";
// Always display the ABN in the standard "XX XXX XXX XXX" format, even if the env var has no spaces.
function formatAbn(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : raw;
}
export const BUSINESS_ABN = formatAbn(process.env.NEXT_PUBLIC_BUSINESS_ABN || "17 806 783 014");
export const BUSINESS_OWNER_LEGAL = "Thanh Nhan (Johnny) Nguyen";
