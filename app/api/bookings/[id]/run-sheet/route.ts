// PATCH /api/bookings/[id]/run-sheet — save the edited timeline items
// POST  /api/bookings/[id]/run-sheet — generate & download the run sheet PDF
//   (uses saved items if present, otherwise auto-generates a suggested
//   timeline on the fly from the booking's service type/times/venues)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError, formatServiceType } from "@/lib/utils";
import { generateDefaultRunSheet, RunSheetItem } from "@/lib/run-sheet";
import { generateRunSheetPDF, RunSheetData } from "@/lib/generate-run-sheet";

type Params = { params: Promise<{ id: string }> };

const ROLE_LABELS: Record<string, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
  PHOTO_EDITOR: "Photo Editor",
  OTHER:        "Contractor",
};

// bookings.run_sheet_items doesn't exist until 20260815_run_sheet.sql has
// been run — same graceful-degradation convention as the crew coverage
// fields (see app/api/bookings/[id]/contractors/route.ts).
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("schema cache") || (msg.includes("column") && msg.includes("does not exist"));
}

function isValidItems(v: unknown): v is RunSheetItem[] {
  return Array.isArray(v) && v.every(
    (i) => i && typeof i === "object" && typeof (i as any).activity === "string"
  );
}

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  if (!isValidItems(body.items)) return apiError("items must be an array of {time, activity, notes?}");

  const { data, error } = await supabase
    .from("bookings")
    .update({ run_sheet_items: body.items })
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .select("id, run_sheet_items")
    .single();

  if (error) {
    if (isMissingColumnError(error)) {
      return apiError(
        "Run sheet storage isn't set up yet — run the 20260815_run_sheet.sql migration in Supabase, then try again.",
        503
      );
    }
    return error.code === "PGRST116" ? apiError("Booking not found", 404) : apiError(error.message, 500);
  }

  return apiSuccess(data);
}

export async function POST(_req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ownerUserId = await getOwnerUserId();

  // `*` so this keeps working whether or not run_sheet_items exists yet.
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      clients (first_name, last_name),
      packages (name),
      booking_contractors (role, contractors (first_name, last_name))
    `)
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const client = booking.clients as any;
  const pkg    = booking.packages as any;
  const crewRows = (booking.booking_contractors as any[]) || [];
  const crew = crewRows.map((row) => {
    const c = row.contractors;
    return {
      name: c ? `${c.first_name} ${c.last_name}` : "Unknown contractor",
      role: ROLE_LABELS[row.role] ?? row.role,
    };
  });

  const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : "Client";

  const savedItems: RunSheetItem[] = Array.isArray(booking.run_sheet_items) ? booking.run_sheet_items : [];
  const items = savedItems.length > 0 ? savedItems : generateDefaultRunSheet(booking);

  const data: RunSheetData = {
    client_name:       clientName,
    service_type:      formatServiceType(booking.service_type),
    package_name:      pkg?.name ?? null,
    event_date:        booking.event_date,
    venue_name:        booking.venue_name ?? null,
    ceremony_venue:    booking.ceremony_venue ?? null,
    reception_venue:   booking.reception_venue ?? null,
    items,
    shot_list:         booking.shot_list ?? null,
    special_requests:  booking.special_requests ?? null,
    crew,
    company_contact_name:  "Johnny Nguyen",
    company_contact_phone: "0426 864 865",
    company_contact_email: "johnny.nguyen@jnguyen.co",
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateRunSheetPDF(data);
  } catch (e) {
    console.error("[run-sheet] PDF generation error:", e);
    return NextResponse.json({ error: "Failed to generate run sheet" }, { status: 500 });
  }

  const fileName = `Run_Sheet_${clientName.replace(/\s+/g, "_")}_${booking.event_date ?? "TBC"}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
