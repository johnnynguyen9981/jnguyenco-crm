// PATCH /api/bookings/[id]/run-sheet — save the edited timeline items
// POST  /api/bookings/[id]/run-sheet — generate & download the run sheet PDF
//   (uses saved items if present, otherwise auto-generates a suggested
//   timeline on the fly from the booking's service type/times/venues)
//
// Pages Router API route (not app/api/) — see pages/api/payments/[id]/
// receipt.ts for why: app/api/** routes compile through Next's
// "react-server" webpack condition, which resolves `react` to a build
// @react-pdf/renderer's reconciler rejects everything from as "not a valid
// React child" (Minified React error #31). Both methods live in this one
// file (rather than leaving PATCH in app/api/ since it doesn't touch
// react-pdf) because Next won't allow an app/api/ route.ts and a pages/api/
// route at the same path to coexist.
//
// getOwnerUserId/getCurrentTeamMember/isFounder from lib/team.ts all call
// the App Router-only createClient() (next/headers cookies()) internally,
// so the founder-role gate and owner lookup are inlined here instead,
// same as pages/api/bookings/[id]/contractors/[assignmentId]/call-sheet.ts.
import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesClient } from "@/lib/supabase/pages-server";
import { formatServiceType } from "@/lib/utils";
import { generateDefaultRunSheet, RunSheetItem } from "@/lib/run-sheet";
import { generateRunSheetPDF, RunSheetData } from "@/lib/generate-run-sheet";

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

async function resolveFounderAndOwner(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("team_members")
    .select("role, user_id")
    .eq("user_id", userId)
    .single();

  const role = member?.role ?? "FOUNDER";
  const isFounder = role === "FOUNDER";

  let ownerUserId = userId;
  if (member && member.role !== "FOUNDER") {
    const { data: founder } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("role", "FOUNDER")
      .eq("is_active", true)
      .not("user_id", "is", null)
      .single();
    ownerUserId = founder?.user_id ?? userId;
  }

  return { isFounder, ownerUserId };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const bookingId = String(req.query.id);
  const supabase = createPagesClient(req, res);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { isFounder, ownerUserId } = await resolveFounderAndOwner(supabase, user.id);
  if (!isFounder) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PATCH") {
    const body = req.body;
    if (!isValidItems(body?.items)) {
      return res.status(400).json({ error: "items must be an array of {time, activity, notes?}" });
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({ run_sheet_items: body.items })
      .eq("id", bookingId)
      .eq("owner_id", ownerUserId)
      .select("id, run_sheet_items")
      .single();

    if (error) {
      if (isMissingColumnError(error)) {
        return res.status(503).json({
          error: "Run sheet storage isn't set up yet — run the 20260815_run_sheet.sql migration in Supabase, then try again.",
        });
      }
      return res.status(error.code === "PGRST116" ? 404 : 500).json({
        error: error.code === "PGRST116" ? "Booking not found" : error.message,
      });
    }

    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    // `*` so this keeps working whether or not run_sheet_items exists yet.
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(`
        *,
        clients (first_name, last_name),
        packages (name),
        booking_contractors (role, contractors (first_name, last_name))
      `)
      .eq("id", bookingId)
      .eq("owner_id", ownerUserId)
      .single();

    if (error || !booking) {
      return res.status(404).json({ error: "Booking not found" });
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
      return res.status(500).json({ error: "Failed to generate run sheet" });
    }

    const fileName = `Run_Sheet_${clientName.replace(/\s+/g, "_")}_${booking.event_date ?? "TBC"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(pdfBuffer);
  }

  res.setHeader("Allow", "PATCH, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
