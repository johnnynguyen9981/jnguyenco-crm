// app/(dashboard)/page.tsx — Dashboard home with stats + upcoming bookings
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { formatCurrency, formatDate, getBookingStatusBadge, formatServiceType } from "@/lib/utils";
import Link from "next/link";
import { Plus, ArrowRight, AlertTriangle, TrendingUp, CalendarCheck, Users, Star } from "lucide-react";
import type { DashboardBooking, InvoiceAging, Client } from "@/lib/supabase/types";

export const metadata = { title: "Dashboard — JNguyen Co. CRM" };

async function getGoogleReviews() {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res  = await fetch(`${base}/api/reviews`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json() as {
      rating: number; totalReviews: number;
      reviews: {
        author_name: string; rating: number;
        relative_time_description: string; text: string;
        profile_photo_url: string;
      }[];
    };
    if (!data.reviews?.length) return null;
    return data;
  } catch { return null; }
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Run all queries in parallel for performance
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [
    googleReviews,
    { data: upcomingBookings },
    { data: overdueInvoices },
    { count: clientCount },
    { data: allPayments },
  ] = await Promise.all([
    getGoogleReviews(),
    supabase
      .from("bookings")
      .select(`id, event_date, status, service_type, quoted_total,
               clients (first_name, last_name),
               packages (name)`)
      .in("status", ["CONTRACTED", "CONFIRMED"])
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(8),

    supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, amount_paid, due_date, clients(first_name, last_name)")
      .eq("status", "OVERDUE")
      .order("due_date", { ascending: true }),

    supabase
      .from("clients")
      .select("id", { count: "exact", head: true }),

    // Use created_at as fallback since paid_date may not be set on all records
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "PAID")
      .gte("created_at", yearStart),
  ]);

  // Compute stats
  const revenueThisYear = allPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;
  const totalClients    = clientCount ?? 0;
  const overdueCount    = overdueInvoices?.length ?? 0;
  const overdueAmount   = overdueInvoices?.reduce(
    (sum, inv) => sum + ((inv.total_amount ?? 0) - (inv.amount_paid ?? 0)), 0
  ) ?? 0;

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">

        {/* ── Overdue alert ───────────────────────────────── */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              {overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""} — {formatCurrency(overdueAmount)} outstanding.
            </p>
            <Link href="/invoices?filter=overdue" className="ml-auto text-sm font-semibold text-red-600 hover:underline whitespace-nowrap">
              View →
            </Link>
          </div>
        )}

        {/* ── Stat cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Revenue This Year"
            value={formatCurrency(revenueThisYear)}
            icon={<TrendingUp size={20} className="text-brand-teal" />}
            sub="from paid invoices & deposits"
          />
          <StatCard
            label="Upcoming Bookings"
            value={String(upcomingBookings?.length ?? 0)}
            icon={<CalendarCheck size={20} className="text-brand-teal" />}
            sub="confirmed & contracted"
          />
          <StatCard
            label="Total Clients"
            value={String(totalClients)}
            icon={<Users size={20} className="text-brand-teal" />}
            sub="all time"
          />
          <StatCard
            label="Overdue Balance"
            value={formatCurrency(overdueAmount)}
            icon={<AlertTriangle size={20} className={overdueAmount > 0 ? "text-red-500" : "text-brand-teal"} />}
            sub={overdueCount > 0 ? `across ${overdueCount} invoice(s)` : "all clear"}
            danger={overdueAmount > 0}
          />
        </div>

        {/* ── Upcoming bookings ───────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
            <h2 className="text-base font-semibold text-brand-navy">Upcoming Bookings</h2>
            <Link href="/bookings/new" className="btn-primary py-1.5 text-xs">
              <Plus size={14} /> New Booking
            </Link>
          </div>

          {!upcomingBookings || upcomingBookings.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <CalendarCheck size={32} className="mx-auto mb-2 text-brand-pale-blue" />
              No upcoming confirmed bookings yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Client</th>
                    <th className="table-header hidden sm:table-cell">Service</th>
                    <th className="table-header hidden md:table-cell">Package</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Quoted</th>
                    <th className="table-header w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBookings.map((b: any) => (
                    <tr key={b.id} className="table-row">
                      <td className="table-cell font-medium whitespace-nowrap">
                        {formatDate(b.event_date)}
                      </td>
                      <td className="table-cell">
                        <Link href={`/bookings/${b.id}`} className="font-medium hover:text-brand-teal">
                          {b.clients?.first_name} {b.clients?.last_name}
                        </Link>
                      </td>
                      <td className="table-cell hidden sm:table-cell text-gray-500">
                        {formatServiceType(b.service_type)}
                      </td>
                      <td className="table-cell hidden md:table-cell text-gray-500 text-xs">
                        {b.packages?.name ?? "—"}
                      </td>
                      <td className="table-cell">
                        <span className={getBookingStatusBadge(b.status).class}>
                          {getBookingStatusBadge(b.status).label}
                        </span>
                      </td>
                      <td className="table-cell text-right font-semibold">
                        {formatCurrency(b.quoted_total)}
                      </td>
                      <td className="table-cell">
                        <Link href={`/bookings/${b.id}`}>
                          <ArrowRight size={15} className="text-brand-teal hover:text-brand-navy" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(upcomingBookings?.length ?? 0) > 0 && (
            <div className="px-5 py-3 border-t border-brand-pale-blue">
              <Link href="/bookings" className="text-xs text-brand-teal hover:underline font-medium">
                View all bookings →
              </Link>
            </div>
          )}
        </div>

        {/* ── Overdue invoices panel ───────────────────────── */}
        {overdueCount > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-pale-blue bg-red-50">
              <h2 className="text-base font-semibold text-red-700">Overdue Invoices</h2>
            </div>
            <div className="divide-y divide-brand-pale-blue">
              {overdueInvoices!.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-navy">
                      {inv.clients?.first_name} {inv.clients?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {inv.invoice_number} · Due {formatDate(inv.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-red-600">
                      {formatCurrency(inv.total_amount - inv.amount_paid)}
                    </span>
                    <Link href={`/invoices/${inv.id}`} className="btn-secondary py-1 text-xs">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Google Reviews ──────────────────────────────── */}
        {googleReviews && googleReviews.reviews.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-brand-navy">Google Reviews</h2>
                <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  {googleReviews.rating.toFixed(1)} · {googleReviews.totalReviews} reviews
                </span>
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=JNguyen+Co+Canberra"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-teal hover:underline font-medium"
              >
                View on Google →
              </a>
            </div>
            <div className="divide-y divide-brand-pale-blue">
              {googleReviews.reviews.slice(0, 5).map((r, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {r.profile_photo_url ? (
                        <img src={r.profile_photo_url} alt={r.author_name} className="w-8 h-8 rounded-full shrink-0 object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-sand/20 border border-brand-sand/30 flex items-center justify-center shrink-0">
                          <span className="text-brand-sand text-xs font-bold">{r.author_name[0]}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-navy truncate">{r.author_name}</p>
                        <p className="text-xs text-gray-400">{r.relative_time_description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={13} className={s <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />
                      ))}
                    </div>
                  </div>
                  {r.text && (
                    <p className="mt-2.5 text-sm text-gray-600 leading-relaxed line-clamp-3">{r.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ── Stat card component ────────────────────────────────────────────────────────
function StatCard({
  label, value, icon, sub, danger = false,
}: {
  label: string; value: string; icon: React.ReactNode; sub?: string; danger?: boolean;
}) {
  return (
    <div className={`card flex flex-col gap-2 ${danger ? "border-red-200" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon}
      </div>
      <span className={`stat-value ${danger ? "text-red-600" : ""}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
