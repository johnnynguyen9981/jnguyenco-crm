// POST /api/bookings/[id]/contractors/[assignmentId]/call-sheet
// Generates a "Booking Confirmation / Call Sheet" PDF for a single crew
// assignment — the operational, contractor-facing companion to the legal
// Independent Contractor Agreement (lib/generate-contractor-agreement.tsx).
// Pulls the booking, client, package, and other assigned crew so the PDF
// has full context (date/time/venue, shot list, rate, who else is on it).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { formatServiceType } from "@/lib/utils";
import { generateCallSheetPDF, CallSheetData } from "@/lib/generate-call-sheet";

type Params = { params: Promise<{ id: string; assignmentId: string }> };

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Contractor",
};

export async function POST(_req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Everything below is wrapped in one try/catch so that whatever actually
  // fails (query, PDF render, anything in between) comes back as JSON with
  // the real error message instead of surfacing as a generic platform error
  // page — which the frontend can't parse as JSON and falls back to an
  // uninformative "Failed to generate call sheet." with no way to diagnose
  // it further from the deployed app alone.
  try {
    const ownerUserId = await getOwnerUserId();

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
      .eq("id", params.assignmentId)
      .eq("booking_id", params.id)
      .single();

    if (error || !assignment) {
      return NextResponse.json({ error: `Assignment not found${error ? `: ${error.message}` : ""}` }, { status: 404 });
    }

    const booking = assignment.bookings as any;
    if (!booking || booking.owner_id !== ownerUserId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contractor = assignment.contractors as any;
    const client      = booking.clients as any;
    const pkg         = booking.packages as any;

    // Other crew assigned to this booking, for context on the call sheet.
    const { data: crewRows } = await supabase
      .from("booking_contractors")
      .select("id, role, contractors (first_name, last_name)")
      .eq("booking_id", params.id)
      .neq("id", params.assignmentId);

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

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error("[call-sheet] PDF generation error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to generate call sheet: ${message}` }, { status: 500 });
  }
}
