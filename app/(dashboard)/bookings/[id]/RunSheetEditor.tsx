"use client";
// app/(dashboard)/bookings/[id]/RunSheetEditor.tsx
// Editable event-day timeline ("run sheet") — generate a suggested schedule
// from the booking's known times/venues, tweak it by hand, save it, and
// export a branded PDF to share with the client/crew. Distinct from the
// per-crew-member Call Sheet (see ContractorAssignment.tsx).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Download, Save, Wand2 } from "lucide-react";
import { generateDefaultRunSheet, RunSheetItem, RunSheetSourceBooking } from "@/lib/run-sheet";

type Props = {
  bookingId: string;
  initialItems: RunSheetItem[];
  sourceBooking: RunSheetSourceBooking;
  clientName: string;
};

export function RunSheetEditor({ bookingId, initialItems, sourceBooking, clientName }: Props) {
  const router = useRouter();
  const [items, setItems]       = useState<RunSheetItem[]>(initialItems);
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dirty, setDirty]       = useState(false);

  function updateItem(i: number, patch: Partial<RunSheetItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    setDirty(true);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  function addItem() {
    setItems((prev) => [...prev, { time: "", activity: "", notes: "" }]);
    setDirty(true);
  }

  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  async function generateSuggested() {
    if (items.length > 0 && !confirm("This will replace the current schedule with a suggested one. Continue?")) {
      return;
    }
    setMessage(null);

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setItems(generateDefaultRunSheet(sourceBooking));
      setDirty(true);
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/run-sheet/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: trimmedNotes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "AI generation failed.");
      setItems(json.items ?? json.data?.items ?? []);
      setDirty(true);
      setMessage({ type: "success", text: "Generated with AI from your notes." });
    } catch (e: unknown) {
      // Fall back to the free local template so a broken/missing AI key never
      // blocks the core feature — just tell Johnny why.
      setItems(generateDefaultRunSheet(sourceBooking));
      setDirty(true);
      setMessage({
        type: "error",
        text: (e instanceof Error ? e.message : "AI generation failed.") + " Used the standard template instead — your notes are still saved below, tweak the schedule by hand or try again.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const cleaned = items
        .filter((it) => it.activity.trim().length > 0)
        .map((it) => ({ time: it.time ?? "", activity: it.activity.trim(), notes: it.notes?.trim() || undefined }));
      const res = await fetch(`/api/bookings/${bookingId}/run-sheet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cleaned }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to save run sheet.");
      setItems(cleaned);
      setDirty(false);
      setMessage({ type: "success", text: "Run sheet saved." });
      router.refresh();
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/run-sheet`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Failed to generate run sheet." }));
        throw new Error(j.error ?? "Failed to generate run sheet.");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const cd   = res.headers.get("content-disposition") ?? "";
      const m    = cd.match(/filename="([^"]+)"/);
      a.download = m?.[1] ?? `Run_Sheet_${clientName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setDownloading(false);
    }
  }

  const hasNotes = notes.trim().length > 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          Anything the AI should know? <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={'e.g. "first look at 1pm before the ceremony", "reception venue is a 20 min drive from the ceremony, add travel time", "no photos during vows", "kids in the bridal party, keep formals short"'}
          rows={2}
          className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-2 resize-y"
        />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400 mb-3">No schedule yet.</p>
          <button
            onClick={generateSuggested}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : hasNotes ? <Wand2 size={13} /> : <Sparkles size={13} />}
            {generating ? "Generating…" : hasNotes ? "Generate with AI" : "Generate Suggested Schedule"}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50">
                <input
                  type="time"
                  value={item.time}
                  onChange={(e) => updateItem(i, { time: e.target.value })}
                  className="w-[92px] shrink-0 text-xs rounded border border-gray-200 px-2 py-1.5"
                />
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    placeholder="Activity"
                    value={item.activity}
                    onChange={(e) => updateItem(i, { activity: e.target.value })}
                    className="w-full text-sm font-medium rounded border border-gray-200 px-2 py-1.5"
                  />
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={item.notes ?? ""}
                    onChange={(e) => updateItem(i, { notes: e.target.value })}
                    className="w-full text-xs text-gray-500 rounded border border-gray-200 px-2 py-1.5"
                  />
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                    className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100 disabled:opacity-30">
                    <ArrowUp size={13} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down"
                    className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100 disabled:opacity-30">
                    <ArrowDown size={13} />
                  </button>
                  <button onClick={() => removeItem(i)} title="Remove"
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Plus size={12} /> Add row
            </button>
            <button
              onClick={generateSuggested}
              disabled={generating}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : hasNotes ? <Wand2 size={12} /> : <Sparkles size={12} />}
              {generating ? "Generating…" : hasNotes ? "Regenerate with AI" : "Regenerate suggested"}
            </button>
            <div className="flex-1" />
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-brand-teal text-brand-teal text-xs font-semibold hover:bg-brand-pale-blue/40 disabled:opacity-50"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {downloading ? "Generating…" : "Download PDF"}
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </>
      )}

      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
