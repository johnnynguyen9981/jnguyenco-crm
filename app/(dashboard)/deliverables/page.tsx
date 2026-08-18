// app/(dashboard)/deliverables/page.tsx
// Server component — global deliverables list across all bookings, with
// status/type filters, an overdue/due-soon quick filter (matches the
// dashboard's "Needs your attention" chip + "In Production" panel), and search.
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { DeliverableStatus, DeliverableType } from "@/lib/supabase/types";
import { ChevronRight, Camera } from "lucide-react";
import { GenerateAllButton } from "./GenerateAllButton";

const STATUS_TABS: { label: string; value: DeliverableStatus | "ALL" }[] = [
  { label: "All",              value: "ALL" },
  { label: "Not Started",      value: "NOT_STARTED" },
  { label: "Culling",          value: "CULLING" },
  { label: "Editing",          value: "EDITING" },
  { label: "Ready",            value: "READY" },
  { label: "Delivered",        value: "DELIVERED" },
  { label: "Client Approved",  value: "CLIENT_APPROVED" },
];

const TYPE_OPTIONS: { label: string; value: DeliverableType | "ALL" }[] = [
  { label: "All types",      value: "ALL" },
  { label: "Photo gallery",  value: "PHOTO_GALLERY" },
  { label: "Highlight film", value: "HIGHLIGHT_FILM" },
  { label: "Teaser",         value: "TEASER" },
  { label: "Raw footage",    value: "RAW_FOOTAGE" },
];

const TYPE_LABEL: Record<DeliverableType, string> = {
  PHOTO_GALLERY:  "Photo gallery",
  HIGHLIGHT_FILM: "Highlight film",
  TEASER:         "Teaser",
  RAW_FOOTAGE:    "Raw footage",
};

const STATUS_BADGE: Record<DeliverableStatus, string> = {
  NOT_STARTED:      "badge badge-inquiry",
  CULLING:          "badge badge-quoted",
  EDITING:          "badge badge-contracted",
  READY:            "badge badge-confirmed",
  DELIVERED:        "badge badge-completed",
  CLIENT_APPROVED:  "badge badge-completed",
};

const STATUS_LABEL: Record<DeliverableStatus, string> = {
  NOT_STARTED:      "Not started",
  CULLING:          "Culling",
  EDITING:          "Editing",
  READY:            "Ready",
  DELIVERED:        "Delivered",
  CLIENT_APPROVED:  "Client approved",
};

export const metadata = { title: "Deliverables — JNguyen Co. CRM" };

type Props = {
  searchParams: {
    status?: string;
    type?: string;
    search?: string;
    filter?: string; // "due-soon" | "overdue"
  };
};

