"use client";
// app/(dashboard)/expenses/ExpenseForm.tsx
// Shared add/edit form — rendered inside a modal-style slide-in panel.
// Drop a PDF or image invoice onto the upload zone to auto-fill all fields.

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import type { Expense, ExpenseCategory } from "@/lib/supabase/types";

const CATEGORY_OPTIONS = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((key) => ({
  value: key,
  label: EXPENSE_CATEGORIES[key].label,
}));

interface Props {
  expense?: Expense;   // present when editing
  onClose: () => void;
}

export function ExpenseForm({ expense, onClose }: Props) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [title,     setTitle]     = useState(expense?.title     ?? "");
  const [vendor,    setVendor]    = useState(expense?.vendor    ?? "");
  const [category,  setCategory]  = useState<ExpenseCategory>(
    expense?.category ?? "SOFTWARE_SUBSCRIPTIONS"
  );
  const [amount,    setAmount]    = useState(String(expense?.amount ?? ""));
  const [date,      setDate]      = useState(
    expense?.date ?? new Date().toISOString().split("T")[0]
  );
  const [notes,     setNotes]     = useState(expense?.notes ?? "");
  const [recurring, setRecurring] = useState(expense?.is_recurring ?? false);

  // Drive receipt state
  const [driveWarning, setDriveWarning] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    id: string; name: string; url: string;
  } | null>(
    expense?.gdrive_file_id
      ? { id: expense.gdrive_file_id, name: expense.gdrive_file_name ?? "", url: expense.gdrive_file_url ?? "" }
      : null
  );

  // UI states
  const [uploading,   setUploading]   = useState(false);
  const [parsing,     setParsing]     = useState(false);
  const [parseFilled, setParseFilled] = useState(false);
  const [parseError,  setParseError]  = useState("");
  const [isDragging,  setIsDragging]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  // ── Core file handler — triggered by drop or file input ───────────────────

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setParseError("");
    setParseFilled(false);

    // 1. Upload to Drive (in background)
    const uploadPromise = (async () => {
      setUploading(true);
      setDriveWarning("");
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("date", date);
        const res  = await fetch("/api/expenses/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        if (json.driveSkipped) {
          // Drive not connected — soft warning, expense can still be saved without receipt
          setDriveWarning(json.driveMessage ?? "Receipt not saved to Google Drive. Connect Google in Settings.");
        } else {
          setUploadedFile({ id: json.fileId, name: json.fileName, url: json.fileUrl });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    })();

    // 2. Parse with AI (in parallel)
    const parsePromise = (async () => {
      setParsing(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res  = await fetch("/api/expenses/parse", { method: "POST", body: fd });
        const json = await res.json();

        if (res.status === 503) {
          // API key not configured — silently skip, just upload
          return;
        }
        if (!res.ok) {
          setParseError("Couldn't auto-fill — please fill in manually.");
          return;
        }

        // Auto-fill fields (only override blanks for safety when editing)
        const isNew = !expense;
        if (json.title    && (isNew || !title))    setTitle(json.title);
        if (json.vendor   && (isNew || !vendor))   setVendor(json.vendor);
        if (json.amount   && (isNew || !amount))   setAmount(String(json.amount));
        if (json.date     && (isNew || !date || date === new Date().toISOString().split("T")[0]))
                                                    setDate(json.date);
        if (json.category && (isNew || category === "SOFTWARE_SUBSCRIPTIONS"))
                                                    setCategory(json.category as ExpenseCategory);
        if (json.notes    && (isNew || !notes))    setNotes(json.notes);

        setParseFilled(true);
      } catch {
        // Non-fatal — user can fill manually
        setParseError("Couldn't auto-fill — please fill in manually.");
      } finally {
        setParsing(false);
      }
    })();

    await Promise.all([uploadPromise, parsePromise]);
  }, [date, expense, title, vendor, amount, category, notes]);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  }

  // ── File input (click to upload) ───────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  }

  // ── Form submit ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !amount || !date) { setError("Title, amount and date are required."); return; }
    setSaving(true);
    setError("");

    const payload = {
      title,
      vendor:              vendor || null,
      category,
      amount:              parseFloat(amount),
      date,
      notes:               notes || null,
      is_recurring:        recurring,
      recurring_frequency: recurring ? "MONTHLY" : null,
      gdrive_file_id:      uploadedFile?.id   ?? null,
      gdrive_file_name:    uploadedFile?.name ?? null,
      gdrive_file_url:     uploadedFile?.url  ?? null,
    };

    try {
      const url    = expense ? `/api/expenses/${expense.id}` : "/api/expenses";
      const method = expense ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isBusy = uploading || parsing;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Smart-fill status banner */}
      {parsing && (
        <div className="flex items-center gap-2 p-2.5 bg-brand-pale-blue rounded-lg text-sm text-brand-navy">
          <Loader2 size={14} className="animate-spin shrink-0 text-brand-teal" />
          <span>Scanning invoice with AI…</span>
        </div>
      )}
      {parseFilled && !parsing && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <Sparkles size={14} className="shrink-0" />
          <span>Fields auto-filled from your invoice — review and save.</span>
        </div>
      )}
      {parseError && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertCircle size={13} className="shrink-0" />
          <span>{parseError}</span>
        </div>
      )}
      {driveWarning && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertCircle size={13} className="shrink-0" />
          <span>{driveWarning}</span>
        </div>
      )}

      {/* Receipt upload — drop zone */}
      <div>
        <label className="block text-xs font-semibold text-brand-navy mb-1">
          Receipt / Invoice
          <span className="ml-1 font-normal text-gray-400">(drop here to auto-fill ✨)</span>
        </label>
        {uploadedFile ? (
          <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
            <FileText size={15} className="text-green-600 shrink-0" />
            <a
              href={uploadedFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-green-700 hover:underline truncate flex-1"
            >
              {uploadedFile.name}
            </a>
            <button
              type="button"
              onClick={() => { setUploadedFile(null); setParseFilled(false); }}
              className="text-gray-400 hover:text-red-500 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={[
              "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all",
              isDragging
                ? "border-brand-teal bg-brand-pale-blue scale-[1.01]"
                : "border-brand-pale-blue hover:border-brand-teal hover:bg-brand-pale-blue/40",
            ].join(" ")}
          >
            {isBusy ? (
              <div className="flex flex-col items-center gap-1.5">
                <Loader2 size={22} className="animate-spin text-brand-teal" />
                <p className="text-sm text-brand-teal font-medium">
                  {uploading && parsing ? "Uploading + scanning…"
                   : uploading ? "Uploading to Google Drive…"
                   : "Scanning with AI…"}
                </p>
              </div>
            ) : isDragging ? (
              <div className="flex flex-col items-center gap-1">
                <Sparkles size={22} className="text-brand-teal" />
                <p className="text-sm font-semibold text-brand-teal">Drop to scan & auto-fill</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload size={20} className="text-gray-400 mb-0.5" />
                <p className="text-sm text-gray-600 font-medium">Drop invoice here to auto-fill</p>
                <p className="text-xs text-gray-400">or click to browse · PDF or image · max 20 MB</p>
              </div>
            )}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-brand-navy mb-1">
          Expense title <span className="text-red-500">*</span>
        </label>
        <input
          className="input w-full"
          placeholder="e.g. Adobe Creative Cloud"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Vendor */}
      <div>
        <label className="block text-xs font-semibold text-brand-navy mb-1">Vendor / Supplier</label>
        <input
          className="input w-full"
          placeholder="e.g. Adobe Inc."
          value={vendor}
          onChange={e => setVendor(e.target.value)}
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-brand-navy mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          className="input w-full"
          value={category}
          onChange={e => setCategory(e.target.value as ExpenseCategory)}
          required
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Amount + Date row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-brand-navy mb-1">
            Amount (AUD) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              className="input w-full pl-7"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-navy mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            className="input w-full"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Recurring toggle */}
      <div className="flex items-center gap-3 p-3 bg-brand-pale-blue rounded-lg">
        <input
          id="recurring"
          type="checkbox"
          checked={recurring}
          onChange={e => setRecurring(e.target.checked)}
          className="w-4 h-4 accent-brand-teal"
        />
        <label htmlFor="recurring" className="text-sm text-brand-navy cursor-pointer">
          <span className="font-semibold">Monthly recurring</span>
          <span className="text-gray-500 text-xs block">
            Auto-generates a new entry every month (great for subscriptions)
          </span>
        </label>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-brand-navy mb-1">Notes</label>
        <textarea
          className="input w-full h-20 resize-none"
          placeholder="Optional notes for tax time…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-brand-pale-blue">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || isBusy}
        >
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : expense ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
