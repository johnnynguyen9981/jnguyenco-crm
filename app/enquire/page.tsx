// app/enquire/page.tsx — Public enquiry form as a full page (no auth required).
// Same 3-step form as the website embed; this page adds the header and footer.
import { EnquiryWizard } from "@/components/enquire/EnquiryWizard";

export default function EnquirePage() {
  return (
    <div className="min-h-screen bg-[#f7f4f1] flex flex-col">
      <header className="bg-[#083a4f] px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[#a58d66] text-xs font-semibold uppercase tracking-widest">JNguyen Co.</p>
          <p className="text-white text-sm font-medium">Wedding &amp; Event Photography · Canberra</p>
        </div>
        <a href="https://www.jnguyen.co" className="min-h-[44px] flex items-center gap-1.5 text-xs text-[#c0d5d6] hover:text-white transition-colors border border-white/20 rounded-md px-3">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden="true"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to website
        </a>
      </header>

      <main className="flex-1">
        <EnquiryWizard />
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center">
        <p className="text-xs font-semibold text-[#083a4f] uppercase tracking-widest mb-1">JNguyen Co.</p>
        <p className="text-xs text-gray-600">Wedding &amp; Event Photography &amp; Videography · Canberra, Australia</p>
        <a href="mailto:johnny.nguyen@jnguyen.co" className="text-xs text-[#407e8c] hover:underline mt-1 inline-block">
          johnny.nguyen@jnguyen.co
        </a>
      </footer>
    </div>
  );
}
