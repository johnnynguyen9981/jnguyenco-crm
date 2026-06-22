// app/(dashboard)/invoices/[id]/InvoiceDetailActions.tsx
// Client component — PDF download, send via Gmail, and mark as paid.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  invoice: any;
  client: any;
};

export function InvoiceDetailActions({ invoice, client }: Props) {
  const router = useRouter();
  const [sendLoading, setSendLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const isPaid = invoice.status === "PAID";

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
      </div>
    </div>
  );
}
