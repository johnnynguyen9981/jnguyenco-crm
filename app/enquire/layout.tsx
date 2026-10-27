// app/enquire/layout.tsx — Counts visits to the public enquiry form (/enquire and
// /enquire/embed) with Vercel Web Analytics. Cookie-free, no personal details.
// Turn it on once in Vercel: project jnguyenco-crm → Analytics → Enable.
import { Analytics } from "@vercel/analytics/next";

export default function EnquireLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
