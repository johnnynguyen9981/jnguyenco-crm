// app/(dashboard)/invoices/page.tsx
// Server component — invoice list with status tabs and revenue summary.
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  getInvoiceStatusBadge,
} from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/supabase/types";

const STATUS_TABS: { label: string; value: InvoiceStatus | "ALL" }[] = [
  { label: "All",     value: "ALL" },
  { label: "Draft",   value: "DRAFT" },
  { label: "Sent",    value: "SENT" },
  { label: "Paid",    value: "PAID" },
  { label: "Overdue", value: "OVERDUE" },
];

type Props = {
  searchParams: { status?: string; page?: string; search?: string };
};

export default async function InvoicesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const activeStatus = (searchParams.status as InvoiceStatus) || "ALL";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 20;

  let query = supabase
    .from("invoices")
    .select(
      `id, invoice_number, status, subtotal, gst, total, due_date, paid_at, created_at,
       clients (id, first_name, last_name),
       bookings (id, event_date, service_type)`,
      { count: "exact" }
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (activeStatus !== "ALL") query = query.eq("status", activeStatus);

  const { data: invoices = [], count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  // Revenue summary
  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("status, total")
    .eq("owner_id", user.id);

  const revenue = {
    paid:    (allInvoices || []).filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0),
    pending: (allInvoices || []).filter((i) => ["SENT", "DRAFT"].includes(i.status)).reduce((s, i) => s + Number(i.total), 0),
    overdue: (allInvoices || []).filter((i) => i.status === "OVERDUE").reduce((s, i) => s + Number(i.total), 0),
  };

  const statusCounts = (allInvoices || []).reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  function buildHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { status: activeStatus, ...params };
    Object.entries(merged).forEach(([k, v]) => { if (v && v !== "ALL") sp.set(k, v); });
    const qs = sp.toString();
    return `/invoices${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{count ?? 0} total invoice{count !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/invoices/new" className="btn-primary">+ New Invoice</Link>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(revenue.paid)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Awaiting Payment</p>
          <p className="text-2xl font-bold text-brand-navy mt-1">{formatCurrency(revenue.pending)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${revenue.overdue > 0 ? "text-red-600" : "text-gray-400"}`}>
            {formatCurrency(revenue.overdue)}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.value;
          const cnt = tab.value === "ALL"
            ? (allInvoices || []).length
            : statusCounts[tab.value] || 0;
          return (
            <Link
              key={tab.value}
              href={buildHref({ status: tab.value, page: "1" })}
              className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors
                ${isActive
                  ? "bg-brand-navy text-white"
                  : "text-gray-600 hover:text-brand-navy hover:bg-gray-50"
                }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {cnt}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {(invoices || []).length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium text-gray-500">No invoices found</p>
            <p className="text-sm mt-1">
              {activeStatus !== "ALL"
                ? "Try a different status filter."
                : "Generate your first invoice from a booking."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Client</th>
                <th className="table-header">Event</th>
                <th className="table-header">Due Date</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {(invoices as any[]).map((inv) => {
                const badge = getInvoiceStatusBadge(inv.status);
                const client = inv.clients;
                return (
                  <tr key={inv.id} className="table-row">
                    <td className="table-cell font-mono text-brand-navy font-medium">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {client
                        ? <Link href={`/clients/${client.id}`} className="hover:underline">{client.first_name} {client.last_name}</Link>
                        : "—"}
                    </td>
                    <td className="table-cell text-gray-500">
                      {inv.bookings?.event_date ? formatDate(inv.bookings.event_date) : "—"}
                    </td>
                    <td className="table-cell">
                      {inv.due_date
                        ? <span className={new Date(inv.due_date) < new Date() && inv.status !== "PAID" ? "text-red-600 font-medium" : ""}>
                            {formatDate(inv.due_date)}
                          </span>
                        : "—"}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </td>
                    <td className="table-cell text-right font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="table-cell text-right">
                      <Link href={`/invoices/${inv.id}`} className="text-brand-teal hover:underline text-xs font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count || 0)} of {count}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })} className="btn-secondary py-1.5 px-3">← Prev</Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: String(page + 1) })} className="btn-secondary py-1.5 px-3">Next →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
