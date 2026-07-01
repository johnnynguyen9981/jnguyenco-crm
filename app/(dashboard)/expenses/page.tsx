// app/(dashboard)/expenses/page.tsx — Business Expenses tracker
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId } from "@/lib/team";
import { TopBar } from "@/components/layout/TopBar";
import {
  getAustralianFY, currentAustralianFY, getFYOptions,
  getCategoryBadge, EXPENSE_CATEGORIES, generateDueRecurringExpenses,
} from "@/lib/expenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense, ExpenseCategory } from "@/lib/supabase/types";
import { Receipt, ExternalLink, RefreshCw, FolderOpen } from "lucide-react";
import { AddExpenseButton, BulkImportButton, EditExpenseButton, DeleteExpenseButton, AttachReceiptButton } from "./ExpenseActions";

export const metadata = { title: "Expenses — JNguyen Co. CRM" };

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

type Props = {
  searchParams: {
    fy?: string;
    category?: string;
    search?: string;
    page?: string;
  };
};

export default async function ExpensesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const ownerUserId = await getOwnerUserId();

  // Auto-generate any due recurring expenses
  await generateDueRecurringExpenses(supabase, ownerUserId);

  const fy       = searchParams.fy       || currentAustralianFY();
  const category = (searchParams.category || "") as ExpenseCategory | "";
  const search   = searchParams.search?.trim() ?? "";
  const page     = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 25;

  // Main query
  let query = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .eq("owner_id", ownerUserId)
    .eq("financial_year", fy)
    .order("date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (category) query = query.eq("category", category);
  if (search)   query = query.or(`title.ilike.%${search}%,vendor.ilike.%${search}%`);

  const { data: expenses = [], count } = await query;

  // Totals for the full FY (ignoring category/search filter)
  const { data: allFY } = await supabase
    .from("expenses")
    .select("category, amount")
    .eq("owner_id", ownerUserId)
    .eq("financial_year", fy);

  const categoryTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of allFY ?? []) {
    categoryTotals[row.category] = (categoryTotals[row.category] ?? 0) + Number(row.amount);
    grandTotal += Number(row.amount);
  }

  const fyOptions = getFYOptions();
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  function buildHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { fy, category, search, ...params };
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v); });
    return `/expenses?${sp.toString()}`;
  }

  return (
    <>
      <TopBar
        title="Expenses"
        subtitle={`FY ${fy} — ${formatCurrency(grandTotal)} total`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">

        {/* ── Summary cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_KEYS.map(cat => {
            const badge = getCategoryBadge(cat);
            const total = categoryTotals[cat] ?? 0;
            return (
              <a
                key={cat}
                href={buildHref({ category: category === cat ? "" : cat, page: "1" })}
                className={`card p-4 block transition-all hover:shadow-md ${
                  category === cat ? "ring-2 ring-brand-teal" : ""
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${badge.color}`}>
                  {badge.label}
                </p>
                <p className="text-xl font-bold text-brand-navy">{formatCurrency(total)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0}% of total
                </p>
              </a>
            );
          })}
        </div>

        {/* Grand total */}
        <div className="card p-4 bg-brand-navy text-white flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">
              Total business expenses — FY {fy}
            </p>
            <p className="text-3xl font-bold mt-0.5">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`https://drive.google.com/drive/search?q=${encodeURIComponent(`FY ${fy}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
            >
              <FolderOpen size={15} /> Drive receipts
            </a>
          </div>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            {/* FY picker */}
            <form method="GET">
              {category  && <input type="hidden" name="category" value={category} />}
              {search    && <input type="hidden" name="search"   value={search} />}
              <select
                name="fy"
                defaultValue={fy}
                className="input text-sm"
                onChange={undefined}
              >
                {fyOptions.map(f => (
                  <option key={f} value={f}>FY {f}</option>
                ))}
              </select>
              <button type="submit" className="btn-secondary ml-2 text-sm">Go</button>
            </form>

            {/* Search */}
            <form method="GET" className="flex gap-2">
              {fy       && <input type="hidden" name="fy"       value={fy} />}
              {category && <input type="hidden" name="category" value={category} />}
              <input
                name="search"
                defaultValue={search}
                placeholder="Search expenses…"
                className="input text-sm w-48"
              />
              <button type="submit" className="btn-secondary text-sm">Search</button>
              {search && (
                <a href={buildHref({ search: undefined, page: "1" })} className="btn-secondary text-sm">
                  Clear
                </a>
              )}
            </form>
          </div>

          <div className="flex items-center gap-2">
            <BulkImportButton />
            <AddExpenseButton viewingFY={fy} />
          </div>
        </div>

        {/* Active category filter chip */}
        {category && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtered by:</span>
            <a
              href={buildHref({ category: "", page: "1" })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getCategoryBadge(category as ExpenseCategory).color} ${getCategoryBadge(category as ExpenseCategory).bgColor}`}
            >
              {getCategoryBadge(category as ExpenseCategory).label} ×
            </a>
          </div>
        )}

        {/* ── Expenses table ───────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          {!expenses.length ? (
            <div className="text-center py-16 text-gray-400">
              <Receipt size={36} className="mx-auto mb-3 text-brand-pale-blue" />
              <p className="font-medium">No expenses yet for FY {fy}</p>
              <p className="text-sm mt-1">Click "Add Expense" to record your first bill or subscription.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-header">Date</th>
                      <th className="table-header">Title</th>
                      <th className="table-header hidden sm:table-cell">Vendor</th>
                      <th className="table-header">Category</th>
                      <th className="table-header hidden md:table-cell">Notes</th>
                      <th className="table-header text-right">Amount</th>
                      <th className="table-header text-center">Receipt</th>
                      <th className="table-header w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expenses as Expense[]).map(exp => {
                      const badge = getCategoryBadge(exp.category);
                      return (
                        <tr key={exp.id} className="table-row">
                          <td className="table-cell text-gray-600 whitespace-nowrap">
                            {formatDate(exp.date)}
                            {exp.is_recurring && (
                              <span title="Recurring monthly" className="ml-1.5 inline-block">
                                <RefreshCw size={10} className="text-brand-teal inline" />
                              </span>
                            )}
                          </td>
                          <td className="table-cell font-medium text-brand-navy">
                            {exp.title}
                          </td>
                          <td className="table-cell hidden sm:table-cell text-gray-500">
                            {exp.vendor || "—"}
                          </td>
                          <td className="table-cell">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color} ${badge.bgColor}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="table-cell hidden md:table-cell text-gray-400 max-w-[160px] truncate">
                            {exp.notes || "—"}
                          </td>
                          <td className="table-cell text-right font-semibold">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="table-cell text-center">
                            {exp.gdrive_file_url ? (
                              <a
                                href={exp.gdrive_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-teal hover:underline text-xs"
                              >
                                <ExternalLink size={12} /> View
                              </a>
                            ) : (
                              <AttachReceiptButton expense={exp} />
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center justify-end gap-1">
                              <EditExpenseButton expense={exp} />
                              <DeleteExpenseButton expense={exp} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-brand-pale-blue bg-gray-50">
                      <td colSpan={5} className="table-cell font-semibold text-brand-navy">
                        {category ? `${getCategoryBadge(category as ExpenseCategory).label} subtotal` : "Total shown"}
                      </td>
                      <td className="table-cell text-right font-bold text-brand-navy">
                        {formatCurrency(
                          (expenses as Expense[]).reduce((s, e) => s + Number(e.amount), 0)
                        )}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-brand-pale-blue">
                  <span className="text-xs text-gray-500">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count ?? 0)} of {count}
                  </span>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <a href={buildHref({ page: String(page - 1) })} className="btn-secondary py-1 text-xs">
                        ← Prev
                      </a>
                    )}
                    {page < totalPages && (
                      <a href={buildHref({ page: String(page + 1) })} className="btn-secondary py-1 text-xs">
                        Next →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tax tip */}
        <div className="card p-4 bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800 mb-1">💡 Tax time tip</p>
          <p className="text-xs text-amber-700">
            All receipts are stored in your Google Drive under <strong>Business Expenses / FY {fy}</strong>.
            Share that folder with your accountant at tax time. The totals above r            Share that folder with your accountant at tax time. The totals above reflect the full financial
            year (1 Jul – 30 Jun).
          </p>
        </div>

      </div>
    </>
  );
}
