// app/(dashboard)/page.tsx — Dashboard home
// Redesigned around "what needs action" (attention strip, this week's shoots
// with readiness checklist, production/deliverables queue) before the more
// retrospective stats (revenue, pipeline volume, reviews, referral sources).
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import {
  formatCurrency, formatDate, formatRelative,
  getBookingStatusBadge, formatServiceType,
} from "@/lib/utils";
import Link from "next/link";
import {
  Plus, ArrowRight, AlertTriangle, TrendingUp, CalendarCheck, Users, Star,
  Inbox, FileWarning, Clock, Camera, Check, X, ChevronRight,
} from "lucide-react";
import type { ReferralSource } from "@/lib/supabase/types";
import { fetchReviews } from "@/lib/reviews";
import { ReferralSourceChart, type ReferralSegment } from "@/components/dashboard/ReferralSourceChart";
import { ProductionTimeline, type TimelineRow } from "@/components/dashboard/ProductionTimeline";

// Fixed display order + brand color per referral source, so the legend and
// slice colors stay stable regardless of which sources happen to have data.
const REFERRAL_SOURCE_STYLE: Record<string, string> = {
  INSTAGRAM:      "#407e8c", // brand-teal
  GOOGLE:         "#a58d66", // brand-sand
  WORD_OF_MOUTH:  "#083a4f", // brand-navy
  WEDDING_WIRE:   "#0a4d68", // brand-navy-800
  FACEBOOK:       "#305f6a", // brand-teal-700
  OTHER:          "#c0d5d6", // brand-pale-blue
  NOT_SPECIFIED:  "#d9d3cb", // muted neutral
};

