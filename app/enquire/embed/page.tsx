"use client";
import { useState, useEffect, useRef } from "react";

const PACKAGES = [
  { id: "mini_wedding",       label: "Mini Wedding / Elopement",        price: "$1,600",  desc: "Up to 4 hrs · 1 Photographer + 1 Videographer · 200–350 images · 3–5 min film" },
  { id: "full_day_essential", label: "Full Day Essential",               price: "$3,200",  desc: "Up to 8 hrs · 400–600 images · 5–7 min highlight film" },
  { id: "full_day_premium",   label: "Full Day Premium",                 price: "$4,800",  desc: "Up to 13 hrs · 2 Photographers + 2 Videographers · 700–1,000 images" },
  { id: "hourly_photo",       label: "Event Photography Only",           price: "$200/hr", desc: "60+ edited images per hour · Online gallery · 4–8 week turnaround" },
  { id: "hourly_photo_video", label: "Event Photography & Videography",  price: "$350/hr", desc: "60+ images/hr · 2–3 min highlight reel + full event video" },
  { id: "portrait",           label: "Portrait Session",                 price: "$200/hr", desc: "Headshot · Couples · Family · Newborn/Maternity · Online gallery" },
  { id: "not_sure",           label: "Not sure — please advise me",      price: null,      desc: "" },
];

const EVENT_TYPES = ["Wedding / Elopement","Birthday","Baptism","Party / Celebration","Corporate Event","Portrait Session","Other"];
const BUDGET_OPTIONS = [
  { id: "under_1k",   label: "Under $1,000" },
  { id: "1k_2.5k",   label: "$1,000 – $2,500" },
  { id: "2.5k_4.5k", label: "$2,500 – $4,500" },
  { id: "4.5k_plus", label: "$4,500+" },
];
const SERVICES_OPTIONS = [
  { id: "PHOTO", label: "Photography only" },
  { id: "VIDEO", label: "Videography only" },
  { id: "BOTH",  label: "Photography & Videography" },
];
const REFERRAL_OPTIONS = [
  { id: "INSTAGRAM",     label: "Instagram" },
  { id: "GOOGLE",        label: "Google Search" },
  { id: "WORD_OF_MOUTH", label: "Word of Mouth" },
  { id: "WEDDING_WIRE",  label: "Wedding Wire" },
  { id: "FACEBOOK",      label: "Facebook" },
  { id: "OTHER",         label: "Other" },
];

const inp = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#407e8c]/40 focus:border-[#407e8c] transition-colors";
const lbl = "block text-xs font-semibold text-gray-600 mb-1";

function SectionHeader({ num, title, note }: { num: string; title: string; note?: string }) {
  return (
    <div className="border-b border-[#c0d5d6] pb-2 mb-4">
      <h2 className="text-xs font-bold text-[#407e8c] uppercase tracking-widest">{num}{num ? " — " : ""}{title}</h2>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  );
}

