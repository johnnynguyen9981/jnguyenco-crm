"use client";
// app/(dashboard)/expenses/BulkImportModal.tsx
// Drop multiple invoices at once — they all upload to Google Drive and get
// AI-scanned in parallel. Duplicates are auto-detected and deselected.
// User reviews the table, confirms, and saves all in one click.

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, Upload, Loader2, CheckCircle2, AlertTriangle,
  AlertCircle, Sparkles, FileText,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ParsedExpense = {
  title:    string;
  vendor:   string;
  amount:   number;
  date:     string;
  category: string;
  notes:    string;
};

type FileEntry = {
  id:            string;
  file:          File;
  uploadStatus:  "pending" | "uploading" | "done" | "error";
  parseStatus:   "pending" | "parsing"   | "done" | "skipped" | "error";
  uploadError?:  string;
  parseError?:   string;
  driveFile?:    { id: string; name: string; url: string };
  parsed?:       ParsedExpense;
  isDuplicate?:  boolean;
  selected:      boolean;
};

type Phase = "drop" | "processing" | "review" | "saving" | "done";

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkImportModal({ onClose }: { onClose: () => void }) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [phase,      setPhase]      = useState<Phase>("drop");
  const [entries,    setEntries]    = useState<FileEntry[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [saveError,  setSaveError]  = useState("");

  // Patch a single entry by id (uses functional update so concurrent calls are safe)
  const patch = useCallback((id: string, p: Partial<FileEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...p } : e)),
  []);

  // ── Core: process files ────────────────────────────────────────────────────

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;

    // Build initial entries
    const work: FileEntry[] = files.map((file, i) => ({
      id:           `${Date.now()}-${i}`,
      file,
      uploadStatus: "pending",
      parseStatus:  "pending",
      selected:     true,
    }));

    setEntries([...work]);
    setPhase("processing");

    // Process every file in parallel — upload + parse run simultaneously per file
    await Promise.all(
      work.map(async (w) => {
        const [uploadRes, parseRes] = await Promise.allSettled([

          // ── Upload to Google Drive ───────────────────────────────────────
          (async () => {
            patch(w.id, { uploadStatus: "uploading" });
            const fd = new FormData();
            fd.append("file", w.file);
            fd.append("date", new Date().toISOString().split("T")[0]);
            const res  = await fetch("/api/expenses/upload", { method: "POST", body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Upload failed");
            return { id: json.fileId, name: json.fileName, url: json.fileUrl } as FileEntry["driveFile"];
          })(),

          // ── AI parse ────────────────────────────────────────────────────
          (async () => {
            patch(w.id, { parseStatus: "parsing" });
            const fd = new FormData();
            fd.append("file", w.file);
            const res  = await fetch("/api/expenses/parse", { method: "POST", body: fd });
            const json = await res.json();
            if (res.status === 503) return null;        // no API key — silent skip
            if (!res.ok) throw new Error("Scan failed");
            return json as ParsedExpense;
          })(),
        ]);

        const driveFile = uploadRes.status === "fulfilled" ? uploadRes.value    : undefined;
        const parsed    = parseRes.status  === "fulfilled" ? (parseRes.value ?? undefined) : undefined;

        // Mutate local work array for the later duplicate-check pass
        w.driveFile    = driveFile;
        w.parsed       = parsed;
        w.uploadStatus = driveFile ? "done" : "error";
        w.uploadError  = uploadRes.status === "rejected"
          ? String((uploadRes.reason as Error)?.message ?? "Upload failed")
          : undefined;
        w.parseStatus  = parseRes.status === "fulfilled"
          ? (parseRes.value ? "done" : "skipped")
          : "error";
        w.parseError   = parseRes.status === "rejected" ? "Scan failed" : undefined;

        patch(w.id, {
          uploadStatus: w.uploadStatus,
          uploadError:  w.uploadError,
          parseStatus:  w.parseStatus,
          parseError:   w.parseError,
          driveFile,
          parsed,
        });
      })
    );

    // ── Duplicate check for all entries that were parsed ───────────────────
    const parsedEntries = work.filter(w => w.parsed);
    if (parsedEntries.length > 0) {
      try {
        const res = await fetch("/api/expenses/bulk?mode=check", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ expenses: parsedEntries.map(w => w.parsed) }),
        });
        if (res.ok) {
          const { results } = await res.json() as { results: Array<{ isDuplicate: boolean }> };
          results.forEach((r, i) => {
            const entry = parsedEntries[i];
            if (!entry) return;
            entry.isDuplicate = r.isDuplicate;
            if (r.isDuplicate) entry.selected = false; // auto-deselect dupes
          });
        }
      } catch {
        // Non-fatal — skip duplicate detection, show everything as selectable
      }
    }

    setEntries([...work]);
    setPhase("review");
  }, [patch]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setIsDragging(true);  }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false); }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(pdf|jpg|jpeg|png|webp|heic)$/i.test(f.name) ||
      f.type.startsWith("image/") ||
      f.type === "application/pdf"
    );
    if (files.length) processFiles(files);
  }

  // ── Save confirmed entries ─────────────────────────────────────────────────

  async function handleSave() {
    setSaveError("");
    const toSave = entries.filter(e => e.selected && e.parsed);
    if (!toSave.length) { setSaveError("No expenses selected."); return; }

    setPhase("saving");

    const payload = toSave.map(e => ({
      ...e.parsed!,
      gdrive_file_id:   e.driveFile?.id   ?? null,
      gdrive_file_name: e.driveFile?.name ?? null,
      gdrive_file_url:  e.driveFile?.url  ?? null,
    }));

    try {
      const res  = await fetch("/api/expenses/bulk?mode=save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ expenses: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSavedCount(json.saved ?? toSave.length);
      router.refresh();
      setPhase("done");
    } catch (err: any) {
      setSaveError(err.message);
      setPhase("review");
    }
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  const selectedCount = entries.filter(e => e.selected).length;
  const dupCount      = entries.filter(e => e.isDuplicate).length;
  const doneCount     = entries.filter(
    e => e.uploadStatus !== "pending" && e.uploadStatus !== "uploading" &&
         e.parseStatus  !== "pending" && e.parseStatus  !== "parsing"
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-pale-blue shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">Bulk Import Invoices</h2>
            {phase === "processing" && (
              <p className="text-xs text-gray-400 mt-0.5">
                {doneCount} of {entries.length} processed…
              </p>
            )}
            {phase === "review" && (
              <p className="text-xs text-gray-400 mt-0.5">
                {entries.length} scanned
                {dupCount > 0 && (
                  <span className="text-amber-600">
                    {" "}· {dupCount} possible duplicate{dupCount > 1 ? "s" : ""} auto-deselected
                  </span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── DROP ──────────────────────────────────────────────────── */}
          {phase === "drop" && (
            <div className="p-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={[
                  "border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all",
                  isDragging
                    ? "border-brand-teal bg-brand-pale-blue scale-[1.01]"
                    : "border-brand-pale-blue hover:border-brand-teal hover:bg-brand-pale-blue/40",
                ].join(" ")}
              >
                {isDragging ? (
                  <div className="flex flex-col items-center gap-2">
                    <Sparkles size={40} className="text-brand-teal" />
                    <p className="text-lg font-semibold text-brand-teal">Drop to scan all invoices</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={38} className="text-gray-300" />
                    <p className="text-base font-semibold text-brand-navy">Drop multiple invoices here</p>
                    <p className="text-sm text-gray-400">or click to browse · PDF or images · max 20 MB each</p>
                    <p className="text-xs text-gray-400 mt-2">
                      All files upload to Google Drive and scan with AI at the same time.
                      Duplicates are flagged automatically.
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) processFiles(files);
                }}
              />
            </div>
          )}

          {/* ── PROCESSING ────────────────────────────────────────────── */}
          {phase === "processing" && (
            <div className="p-6 space-y-2">
              {entries.map((entry) => {
                const done = (
                  entry.uploadStatus !== "pending" && entry.uploadStatus !== "uploading" &&
                  entry.parseStatus  !== "pending" && entry.parseStatus  !== "parsing"
                );
                const hasError = entry.uploadStatus === "error";

                return (
                  <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="shrink-0 w-5">
                      {done
                        ? hasError
                          ? <AlertCircle size={18} className="text-red-400" />
                          : <CheckCircle2 size={18} className="text-green-500" />
                        : <Loader2 size={18} className="animate-spin text-brand-teal" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-navy truncate">
                        {entry.file.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {entry.uploadStatus === "uploading" && entry.parseStatus !== "done"
                          ? "Uploading + scanning…"
                          : entry.uploadStatus === "uploading"
                          ? "Uploading to Google Drive…"
                          : entry.parseStatus === "parsing"
                          ? "Scanning with AI…"
                          : entry.uploadStatus === "error"
                          ? `Upload failed: ${entry.uploadError}`
                          : entry.parseStatus === "error"
                          ? `Saved to Drive · AI scan failed (fill manually)`
                          : entry.parseStatus === "skipped"
                          ? "Saved to Drive · AI not configured"
                          : done
                          ? (entry.parsed?.title ?? "Done")
                          : "Queued…"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── REVIEW ────────────────────────────────────────────────── */}
          {phase === "review" && (
            <div>
              {dupCount > 0 && (
                <div className="mx-5 mt-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    {dupCount} possible duplicate{dupCount > 1 ? "s" : ""} detected — auto-deselected below.
                    Tick them back if you want to import anyway.
                  </span>
                </div>
              )}

              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide border-b border-brand-pale-blue">
                      <th className="px-4 py-3 text-left w-8">
                        <input
                          type="checkbox"
                          checked={selectedCount === entries.filter(e => e.parsed).length && selectedCount > 0}
                          onChange={e =>
                            setEntries(prev =>
                              prev.map(en => ({ ...en, selected: en.parsed ? e.target.checked : false }))
                            )
                          }
                          className="accent-brand-teal"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Title / File</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Vendor</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Date</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={[
                          "border-b border-gray-50 transition-opacity",
                          entry.selected ? "" : "opacity-50",
                        ].join(" ")}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={entry.selected}
                            disabled={!entry.parsed}
                            onChange={() =>
                              setEntries(prev =>
                                prev.map(e => e.id === entry.id ? { ...e, selected: !e.selected } : e)
                              )
                            }
                            className="accent-brand-teal"
                          />
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3">
                          {entry.parsed ? (
                            <span className="font-medium text-brand-navy">
                              {entry.parsed.title || "—"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-gray-400 text-xs italic">
                              <FileText size={12} />
                              {entry.file.name}
                            </span>
                          )}
                        </td>

                        {/* Vendor */}
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                          {entry.parsed?.vendor || "—"}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 text-right font-mono font-medium text-brand-navy">
                          {entry.parsed ? `$${Number(entry.parsed.amount).toFixed(2)}` : "—"}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                          {entry.parsed?.date || "—"}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          {entry.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                              <AlertTriangle size={10} />
                              Duplicate
                            </span>
                          ) : entry.uploadStatus === "error" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                              <AlertCircle size={10} />
                              Upload failed
                            </span>
                          ) : entry.parseStatus === "error" || entry.parseStatus === "skipped" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                              Needs review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                              <CheckCircle2 size={10} />
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SAVING ────────────────────────────────────────────────── */}
          {phase === "saving" && (
            <div className="p-16 flex flex-col items-center gap-3">
              <Loader2 size={40} className="animate-spin text-brand-teal" />
              <p className="text-brand-navy font-medium">Saving {selectedCount} expenses…</p>
            </div>
          )}

          {/* ── DONE ──────────────────────────────────────────────────── */}
          {phase === "done" && (
            <div className="p-16 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 size={52} className="text-green-500" />
              <p className="text-2xl font-bold text-brand-navy">
                {savedCount} expense{savedCount !== 1 ? "s" : ""} saved!
              </p>
              <p className="text-sm text-gray-500">
                All receipts are filed in Google Drive under Business Expenses.
              </p>
              <button onClick={onClose} className="btn-primary mt-3">Close</button>
            </div>
          )}

        </div>

        {/* Footer (review + processing phases) */}
        {(phase === "review" || phase === "processing") && (
          <div className="px-6 py-4 border-t border-brand-pale-blue flex items-center justify-between shrink-0 gap-3">
            <p className="text-sm text-gray-500">
              {phase === "processing"
                ? `Processing ${entries.length} file${entries.length !== 1 ? "s" : ""}…`
                : `${selectedCount} of ${entries.length} selected`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              {phase === "review" && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selectedCount === 0}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Import {selectedCount} expense{selectedCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>
        )}

        {saveError && (
          <p className="px-6 pb-4 text-sm text-red-600">{saveError}</p>
        )}

      </div>
    </div>
  );
}
