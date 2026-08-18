// Deliverable templates — derives a list of deliverables with due dates
// relative to the event date, computed directly from the booking's real
// package row (max_hours, includes_photography/videography, photo/film
// counts) rather than regex-matching the package name against a fixed set
// of hardcoded buckets. Editing a package's photo/film counts (or adding a
// brand-new package) in Supabase is reflected here automatically.
import type { DeliverableType } from "@/lib/supabase/types";

interface DeliverableTemplate {
  type:               DeliverableType;
  notes:              string;
  due_days_after:     number;  // days after event_date
  image_count_min?:   number;
  image_count_max?:   number;
  film_duration_sec?: number;  // midpoint for display
}

export interface PackageDeliverableInput {
  max_hours?:              number | null;
  includes_photography?:   boolean | null;
  includes_videography?:   boolean | null;
  photo_count_min?:        number | null;
  photo_count_max?:        number | null;
  film_duration_min_sec?:  number | null;
  film_duration_max_sec?:  number | null;
}

/**
 * Wedding packages (fixed-duration, max_hours set) get a teaser + tiered
 * turnaround based on package size. Event/Portrait packages (hourly,
 * max_hours null) get a simpler, faster turnaround since there's no fixed
 * "package tier" to key off — just includes_photography/videography.
 */
export function getDeliverableTemplates(
  pkg: PackageDeliverableInput | null | undefined,
  serviceType: string,
): DeliverableTemplate[] {
  const isWedding      = pkg?.max_hours != null;
  const hours          = pkg?.max_hours ?? null;
  const includesPhoto  = pkg?.includes_photography ?? true;
  const includesVideo  = pkg?.includes_videography ?? (serviceType === "WEDDING");

  const imgMin = pkg?.photo_count_min ?? null;
  const imgMax = pkg?.photo_count_max ?? null;
  const filmMin = pkg?.film_duration_min_sec ?? null;
  const filmMax = pkg?.film_duration_max_sec ?? null;
  const filmMid = (filmMin != null && filmMax != null) ? Math.round((filmMin + filmMax) / 2) : undefined;

  // Larger wedding packages (Full Day Premium, 13hrs) get a longer, richer
  // turnaround than smaller ones (Mini, 4hrs / Essential, 8hrs).
  const isBigWedding = isWedding && (hours ?? 0) >= 13;
  const isMidWedding = isWedding && (hours ?? 0) >= 8 && (hours ?? 0) < 13;

  const items: DeliverableTemplate[] = [];

  if (isWedding && includesVideo) {
    items.push({ type: "TEASER", notes: "30–60 sec vertical reel cut", due_days_after: 2 });
  }

  if (includesPhoto) {
    items.push({
      type: "PHOTO_GALLERY",
      notes: (imgMin != null && imgMax != null)
        ? `${imgMin}–${imgMax} edited images${isWedding ? "" : " per hour"}`
        : "60+ edited images per hour",
      due_days_after: isBigWedding ? 42 : isMidWedding ? 42 : isWedding ? 28 : 14,
      image_count_min: imgMin ?? undefined,
      image_count_max: imgMax ?? undefined,
    });
  }

  if (includesVideo) {
    items.push({
      type: "HIGHLIGHT_FILM",
      notes: (filmMin != null && filmMax != null)
        ? `${Math.round(filmMin / 60)}–${Math.round(filmMax / 60)} min highlight film`
        : "Event highlight film",
      due_days_after: isBigWedding ? 56 : isMidWedding ? 56 : isWedding ? 42 : 21,
      film_duration_sec: filmMid,
    });
  }

  if (isBigWedding) {
    items.push({
      type: "RAW_FOOTAGE",
      notes: "Full ceremony (uncut) — if included in package",
      due_days_after: 56,
    });
  }

  if (items.length > 0) return items;

  // Fallback when there's no linked package at all (shouldn't normally
  // happen since bookings require a package, but keeps this function total).
  return [{ type: "PHOTO_GALLERY", notes: "Edited photo gallery", due_days_after: 28 }];
}

export function addDaysToDate(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export { type DeliverableTemplate };
