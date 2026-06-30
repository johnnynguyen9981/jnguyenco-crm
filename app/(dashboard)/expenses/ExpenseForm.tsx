"use client";
// app/(dashboard)/expenses/ExpenseForm.tsx
// Shared add/edit form — rendered inside a modal-style slide-in panel.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import type { Expense, ExpenseCategory } from "@/lib/supabase/types";

const CATEGORY_OPTIONS = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((key) => ({
  value: key,
  label: EXPENSE_CATEGORIES[key].label,
}));

interface Props {
  expense?: Expense;         // present when editing
  onClose: () => void;
}

export function ExpenseForm({ expense, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title,     setTitle]     = useState(expense?.title     ?? "");
  const [vendor,    setVendor]    = useState(expense?.vendor    ?? "");
  const [category,  setCategory]  = useState<ExpenseCategory>(
    expense?.category ?? "SOFTWARE_SUBSCRIPTIONS"
  );
  const [amount,    setAmount]    = useState(String(expense?.amount ?? ""));
  const [date,      setDate]      = useState(expense?.date ?? new Date().toISOString().split("T")[0]);
  const [notes,     setNotes]     = useState(expense?.notes     ?? "");
  const [recurring, setRecurring] = useState(expense?.is_recurring ?? false);

  // Drive receipt state
  const [receipt,       setReceipt]       = useState<File | null>(null);
  const [uploadedFile,  setUploadedFile]  = useState<{
    id: string; name: string; url: string;
  } | null>(
    expense?.gdrive_file_id
      ? { id: expense.gdrive_file_id, name: expense.gdrive_file_name ?? "", url: expense.gdrive_file_url ?? "" }
      : null
  );
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceipt(f);
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("date", date);
      const res = await fetch("/api/expenses/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setUploadedFile({ id: json.fileId, name: json.fileName, url: json.fileUrl });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !amount || !date) { setError("Title, amount and date are required."); return; }
    setSaving(true);
    setError("");

    const payload = {
      title,
      vendor:             vendor || null,
      category,
      amount:             parseFloat(amount),
      date,
      notes:              notes || null,
      is_recurring:       recurring,
      recurring_frequency: recurring ? "MONTHLY" : null,
      gdrive_file_id:     uploadedFile?.id   ?? null,
      gdrive_file_name:   uploadedFile?.name ?? null,
      gdrive_file_url:    uploadedFile?.url  ?? null,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* Receipt upload */}
      <div>
        <label className="block text-xs font-semibold text-brand-navy mb-1">
          Receipt / Bill (saved to Google Drive)
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
              onClick={() => { setUploadedFile(null); setReceipt(null); }}
              className="text-gray-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-brand-pale-blue rounded-lg p-4 text-center cursor-pointer hover:border-brand-teal transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-brand-teal">
                <Loader2 size={15} className="animate-spin" />
                Uploading to Google Drive…
              </div>
            ) : (
              <>
                <Upload size={20} className="mx-auto mb-1 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload PDF or image</p>
                <p className="text-xs text-gray-400">Max 20 MB</p>
              </>
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

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-brand-pale-blue">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving || uploading}>
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : expense ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
