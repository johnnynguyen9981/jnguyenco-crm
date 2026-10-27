"use client";
// components/enquire/EnquiryWizard.tsx — The 3-step public enquiry form, used by both
// /enquire (full page) and /enquire/embed (inside the Squarespace Contact page).
//
//   Step 1  What are you planning? + date (with the advisory date check)
//   Step 2  Package for that type only, single choice. Budget is asked only for "Not sure".
//   Step 3  First name + email (required), phone (optional), everything else folded
//           under "Tell me more (optional)".
//
// Business / vendor messages use the same /api/enquire vendor path as before (no client,
// no booking, no auto-reply), reached from a small link at the bottom.
import { useEffect, useRef, useState } from "react";
import {
  HoneypotField, VendorFields, EMPTY_VENDOR_FORM, HONEYPOT_FIELD, vendorFormError, type VendorForm,
} from "@/components/enquire/VendorEnquiry";
import { DateAvailability } from "@/components/enquire/DateAvailability";
import {
  BUDGETS, EVENT_OCCASIONS, GROUPS, NOT_SURE_ID, packagesForGroup, servicesFor, sydneyTodayYmd,
  type EnquiryGroup,
} from "@/lib/enquiry-packages";

const REFERRAL_OPTIONS = [
  { id: "GOOGLE",         label: "Google" },
  { id: "INSTAGRAM",      label: "Instagram" },
  { id: "FACEBOOK",       label: "Facebook" },
  { id: "FACEBOOK_GROUP", label: "Facebook group" },
  { id: "WORD_OF_MOUTH",  label: "Friend or family" },
  { id: "WEDDING_WIRE",   label: "Wedding Wire" },
  { id: "OTHER",          label: "Other" },
];
const REFERRAL_HAS_NOTES = (src: string) => src === "WORD_OF_MOUTH" || src === "OTHER" || src === "FACEBOOK_GROUP";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inp = "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#407e8c]/40 focus:border-[#407e8c] transition-colors";
const lbl = "block text-sm font-semibold text-gray-800 mb-1.5";
const primaryBtn = "w-full min-h-[52px] bg-[#083a4f] hover:bg-[#0a4d68] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-base flex items-center justify-center gap-2";
const backBtn = "min-h-[44px] text-sm font-semibold text-[#407e8c] hover:text-[#083a4f]";

type Step = 1 | 2 | 3;

const EMPTY_FORM = {
  first_name: "", email: "", phone: "",
  instagram_handle: "", referral_source: "", referral_notes: "",
  partner_first: "", partner_last: "",
  occasion: "", event_date: "", event_start_time: "", event_end_time: "",
  venue_name: "", venue_suburb: "", guest_count: "",
  selected_package: "", budget_range: "", special_requests: "",
};

function Choice({ selected, onSelect, title, sub, price }: {
  selected: boolean; onSelect: () => void; title: string; sub?: string; price?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={[
        "w-full min-h-[56px] text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors",
        selected ? "border-[#083a4f] bg-[#407e8c]/10 ring-1 ring-[#083a4f]" : "border-gray-300 bg-white hover:border-[#407e8c]",
      ].join(" ")}
    >
      <span aria-hidden="true" className={[
        "flex-shrink-0 w-5 h-5 rounded-full border-2",
        selected ? "border-[6px] border-[#083a4f]" : "border-gray-300 bg-white",
      ].join(" ")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-gray-900 text-[15px] leading-snug">{title}</span>
          {price && <span className="text-sm font-bold text-[#407e8c] whitespace-nowrap">{price}</span>}
        </span>
        {sub && <span className="block text-[13px] text-gray-600 mt-0.5 leading-snug">{sub}</span>}
      </span>
    </button>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#407e8c] uppercase tracking-widest">Step {step} of 3</span>
        <span className="text-xs text-gray-600">About 1 minute</span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map(n => (
          <span key={n} className={"h-1 flex-1 rounded-full " + (n <= step ? "bg-[#083a4f]" : "bg-gray-300")} />
        ))}
      </div>
    </div>
  );
}

