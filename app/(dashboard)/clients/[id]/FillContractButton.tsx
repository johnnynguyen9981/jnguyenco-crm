"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2, CheckCircle, X, PenLine } from "lucide-react";

interface Props {
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  // Optional booking data to pre-fill the contract
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venueSuburb?: string;
  eventType?: string;
  // Pricing
  totalFee?: number;
  depositAmount?: number;
  remainingBalance?: number;
  // Package (from the booking linked to this client)
  packageName?: string;
}

const PACKAGES = [
  { key: "pkg_mini",   label: "Mini Wedding / Elopement",  detail: "Up to 4 hrs · $1,600" },
  { key: "pkg_full8",  label: "Full Day Essential",         detail: "Up to 8 hrs · $3,200" },
  { key: "pkg_full13", label: "Full Day Premium",           detail: "Up to 13 hrs · $4,800" },
  { key: "pkg_hourly", label: "Hourly – Photography",       detail: "$150/hr" },
  { key: "pkg_combo",  label: "Hourly – Photo + Video",     detail: "$250/hr" },
  { key: "pkg_unsure", label: "TBD / Unsure",               detail: "" },
] as const;

const SERVICES = [
  { key: "svc_photo", label: "Photography" },
  { key: "svc_video", label: "Videography" },
  { key: "svc_both",  label: "Both" },
] as const;

type PkgKey = typeof PACKAGES[number]["key"];
type SvcKey = typeof SERVICES[number]["key"];

interface ManualForm {
  full_name: string;
  email: string;
  phone: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guest_count: string;
  venue: string;
  suburb: string;
  pkg: PkgKey | "";
  svc: SvcKey | "";
  additional_info: string;
}

async function downloadContract(
  clientId: string,
  fd: FormData,
  onDone: () => void,
  onError: (msg: string) => void
) {
  const res = await fetch(`/api/clients/${clientId}/fill-contract`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(j.error ?? "Failed to generate contract");
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  const cd   = res.headers.get("content-disposition") ?? "";
  const m    = cd.match(/filename="([^"]+)"/);
  a.download = m?.[1] ?? "Photography_Contract.pdf";
  a.click();
  URL.revokeObjectURL(url);
  onDone();
}

