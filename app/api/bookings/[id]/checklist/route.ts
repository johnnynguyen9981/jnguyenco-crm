// PATCH /api/bookings/[id]/checklist
// Ticks/unticks a single night-before checklist item (merged into
// bookings.checklist_state), or resets the whole checklist for a booking.
//
// POST /api/bookings/[id]/checklist
// Sends the night-before checklist email immediately for this booking
// (manual "send now" — for testing, or sending ahead of the automatic
// cron run). Uses the same SMTP path as the cron job.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { formatDate, getAppUrl } from "@/lib/utils";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { nightBeforeChecklistHtml } from "@/lib/google/gmail";
import { NIGHT_BEFORE_ITEM_COUNT } from "@/lib/checklist/nightBeforeItems";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`id, event_date, clients (first_name, last_name)`)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (bErr || !booking) return apiError("Booking not found", 404);

  const recipient = process.env.NIGHT_BEFORE_CHECKLIST_EMAIL || process.env.NEXT_PUBLIC_BUSINESS_EMAIL;
  if (!recipient) return apiError("No recipient configured (set NEXT_PUBLIC_BUSINESS_EMAIL in .env.local)", 500);

  const client = (booking as any).clients;
  const clientName = client ? `${client.first_name} ${client.last_name}` : "your event";

  try {
    const html = nightBeforeChecklistHtml({
      clientName,
      eventDate:    formatDate(booking.event_date),
      itemCount:    NIGHT_BEFORE_ITEM_COUNT,
      checklistUrl: `${getAppUrl()}/checklist/${booking.id}`,
    });
    await sendEmailViaSMTP({
      to:      recipient,
      subject: `${clientName} — night-before checklist`,
      html,
    });
    await supabase.from("bookings").update({ checklist_sent_at: new Date().toISOString() }).eq("id", params.id);
    return apiSuccess({ sent_to: recipient });
  } catch (err: any) {
    if (err.message?.includes("not configured")) {
      return apiError("SMTP not configured. Add SMTP_HOST/SMTP_USER/SMTP_PASS to .env.local.", 503);
    }
    console.error("[bookings/checklist] Send failed:", err);
    return apiError(`Failed to send: ${err.message}`, 500);
  }
}

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { key, checked, reset } = body as { key?: string; checked?: boolean; reset?: boolean };

  if (!reset && !key) return apiError("key is required (or pass reset: true)");

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, checklist_state")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (bErr || !booking) return apiError("Booking not found", 404);

  const nextState: Record<string, boolean> = reset
    ? {}
    : { ...(booking.checklist_state ?? {}), [key!]: !!checked };

  const { error } = await supabase
    .from("bookings")
    .update({ checklist_state: nextState })
    .eq("id", params.id);

  if (error) return apiError(error.message, 500);

  return apiSuccess({ checklist_state: nextState });
}
