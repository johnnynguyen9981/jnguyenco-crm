/**
 * Event Run Sheet — a minute-by-minute, editable schedule for the event day
 * itself (getting ready → ceremony → speeches → coverage ends, etc). This is
 * distinct from the "Call Sheet" (lib/generate-call-sheet.tsx), which is
 * per-crew-member logistics (where to be, rate, contact). A run sheet is
 * one shared timeline for the whole event, generated as a smart starting
 * point from the booking's service type / times / venues, then hand-edited
 * and exported as a branded PDF.
 */

export interface RunSheetItem {
  time: string;     // "HH:MM" 24-hour, or "" if not yet set
  activity: string;
  notes?: string;
}

export interface RunSheetSourceBooking {
  service_type?: string | null;      // 'WEDDING' | 'EVENT' | 'PORTRAIT'
  event_start_time?: string | null;  // "HH:MM" or "HH:MM:SS"
  event_end_time?: string | null;
  venue_name?: string | null;
  ceremony_venue?: string | null;
  reception_venue?: string | null;
  hours_booked?: number | string | null;
}

// ── Time helpers ────────────────────────────────────────────────────────
function parseToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440; // wrap within a day, stay positive
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Template shape: fraction of total duration + activity/notes builder ──
type TemplateStep = {
  frac: number; // 0–1, position within the coverage window
  activity: string;
  notes?: (b: RunSheetSourceBooking) => string | undefined;
};

const WEDDING_FULL: TemplateStep[] = [
  { frac: 0.00, activity: "Getting ready & detail shots" },
  { frac: 0.14, activity: "Bridal party photos" },
  { frac: 0.24, activity: "Ceremony", notes: (b) => b.ceremony_venue ?? undefined },
  { frac: 0.40, activity: "Family formal photos" },
  { frac: 0.50, activity: "Wedding party & couple portraits" },
  { frac: 0.62, activity: "Cocktail hour / guests mingle" },
  { frac: 0.70, activity: "Reception entrance", notes: (b) => b.reception_venue ?? undefined },
  { frac: 0.76, activity: "Speeches" },
  { frac: 0.84, activity: "Cake cutting" },
  { frac: 0.90, activity: "First dance" },
  { frac: 0.95, activity: "Open dancing" },
  { frac: 1.00, activity: "Coverage ends" },
];

const WEDDING_SHORT: TemplateStep[] = [
  { frac: 0.00, activity: "Getting ready & detail shots" },
  { frac: 0.20, activity: "Ceremony", notes: (b) => b.ceremony_venue ?? undefined },
  { frac: 0.45, activity: "Couple portraits" },
  { frac: 0.62, activity: "Family & group photos" },
  { frac: 0.78, activity: "Reception / celebration begins", notes: (b) => b.reception_venue ?? undefined },
  { frac: 1.00, activity: "Coverage ends" },
];

const EVENT_TEMPLATE: TemplateStep[] = [
  { frac: 0.00, activity: "Arrival & venue walkthrough" },
  { frac: 0.15, activity: "Guests arrive / mingling" },
  { frac: 0.40, activity: "Key moment / program begins" },
  { frac: 0.65, activity: "Speeches / formalities" },
  { frac: 0.85, activity: "Candid coverage & final shots" },
  { frac: 1.00, activity: "Coverage ends" },
];

const PORTRAIT_TEMPLATE: TemplateStep[] = [
  { frac: 0.00, activity: "Arrival & setup" },
  { frac: 0.20, activity: "Warm-up shots" },
  { frac: 0.55, activity: "Main session" },
  { frac: 0.85, activity: "Wrap-up / final looks" },
  { frac: 1.00, activity: "Session ends" },
];

function pickTemplate(b: RunSheetSourceBooking, totalMinutes: number | null): TemplateStep[] {
  const svc = (b.service_type ?? "EVENT").toUpperCase();
  if (svc === "PORTRAIT") return PORTRAIT_TEMPLATE;
  if (svc === "WEDDING") {
    // Short-form (elopement style) template once coverage is 5 hours or less.
    if (totalMinutes != null && totalMinutes <= 300) return WEDDING_SHORT;
    return WEDDING_FULL;
  }
  return EVENT_TEMPLATE;
}

/**
 * Builds a suggested run sheet from the booking's known times/venues. Always
 * returns something usable — with no start/end time on file, activities are
 * still ordered sensibly but every "time" comes back blank ("") for Johnny
 * to fill in by hand.
 */
export function generateDefaultRunSheet(b: RunSheetSourceBooking): RunSheetItem[] {
  const startMin = parseToMinutes(b.event_start_time);
  let endMin = parseToMinutes(b.event_end_time);
  if (endMin != null && startMin != null && endMin <= startMin) endMin += 1440; // crosses midnight

  let totalMinutes: number | null = null;
  if (startMin != null && endMin != null) {
    totalMinutes = endMin - startMin;
  } else if (b.hours_booked) {
    totalMinutes = Number(b.hours_booked) * 60;
  }

  const template = pickTemplate(b, totalMinutes);

  return template.map((step) => {
    const time =
      startMin != null && totalMinutes != null
        ? minutesToHHMM(startMin + Math.round(step.frac * totalMinutes))
        : "";
    return {
      time,
      activity: step.activity,
      notes: step.notes?.(b),
    };
  });
}

// ── Display formatting (for the PDF + read-only views) ───────────────────
export function fmtRunSheetTime(t?: string | null): string {
  if (!t) return "TBC";
  const mins = parseToMinutes(t);
  if (mins == null) return t;
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