export default async function DeliverablesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const activeStatus = (searchParams.status as DeliverableStatus) || "ALL";
  const activeType   = (searchParams.type as DeliverableType) || "ALL";
  const activeFilter = searchParams.filter || "";
  const search       = searchParams.search?.trim() || "";

  const today     = new Date().toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  let query = supabase
    .from("deliverables")
    .select(`id, type, status, due_date, delivered_at,
             bookings (id, event_date, clients (first_name, last_name))`)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (activeStatus !== "ALL") query = query.eq("status", activeStatus);
  if (activeType   !== "ALL") query = query.eq("type", activeType);

  if (activeFilter === "due-soon") {
    query = query
      .not("status", "in", "(DELIVERED,CLIENT_APPROVED)")
      .not("due_date", "is", null)
      .gte("due_date", today)
      .lte("due_date", weekAhead);
  } else if (activeFilter === "overdue") {
    query = query
      .not("status", "in", "(DELIVERED,CLIENT_APPROVED)")
      .not("due_date", "is", null)
      .lt("due_date", today);
  }

  const { data: rows } = await query;

  // Client-side search filter (small dataset — no separate query needed)
  const deliverables = (rows ?? []).filter((d: any) => {
    if (!search) return true;
    const client = d.bookings?.clients;
    const name = client ? `${client.first_name} ${client.last_name}` : "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Status tab counts (unfiltered by status, respects type/filter/search would
  // be overkill here — just show totals per status across everything)
  const { data: allForCounts } = await supabase.from("deliverables").select("status");
  const statusCounts = (allForCounts ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  function buildHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { status: activeStatus, type: activeType, search, filter: activeFilter, ...params };
    Object.entries(merged).forEach(([k, v]) => { if (v && v !== "ALL") sp.set(k, v); });
    const qs = sp.toString();
    return `/deliverables${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <TopBar
        title="Deliverables"
        subtitle={`${deliverables.length} shown`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">

        <GenerateAllButton />

        {/* Quick filter chips */}
        <div className="flex gap-2 flex-wrap">
          <Link
            href={buildHref({ filter: undefined })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === ""
                ? "bg-brand-navy text-white border-brand-navy"
                : "bg-white text-gray-600 border-gray-200 hover:border-brand-teal/40"
            }`}
          >
            All
          </Link>
          <Link
            href={buildHref({ filter: "due-soon" })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              activeFilter === "due-soon"
                ? "bg-brand-teal text-white border-brand-teal"
                : "bg-brand-teal/5 text-brand-teal-700 border-brand-teal/30 hover:border-brand-teal/60"
            }`}
          >
            <Camera size={12} /> Due this week
          </Link>
          <Link
            href={buildHref({ filter: "overdue" })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === "overdue"
                ? "bg-red-600 text-white border-red-600"
                : "bg-red-50 text-red-700 border-red-200 hover:border-red-400"
            }`}
          >
            Overdue
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
                href={buildHref({ status: tab.value })}
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
          <form method="GET" action="/deliverables" className="flex gap-2 flex-1 min-w-[200px]">
            {activeStatus !== "ALL" && <input type="hidden" name="status" value={activeStatus} />}
            {activeType   !== "ALL" && <input type="hidden" name="type" value={activeType} />}
            {activeFilter && <input type="hidden" name="filter" value={activeFilter} />}
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search clients…"
              className="input flex-1"
            />
            <button type="submit" className="btn-secondary">Search</button>
            {search && (
              <Link href={buildHref({ search: undefined })} className="btn-secondary">
                Clear
              </Link>
            )}
          </form>

          <form method="GET" action="/deliverables">
            {activeStatus !== "ALL" && <input type="hidden" name="status" value={activeStatus} />}
            {search && <input type="hidden" name="search" value={search} />}
            {activeFilter && <input type="hidden" name="filter" value={activeFilter} />}
            <select name="type" defaultValue={activeType} className="input w-44">
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button type="submit" className="btn-secondary ml-2">Filter</button>
          </form>
        </div>

        {/* Table */}
        <div className="card overflow-hidden p-0">
          {deliverables.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Camera size={32} className="mx-auto mb-2 text-brand-pale-blue" />
              <p className="text-lg font-medium text-gray-500">No deliverables found</p>
              <p className="text-sm mt-1">
                {activeStatus !== "ALL" || activeType !== "ALL" || search || activeFilter
                  ? "Try adjusting your filters."
                  : "Deliverables are created from a booking's package via “Setup Deliverables.”"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">Client</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Event Date</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d: any) => {
                  const booking = d.bookings;
                  const client  = booking?.clients;
                  const clientName = client ? `${client.first_name} ${client.last_name}` : "—";
                  const dueDate  = d.due_date ? new Date(d.due_date) : null;
                  const daysLeft = dueDate ? Math.round((dueDate.getTime() - Date.now()) / 86400000) : null;
                  const isDelivered = d.status === "DELIVERED" || d.status === "CLIENT_APPROVED";
                  const overdue = !isDelivered && daysLeft !== null && daysLeft < 0;
                  const dueSoon = !isDelivered && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                  return (
                    <tr key={d.id} className="table-row">
                      <td className="table-cell font-medium text-brand-navy">
                        {booking ? (
                          <Link href={`/bookings/${booking.id}`} className="hover:underline">
                            {clientName}
                          </Link>
                        ) : clientName}
                      </td>
                      <td className="table-cell">{TYPE_LABEL[d.type as DeliverableType] ?? d.type}</td>
                      <td className="table-cell text-gray-500">{formatDate(booking?.event_date)}</td>
                      <td className="table-cell">
                        <span className={overdue ? "text-red-600 font-medium" : dueSoon ? "text-amber-700 font-medium" : "text-gray-500"}>
                          {formatDate(d.due_date)}
                        </span>
                        {overdue && <span className="ml-1.5 text-xs text-red-500">({Math.abs(daysLeft!)}d overdue)</span>}
                      </td>
                      <td className="table-cell">
                        <span className={STATUS_BADGE[d.status as DeliverableStatus]}>
                          {STATUS_LABEL[d.status as DeliverableStatus] ?? d.status}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        {booking && (
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="text-brand-teal hover:underline text-xs font-medium inline-flex items-center gap-0.5"
                          >
                            View <ChevronRight size={12} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
