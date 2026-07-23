"use client";
import { useState } from "react";
import { FileText, Loader2, CheckCircle } from "lucide-react";

export function GenerateContractButton({ contractorId }: { contractorId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error,  setError]  = useState("");

  async function generate() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/contractors/${contractorId}/generate-contract`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(j.error ?? "Failed to generate agreement");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const cd   = res.headers.get("content-disposition") ?? "";
      const m    = cd.match(/filename="([^"]+)"/);
      a.download = m?.[1] ?? "Contractor_Agreement.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-brand-teal" />
        <h3 className="text-sm font-semibold text-brand-navy">Independent Contractor Agreement</h3>
      </div>
      <p className="text-xs text-gray-500">
        Generates a PDF agreement covering payment terms, IP ownership, confidentiality, and term/termination — filled in from this contractor's saved details. Sign manually (print or email) — there's no e-sign flow for contractor agreements.
      </p>
      <button
        onClick={generate}
        disabled={status === "loading"}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {status === "loading" ? (
          <><Loader2 size={14} className="animate-spin" /> Generating...</>
        ) : status === "done" ? (
          <><CheckCircle size={14} /> Downloaded!</>
        ) : (
          <><FileText size={14} /> Generate &amp; Download Agreement</>
        )}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>
      )}
    </div>
  );
}
