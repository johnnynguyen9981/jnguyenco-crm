// app/(dashboard)/bookings/page.tsx
// Server component — bookings list with status filter tabs and search.
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  getBookingStatusBadge,
  formatServiceType,
} from "@/lib/utils";
import type { BookingStatus, ServiceType } from "@/lib/supabase/types";

const STATUS_TABS: { label: string; value: BookingStatus | "ALL" }[] = [
  { label: "All",        value: "ALL" },
  { label: "Inquiry",    value: "INQUIRY" },
  { label: "Quoted",     value: "QUOTED" },
  { label: "Contracted", value: "CONTRACTED" },
  { label: "Confirmed",  value: "CONFIRMED" },
  { label: "Completed",  value: "COMPLETED" },
  { label: "Cancelled",  value: "CANCELLED" },
];

type Props = {
  searchParams: {
    status?: string;
    service?: string;
    search?: string;
    page?: string;
  };
};

export default async function BookingsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const activeStatus = (searchParams.status as BookingStatus) || "ALL";
  const activeService = (searchParams.service as ServiceType) || "ALL";
  const search = searchParams.search?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 20;

  let query = supabase
    .from("bookings")
    .select(
      `id, service_type, status, event_date, event_start_time, quoted_total,
       clients (id, first_name, last_name),
       packages (name)`,
      { count: "exact" }
    )
    .eq("owner_id", user.id)
    .order("event_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (activeStatus !== "ALL") query = query.eq("status", activeStatus);
  if (activeService !== "ALL") query = query.eq("service_type", activeService);

  const { data: bookings = [], count } = await query;

  const totalPages = Math.ceil((count || 0) / pageSize);

  // Stat counts per status
  const { data: counts } = await supabase
    .from("bookings")
    .select("status")
    .eq("owner_id", user.id);

  const statusCounts = (counts || []).reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  function buildHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { status: activeStatus, service: activeService, search, ...params };
    Object.entries(merged).forEach(([k, v]) => { if (v && v !== "ALL") sp.set(k, v); });
    const qs = sp.toString();
    return `/bookings${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy">Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {count ?? 0} total booking{count !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/bookings/new" className="btn-primary">
          + New Booking
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.value;
          const cnt = tab.value === "ALL"
            ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
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

      {/* Filters row */}
      <div className="flex gap-3 flex-wrap">
        <form method="GET" action="/bookings" className="flex gap-2 flex-1 min-w-[200px]">
          {activeStatus !== "ALL" && <input type="hidden" name="status" value={activeStatus} />}
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search clients…"
            className="input flex-1"
          />
          <button type="submit" className="btn-secondary">Search</button>
          {search && (
            <Link href={buildHref({ search: undefined, page: "1" })} className="btn-secondary">
              Clear
            </Link>
          )}
        </form>

        <form method="GET" action="/bookings">
          {activeStatus !== "ALL" && <input type="hidden" name="status" value={activeStatus} />}
          {search && <input type="hidden" name="search" value={search} />}
          <select
            name="service"
            defaultValue={activeService}
            className="input w-44"
            onChange={undefined}
          >
            <option value="ALL">All services</option>
            <option value="WEDDING">Wedding</option>
            <option value="EVENT">Event</option>
            <option value="PORTRAIT">Portrait</option>
          </select>
          <button type="submit" className="btn-secondary ml-2">Filter</button>
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {bookings.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium text-gray-500">No bookings found</p>
            <p className="text-sm mt-1">
              {activeStatus !== "ALL" || search
                ? "Try adjusting your filters."
                : "Create your first booking to get started."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header">Client</th>
                <th className="table-header">Date</th>
                <th className="table-header">Service</th>
                <th className="table-header">Package</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking: any) => {
                const badge = getBookingStatusBadge(booking.status);
                const client = booking.clients;
                const clientName = client
                  ? `${client.first_name} ${client.last_name}`
                  : "—";
                return (
                  <tr key={booking.id} className="table-row">
                    <td className="table-cell font-medium text-brand-navy">
                      <Link href={`/bookings/${booking.id}`} className="hover:underline">
                        {clientName}
                      </Link>
                    </td>
                    <td className="table-cell">{formatDate(booking.event_date)}</td>
                    <td className="table-cell">{formatServiceType(booking.service_type)}</td>
                    <td className="table-cell text-gray-500">
                      {booking.packages?.name ?? "Custom"}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </td>
                    <td className="table-cell text-right font-medium">
                      {booking.quoted_total
                        ? formatCurrency(booking.quoted_total)
                        : <span className="text-gray-400">TBD</span>}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        href={`/bookings/${booking.id}`}
                        className="text-brand-teal hover:underline text-xs font-medium"
                      >
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
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count || 0)} of {count}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })} className="btn-secondary py-1.5 px-3">
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: String(page + 1) })} className="btn-secondary py-1.5 px-3">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
