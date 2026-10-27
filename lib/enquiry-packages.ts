// lib/enquiry-packages.ts — Package options shown on the public enquiry form
// (/enquire and /enquire/embed). One list, used by both pages.
//
// Package ids are stored in the CRM as "Package interest: <id with spaces>", so keep
// existing ids stable when editing labels or prices.
//
// All "today" checks use Australia/Sydney, never UTC.

export type EnquiryGroup = "WEDDING" | "EVENT" | "PORTRAIT";

export interface EnquiryPackage {
  id: string;
  group: EnquiryGroup;
  label: string;
  price: string;
  meta: string;              // one short line under the name
  services: "PHOTO" | "VIDEO" | "BOTH";
  showFrom?: string;         // first day it is offered (YYYY-MM-DD, Sydney)
  showUntil?: string;        // last day it is offered (YYYY-MM-DD, Sydney)
}

// Spring Weekend Special — extended by Johnny on 27 Oct 2026 to the end of November.
export const SPRING_LAST_BOOKING_DAY = "2026-11-30";

// WINTER27 — 20% off selected packages for Jun–Aug 2027 weddings. The 6-date cap is
// managed by hand: once 6 dates are booked, set WINTER27_LAST_BOOKING_DAY to that day.
export const WINTER27_LAUNCH_DAY = "2026-11-16";
export const WINTER27_LAST_BOOKING_DAY = "2027-02-28";

const WINTER27_NOTE = "Jun–Aug 2027 weddings · Book by 28 Feb";

export const PACKAGES: EnquiryPackage[] = [
  // Weddings & elopements (tea ceremony sits here too)
  { id: "quiet_elopement",         group: "WEDDING", label: "The Quiet Elopement",            price: "$999",   meta: "Up to 2 hrs · Photographer · Sun–Thu only", services: "PHOTO" },
  { id: "vietnamese_tea_ceremony", group: "WEDDING", label: "Vietnamese Tea Ceremony",        price: "$1,650", meta: "Up to 2 hrs · Photo + video · 2–3 min film", services: "BOTH" },
  { id: "spring_mini_wedding",     group: "WEDDING", label: "Spring Special — Mini Wedding",  price: "$1,610", meta: "30% off (was $2,300) · Weekends · Book by 30 Nov · Paid in full before the day", services: "BOTH", showUntil: SPRING_LAST_BOOKING_DAY },
  { id: "mini_wedding",            group: "WEDDING", label: "Mini Wedding / Elopement",       price: "$2,300", meta: "Up to 4 hrs · Photo + video · 3–5 min film", services: "BOTH" },
  { id: "wedding_photo_only",      group: "WEDDING", label: "Wedding Photography Only",       price: "$2,650", meta: "Up to 8 hrs · Photographer only", services: "PHOTO" },
  { id: "wedding_video_only",      group: "WEDDING", label: "Wedding Videography Only",       price: "$2,650", meta: "Up to 8 hrs · Videographer only · 5–7 min film", services: "VIDEO" },
  { id: "half_day_wedding",        group: "WEDDING", label: "Half Day Wedding",               price: "$3,300", meta: "Up to 6 hrs · Photo + video · 4–6 min film", services: "BOTH" },
  { id: "full_day_essential",      group: "WEDDING", label: "Full Day – Essential",           price: "$4,500", meta: "Up to 8 hrs · Photo + video · 5–7 min film", services: "BOTH" },
  { id: "full_day_premium",        group: "WEDDING", label: "Full Day – Premium",             price: "$7,300", meta: "Up to 10 hrs · 2 photographers + 2 videographers", services: "BOTH" },
  { id: "winter27_full_day_premium",   group: "WEDDING", label: "WINTER27 — Full Day Premium",      price: "$5,840", meta: "20% off (was $7,300) · " + WINTER27_NOTE, services: "BOTH",  showFrom: WINTER27_LAUNCH_DAY, showUntil: WINTER27_LAST_BOOKING_DAY },
  { id: "winter27_full_day_essential", group: "WEDDING", label: "WINTER27 — Full Day Essential",    price: "$3,600", meta: "20% off (was $4,500) · " + WINTER27_NOTE, services: "BOTH",  showFrom: WINTER27_LAUNCH_DAY, showUntil: WINTER27_LAST_BOOKING_DAY },
  { id: "winter27_wedding_photo_only", group: "WEDDING", label: "WINTER27 — Photography Only",      price: "$2,120", meta: "20% off (was $2,650) · " + WINTER27_NOTE, services: "PHOTO", showFrom: WINTER27_LAUNCH_DAY, showUntil: WINTER27_LAST_BOOKING_DAY },
  { id: "winter27_wedding_video_only", group: "WEDDING", label: "WINTER27 — Videography Only",      price: "$2,120", meta: "20% off (was $2,650) · " + WINTER27_NOTE, services: "VIDEO", showFrom: WINTER27_LAUNCH_DAY, showUntil: WINTER27_LAST_BOOKING_DAY },

  // Parties & events
  { id: "celebration_photo_2hr",      group: "EVENT", label: "The Celebration",          price: "$460",    meta: "2 hrs · Photographer · 100+ images", services: "PHOTO" },
  { id: "full_party_photo_3hr",       group: "EVENT", label: "The Full Party",           price: "$690",    meta: "3 hrs · Photographer · 150+ images", services: "PHOTO" },
  { id: "celebration_photo_film_2hr", group: "EVENT", label: "Celebration Photo + Film", price: "$850",    meta: "2 hrs · Photo + video · 2–3 min reel", services: "BOTH" },
  { id: "full_party_photo_film_3hr",  group: "EVENT", label: "Full Party Photo + Film",  price: "$1,275",  meta: "3 hrs · Photo + video · 2–3 min reel", services: "BOTH" },
  { id: "hourly_photo",               group: "EVENT", label: "Longer event — photography",  price: "$230/hr", meta: "50–80 edited images per hour", services: "PHOTO" },
  { id: "hourly_video",               group: "EVENT", label: "Longer event — videography",  price: "$280/hr", meta: "1–2 min reel per hour of coverage", services: "VIDEO" },
  { id: "hourly_photo_video",         group: "EVENT", label: "Longer event — photo + video", price: "$425/hr", meta: "Both, per hour", services: "BOTH" },

  // Portraits
  { id: "portrait_couples",   group: "PORTRAIT", label: "Couples / engagement", price: "$250/hr", meta: "1 photographer · online gallery", services: "PHOTO" },
  { id: "portrait_family",    group: "PORTRAIT", label: "Family portrait",      price: "$250/hr", meta: "1 photographer · online gallery", services: "PHOTO" },
  { id: "portrait_newborn",   group: "PORTRAIT", label: "Newborn / maternity",  price: "$250/hr", meta: "1 photographer · online gallery", services: "PHOTO" },
  { id: "portrait_individual",group: "PORTRAIT", label: "Individual portrait",  price: "$250/hr", meta: "1 photographer · online gallery", services: "PHOTO" },
  { id: "portrait_headshot",  group: "PORTRAIT", label: "Headshot session",     price: "$375",    meta: "Up to 1 hr · 20–40 images", services: "PHOTO" },
];

