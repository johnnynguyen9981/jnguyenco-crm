// Deliverable templates — maps package name + service type to a list of
// deliverables with due dates relative to the event date.
import type { DeliverableType } from "@/lib/supabase/types";

interface DeliverableTemplate {
  type:               DeliverableType;
  notes:              string;
  due_days_after:     number;  // days after event_date
  image_count_min?:   number;
  image_count_max?:   number;
  film_duration_sec?: number;  // midpoint for display
}

// ── Package templates ─────────────────────────────────────────────────────────

const MINI_WEDDING: DeliverableTemplate[] = [
  { type: "TEASER",          notes: "30–60 sec vertical reel cut",         due_days_after: 2  },
  { type: "PHOTO_GALLERY",   notes: "200–350 edited images",                due_days_after: 28, image_count_min: 200, image_count_max: 350 },
  { type: "HIGHLIGHT_FILM",  notes: "3–5 min cinematic highlight film",     due_days_after: 42, film_duration_sec: 240 },
];

const FULL_DAY_ESSENTIAL: DeliverableTemplate[] = [
  { type: "TEASER",          notes: "30–60 sec vertical reel cut",          due_days_after: 2  },
  { type: "PHOTO_GALLERY",   notes: "400–600 edited images + full ceremony", due_days_after: 42, image_count_min: 400, image_count_max: 600 },
  { type: "HIGHLIGHT_FILM",  notes: "5–7 min cinematic highlight film",     due_days_after: 56, film_duration_sec: 360 },
];

const FULL_DAY_PREMIUM: DeliverableTemplate[] = [
  { type: "TEASER",          notes: "30–60 sec vertical reel cut",                      due_days_after: 2  },
  { type: "PHOTO_GALLERY",   notes: "700–1,000 edited images + ceremony + speeches",    due_days_after: 42, image_count_min: 700, image_count_max: 1000 },
  { type: "HIGHLIGHT_FILM",  notes: "6–8 min cinematic film",                           due_days_after: 56, film_duration_sec: 420 },
  { type: "RAW_FOOTAGE",     notes: "Full ceremony (uncut) — if included in package",   due_days_after: 56 },
];

const HOURLY_PHOTO: DeliverableTemplate[] = [
  { type: "PHOTO_GALLERY",   notes: "80–150 edited images per hour",        due_days_after: 14, image_count_min: 80, image_count_max: 300 },
];

const HOURLY_PHOTO_VIDEO: DeliverableTemplate[] = [
  { type: "PHOTO_GALLERY",   notes: "80–150 edited images per hour",        due_days_after: 14, image_count_min: 80, image_count_max: 300 },
  { type: "HIGHLIGHT_FILM",  notes: "1–3 min event highlight",              due_days_after: 21, film_duration_sec: 120 },
];

// ── Lookup by package name (normalised) ───────────────────────────────────────
const TEMPLATES: Array<{ match: RegExp; items: DeliverableTemplate[] }> = [
  { match: /mini|elopement/i,          items: MINI_WEDDING        },
  { match: /essential|full.?day.?8/i,  items: FULL_DAY_ESSENTIAL  },
  { match: /premium|full.?day.?13/i,   items: FULL_DAY_PREMIUM    },
  { match: /photo.{0,5}video|combo/i,  items: HOURLY_PHOTO_VIDEO  },
  { match: /hourly|event/i,            items: HOURLY_PHOTO        },
];

export function getDeliverableTemplates(
  packageName: string,
  serviceType: string,
): DeliverableTemplate[] {
  for (const t of TEMPLATES) {
    if (t.match.test(packageName)) return t.items;
  }
  // Fallback by service type
  if (serviceType === "WEDDING")  return FULL_DAY_ESSENTIAL;
  if (serviceType === "PORTRAIT") return HOURLY_PHOTO;
  return HOURLY_PHOTO;
}

export function addDaysToDate(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export { type DeliverableTemplate };
