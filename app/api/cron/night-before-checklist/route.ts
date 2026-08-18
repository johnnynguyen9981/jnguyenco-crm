// GET /api/cron/night-before-checklist
// Runs once daily (see vercel.json) — finds every booking happening
// tomorrow (Australia/Sydney) that's actually going ahead, and emails
// Johnny a link to that booking's tickable mobile checklist. No user
// session in a cron context, so this uses the service-role client and
// sends via SMTP (same pattern as app/api/sign/[token]/route.ts) rather
// than the Gmail OAuth flow, which is tied to a logged-in session.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { addDaysToDate } from "@/lib/deliverables/autoPopulate";
import { sendEmailViaSMTP } from "@/lib/email/smtp";
import { nightBeforeChecklistHtml } from "@/lib/google/gmail";
import { NIGHT_BEFORE_ITEM_COUNT } from "@/lib/checklist/nightBeforeItems";
import { getAppUrl } from "@/lib/utils";

function sydneyTodayISO(): string {
  // Locale 'en-CA' formats as YYYY-MM-DD, handy for a direct ISO date string,
  // and Intl handles the AEST/AEDT daylight-saving switch for us.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase   = createServiceClient();
  const tomorrow   = addDaysToDate(sydneyTodayISO(), 1);
  const recipient  = process.env.NIGHT_BEFORE_CHECKLIST_EMAIL || process.env.NEXT_PUBLIC_BUSINESS_EMAIL;

  if (!recipient) {
    return NextResponse.json({ error: "No recipient configured (set NEXT_PUBLIC_BUSINESS_EMAIL or NIGHT_BEFORE_CHECKLIST_EMAIL)" }, { status: 500 });
  }

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, event_date, checklist_sent_at, clients (first_name, last_name)")
    .eq("event_date", tomorrow)
    .in("status", ["CONTRACTED", "CONFIRMED"])
    .is("checklist_sent_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  const failures: string[] = [];

  for (const b of bookings ?? []) {
    const client = (b as any).clients;
    const clientName = client ? `${client.first_name} ${client.last_name}` : "your event";
    try {
      const html = nightBeforeChecklistHtml({
        clientName,
        eventDate:    tomorrow,
        itemCount:    NIGHT_BEFORE_ITEM_COUNT,
        checklistUrl: `${getAppUrl()}/checklist/${b.id}`,
      });
      await sendEmailViaSMTP({
        to:      recipient,
        subject: `Tomorrow: ${clientName} — night-before checklist`,
        html,
      });
      await supabase.from("bookings").update({ checklist_sent_at: new Date().toISOString() }).eq("id", b.id);
      sent++;
    } catch (err: any) {
      console.error("[cron/night-before-checklist] Failed for booking", b.id, err);
      failures.push(b.id);
    }
  }

  return NextResponse.json({
    tomorrow,
    bookings_found: (bookings ?? []).length,
    sent,
    failed: failures.length,
  });
}