export function FillContractButton({
  clientId,
  clientName = "",
  clientEmail = "",
  clientPhone = "",
  eventDate = "",
  startTime = "",
  endTime = "",
  venueName = "",
  venueSuburb = "",
  eventType = "",
  totalFee,
  depositAmount,
  remainingBalance,
  packageName = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]             = useState<File | null>(null);
  const [autoStatus, setAutoStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [autoErr, setAutoErr]       = useState("");

  const [modalOpen, setModalOpen]       = useState(false);
  const [manualStatus, setManualStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [manualErr, setManualErr]       = useState("");

  const [form, setForm] = useState<ManualForm>({
    full_name: clientName,
    email: clientEmail,
    phone: clientPhone,
    event_type: eventType,
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    guest_count: "",
    venue: venueName,
    suburb: venueSuburb,
    pkg: "",
    svc: "",
    additional_info: "",
  });

  function set(key: keyof ManualForm, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function autoGenerate() {
    setAutoStatus("loading");
    setAutoErr("");
    try {
      const fd = new FormData();
      if (file) {
        fd.append("form", file);
      } else {
        // No PDF — send booking + client data so the contract is pre-filled
        const prefill: Record<string, string | number> = {};
        if (clientName)       prefill.full_name         = clientName;
        if (clientEmail)      prefill.email             = clientEmail;
        if (clientPhone)      prefill.phone             = clientPhone;
        if (eventDate)        prefill.event_date        = eventDate;
        if (startTime)        prefill.start_time        = startTime;
        if (endTime)          prefill.end_time          = endTime;
        if (venueName)        prefill.venue             = venueName;
        if (venueSuburb)      prefill.suburb            = venueSuburb;
        if (eventType)        prefill.event_type        = eventType;
        if (totalFee != null)        prefill.total_fee         = totalFee;
        if (depositAmount != null)   prefill.deposit_amount    = depositAmount;
        if (remainingBalance != null) prefill.remaining_balance = remainingBalance;
        if (packageName)             prefill.package_name      = packageName;
        fd.append("data", JSON.stringify(prefill));
      }
      await downloadContract(
        clientId,
        fd,
        () => {
          setAutoStatus("done");
          setTimeout(() => setAutoStatus("idle"), 4000);
        },
        (msg) => {
          setAutoErr(msg);
          setAutoStatus("error");
        }
      );
    } catch (e: unknown) {
      setAutoErr(e instanceof Error ? e.message : "Something went wrong");
      setAutoStatus("error");
    }
  }

  function openModal() {
    setForm({
      full_name: clientName,
      email: clientEmail,
      phone: clientPhone,
      event_type: eventType,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      guest_count: "",
      venue: venueName,
      suburb: venueSuburb,
      pkg: "",
      svc: "",
      additional_info: "",
    });
    setManualStatus("idle");
    setManualErr("");
    setModalOpen(true);
  }

  async function manualGenerate() {
    setManualStatus("loading");
    setManualErr("");
    try {
      const pkgData: Record<string, string> = {};
      if (form.pkg) pkgData[form.pkg] = "Yes";
      const svcData: Record<string, string> = {};
      if (form.svc) svcData[form.svc] = "Yes";

      const enquiry = {
        full_name:       form.full_name,
        email:           form.email,
        phone:           form.phone,
        event_type:      form.event_type,
        event_date:      form.event_date,
        start_time:      form.start_time,
        end_time:        form.end_time,
        guest_count:     form.guest_count,
        venue:           form.venue,
        suburb:          form.suburb,
        additional_info: form.additional_info,
        ...pkgData,
        ...svcData,
      };

      const fd = new FormData();
      fd.append("data", JSON.stringify(enquiry));

      await downloadContract(
        clientId,
        fd,
        () => {
          setManualStatus("done");
          setTimeout(() => {
            setManualStatus("idle");
            setModalOpen(false);
          }, 2000);
        },
        (msg) => {
          setManualErr(msg);
          setManualStatus("error");
        }
      );
    } catch (e: unknown) {
      setManualErr(e instanceof Error ? e.message : "Something went wrong");
      setManualStatus("error");
    }
  }

  return (
    <>
      {/* ── Card ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-brand-teal" />
          <h3 className="text-sm font-semibold text-brand-navy">Generate Contract</h3>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">
            Optionally upload the client's enquiry PDF to auto-fill all fields.
          </p>
          <label
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors",
              file
                ? "border-brand-teal/60 bg-brand-teal/[0.04] text-brand-teal"
                : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-500 hover:text-brand-teal",
            ].join(" ")}
          >
            <Upload size={13} />
            {file ? file.name : "Upload enquiry form (optional)"}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setAutoStatus("idle");
              }}
            />
          </label>
        </div>

        <button
          onClick={autoGenerate}
          disabled={autoStatus === "loading"}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          {autoStatus === "loading" ? (
            <><Loader2 size={14} className="animate-spin" /> Generating...</>
          ) : autoStatus === "done" ? (
            <><CheckCircle size={14} /> Downloaded!</>
          ) : (
            <><FileText size={14} /> Fill &amp; Download Contract</>
          )}
        </button>

        {autoStatus === "error" && (
          <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{autoErr}</p>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-brand-pale-blue" />
          <span className="text-[11px] text-gray-400">or</span>
          <div className="flex-1 border-t border-brand-pale-blue" />
        </div>

        <button
          onClick={openModal}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <PenLine size={14} /> Fill Contract Manually
        </button>
      </div>

      {/* ── Modal ────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-pale-blue">
              <div className="flex items-center gap-2">
                <PenLine size={16} className="text-brand-teal" />
                <h2 className="font-semibold text-brand-navy">Fill Contract Manually</h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-brand-navy transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                  Client Info
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      value={form.full_name}
                      onChange={(e) => set("full_name", e.target.value)}
                      placeholder="e.g. Sarah and James Johnson"
                    />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="client@email.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="04xx xxx xxx"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                  Event Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Event Type</label>
                    <input
                      className="form-input"
                      value={form.event_type}
                      onChange={(e) => set("event_type", e.target.value)}
                      placeholder="e.g. Wedding, Birthday, Baptism"
                    />
                  </div>
                  <div>
                    <label className="form-label">Event Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={form.event_date}
                      onChange={(e) => set("event_date", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Start Time</label>
                    <input
                      className="form-input"
                      type="time"
                      value={form.start_time}
                      onChange={(e) => set("start_time", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">End Time</label>
                    <input
                      className="form-input"
                      type="time"
                      value={form.end_time}
                      onChange={(e) => set("end_time", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Guest Count</label>
                    <input
                      className="form-input"
                      value={form.guest_count}
                      onChange={(e) => set("guest_count", e.target.value)}
                      placeholder="e.g. 80"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                  Venue
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="form-label">Venue Name</label>
                    <input
                      className="form-input"
                      value={form.venue}
                      onChange={(e) => set("venue", e.target.value)}
                      placeholder="e.g. Old Parliament House"
                    />
                  </div>
                  <div>
                    <label className="form-label">Suburb / City</label>
                    <input
                      className="form-input"
                      value={form.suburb}
                      onChange={(e) => set("suburb", e.target.value)}
                      placeholder="e.g. Canberra ACT"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                  Package
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PACKAGES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => set("pkg", p.key)}
                      className={[
                        "flex items-start gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors text-sm",
                        form.pkg === p.key
                          ? "border-brand-teal bg-brand-teal/[0.06] text-brand-navy"
                          : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-600",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0",
                          form.pkg === p.key
                            ? "border-brand-teal bg-brand-teal"
                            : "border-gray-300",
                        ].join(" ")}
                      />
                      <span>
                        <span className="font-medium block">{p.label}</span>
                        {p.detail && (
                          <span className="text-xs text-gray-400">{p.detail}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                  Services
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {SERVICES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => set("svc", s.key)}
                      className={[
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                        form.svc === s.key
                          ? "border-brand-teal bg-brand-teal text-white"
                          : "border-brand-pale-blue hover:border-brand-teal/50 text-gray-600",
                      ].join(" ")}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-teal mb-3">
                  Additional Notes
                </h3>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  value={form.additional_info}
                  onChange={(e) => set("additional_info", e.target.value)}
                  placeholder="Any special requirements or extra details..."
                />
              </section>

              {manualStatus === "error" && (
                <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{manualErr}</p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-brand-pale-blue">
              <button
                onClick={() => setModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={manualGenerate}
                disabled={manualStatus === "loading"}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {manualStatus === "loading" ? (
                  <><Loader2 size={14} className="animate-spin" /> Generating...</>
                ) : manualStatus === "done" ? (
                  <><CheckCircle size={14} /> Downloaded!</>
                ) : (
                  <><FileText size={14} /> Generate and Download</>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