function formatReferralLabel(key: string) {
  if (key === "NOT_SPECIFIED") return "Not specified";
  return key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

export const metadata = { title: "Dashboard — JNguyen Co. CRM" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const admin     = createServiceClient(); // for the enquiries count (owner_id IS NULL rows, bypasses RLS)

  const today       = new Date().toISOString().split("T")[0];
  const weekAhead   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
  const yearStart   = `${new Date().getFullYear()}-01-01`;

  const [
    { reviews: googleReviewsList, rating: googleRating, totalReviews: googleTotal },
    { data: thisWeekBookings },
    { data: upcomingBookings },
    { data: overdueInvoices },
    { count: clientCount },
    { data: allPayments },
    { data: referralRows },
    { count: enquiriesCount },
    { count: staleQuoteCount },
    { count: contractsAwaitingCount },
    { count: deliverablesDueSoonCount },
    { data: productionQueue },
    { data: pipelineRows },
  ] = await Promise.all([
    fetchReviews(),

    // This week's shoots, with everything needed to judge readiness.
    supabase
      .from("bookings")
      .select(`id, event_date, status,
               clients (first_name, last_name),
               packages (name),
               payments (payment_type, status),
               booking_contractors (id),
               contract_signed_at`)
      .gte("event_date", today)
      .lte("event_date", weekAhead)
      .not("status", "in", "(CANCELLED,COMPLETED)")
      .order("event_date", { ascending: true }),

    supabase
      .from("bookings")
      .select(`id, event_date, status, service_type, quoted_total,
               clients (first_name, last_name),
               packages (name)`)
      .in("status", ["CONTRACTED", "CONFIRMED"])
      .gte("event_date", today)
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

    supabase
      .from("clients")
      .select("referral_source"),

    // New enquiries — public form submissions not yet claimed by the owner.
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("owner_id", null),

    // Quotes sent 5+ days ago with no status change since.
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "QUOTED")
      .lt("updated_at", fiveDaysAgo),

    // Contract sent but not yet signed back.
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .not("contract_sent_at", "is", null)
      .is("contract_signed_at", null)
      .not("status", "in", "(CANCELLED,COMPLETED)"),

    // Deliverables due within the next 7 days.
    supabase
      .from("deliverables")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(DELIVERED,CLIENT_APPROVED)")
      .gte("due_date", today)
      .lte("due_date", weekAhead),

    // Production queue — everything not yet delivered, soonest due first.
    supabase
      .from("deliverables")
      .select(`id, type, status, due_date,
               bookings (id, event_date, clients (first_name, last_name))`)
      .not("status", "in", "(DELIVERED,CLIENT_APPROVED)")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(10),

    // Pipeline volume by stage.
    supabase
      .from("bookings")
      .select("status")
      .in("status", ["INQUIRY", "QUOTED", "CONTRACTED", "CONFIRMED"]),
  ]);

  // ── Compute stats ────────────────────────────────────────────────────────
  const revenueThisYear = allPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;
  const totalClients    = clientCount ?? 0;
  const overdueCount    = overdueInvoices?.length ?? 0;
  const overdueAmount   = overdueInvoices?.reduce(
    (sum, inv) => sum + ((inv.total_amount ?? 0) - (inv.amount_paid ?? 0)), 0
  ) ?? 0;

  const pipelineCounts = { INQUIRY: 0, QUOTED: 0, CONTRACTED: 0, CONFIRMED: 0 };
  (pipelineRows ?? []).forEach((b: { status: keyof typeof pipelineCounts }) => {
    if (b.status in pipelineCounts) pipelineCounts[b.status]++;
  });

  const attentionItems = [
    {
      count: overdueCount,
      label: `Overdue invoice${overdueCount === 1 ? "" : "s"}`,
      icon: <AlertTriangle size={16} />,
      tone: "danger" as const,
      href: "/invoices?filter=overdue",
    },
    {
      count: contractsAwaitingCount ?? 0,
      label: `Contract${(contractsAwaitingCount ?? 0) === 1 ? "" : "s"} awaiting signature`,
      icon: <FileWarning size={16} />,
      tone: "warning" as const,
      href: "/bookings?filter=awaiting-signature",
    },
    {
      count: staleQuoteCount ?? 0,
      label: "Quotes sent, no reply 5+ days",
      icon: <Clock size={16} />,
      tone: "warning" as const,
      href: "/bookings?status=QUOTED",
    },
    {
      count: enquiriesCount ?? 0,
      label: `New enquir${(enquiriesCount ?? 0) === 1 ? "y" : "ies"}, not yet quoted`,
      icon: <Inbox size={16} />,
      tone: "info" as const,
      href: "/enquiries",
    },
    {
      count: deliverablesDueSoonCount ?? 0,
      label: `Gallery/film${(deliverablesDueSoonCount ?? 0) === 1 ? "" : "s"} due this week`,
      icon: <Camera size={16} />,
      tone: "accent" as const,
      href: "/deliverables?filter=due-soon",
    },
  ].filter((item) => item.count > 0);

  // "How did you hear about us?" breakdown, ordered consistently with a fixed
  // color per source. Clients with no referral_source set are grouped as
  // "Not specified" rather than dropped, so the percentages always sum to 100%.
  const referralCounts: Record<string, number> = {};
  (referralRows ?? []).forEach((r: { referral_source: ReferralSource | null }) => {
    const key = r.referral_source ?? "NOT_SPECIFIED";
    referralCounts[key] = (referralCounts[key] ?? 0) + 1;
  });
  const referralSegments: ReferralSegment[] = Object.keys(REFERRAL_SOURCE_STYLE)
    .filter((key) => referralCounts[key] > 0)
    .map((key) => ({
      label: formatReferralLabel(key),
      count: referralCounts[key],
      color: REFERRAL_SOURCE_STYLE[key],
    }));

  // Production timeline rows — one per active (not yet delivered/approved) deliverable.
  const timelineRows: TimelineRow[] = (productionQueue ?? []).map((d: any) => {
    const booking = d.bookings;
    const client  = booking?.clients;
    return {
      id: d.id,
      bookingId: booking?.id,
      clientName: client ? `${client.first_name} ${client.last_name}` : "—",
      type: d.type,
      eventDate: booking?.event_date ?? null,
      dueDate: d.due_date ?? null,
      status: d.status,
    };
  });

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">

        {/* ── Needs your attention ─────────────────────────── */}
        {attentionItems.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2">
              Needs your attention
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {attentionItems.map((item, i) => (
                <AttentionChip key={i} {...item} />
              ))}
            </div>
          </div>
        )}

        {/* ── This week ────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
            <h2 className="text-base font-semibold text-brand-navy">This Week</h2>
            <span className="text-xs text-gray-400">{formatDate(today)} – {formatDate(weekAhead)}</span>
          </div>
          {!thisWeekBookings || thisWeekBookings.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No shoots scheduled in the next 7 days.
            </div>
          ) : (
            <div className="divide-y divide-brand-pale-blue">
              {thisWeekBookings.map((b: any) => {
                const client        = b.clients;
                const pkg           = b.packages;
                const payments      = (b.payments as any[]) ?? [];
                const depositPaid   = payments.some((p) => p.payment_type === "DEPOSIT" && p.status === "PAID");
                const contractOK    = !!b.contract_signed_at;
                const crewAssigned  = ((b.booking_contractors as any[]) ?? []).length > 0;
                return (
                  <Link
                    key={b.id}
                    href={`/bookings/${b.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-brand-pale-blue/20 transition-colors"
                  >
                    <div className="w-16 shrink-0 text-sm font-medium text-brand-navy">
                      {formatDate(b.event_date).replace(/ \d{4}$/, "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {client?.first_name} {client?.last_name}
                        <span className="text-gray-400 font-normal"> · {pkg?.name ?? "—"}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReadinessDot ok={contractOK} label="Contract" />
                      <ReadinessDot ok={depositPaid} label="Deposit" />
                      <ReadinessDot ok={crewAssigned} label="Crew" />
                    </div>
                    <ChevronRight size={15} className="text-gray-300 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Production timeline (Gantt-style stage tracker) ─ */}
        <ProductionTimeline rows={timelineRows} />

        {/* ── Pipeline + financial snapshot ────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pipeline"
            value={`${pipelineCounts.INQUIRY + pipelineCounts.QUOTED + pipelineCounts.CONTRACTED + pipelineCounts.CONFIRMED}`}
            icon={<CalendarCheck size={20} className="text-brand-teal" />}
            sub={`${pipelineCounts.INQUIRY} inquiry · ${pipelineCounts.QUOTED} quoted · ${pipelineCounts.CONTRACTED} contracted · ${pipelineCounts.CONFIRMED} confirmed`}
          />
          <StatCard
            label="Revenue This Year"
            value={formatCurrency(revenueThisYear)}
            icon={<TrendingUp size={20} className="text-brand-teal" />}
            sub="from paid invoices & deposits"
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

        {/* ── Secondary: referral sources + reviews ────────── */}
        <div className="pt-2 border-t border-brand-pale-blue/60">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Insights</h2>
          <div className="space-y-6">
            {referralSegments.length > 0 && (
              <div className="card">
                <h2 className="text-base font-semibold text-brand-navy mb-4">
                  How Clients Heard About Us
                </h2>
                <ReferralSourceChart segments={referralSegments} />
              </div>
            )}

            {googleReviewsList.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-brand-pale-blue">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-brand-navy">Google Reviews</h2>
                    <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      {googleRating.toFixed(1)} · {googleTotal} reviews
                    </span>
                  </div>
                  <a
                    href="https://share.google/sUmfJfpLfCDYnQMsz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-teal hover:underline font-medium"
                  >
                    View on Google →
                  </a>
                </div>
                <div className="divide-y divide-brand-pale-blue">
                  {googleReviewsList.slice(0, 5).map((r, i) => (
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
        </div>

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

// ── Attention chip ───────────────────────────────────────────────────────────
const TONE_CLASSES: Record<string, string> = {
  danger:  "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info:    "border-blue-200 bg-blue-50 text-blue-700",
  accent:  "border-brand-teal/30 bg-brand-teal/5 text-brand-teal-700",
};

function AttentionChip({
  count, label, icon, tone, href,
}: {
  count: number; label: string; icon: React.ReactNode; tone: keyof typeof TONE_CLASSES; href?: string;
}) {
  const content = (
    <div className={`rounded-lg border px-3 py-2.5 h-full flex flex-col gap-1.5 transition-colors ${TONE_CLASSES[tone]} ${href ? "hover:brightness-95 cursor-pointer" : ""}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xl font-semibold">{count}</span>
      </div>
      <p className="text-xs font-medium leading-snug">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ── Readiness dot (contract / deposit / crew, this-week panel) ─────────────
function ReadinessDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${ok ? "ready" : "not yet"}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
        ok ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
      }`}
    >
      {ok ? <Check size={12} /> : <X size={12} />}
    </span>
  );
}
