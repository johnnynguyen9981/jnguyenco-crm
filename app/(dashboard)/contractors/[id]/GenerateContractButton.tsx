"use client";
import { useState } from "react";
import { FileText, Loader2, CheckCircle } from "lucide-react";

type ContractLanguage = "EN" | "VI" | "BOTH";

const LANGUAGE_OPTIONS: { value: ContractLanguage; label: string }[] = [
  { value: "BOTH", label: "Both — English + Vietnamese (recommended)" },
  { value: "EN",   label: "English only" },
  { value: "VI",   label: "Vietnamese only" },
];

export function GenerateContractButton({ contractorId }: { contractorId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error,  setError]  = useState("");
  const [language, setLanguage] = useState<ContractLanguage>("BOTH");

  async function generate() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/contractors/${contractorId}/generate-contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
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

      <div>
        <label className="label text-xs">Language</label>
        <select
          className="input w-full text-sm"
          value={language}
          onChange={(e) => setLanguage(e.target.value as ContractLanguage)}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {language === "BOTH" && (
          <p className="text-[11px] text-gray-400 mt-1">
            One PDF with an English page followed by a Vietnamese page. A short notice states the English version governs if the two ever differ.
          </p>
        )}
        {language === "VI" && (
          <p className="text-[11px] text-gray-400 mt-1">
            Vietnamese only — no English page included. Consider &quot;Both&quot; if you may ever need to rely on the English wording (e.g. for your own records or a dispute).
          </p>
        )}
      </div>

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
