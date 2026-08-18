// POST /api/bookings/[id]/run-sheet/generate
// AI-assisted run sheet generation. Takes the booking's known details plus
// free-text notes from Johnny ("first look at 1pm", "reception venue is
// 20 min drive from the ceremony", "no photos during vows", etc.) and asks
// Claude to build a tailored minute-by-minute schedule around them. Uses
// Anthropic's Messages API. (Tried Google's Gemini free tier first, but two
// separate Google Cloud projects on this account both hit account-level
// blocks — depleted trial credits, then a flat 403 permission denial — that
// had nothing to do with this code. Anthropic is a few cents/month at this
// feature's usage and just works.) Falls back cleanly (503, clear message)
// if ANTHROPIC_API_KEY isn't configured — the client then uses the free,
// local template generator instead.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError, formatServiceType } from "@/lib/utils";
import { generateDefaultRunSheet, RunSheetItem } from "@/lib/run-sheet";

type Params = { params: { id: string } };

const MODEL = "claude-haiku-4-5-20251001";

function isValidItems(v: unknown): v is RunSheetItem[] {
  return Array.isArray(v) && v.length > 0 && v.every(
    (i) =>
      i && typeof i === "object" &&
      typeof (i as any).activity === "string" && (i as any).activity.trim().length > 0 &&
      (typeof (i as any).time === "string" || (i as any).time == null) &&
      (typeof (i as any).notes === "string" || (i as any).notes == null)
  );
}

/** Strips ```json ... ``` fences etc if the model wraps its output. */
function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  const jsonSlice = start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonSlice);
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return apiError("Forbidden", 403);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return apiError(
      "AI generation isn't set up yet — add ANTHROPIC_API_KEY to your environment to enable it. Using the standard template instead.",
      503
    );
  }

  let body: { notes?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const notes = (body.notes ?? "").trim();
  if (!notes) return apiError("Add some notes describing what should be different, then try again.");

  const ownerUserId = await getOwnerUserId();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      clients (first_name, last_name),
      packages (name)
    `)
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();

  if (error || !booking) return apiError("Booking not found", 404);

  const client = booking.clients as any;
  const pkg    = booking.packages as any;
  const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : "the client";

  // A free, deterministic baseline the model can adjust rather than invent
  // from scratch — keeps timing sane even if the notes are sparse.
  const baseline = generateDefaultRunSheet(booking);

  const contextLines = [
    `Client: ${clientName}`,
    `Service type: ${formatServiceType(booking.service_type)}`,
    `Package: ${pkg?.name ?? "Custom"}`,
    `Event date: ${booking.event_date ?? "TBC"}`,
    `Coverage window: ${booking.event_start_time ?? "TBC"} to ${booking.event_end_time ?? "TBC"}`,
    booking.venue_name ? `Venue: ${booking.venue_name}` : null,
    booking.ceremony_venue ? `Ceremony venue: ${booking.ceremony_venue}` : null,
    booking.reception_venue ? `Reception venue: ${booking.reception_venue}` : null,
    booking.shot_list ? `Shot list: ${booking.shot_list}` : null,
    booking.special_requests ? `Special requests on file: ${booking.special_requests}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are building a minute-by-minute event day "run sheet" (shared schedule) for a wedding/event photography and videography studio (JNguyen Co., Canberra, Australia).

BOOKING CONTEXT:
${contextLines}

BASELINE SCHEDULE (a generic starting point — adjust freely, don't feel bound by it):
${JSON.stringify(baseline, null, 2)}

PHOTOGRAPHER'S NOTES (this is the important part — the schedule MUST reflect these):
"""
${notes}
"""

Produce the final run sheet as a JSON array of objects, each shaped exactly like:
{"time": "HH:MM", "activity": "string", "notes": "string (optional, omit or empty if none)"}

Rules:
- "time" must be 24-hour "HH:MM" format, or "" if genuinely unknown/TBC.
- Items must be in chronological order.
- Incorporate every concrete instruction from the notes (added activities, timing changes, venue changes, things to avoid, travel buffers, etc).
- Keep activity labels short (a few words) and put extra detail in "notes".
- Only include realistic, non-overlapping timings within the coverage window when times are known.
- Return ONLY the JSON array — no markdown fences, no commentary, no explanation.`;

  let aiText: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[run-sheet/generate] Anthropic API error:", res.status, errText);
      return apiError("AI generation failed — using the standard template instead.", 502);
    }

    const json = await res.json();
    aiText = json?.content?.[0]?.text ?? "";
  } catch (e: any) {
    console.error("[run-sheet/generate] Request failed:", e);
    return apiError("AI generation failed — using the standard template instead.", 502);
  }

  let items: unknown;
  try {
    items = extractJsonArray(aiText);
  } catch (e) {
    console.error("[run-sheet/generate] Failed to parse AI response:", aiText);
    return apiError("AI returned an unexpected format — using the standard template instead.", 502);
  }

  if (!isValidItems(items)) {
    console.error("[run-sheet/generate] AI response failed validation:", items);
    return apiError("AI returned an unexpected format — using the standard template instead.", 502);
  }

  const cleaned: RunSheetItem[] = items.map((i) => ({
    time: i.time ?? "",
    activity: i.activity.trim(),
    notes: i.notes && String(i.notes).trim() ? String(i.notes).trim() : undefined,
  }));

  return apiSuccess({ items: cleaned });
}