function OptionCard({ selected, onSelect, label, sub, price }: {
  selected: boolean; onSelect: () => void; label: string; sub?: string; price?: string | null;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={["text-left w-full rounded-lg border px-4 py-3 transition-all text-sm",
        selected ? "border-[#407e8c] bg-[#407e8c]/5 ring-1 ring-[#407e8c]/30" : "border-gray-200 bg-white hover:border-[#407e8c]/50",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className={["mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center",
          selected ? "bg-[#407e8c] border-[#407e8c]" : "border-gray-300"].join(" ")}>
          {selected && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">{label}</span>
            {price && <span className="text-xs font-bold text-[#407e8c]">{price}</span>}
          </div>
          {sub && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{sub}</p>}
        </div>
      </div>
    </button>
  );
}

export default function EnquireEmbedPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", instagram_handle: "",
    referral_source: "", referral_notes: "",
    partner_first: "", partner_last: "", partner_email: "", partner_phone: "",
    event_type: "", event_date: "", event_start_time: "", event_end_time: "",
    venue_name: "", venue_suburb: "", guest_count: "",
    selected_package: "", services_required: "", budget_range: "", special_requests: "",
  });

  // Report height to parent so iframe auto-resizes
  useEffect(() => {
    function reportHeight() {
      const h = containerRef.current?.scrollHeight ?? document.body.scrollHeight;
      window.parent.postMessage({ type: "jn-embed-height", height: h }, "*");
    }
    reportHeight();
    const ro = new ResizeObserver(reportHeight);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [submitted, error]);

  function set(field: keyof typeof form, val: string) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError("Please fill in your first name, last name and email address.");
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch("/api/enquire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong. Please try again."); return; }
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div ref={containerRef} className="bg-transparent py-16 px-4 text-center">
        <div className="w-16 h-16 bg-[#407e8c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#407e8c]">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[#083a4f] mb-3">Thank you, {form.first_name}!</h2>
        <p className="text-gray-600 text-sm leading-relaxed mb-2">
          Your enquiry has been received. I will be in touch within 24–48 hours with a personalised quote.
        </p>
        <p className="text-gray-400 text-xs">A confirmation has been sent to <strong>{form.email}</strong></p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-transparent">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        {/* 01 Your Details */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <SectionHeader num="01" title="Your Details" />
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>First Name <span className="text-red-400">*</span></label><input className={inp} value={form.first_name} onChange={e => set("first_name", e.target.value)} required placeholder="Jane" /></div>
            <div><label className={lbl}>Last Name <span className="text-red-400">*</span></label><input className={inp} value={form.last_name} onChange={e => set("last_name", e.target.value)} required placeholder="Smith" /></div>
          </div>
          <div><label className={lbl}>Email Address <span className="text-red-400">*</span></label><input type="email" className={inp} value={form.email} onChange={e => set("email", e.target.value)} required placeholder="jane@email.com" /></div>
          <div><label className={lbl}>Phone Number</label><input className={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="04XX XXX XXX" /></div>
          <div><label className={lbl}>Instagram Handle <span className="text-gray-400 font-normal">(optional)</span></label><input className={inp} value={form.instagram_handle} onChange={e => set("instagram_handle", e.target.value)} placeholder="@handle" /></div>
          <div>
            <label className={lbl}>How did you hear about me?</label>
            <div className="grid grid-cols-2 gap-3">
              <select className={inp} value={form.referral_source} onChange={e => set("referral_source", e.target.value)}>
                <option value="">Select source...</option>
                {REFERRAL_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <input className={inp} value={form.referral_notes} onChange={e => set("referral_notes", e.target.value)} placeholder="e.g. Referred by Sarah & Tom" />
            </div>
          </div>
        </div>

        {/* Partner */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <SectionHeader num="" title="Partner / Spouse" note="Optional — fill in for weddings or couples sessions" />
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>First Name</label><input className={inp} value={form.partner_first} onChange={e => set("partner_first", e.target.value)} /></div>
            <div><label className={lbl}>Last Name</label><input className={inp} value={form.partner_last} onChange={e => set("partner_last", e.target.value)} /></div>
            <div><label className={lbl}>Email</label><input type="email" className={inp} value={form.partner_email} onChange={e => set("partner_email", e.target.value)} /></div>
            <div><label className={lbl}>Phone</label><input className={inp} value={form.partner_phone} onChange={e => set("partner_phone", e.target.value)} /></div>
          </div>
        </div>

        {/* 02 Event Details */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <SectionHeader num="02" title="Event Details" note="Fill in as much as you know — you can always update later." />
          <div><label className={lbl}>Event Type</label>
            <select className={inp} value={form.event_type} onChange={e => set("event_type", e.target.value)}>
              <option value="">Select type...</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lbl}>Event Date</label><input type="date" className={inp} value={form.event_date} onChange={e => set("event_date", e.target.value)} /></div>
            <div><label className={lbl}>Start Time</label><input type="time" className={inp} value={form.event_start_time} onChange={e => set("event_start_time", e.target.value)} /></div>
            <div><label className={lbl}>End Time</label><input type="time" className={inp} value={form.event_end_time} onChange={e => set("event_end_time", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Venue / Location Name</label><input className={inp} value={form.venue_name} onChange={e => set("venue_name", e.target.value)} placeholder="Venue name" /></div>
            <div><label className={lbl}>Suburb / City</label><input className={inp} value={form.venue_suburb} onChange={e => set("venue_suburb", e.target.value)} placeholder="e.g. Canberra, ACT" /></div>
          </div>
          <div><label className={lbl}>Estimated Guest Count</label><input type="number" min="0" className={inp} value={form.guest_count} onChange={e => set("guest_count", e.target.value)} placeholder="e.g. 80" /></div>
        </div>

        {/* 03 Package */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <SectionHeader num="03" title="Package Interest" note="Not sure? Select the last option and I will advise you." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PACKAGES.map(pkg => (
              <OptionCard key={pkg.id} selected={form.selected_package === pkg.id}
                onSelect={() => set("selected_package", form.selected_package === pkg.id ? "" : pkg.id)}
                label={pkg.label} price={pkg.price} sub={pkg.desc || undefined} />
            ))}
          </div>
        </div>

        {/* 04 Services */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <SectionHeader num="04" title="Services Required" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SERVICES_OPTIONS.map(s => (
              <OptionCard key={s.id} selected={form.services_required === s.id}
                onSelect={() => set("services_required", form.services_required === s.id ? "" : s.id)}
                label={s.label} />
            ))}
          </div>
        </div>

        {/* 05 Budget */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <SectionHeader num="05" title="Approximate Budget" note="Helps me tailor the right package for you." />
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_OPTIONS.map(b => (
              <OptionCard key={b.id} selected={form.budget_range === b.id}
                onSelect={() => set("budget_range", form.budget_range === b.id ? "" : b.id)}
                label={b.label} />
            ))}
          </div>
        </div>

        {/* 06 Message */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <SectionHeader num="06" title="Anything Else?" note="Must-have shots, special moments, or anything you would like me to know." />
          <textarea rows={4} className={inp + " resize-none"} value={form.special_requests}
            onChange={e => set("special_requests", e.target.value)}
            placeholder="e.g. We would love a first look moment, outdoor ceremony, and a must-have shot of the venue at golden hour..." />
        </div>

        {/* Submit */}
        <div className="pb-4">
          <button type="submit" disabled={loading}
            className="w-full bg-[#083a4f] hover:bg-[#0a4d68] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
            {loading ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending enquiry...</>
            ) : "Send Enquiry"}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">No payment required. I will be in touch within 24–48 hours.</p>
        </div>

      </form>
    </div>
  );
}
