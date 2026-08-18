// lib/checklist/nightBeforeItems.ts
// Shared "night before" prep checklist — same content as the printable
// night-before-checklist.pdf, but with stable item keys so tick state can
// be persisted per booking (bookings.checklist_state jsonb) and reused by
// both the mobile checklist page and the reminder email.
export interface ChecklistItem {
  key:   string;
  label: string;
}

export interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export const NIGHT_BEFORE_CHECKLIST: ChecklistSection[] = [
  {
    title: "Cameras & Batteries",
    items: [
      { key: "cam-xt5",      label: "Fujifilm X-T5 (primary stills) — battery charged" },
      { key: "cam-xt20",     label: "Fujifilm X-T20 (backup stills) — battery charged" },
      { key: "cam-a7iv",     label: "Sony A7 IV (video/hybrid) — battery charged" },
      { key: "spare-batts",  label: "Minimum 3 spare batteries per camera, all charged" },
      { key: "chargers",     label: "All battery chargers packed" },
      { key: "power-bank",   label: "Portable power bank charged" },
    ],
  },
  {
    title: "Lenses & Memory Cards",
    items: [
      { key: "lens-kit",     label: "Lens kit confirmed for this shoot (wide / standard / tele)" },
      { key: "lens-clean",   label: "Lens cleaning cloth & blower packed" },
      { key: "cards-format", label: "All memory cards formatted and tested" },
      { key: "cards-spare",  label: "Spare cards packed (2× expected shot count)" },
      { key: "card-wallet",  label: "Card wallet / hard case" },
      { key: "card-reader",  label: "Card reader packed" },
    ],
  },
  {
    title: "Audio & Support (video)",
    items: [
      { key: "lav-mics",     label: "Wireless lav mics — charged & tested" },
      { key: "shotgun-mic",  label: "Shotgun mic + windscreen" },
      { key: "headphones",   label: "Headphones for audio monitoring" },
      { key: "mic-batts",    label: "Spare mic batteries" },
      { key: "tripod",       label: "Tripod" },
      { key: "gimbal",       label: "Gimbal / stabiliser — charged" },
    ],
  },
  {
    title: "Lighting & Backup",
    items: [
      { key: "flash",        label: "Speedlight / flash + spare batteries" },
      { key: "diffuser",     label: "Diffuser / modifier" },
      { key: "led-light",    label: "LED video light + charger (if needed)" },
      { key: "laptop",       label: "Laptop — charged, charger packed" },
      { key: "hard-drives",  label: "External hard drive(s) for on-the-day backup" },
      { key: "gaffer-tape",  label: "Gaffer tape" },
    ],
  },
  {
    title: "Bag Essentials",
    items: [
      { key: "rain-cover",   label: "Rain cover / dry bags (weather protection)" },
      { key: "contract",     label: "Signed contract / booking confirmation (saved or printed)" },
      { key: "model-release",label: "Model release forms, if needed" },
      { key: "biz-cards",    label: "Business cards" },
    ],
  },
  {
    title: "Logistics",
    items: [
      { key: "venue-parking",label: "Venue address & parking plan confirmed" },
      { key: "run-sheet",    label: "Run sheet / timeline reviewed for the day" },
      { key: "call-time",    label: "Call time confirmed with client / coordinator" },
      { key: "contacts",     label: "Client & coordinator numbers saved in phone" },
      { key: "weather",      label: "Weather forecast checked — plan for rain or sun" },
      { key: "second-shooter",label: "Second shooter / contractor call time & gear confirmed" },
      { key: "directions",   label: "Route / directions set, traffic accounted for" },
      { key: "car-fuel",     label: "Car fuelled / charged" },
    ],
  },
  {
    title: "Personal",
    items: [
      { key: "outfit",       label: "Outfit laid out — comfortable, event-appropriate, weather-suited" },
      { key: "shoes",        label: "Comfortable shoes" },
      { key: "snacks",       label: "Snacks & water bottle packed" },
      { key: "phone-charger",label: "Phone charger + car charger" },
      { key: "alarm",        label: "Alarm set, with backup alarm" },
      { key: "early-night",  label: "Early night — lights out on time" },
    ],
  },
];

export const NIGHT_BEFORE_ITEM_COUNT = NIGHT_BEFORE_CHECKLIST.reduce(
  (sum, s) => sum + s.items.length, 0
);