export const NOT_SURE_ID = "not_sure";

export function sydneyTodayYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

export function isOffered(p: EnquiryPackage, today: string): boolean {
  if (p.showFrom && today < p.showFrom) return false;
  if (p.showUntil && today > p.showUntil) return false;
  return true;
}

export function packagesForGroup(group: EnquiryGroup, today: string = sydneyTodayYmd()): EnquiryPackage[] {
  return PACKAGES.filter(p => p.group === group && isOffered(p, today));
}

export function servicesFor(packageId: string): string {
  return PACKAGES.find(p => p.id === packageId)?.services ?? "";
}

// The three choices on step 1. `eventType` is what the CRM stores and what
// toServiceType() in the API and lib/availability.ts reads.
export const GROUPS: { id: EnquiryGroup; label: string; sub: string; eventType: string }[] = [
  { id: "WEDDING",  label: "Wedding or elopement", sub: "Including Vietnamese tea ceremonies",       eventType: "Wedding / Elopement" },
  { id: "EVENT",    label: "Party or event",       sub: "Birthdays, baptisms, baby showers and more", eventType: "Party / Event" },
  { id: "PORTRAIT", label: "Portrait session",     sub: "Couples, family, newborn, headshots",        eventType: "Portrait Session" },
];

// Optional detail for events, asked under "Tell me more". When chosen it replaces the
// generic "Party / Event" so the CRM still records the occasion.
export const EVENT_OCCASIONS = ["Birthday", "Baptism", "Baby Shower", "Gender Reveal", "Corporate Event", "Other"];

// Budget is only asked when the person picks "Not sure — help me choose".
export const BUDGETS: Record<EnquiryGroup, string[]> = {
  WEDDING:  ["Under $1,500", "$1,500 – $3,000", "$3,000 – $5,000", "$5,000+"],
  EVENT:    ["Under $500", "$500 – $900", "$900 – $1,300", "$1,300+"],
  PORTRAIT: ["Under $300", "$300 – $500", "$500+"],
};
