"use client";

import { useEffect, useState } from "react";
import {
  Download, Send, FileText, CheckCircle2,
  Loader2, AlertCircle, Eye, Mail,
} from "lucide-react";

interface Client {
  id: string;
  first_name: string | null;
  last_name:  string | null;
  email:      string | null;
}

export default function FormsPage() {
  const [clients,       setClients]       = useState<Client[]>([]);
  const [selectedId,    setSelectedId]    = useState("");
  const [customEmail,   setCustomEmail]   = useState("");
  const [message,       setMessage]       = useState("");
  const [sending,       setSending]       = useState(false);
  const [sent,          setSent]          = useState(false);
  const [error,         setError]         = useState("");
  const [loadingClients,setLoadingClients]= useState(true);

  /* ── Load clients ──────────────────────────────────── */
  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(d => {
        setClients(Array.isArray(d) ? d : (d.clients ?? []));
        setLoadingClients(false);
      })
      .catch(() => setLoadingClients(false));
  }, []);

  /* When a client is selected, auto-fill their email */
  const selectedClient = clients.find(c => c.id === selectedId);
  useEffect(() => {
    if (selectedClient?.email) setCustomEmail(selectedClient.email);
    else setCustomEmail("");
  }, [selectedId]);

  /* ── Send form ────────────────────────────────────── */
  async function handleSend() {
    const email = customEmail.trim();
    if (!email) { setError("Please enter or select a client email."); return; }
    setSending(true);
    setError("");
    setSent(false);
    try {
      const res = await fetch("/api/forms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId:    selectedId || null,
          clientEmail: email,
          clientName:  selectedClient
            ? `${selectedClient.first_name ?? ""} ${selectedClient.last_name ?? ""}`.trim()
            : "",
          message,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to send");
      }
      setSent(true);
      setMessage("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-brand-navy tracking-tight">
          Forms &amp; Templates
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Download or send forms directly to clients from here.
        </p>
      </div>

      {/* Form card grid */}
      <div className="grid gap-6 sm:grid-cols-2">

        {/* ── Enquiry Form card ──────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Card top strip */}
          <div className="bg-brand-navy px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-brand-sand" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">
                Client Enquiry Form
              </p>
              <p className="text-brand-pale-blue text-[11px] mt-0.5">
                Fillable PDF &middot; A4 &middot; 1 page
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Branded enquiry form covering personal details, partner info, event
              details, package interest, services, budget and special requests.
              Send to a new client before their first consultation.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["Personal Details","Event Info","Package Interest","Budget"].map(tag => (
                <span key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50
                             border border-gray-100 text-gray-500 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions row */}
          <div className="px-5 py-4 flex gap-2">
            <a
              href="/JNguyen_Co_Enquiry_Form.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                         bg-brand-navy text-white text-xs font-semibold
                         hover:bg-brand-teal transition-colors"
            >
              <Download size={13} />
              Download
            </a>
            <a
              href="/JNguyen_Co_Enquiry_Form.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                         border border-gray-200 text-gray-600 text-xs font-semibold
                         hover:bg-gray-50 transition-colors"
            >
              <Eye size={13} />
              Preview
            </a>
          </div>

          {/* ── Send section ──────────────────────── */}
          <div className="px-5 pb-5 pt-1 border-t border-gray-50">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-sand mb-3 mt-3">
              Send to Client
            </p>

            {/* Client picker */}
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Select Client
              </label>
              {loadingClients ? (
                <div className="h-9 bg-gray-50 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg
                             bg-white text-gray-700 focus:outline-none
                             focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
                >
                  <option value="">— pick a client or enter email below —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed"}
                      {c.email ? ` (${c.email})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Email override */}
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Send To <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg
                             bg-white text-gray-700 placeholder-gray-300
                             focus:outline-none focus:ring-2 focus:ring-brand-teal/30
                             focus:border-brand-teal"
                />
              </div>
            </div>

            {/* Personal message */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Personal Message <span className="text-gray-300">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder="e.g. Hi Jane! Looking forward to chatting about your wedding — please fill this in before our call."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                           bg-white text-gray-700 placeholder-gray-300 resize-none
                           focus:outline-none focus:ring-2 focus:ring-brand-teal/30
                           focus:border-brand-teal"
              />
            </div>

            {/* Error / Success */}
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs mb-3 bg-red-50
                              border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}
            {sent && (
              <div className="flex items-center gap-2 text-emerald-600 text-xs mb-3
                              bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <CheckCircle2 size={13} className="shrink-0" />
                Form sent successfully!
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending || !customEmail.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5
                         rounded-lg bg-brand-teal text-white text-xs font-semibold
                         hover:bg-brand-navy transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending
                ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                : <><Send size={13} /> Send Form via Email</>
              }
            </button>
          </div>
        </div>

        {/* ── Placeholder for future templates ─────── */}
        <div className="bg-white rounded-2xl border border-dashed border-gray-200
                        flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <FileText size={20} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">More templates coming soon</p>
          <p className="text-xs text-gray-300 mt-1">
            Contract, quote, and welcome pack templates will appear here.
          </p>
        </div>

      </div>
    </div>
  );
}