function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "your date";
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function EnquiryWizard({ embedded = false }: { embedded?: boolean }) {
  const topRef = useRef<HTMLDivElement>(null);
  const [mode, setMode]           = useState<"client" | "vendor">("client");
  const [step, setStep]           = useState<Step>(1);
  const [group, setGroup]         = useState<EnquiryGroup | "">("");
  const [more, setMore]           = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [vendor, setVendor]       = useState<VendorForm>(EMPTY_VENDOR_FORM);
  const [honeypot, setHoneypot]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");
  const today = sydneyTodayYmd();

  const set = (field: keyof typeof EMPTY_FORM, val: string) => setForm(prev => ({ ...prev, [field]: val }));
  const groupInfo = GROUPS.find(g => g.id === group);
  const packages = group ? packagesForGroup(group, today) : [];
  const chosen = packages.find(p => p.id === form.selected_package);
  const eventTypeForApi = group === "EVENT" && form.occasion ? form.occasion : (groupInfo?.eventType ?? "");

  // Keep the start of the form in view when the step changes (a long step 2 followed by a
  // short step 3 would otherwise leave the person looking at empty space), and tell the
  // parent page which step is showing (no personal details).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (embedded) window.parent.postMessage({ type: "jn-enquiry-step", step: submitted ? "done" : mode === "vendor" ? "vendor" : step }, "*");
  }, [step, mode, submitted, embedded]);

  function pickGroup(g: EnquiryGroup) {
    if (g !== group) setForm(prev => ({ ...prev, selected_package: "", budget_range: "", occasion: "" }));
    setGroup(g);
  }

  function pickPackage(id: string) {
    setForm(prev => ({ ...prev, selected_package: id, budget_range: id === NOT_SURE_ID ? prev.budget_range : "" }));
  }

  const step1Ready = !!group && /^\d{4}-\d{2}-\d{2}$/.test(form.event_date) && form.event_date >= today;
  const step2Ready = !!form.selected_package;
  const step3Ready = !!form.first_name.trim() && EMAIL_RE.test(form.email.trim());

  async function send(payload: Record<string, string>) {
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/enquire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong. Please try again."); return false; }
      setSubmitted(true);
      return true;
    } catch {
      setError("Network error. Please check your connection and try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function submitClient(e: React.FormEvent) {
    e.preventDefault();
    if (!step3Ready) { setError("Please add your first name and a valid email address."); return; }
    const ok = await send({
      first_name: form.first_name.trim(),
      last_name: "",
      email: form.email.trim(),
      phone: form.phone,
      instagram_handle: form.instagram_handle,
      referral_source: form.referral_source,
      referral_notes: REFERRAL_HAS_NOTES(form.referral_source) ? form.referral_notes : "",
      partner_first: group === "WEDDING" ? form.partner_first : "",
      partner_last: group === "WEDDING" ? form.partner_last : "",
      event_type: eventTypeForApi,
      event_date: form.event_date,
      event_start_time: form.event_start_time,
      event_end_time: form.event_end_time,
      venue_name: form.venue_name,
      venue_suburb: form.venue_suburb,
      guest_count: form.guest_count,
      selected_package: form.selected_package,
      services_required: servicesFor(form.selected_package),
      budget_range: form.selected_package === NOT_SURE_ID ? form.budget_range : "",
      special_requests: form.special_requests,
      [HONEYPOT_FIELD]: honeypot,
    });
    // Same event the Squarespace page already listens for (Google Analytics key event).
    if (ok && embedded) {
      window.parent.postMessage({ type: "jn-enquiry-submitted", event_type: eventTypeForApi || "unknown", package: form.selected_package || "unknown" }, "*");
    }
  }

  async function submitVendor(e: React.FormEvent) {
    e.preventDefault();
    const vErr = vendorFormError(vendor);
    if (vErr) { setError(vErr); return; }
    await send({ enquirer_type: "vendor", ...vendor, [HONEYPOT_FIELD]: honeypot });
  }

  const errorBox = error && (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
  );

  // ── Thank-you screens ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div ref={topRef} className="max-w-xl mx-auto px-4 py-14 text-center">
        <div className="w-16 h-16 bg-[#407e8c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#407e8c]" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {mode === "vendor" ? (<>
          <h2 className="text-2xl font-bold text-[#083a4f] mb-3">Thanks, {vendor.first_name}!</h2>
          <p className="text-gray-700 text-base leading-relaxed">Your message has been sent. I&apos;ll get back to you if it&apos;s a good fit.</p>
        </>) : (<>
          <h2 className="text-2xl font-bold text-[#083a4f] mb-3">Thanks, {form.first_name.trim()}!</h2>
          <p className="text-gray-700 text-base leading-relaxed mb-2">
            I&apos;ve got your enquiry for <strong>{longDate(form.event_date)}</strong>. I&apos;ll check my calendar and send you a personal quote within 24 hours.
          </p>
          <p className="text-gray-600 text-sm">A confirmation has been sent to <strong>{form.email.trim()}</strong>.</p>
          <a href="https://www.instagram.com/jnguyen.co/" target="_blank" rel="noopener noreferrer"
            className="inline-block mt-6 text-sm font-semibold text-[#407e8c] hover:text-[#083a4f]">
            See recent work on Instagram @jnguyen.co
          </a>
        </>)}
      </div>
    );
  }

  // ── Business / vendor message ───────────────────────────────────────────────
  if (mode === "vendor") {
    return (
      <div ref={topRef} className="max-w-xl mx-auto px-4 py-8">
        <form onSubmit={submitVendor} className="space-y-5">
          <HoneypotField value={honeypot} onChange={setHoneypot} />
          <h2 className="text-2xl font-bold text-[#083a4f]">Message from a business</h2>
          {errorBox}
          <VendorFields form={vendor} set={(f, v) => setVendor(prev => ({ ...prev, [f]: v }))} inputCls={inp} labelCls={lbl} />
          <button type="submit" disabled={loading} className={primaryBtn}>{loading ? "Sending…" : "Send message"}</button>
          <button type="button" className={backBtn} onClick={() => { setMode("client"); setError(""); }}>← Back to the enquiry form</button>
        </form>
      </div>
    );
  }

  // ── Client enquiry, 3 steps ─────────────────────────────────────────────────
  return (
    <div ref={topRef} className="max-w-xl mx-auto px-4 py-8">
      <form onSubmit={submitClient} noValidate>
        <HoneypotField value={honeypot} onChange={setHoneypot} />
        <Progress step={step} />

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] leading-tight font-bold text-[#083a4f]">Let&apos;s check your date</h2>
              <p className="text-base text-gray-600 mt-1.5">Tell me what you&apos;re planning and when. You&apos;ll see straight away if I&apos;m likely free.</p>
            </div>
            <fieldset>
              <legend className={lbl}>What are you planning?</legend>
              <div className="space-y-2.5" role="radiogroup">
                {GROUPS.map(g => (
                  <Choice key={g.id} selected={group === g.id} onSelect={() => pickGroup(g.id)} title={g.label} sub={g.sub} />
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="enq-date" className={lbl}>Your date</label>
              <input id="enq-date" type="date" min={today} className={inp} value={form.event_date}
                onChange={e => set("event_date", e.target.value)} />
              <p className="text-[13px] text-gray-600 mt-1.5">Not sure of the exact day? Pick your best guess.</p>
              {group && <DateAvailability date={form.event_date} eventType={groupInfo?.eventType ?? ""} />}
            </div>
            <button type="button" className={primaryBtn} disabled={!step1Ready} onClick={() => setStep(2)}>Continue</button>
          </div>
        )}

        {step === 2 && group && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[28px] leading-tight font-bold text-[#083a4f]">Which package fits?</h2>
              <p className="text-base text-gray-600 mt-1.5">Prices are starting points. Everyone gets a custom quote.</p>
            </div>
            <div className="space-y-2.5" role="radiogroup" aria-label="Package">
              <Choice selected={form.selected_package === NOT_SURE_ID} onSelect={() => pickPackage(NOT_SURE_ID)}
                title="Not sure — help me choose" sub="I'll suggest the best fit for your day" />
              {packages.map(p => (
                <Choice key={p.id} selected={form.selected_package === p.id} onSelect={() => pickPackage(p.id)}
                  title={p.label} price={p.price} sub={p.meta} />
              ))}
            </div>
            <a href="https://www.jnguyen.co/services" target="_blank" rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-[#407e8c] hover:text-[#083a4f]">
              See everything included in each package
            </a>
            {form.selected_package === NOT_SURE_ID && (
              <fieldset className="bg-white rounded-xl border border-gray-200 p-4">
                <legend className="sr-only">Budget</legend>
                <p className="text-[15px] font-semibold text-gray-900">Roughly what budget do you have in mind?</p>
                <p className="text-[13px] text-gray-600 mb-3">Optional. It helps me suggest the right package.</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Budget">
                  {BUDGETS[group].map(b => {
                    const on = form.budget_range === b;
                    return (
                      <button key={b} type="button" role="radio" aria-checked={on}
                        onClick={() => set("budget_range", on ? "" : b)}
                        className={[
                          "min-h-[44px] px-4 rounded-full border text-sm font-semibold transition-colors",
                          on ? "bg-[#083a4f] border-[#083a4f] text-white" : "bg-white border-gray-300 text-gray-900 hover:border-[#407e8c]",
                        ].join(" ")}>{b}</button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <button type="button" className={primaryBtn} disabled={!step2Ready} onClick={() => setStep(3)}>Continue</button>
            <button type="button" className={backBtn} onClick={() => setStep(1)}>← Back</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[28px] leading-tight font-bold text-[#083a4f]">Where do I send your quote?</h2>
              <p className="text-base text-gray-600 mt-1.5">
                {chosen ? chosen.label : groupInfo?.label} on {longDate(form.event_date)}. Last step!
              </p>
            </div>
            {errorBox}
            <div>
              <label htmlFor="enq-first" className={lbl}>First name</label>
              <input id="enq-first" className={inp} autoComplete="given-name" placeholder="Jane"
                value={form.first_name} onChange={e => set("first_name", e.target.value)} />
            </div>
            <div>
              <label htmlFor="enq-email" className={lbl}>Email</label>
              <input id="enq-email" type="email" inputMode="email" autoComplete="email" className={inp} placeholder="jane@email.com"
                value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div>
              <label htmlFor="enq-phone" className={lbl}>Phone <span className="font-normal text-gray-600">(optional)</span></label>
              <input id="enq-phone" type="tel" inputMode="tel" autoComplete="tel" className={inp} placeholder="04XX XXX XXX"
                value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <button type="button" aria-expanded={more} aria-controls="enq-more" onClick={() => setMore(m => !m)}
                className="w-full min-h-[52px] px-4 flex items-center justify-between text-left">
                <span className="text-[15px] font-semibold text-[#083a4f]">Tell me more <span className="font-normal text-gray-600">(optional)</span></span>
                <span aria-hidden="true" className="text-xl text-[#407e8c]">{more ? "−" : "+"}</span>
              </button>
              {more && (
                <div id="enq-more" className="px-4 pb-4 space-y-4">
                  {group === "WEDDING" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><label htmlFor="enq-pf" className={lbl}>Partner&apos;s first name</label><input id="enq-pf" className={inp} value={form.partner_first} onChange={e => set("partner_first", e.target.value)} /></div>
                      <div><label htmlFor="enq-pl" className={lbl}>Last name</label><input id="enq-pl" className={inp} value={form.partner_last} onChange={e => set("partner_last", e.target.value)} /></div>
                    </div>
                  )}
                  {group === "EVENT" && (
                    <div>
                      <label htmlFor="enq-occ" className={lbl}>What&apos;s the occasion?</label>
                      <select id="enq-occ" className={inp} value={form.occasion} onChange={e => set("occasion", e.target.value)}>
                        <option value="">Choose one</option>
                        {EVENT_OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="enq-venue" className={lbl}>Venue or location</label>
                    <input id="enq-venue" className={inp} placeholder="e.g. Stonehouse Garden" value={form.venue_name} onChange={e => set("venue_name", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="enq-suburb" className={lbl}>Suburb or city</label>
                    <input id="enq-suburb" className={inp} placeholder="e.g. Canberra, ACT" value={form.venue_suburb} onChange={e => set("venue_suburb", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="enq-start" className={lbl}>Start time</label><input id="enq-start" type="time" className={inp} value={form.event_start_time} onChange={e => set("event_start_time", e.target.value)} /></div>
                    <div><label htmlFor="enq-end" className={lbl}>End time</label><input id="enq-end" type="time" className={inp} value={form.event_end_time} onChange={e => set("event_end_time", e.target.value)} /></div>
                  </div>
                  <div>
                    <label htmlFor="enq-guests" className={lbl}>Number of guests</label>
                    <input id="enq-guests" type="number" min="0" inputMode="numeric" className={inp} placeholder="e.g. 80" value={form.guest_count} onChange={e => set("guest_count", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="enq-ig" className={lbl}>Instagram</label>
                    <input id="enq-ig" className={inp} placeholder="@handle" value={form.instagram_handle} onChange={e => set("instagram_handle", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="enq-src" className={lbl}>How did you find me?</label>
                    <select id="enq-src" className={inp} value={form.referral_source} onChange={e => set("referral_source", e.target.value)}>
                      <option value="">Choose one</option>
                      {REFERRAL_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    {REFERRAL_HAS_NOTES(form.referral_source) && (
                      <input aria-label="More detail on how you found me" className={inp + " mt-2"} value={form.referral_notes}
                        onChange={e => set("referral_notes", e.target.value)}
                        placeholder={form.referral_source === "FACEBOOK_GROUP" ? "Which group? e.g. Canberra Weddings" : "e.g. Referred by Sarah & Tom"} />
                    )}
                  </div>
                  <div>
                    <label htmlFor="enq-msg" className={lbl}>Anything else?</label>
                    <textarea id="enq-msg" rows={3} className={inp + " resize-none"} placeholder="Must-have moments, your vision, questions…"
                      value={form.special_requests} onChange={e => set("special_requests", e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className={primaryBtn} disabled={loading || !step3Ready}>
              {loading ? "Sending…" : "Send my enquiry"}
            </button>
            <p className="text-center text-sm text-gray-600">No payment needed. I&apos;ll reply within 24 hours.</p>
            <button type="button" className={backBtn} onClick={() => { setStep(2); setError(""); }}>← Back</button>
          </div>
        )}
      </form>

      <p className="mt-10 text-center text-[13px] text-gray-600">
        A business or vendor?{" "}
        <button type="button" className="font-semibold text-[#407e8c] underline hover:text-[#083a4f]"
          onClick={() => { setMode("vendor"); setError(""); }}>Send me a message here</button>
      </p>
    </div>
  );
}
