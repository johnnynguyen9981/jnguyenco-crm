"use client";
// app/(dashboard)/bookings/[id]/ContractCard.tsx
// Shows contract status, mark-as-sent/signed actions, and signed copy link management.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookingId:          string;
  contractSentAt:     string | null;
  contractSignedAt:   string | null;
  contractSignedUrl:  string | null;
  contractSignToken:  string | null;
  clientEmail:        string | null;
  driveFolderUrl:     string | null; // client's Google Drive folder
};

type Status = "NOT_SENT" | "SENT" | "SIGNED";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function ContractCard({
  bookingId,
  contractSentAt,
  contractSignedAt,
  contractSignedUrl,
  contractSignToken,
  clientEmail,
  driveFolderUrl,
}: Props) {
  const router = useRouter();

  const status: Status = contractSignedAt ? "SIGNED" : contractSentAt ? "SENT" : "NOT_SENT";

  const [loading,      setLoading]      = useState<string | null>(null);
  const [signedUrl,    setSignedUrl]    = useState(contractSignedUrl ?? "");
  const [urlSaved,     setUrlSaved]     = useState(false);
  const [message,      setMessage]      = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sigLinkSent,  setSigLinkSent]  = useState(false);
  const [sigLinkToken, setSigLinkToken] = useState(contractSignToken);

  async function patch(fields: Record<string, string | null>) {
    const key = Object.keys(fields)[0];
    setLoading(key);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(null);
    }
  }

  async function saveSignedUrl() {
    setUrlSaved(false);
    await patch({ contract_signed_url: signedUrl || null });
    setUrlSaved(true);
  }

  async function sendSigningLink() {
    if (!clientEmail) { setMessage({ type: "error", text: "Client has no email address on file." }); return; }
    setLoading("esign");
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/sign-request`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send signing link");
      setSigLinkSent(true);
      setSigLinkToken(data.data?.signing_url?.split("/sign/")[1] ?? sigLinkToken);
      setMessage({ type: "success", text: `Signing link sent to ${clientEmail}` });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(null);
    }
  }

  const STATUS_CONFIG = {
    NOT_SENT: { label: "Not Sent",                 cls: "bg-gray-100 text-gray-600" },
    SENT:     { label: "Sent · Awaiting Signature", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    SIGNED:   { label: "✓ Signed",                 cls: "bg-green-50 text-green-700 border border-green-200" },
  };

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="card space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">Contract</h2>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      {/* Error message */}
      {message && (
        <p className={`text-xs ${message.type === "error" ? "text-red-500" : "text-green-600"}`}>
          {message.text}
        </p>
      )}

      {/* Timeline dates */}
      <div className="space-y-1 text-xs text-gray-400">
        {contractSentAt  && <p>📤 Sent: <span className="text-gray-600">{fmt(contractSentAt)}</span></p>}
        {contractSignedAt && <p className="text-green-600 font-medium">✅ Signed: {fmt(contractSignedAt)}</p>}
      </div>

      {/* ── NOT SENT actions ── */}
      {status === "NOT_SENT" && (
        <div className="space-y-2">
          {/* Primary: send e-signature link */}
          <button
            onClick={sendSigningLink}
            disabled={loading !== null || !clientEmail}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:bg-brand-navy transition-colors disabled:opacity-50"
          >
            {loading === "esign" ? "Sending…" : sigLinkSent ? "✅ Link Sent — Resend?" : "✍️ Send for E-Signature"}
          </button>
          {sigLinkSent && (
            <p className="text-xs text-green-600 text-center">
              Client received a link to sign electronically. This page will update automatically when they sign.
            </p>
          )}
          {sigLinkToken && !sigLinkSent && (
            <p className="text-xs text-amber-600 text-center">
              A signing link was previously sent and is pending.
            </p>
          )}
          {!clientEmail && (
            <p className="text-xs text-red-400 text-center">Add an email address to this client first.</p>
          )}
          {/* Divider */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-[10px] text-gray-300 uppercase tracking-wider">or</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>
          {/* Manual fallback */}
          <button
            onClick={() => patch({ contract_sent_at: new Date().toISOString() })}
            disabled={loading !== null}
            className="btn-secondary text-xs py-1.5 w-full"
          >
            {loading === "contract_sent_at" ? "Saving…" : "📤 Mark as Manually Sent"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            If you emailed the PDF manually, mark it sent here.
          </p>
        </div>
      )}

      {/* ── SENT actions ── */}
      {status === "SENT" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            Once the client returns the signed copy, upload it to their Drive folder and mark it as signed.
          </p>
          <button
            onClick={() => patch({ contract_signed_at: new Date().toISOString() })}
            disabled={loading !== null}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-brand-navy transition-colors"
          >
            {loading === "contract_signed_at" ? "Saving…" : "✅ Mark as Signed"}
          </button>
          <button
            onClick={() => patch({ contract_sent_at: null })}
            disabled={loading !== null}
            className="text-xs text-gray-400 hover:text-red-500 underline w-full text-center"
          >
            Undo "Sent"
          </button>
        </div>
      )}

      {/* ── SIGNED actions ── */}
      {status === "SIGNED" && (
        <div className="space-y-3">
          {/* Signed copy link */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600">Signed copy (Drive link)</p>
            <div className="flex gap-2">
              <input
                className="input flex-1 py-1.5 text-xs"
                placeholder="Paste Google Drive URL of signed PDF…"
                value={signedUrl}
                onChange={e => { setSignedUrl(e.target.value); setUrlSaved(false); }}
              />
              <button
                onClick={saveSignedUrl}
                disabled={loading !== null}
                className="btn-secondary text-xs py-1.5 px-3 shrink-0"
              >
                {loading === "contract_signed_url" ? "…" : urlSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {(contractSignedUrl || signedUrl) && (
              <a
                href={contractSignedUrl || signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-teal hover:underline font-medium"
              >
                📄 View Signed Contract ↗
              </a>
            )}
          </div>

          <button
            onClick={() => patch({ contract_signed_at: null })}
            disabled={loading !== null}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            Undo "Signed"
          </button>
        </div>
      )}

      {/* Drive folder link — always visible if connected */}
      {driveFolderUrl && (
        <a
          href={driveFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-teal transition-colors pt-1 border-t border-gray-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58q0-1.95 1.17-3.48 1.18-1.53 3.08-1.95.51-2.24 2.29-3.7Q9.32 4 11.5 4q2.69 0 4.6 1.91T18 10.5v.5q1.73-.04 2.86 1.06Q22 13.16 22 14.88q0 1.74-1.19 2.93Q19.62 19 17.9 19L13 19v-6.15l1.6 1.55L15.95 13 12 9.05 8.05 13l1.35 1.4L11 12.85V19H6.5Z"/>
          </svg>
          Open Client Drive Folder ↗
        </a>
      )}
    </div>
  );
}
