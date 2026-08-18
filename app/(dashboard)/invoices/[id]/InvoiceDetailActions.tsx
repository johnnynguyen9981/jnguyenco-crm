// app/(dashboard)/invoices/[id]/InvoiceDetailActions.tsx
// Client component — PDF download, send via Gmail, and mark as paid.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Ban } from "lucide-react";

type Props = {
  invoice: any;
  client: any;
};

export function InvoiceDetailActions({ invoice, client }: Props) {
  const router = useRouter();
  const [sendLoading, setSendLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [voidLoading, setVoidLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  async function sendInvoiceEmail() {
    if (!client?.email) { setMessage({ type: "error", text: "No client email on file." }); return; }
    setSendLoading(true);
    setMessage(null);
    try {
      // 1. Fetch the invoice PDF and convert to base64
      const pdfRes = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!pdfRes.ok) throw new Error("Could not generate invoice PDF.");
      const pdfBlob   = await pdfRes.blob();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      // 2. Send email with PDF attached
      const res = await fetch("/api/google/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template:     "invoice_sent",
          to:           client.email,
          invoice_id:   invoice.id,
          pdf_base64:   pdfBase64,
          from_account: "godaddy",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invoice");
      setMessage({ type: "success", text: `Invoice sent to ${client.email} ✓` });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSendLoading(false);
    }
  }

  async function markAsPaid() {
    setPaidLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark as paid");
      setMessage({ type: "success", text: "Invoice marked as paid ✓" });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setPaidLoading(false);
    }
  }

  function downloadPdf() {
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      if (res.status === 204) {
        router.push("/invoices");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setConfirmError(data.error ?? "Failed to delete invoice.");
    } catch {
      setConfirmError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleVoid() {
    setVoidLoading(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VOID" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to void invoice");
      setConfirmVoid(false);
      setMessage({ type: "success", text: "Invoice voided ✓" });
      router.refresh();
    } catch (err: any) {
      setConfirmError(err.message);
    } finally {
      setVoidLoading(false);
    }
  }

  const isPaid  = invoice.status === "PAID";
  const isDraft = invoice.status === "DRAFT";
  const isVoid  = invoice.status === "VOID";
  const canVoid = invoice.status === "SENT" || invoice.status === "OVERDUE";

  return (
    <div className="flex flex-col items-end gap-2">
      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}
      <div className="flex gap-2 flex-wrap justify-end">
        <button onClick={downloadPdf} className="btn-secondary text-sm py-1.5">
          ↓ Download PDF
        </button>
        <button
          onClick={sendInvoiceEmail}
          disabled={sendLoading}
          className="btn-secondary text-sm py-1.5"
        >
          {sendLoading ? "Sending…" : "📧 Send Invoice to Client"}
        </button>
        {!isPaid && (
          <button
            onClick={markAsPaid}
            disabled={paidLoading}
            className="btn-sand text-sm py-1.5"
          >
            {paidLoading ? "Saving…" : "Mark as Paid"}
          </button>
        )}
        {isPaid && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
            ✓ Paid
          </span>
        )}
        {isVoid && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
            <Ban size={14} /> Void
          </span>
        )}
        {isDraft && (
          <button
            onClick={() => { setConfirmError(""); setConfirmDelete(true); }}
            className="btn-danger text-sm py-1.5 flex items-center gap-1.5"
          >
            <Trash2 size={14} /> Delete Invoice
          </button>
        )}
        {canVoid && (
          <button
            onClick={() => { setConfirmError(""); setConfirmVoid(true); }}
            className="btn-danger text-sm py-1.5 flex items-center gap-1.5"
          >
            <Ban size={14} /> Void Invoice
          </button>
        )}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !deleteLoading && setConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-navy">Delete this invoice?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This is permanent and removes {invoice.invoice_number} completely. Only draft invoices can be deleted this way.
                </p>
              </div>
            </div>

            {confirmError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{confirmError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmDelete(false)} disabled={deleteLoading} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteLoading} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {deleteLoading ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmVoid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !voidLoading && setConfirmVoid(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Ban size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-navy">Void this invoice?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.invoice_number} has already been sent, so it can't be deleted outright — voiding keeps it on record
                  as cancelled instead, and it won't count toward outstanding revenue.
                </p>
              </div>
            </div>

            {confirmError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{confirmError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmVoid(false)} disabled={voidLoading} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleVoid} disabled={voidLoading} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {voidLoading ? <><Loader2 size={14} className="animate-spin" /> Voiding…</> : <><Ban size={14} /> Void Invoice</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
