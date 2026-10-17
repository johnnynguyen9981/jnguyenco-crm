"use client";
// Shared pieces for the public enquiry forms (/enquire and /enquire/embed).
// Lets businesses (editors, other vendors) message Johnny without creating a fake client
// enquiry, an INQUIRY booking, a client auto-reply or a referral-source data point.

export type EnquirerType = "client" | "vendor";

// Hidden field that real people never see. Bots that fill every input fill this one too,
// and /api/enquire silently drops those submissions.
export const HONEYPOT_FIELD = "hp_company_url";

export function EnquirerTypeToggle({ value, onChange }: { value: EnquirerType; onChange: (v: EnquirerType) => void }) {
  const options: { id: EnquirerType; label: string; sub: string }[] = [
    { id: "client", label: "I'm planning an event or photoshoot", sub: "Weddings, elopements, parties, portraits" },
    { id: "vendor", label: "I'm a business offering services", sub: "Editors, vendors, collaborations" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Who are you?">
      {options.map(o => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={[
              "text-left w-full rounded-lg border px-4 py-3 transition-all text-sm",
              selected ? "border-[#407e8c] bg-[#407e8c]/5 ring-1 ring-[#407e8c]/30" : "border-gray-200 bg-white hover:border-[#407e8c]/50",
            ].join(" ")}
          >
            <span className="block font-semibold text-gray-800">{o.label}</span>
            <span className="block text-xs text-gray-400 mt-0.5">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Leave this field empty
        <input
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export type VendorForm = {
  first_name: string;
  last_name: string;
  email: string;
  business_name: string;
  business_link: string;
  message: string;
};

export const EMPTY_VENDOR_FORM: VendorForm = {
  first_name: "", last_name: "", email: "", business_name: "", business_link: "", message: "",
};

export function vendorFormError(f: VendorForm): string {
  if (!f.first_name.trim() || !f.email.trim()) return "Please fill in your name and email address.";
  if (!f.message.trim()) return "Please add a short message.";
  return "";
}

export function VendorFields({
  form, set, inputCls, labelCls,
}: {
  form: VendorForm;
  set: (field: keyof VendorForm, val: string) => void;
  inputCls: string;
  labelCls: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Thanks for reaching out. Messages from businesses go straight to my inbox. I read them all, and I&apos;ll reply if it&apos;s a fit.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>First Name <span className="text-red-400">*</span></label>
          <input className={inputCls} value={form.first_name} onChange={e => set("first_name", e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Last Name</label>
          <input className={inputCls} value={form.last_name} onChange={e => set("last_name", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Email Address <span className="text-red-400">*</span></label>
        <input type="email" className={inputCls} value={form.email} onChange={e => set("email", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Business Name</label>
          <input className={inputCls} value={form.business_name} onChange={e => set("business_name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Website or Instagram</label>
          <input className={inputCls} value={form.business_link} onChange={e => set("business_link", e.target.value)} placeholder="@handle or link" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Message <span className="text-red-400">*</span></label>
        <textarea rows={5} className={inputCls + " resize-none"} value={form.message} onChange={e => set("message", e.target.value)} required />
      </div>
    </div>
  );
}
