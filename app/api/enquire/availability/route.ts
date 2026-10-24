// GET /api/enquire/availability?date=YYYY-MM-DD&type=<event type label>
// Public (no auth) — used by the enquiry form to show an advisory "looks available" message.
//
// Privacy: the response is only a status word and a fixed message. It never includes client
// names, venues, times, package names or how many bookings exist on the date.
// Failure mode: on any error it returns { status: "unknown" } with HTTP 200 and the form shows
// nothing, so a problem here can never block or break an enquiry.
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  LOCKED_STATUSES,
  computeAvailability,
  isValidYmd,
  sydneyToday,
  toServiceType,
} from "@/lib/availability";

function stripBOM(s: string | undefined): string {
  if (!s) return "";
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function adminClient() {
  return createServiceClient(
    stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL),
    stripBOM(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

const NO_STORE = { "Cache-Control": "no-store" };

// Best-effort per-IP rate limit (in-memory, so it resets per serverless instance).
// Enough to stop someone casually walking the whole calendar; not a security boundary.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) {
      hits.forEach((v, k) => { if (now > v.resetAt) hits.delete(k); });
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    return NextResponse.json({ status: "unknown" }, { status: 429, headers: NO_STORE });
  }

  const date = req.nextUrl.searchParams.get("date") ?? "";
  const type = req.nextUrl.searchParams.get("type") ?? "";
  if (!isValidYmd(date)) {
    return NextResponse.json({ status: "unknown" }, { status: 400, headers: NO_STORE });
  }

  try {
    const { count, error } = await adminClient()
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("event_date", date)
      .in("status", [...LOCKED_STATUSES]);

    if (error) throw error;

    const result = computeAvailability({
      date,
      serviceType: toServiceType(type),
      today: sydneyToday(),
      lockedCount: count ?? 0,
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    console.error("Availability check failed:", e);
    return NextResponse.json({ status: "unknown" }, { headers: NO_STORE });
  }
}
