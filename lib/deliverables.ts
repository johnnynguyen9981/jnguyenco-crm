// lib/deliverables.ts
// Resolves a package's raw "deliverables" bullet list into booking-specific
// numbers for hourly (Event) packages. Hourly packages store a per-hour photo
// rate (photo_count_min/max) and a generic bullet like "50-80 professionally
// edited images per hour of coverage" — this multiplies that rate by the
// booking's actual hours_booked and swaps in the real total for this specific
// booking, e.g. "150-240 professionally edited images" for a 3-hour shoot.
//
// Fixed-duration packages (Wedding/Portrait, which have max_hours set) are
// left untouched since their deliverables are already a flat total, not a rate.

export type DeliverablesPackage = {
  max_hours?: number | null;
  photo_count_min?: number | null;
  photo_count_max?: number | null;
  deliverables?: string[] | null;
};

const PER_HOUR_LINE = /\bper hour\b/i;
const IMAGE_WORD    = /\bimages?\b/i;

export function resolvePackageDeliverables(
  pkg: DeliverablesPackage | null | undefined,
  hoursBooked: number | string | null | undefined
): string[] {
  const bullets = pkg?.deliverables ?? [];
  if (!bullets.length) return [];

  const isHourlyPkg = pkg?.max_hours == null;
  const hours    = hoursBooked != null && hoursBooked !== "" ? Number(hoursBooked) : null;
  const photoMin = pkg?.photo_count_min ?? null;
  const photoMax = pkg?.photo_count_max ?? null;

  if (!isHourlyPkg || !hours || hours <= 0 || photoMin == null) {
    return bullets;
  }

  const min = Math.round(photoMin * hours);
  const max = photoMax != null && photoMax !== photoMin ? Math.round(photoMax * hours) : null;
  const computedLine = max != null
    ? `${min}–${max} professionally edited images`
    : `${min}+ professionally edited images`;

  // Swap the generic "per hour" image bullet for the computed total for this
  // booking; every other bullet (gallery delivery, video coverage, etc.)
  // passes through unchanged.
  let replaced = false;
  const resolved = bullets.map((line) => {
    if (!replaced && PER_HOUR_LINE.test(line) && IMAGE_WORD.test(line)) {
      replaced = true;
      return computedLine;
    }
    return line;
  });

  // Package deliverables didn't have a matching per-hour bullet to replace —
  // still surface the computed total by prepending it.
  return replaced ? resolved : [computedLine, ...resolved];
}
