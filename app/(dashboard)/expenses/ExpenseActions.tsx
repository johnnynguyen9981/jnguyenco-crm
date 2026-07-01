"use client";
// app/(dashboard)/expenses/ExpenseActions.tsx
// Add Expense button + slide-in form panel + Edit/Delete per row + Bulk Import

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Trash2, Loader2, Layers, Paperclip, Upload } from "lucide-react";
import { ExpenseForm } from "./ExpenseForm";
import { BulkImportModal } from "./BulkImportModal";
import type { Expense } from "@/lib/supabase/types";

// ── Add Expense button + panel ───────────────────────────────────────────────

interface AddExpenseButtonProps {
  /** The FY currently being viewed, e.g. "2025-26". Used to pre-fill the date sensibly. */
  viewingFY?: string;
}

export function AddExpenseButton({ viewingFY }: AddExpenseButtonProps) {
  const [open, setOpen] = useState(false);

  // If viewing a past FY, default the date to June 30 of that FY instead of today.
  // e.g. viewing "2025-26" → default date "2026-06-30"
  function getDefaultDate() {
    const today = new Date().toISOString().split("T")[0];
    if (!viewingFY) return today;
    const [startYearStr] = viewingFY.split("-");
    const startYear = parseInt(startYearStr, 10);
    const fyEnd = `${startYear + 1}-06-30`;
    // Only override if today is AFTER the FY end (i.e. we're viewing a past FY)
    return today > fyEnd ? fyEnd : today;
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> Add Expense
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
          {/* Panel */}
          <div className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
              <h2 className="text-lg font-semibold text-brand-navy">Add Expense</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 flex-1">
              <ExpenseForm defaultDate={getDefaultDate()} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Bulk Import button ───────────────────────────────────────────────────────

export function BulkImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Layers size={15} /> Bulk Import
      </button>
      {open && <BulkImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Edit button (per row) ────────────────────────────────────────────────────

export function EditExpenseButton({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-brand-teal hover:text-brand-navy p-1 rounded transition-colors"
        title="Edit"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
              <h2 className="text-lg font-semibold text-brand-navy">Edit Expense</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 flex-1">
              <ExpenseForm expense={expense} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Attach Receipt button (per row, for expenses with no receipt) ─────────────

export function AttachReceiptButton({ expense }: { expense: Expense }) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [open,      setOpen]      = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const [dragging,  setDragging]  = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setUploading(true);
    try {
      // 1. Upload to Drive
      const fd = new FormData();
      fd.append("file", file);
      fd.append("date", expense.date);
      const upRes  = await fetch("/api/expenses/upload", { method: "POST", body: fd });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error ?? "Upload failed");
      if (upJson.driveSkipped) throw new Error(upJson.driveMessage ?? "Drive not connected");

      // 2. Patch the expense with Drive file details
      const patchRes = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gdrive_file_id:   upJson.fileId,
          gdrive_file_name: upJson.fileName,
          gdrive_file_url:  upJson.fileUrl,
        }),
      });
      if (!patchRes.ok) throw new Error("Failed to save receipt link");

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [expense.date, expense.id, router]);

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(""); }}
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-teal transition-colors"
        title="Attach receipt"
      >
        <Paperclip size={12} /> Attach
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-navy">Attach receipt</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{expense.title}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={e => { e.preventDefault(); setDragging(false); }}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => !uploading && fileRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                dragging
                  ? "border-brand-teal bg-brand-pale-blue scale-[1.01]"
                  : "border-brand-pale-blue hover:border-brand-teal hover:bg-brand-pale-blue/40",
              ].join(" ")}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-brand-teal" />
                  <p className="text-sm text-brand-teal font-medium">Uploading to Drive…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={22} className="text-gray-400" />
                  <p className="text-sm font-medium text-gray-600">Drop PDF or image here</p>
                  <p className="text-xs text-gray-400">or click to browse</p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

// ── Delete button (per row) ───────────────────────────────────────────────────

export function DeleteExpenseButton({ expense }: { expense: Expense }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const cascade = expense.is_recurring;
    await fetch(
      `/api/expenses/${expense.id}${cascade ? "?cascade=true" : ""}`,
      { method: "DELETE" }
    );
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-600 font-semibold hover:underline"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
      title={expense.is_recurring ? "Delete (+ all auto-entries)" : "Delete"}
    >
      <Trash2 size={14} />
    </button>
  );
}
