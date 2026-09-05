// POST /api/bookings/[id]/contractors/[assignmentId]/call-sheet
//
// This is a Pages Router API route, not an App Router route handler, even
// though every other API route in this project lives under app/api/. That's
// deliberate: @react-pdf/renderer's renderToBuffer() builds its element tree
// with the exact same "react" package it requires internally, but a file
// under app/** that creates that tree (lib/generate-call-sheet.tsx) gets
// compiled through Next's app-router "react-server" webpack condition,
// which resolves `react` to a Server-Components-only build missing the
// reconciler internals react-pdf needs. Two different `react` module
// instances in the same process means every element this file builds gets
// rejected by react-pdf's reconciler as "not a valid React child" (Minified
// React error #31) — reproduced directly against the dev server, not
// inferred from Vercel's minified error text alone. Pages Router API routes
// never enter that module graph, so `react` resolves once, consistently,
// for both sides — the same fix multiple react-pdf/Next.js App Router
// compatibility threads land on.
//
// Everything below mirrors what was previously
// app/api/bookings/[id]/contractors/[assignmentId]/call-sheet/route.ts, just
// adapted from NextRequest/NextResponse + async params to NextApiRequest/
// NextApiResponse + req.query, and using createPagesClient (req/res cookies)
// instead of the App Router-only createClient() (next/headers cookies()).
import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesClient } from "@/lib/supabase/pages-server";
import { formatServiceType } from "@/lib/utils";
import { generateCallSheetPDF, CallSheetData } from "@/lib/generate-call-sheet";

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Contractor",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const bookingId = String(req.query.id);
  const assignmentId = String(req.query.assignmentId);

  const supabase = createPagesClient(req, res);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Inlined founder/owner lookup (lib/team.ts's getCurrentTeamMember /
    // getOwnerUserId both call the App Router-only createClient()
    // internally, so they can't be reused from a Pages Router handler).
    const { data: member } = await supabase
      .from("team_members")
      .select("role, user_id")
      .eq("user_id", user.id)
      .single();

    const role = member?.role ?? "FOUNDER";
    if (role !== "FOUNDER") return res.status(403).json({ error: "Forbidden" });

    let ownerUserId = user.id;
    if (member && member.role !== "FOUNDER") {
      const { data: founder } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("role", "FOUNDER")
        .eq("is_active", true)
        .not("user_id", "is", null)
        .single();
      ownerUserId = founder?.user_id ?? user.id;
    }

    // `*` (rather than an explicit column list) for the booking_contractors
    // row so this keeps working whether or not the rate_type/coverage_*
    // columns from 20260813_booking_contractor_coverage.sql exist yet.
    const { data: assignment, error } = await supabase
      .from("booking_contractors")
      .select(`
        *,
        contractors (first_name, last_name, email, phone),
        bookings (
          id, owner_id, service_type, event_date, event_start_time, event_end_time,
          venue_name, venue_address, shot_list, special_requests,
          clients (first_name, last_name),
          packages (name)
        )
      `)
      .eq("id", assignmentId)
      .eq("booking_id", bookingId)
      .single();

    if (error || !assignment) {
      return res.status(404).json({ error: `Assignment not found${error ? `: ${error.message}` : ""}` });
    }

    const booking = assignment.bookings as any;
    if (!booking || booking.owner_id !== ownerUserId) {
      return res.status(404).json({ error: "Not found" });
    }

    const contractor = assignment.contractors as any;
    const client      = booking.clients as any;
    const pkg         = booking.packages as any;

    // Other crew assigned to this booking, for context on the call sheet.
    const { data: crewRows } = await supabase
      .from("booking_contractors")
      .select("id, role, contractors (first_name, last_name)")
      .eq("booking_id", bookingId)
      .neq("id", assignmentId);

    const crew = (crewRows ?? []).map((row: any) => {
      const c = row.contractors;
      return {
        name: c ? `${c.first_name} ${c.last_name}` : "Unknown contractor",
        role: ROLE_LABELS[row.role] ?? row.role,
      };
    });

    const contractorName = contractor
      ? `${contractor.first_name} ${contractor.last_name}`.trim()
      : "Contractor";

    // Coverage window: use this crew member's own coverage times if set
    // (e.g. a second shooter only covering the ceremony), otherwise fall back
    // to the booking's full event window.
    const effectiveStart = assignment.coverage_start_time ?? booking.event_start_time ?? null;
    const effectiveEnd   = assignment.coverage_end_time   ?? booking.event_end_time   ?? null;

    const data: CallSheetData = {
      contractor_name:  contractorName,
      contractor_role:  ROLE_LABELS[assignment.role] ?? assignment.role,
      contractor_email: contractor?.email ?? null,
      contractor_phone: contractor?.phone ?? null,
      agreed_rate:      assignment.agreed_rate,
      rate_type:        assignment.rate_type ?? null,
      confirmed:         !!assignment.confirmed,
      client_name:      client ? `${client.first_name} ${client.last_name}`.trim() : "—",
      service_type:     formatServiceType(booking.service_type),
      package_name:     pkg?.name ?? null,
      event_date:       booking.event_date,
      start_time:       effectiveStart,
      end_time:         effectiveEnd,
      venue_name:       booking.venue_name ?? null,
      venue_address:    booking.venue_address ?? null,
      shot_list:        booking.shot_list ?? null,
      special_requests: booking.special_requests ?? null,
      crew,
      company_contact_name:  "Johnny Nguyen",
      company_contact_phone: "0426 864 865",
      company_contact_email: "johnny.nguyen@jnguyen.co",
    };

    const pdfBuffer = await generateCallSheetPDF(data);

    const fileName = `Call_Sheet_${contractorName.replace(/\s+/g, "_")}_${booking.event_date ?? "TBC"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("[call-sheet] PDF generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to generate call sheet: ${message}` });
  }
}
