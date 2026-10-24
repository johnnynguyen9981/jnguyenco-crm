// lib/availability.ts — Date availability rules for the public enquiry form.
//
// Pure functions only (no I/O) so the rules can be tested without a database.
// The API route (app/api/enquire/availability/route.ts) supplies the count of locked
// bookings for the requested date; everything else is decided here.
//
// Rules (agreed with Johnny, 24 Oct 2026):
//  - A date is "locked" only by a booking with status CONFIRMED (signed contract + deposit).
//    INQUIRY / QUOTED / CONTRACTED / COMPLETED / CANCELLED never lock a date.
//  - Johnny can run more than one job per day with contractors, so there is no hard "booked"
//    answer: one or more locked bookings = "limited" (he confirms by hand).
//  - Dates inside the notice window (weddings 30 days, events and portraits 14 days) are
//    "contact" so he has time to organise a team.
//  - The result is advisory only. It never blocks a submission and never names a client.
//  - All "today" and date maths use Australia/Sydney, never UTC.

export type ServiceType = "WEDDING" | "EVENT" | "PORTRAIT";
export type AvailabilityStatus = "available" | "limited" | "contact";

export interface AvailabilityResult {
  status: AvailabilityStatus;
  message: string;
}

// Booking statuses that lock a date. Keep in sync with the booking_status enum.
export const LOCKED_STATUSES = ["CONFIRMED"] as const;

// Minimum notice in days, per service type. Portraits follow the events rule (not yet confirmed with Johnny).
export const LEAD_TIME_DAYS: Record<ServiceType, number> = {
  WEDDING: 30,
  EVENT: 14,
  PORTRAIT: 14,
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

// Same mapping the enquiry API uses to turn the event-type label into a service_type.
export function toServiceType(label: string): ServiceType {
  const l = (label ?? "").toLowerCase();
  if (l.includes("wedding") || l.includes("elopement")) return "WEDDING";
  if (l.includes("portrait")) return "PORTRAIT";
  return "EVENT";
}

// True only for a well-formed YYYY-MM-DD that is a real calendar date (rejects 2026-02-31).
export function isValidYmd(s: string): boolean {
  if (!YMD_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Today's calendar date in Sydney as YYYY-MM-DD (en-CA formats as ISO).
export function sydneyToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

// Whole calendar days from `fromYmd` to `toYmd`. Both are plain dates, so DST never skews the result.
export function daysBetween(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export const MESSAGES: Record<AvailabilityStatus, string> = {
  available:
    "Good news — that date looks available. Send your enquiry and I'll confirm personally.",
  limited:
    "I already have a booking on that date, but I can often fit another job with my team. Send your enquiry and I'll confirm.",
  contact:
    "That date is coming up soon, so I'll need to check what's possible. Send your enquiry or email johnny.nguyen@jnguyen.co and I'll get back to you.",
};

export function computeAvailability(args: {
  date: string;          // requested event date, YYYY-MM-DD
  serviceType: ServiceType;
  today: string;         // Sydney "today", YYYY-MM-DD
  lockedCount: number;   // CONFIRMED bookings already on that date
}): AvailabilityResult {
  const { date, serviceType, today, lockedCount } = args;

  // Inside the notice window (or in the past): Johnny needs to look at it himself.
  if (daysBetween(today, date) < LEAD_TIME_DAYS[serviceType]) {
    return { status: "contact", message: MESSAGES.contact };
  }
  if (lockedCount > 0) {
    return { status: "limited", message: MESSAGES.limited };
  }
  return { status: "available", message: MESSAGES.available };
}
