// GET /api/search?q=...
// Global quick-search across clients, bookings, invoices, and contractors,
// powering the search box in the top bar.
//
// Scoped the same way the rest of the app is: results come from the
// logged-in user's owner (getOwnerUserId — staff share the founder's data).
// Invoices and contractors are founder-only, matching STAFF_RESTRICTED_PATHS
// in lib/team.ts, so staff accounts simply don't get those result types.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, isCurrentUserFounder } from "@/lib/team";
import { formatDate } from "@/lib/utils";

export type SearchResult = {
  type:     "client" | "booking" | "invoice" | "contractor";
  id:       string;
  title:    string;
  subtitle: string;
  href:     string;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const ownerId    = await getOwnerUserId();
  const founder    = await isCurrentUserFounder();
  const qLower     = q.toLowerCase();
  const likePattern = `%${q}%`;

  const results: SearchResult[] = [];

  // ── Clients ──────────────────────────────────────────────────────────────
  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .eq("owner_id", ownerId)
    .or(
      `first_name.ilike.${likePattern},last_name.ilike.${likePattern},` +
      `email.ilike.${likePattern},phone.ilike.${likePattern}`
    )
    .limit(6);

  for (const c of clients ?? []) {
    results.push({
      type:     "client",
      id:       c.id,
      title:    `${c.first_name} ${c.last_name}`.trim(),
      subtitle: c.email || c.phone || "Client",
      href:     `/clients/${c.id}`,
    });
  }

  // ── Bookings ─────────────────────────────────────────────────────────────
  // Matches against client name, venue, service type, or event date. Postgrest's
  // .or() can't filter on joined-table columns, so fetch a bounded window and
  // filter in memory — fine at this data scale.
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("id, event_date, service_type, venue_name, status, clients (first_name, last_name)")
    .eq("owner_id", ownerId)
    .order("event_date", { ascending: false })
    .limit(200);

  for (const b of bookingRows ?? []) {
    const client     = Array.isArray(b.clients) ? b.clients[0] : b.clients;
    const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : "";
    const haystack = [clientName, b.venue_name, b.service_type, b.event_date]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (haystack.includes(qLower)) {
      results.push({
        type:     "booking",
        id:       b.id,
        title:    clientName || "Booking",
        subtitle: [b.service_type, b.event_date ? formatDate(b.event_date) : null]
          .filter(Boolean)
          .join(" · "),
        href:     `/bookings/${b.id}`,
      });
    }
    if (results.filter(r => r.type === "booking").length >= 6) break;
  }

  // ── Invoices (founder only) ─────────────────────────────────────────────
  if (founder) {
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total_amount, clients (first_name, last_name)")
      .eq("owner_id", ownerId)
      .order("issue_date", { ascending: false })
      .limit(200);

    for (const inv of invoiceRows ?? []) {
      const client     = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : "";
      const haystack = `${inv.invoice_number} ${clientName}`.toLowerCase();

      if (haystack.includes(qLower)) {
        results.push({
          type:     "invoice",
          id:       inv.id,
          title:    inv.invoice_number,
          subtitle: clientName || "Invoice",
          href:     `/invoices/${inv.id}`,
        });
      }
      if (results.filter(r => r.type === "invoice").length >= 6) break;
    }

    // ── Contractors (founder only) ──────────────────────────────────────
    const { data: contractors } = await supabase
      .from("contractors")
      .select("id, first_name, last_name, email, role")
      .eq("owner_id", ownerId)
      .or(
        `first_name.ilike.${likePattern},last_name.ilike.${likePattern},email.ilike.${likePattern}`
      )
      .limit(6);

    for (const c of contractors ?? []) {
      results.push({
        type:     "contractor",
        id:       c.id,
        title:    `${c.first_name} ${c.last_name}`.trim(),
        subtitle: c.role ?? "Contractor",
        href:     `/contractors/${c.id}`,
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, 24) });
}
