"use client";
// app/(dashboard)/expenses/ExpenseActions.tsx
// Add Expense button + slide-in form panel + Edit/Delete per row + Bulk Import

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Trash2, Loader2, Layers } from "lucide-react";
import { ExpenseForm } from "./ExpenseForm";
import { BulkImportModal } from "./BulkImportModal";
import type { Expense } from "@/lib/supabase/types";

// ── Add Expense button + panel ───────────────────────────────────────────────

export function AddExpenseButton() {
  const [open, setOpen] = useState(false);

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
              <ExpenseForm onClose={() => setOpen(false)} />
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
