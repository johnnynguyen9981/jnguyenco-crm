export type Review = {
  author_name: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
};
export type ReviewsData = {
  name: string;
  rating: number;
  totalReviews: number;
  source: string;
  reviews: Review[];
};

const MAX_REVIEWS = 5;

// Places API only returns its 5 "most relevant" reviews, so recent ones it skips are
// pinned here (copied from the Google Business Profile). Dates are approximate post dates.
type PinnedReview = Omit<Review, "relative_time_description"> & { date: string };
const PINNED: PinnedReview[] = [
  {
    author_name:       "Chloe Wentworth",
    profile_photo_url: "",
    rating:            5,
    date:              "2026-09-10",
    text: "We couldn't recommend Johnny enough! Johnny photographed my husband's 30th birthday and honestly did such an amazing job. From the moment he arrived, he made everyone feel so comfortable and somehow had everyone laughing and just being themselves in front of the camera.\n\nHe captured the night so naturally, and we absolutely LOVE the photos. They're exactly what we hoped for and will be such special memories for us to look back on.\n\nThe video was fantastic as well. We're so grateful to both of them for capturing such an important milestone and making the whole experience so easy and enjoyable.\n\nThank you so much, Johnny! We're absolutely thrilled with everything and would 100% recommend you to anyone looking for a photographer! ❤️",
  },
  {
    author_name:       "Shashmitha Reddy",
    profile_photo_url: "",
    rating:            5,
    date:              "2026-07-30",
    text: "Johnny did an amazing job capturing our daughter's First Holy Communion. He was professional, friendly, and made the whole experience special.",
  },
];

function relativeTime(ms: number): string {
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  if (days < 1)   return "today";
  if (days < 7)   return days === 1 ? "a day ago" : `${days} days ago`;
  if (days < 30)  { const w = Math.floor(days / 7);   return w === 1 ? "a week ago"  : `${w} weeks ago`; }
  if (days < 365) { const m = Math.floor(days / 30);  return m === 1 ? "a month ago" : `${m} months ago`; }
  const y = Math.floor(days / 365);
  return y === 1 ? "a year ago" : `${y} years ago`;
}

// Merge pinned + Google reviews, drop duplicates by author, newest first.
function mergeReviews(google: (Review & { time: number })[]): Review[] {
  const pinned = PINNED.map(({ date, ...r }) => {
    const time = new Date(date).getTime();
    return { ...r, time, relative_time_description: relativeTime(time) };
  });
  const seen = new Set<string>();
  return [...pinned, ...google]
    .filter(r => {
      const key = r.author_name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_REVIEWS)
    .map(({ time, ...r }) => r);
}

const FALLBACK: ReviewsData = {
  name:         "Jnguyen.co | Canberra Photographer & Videographer",
  rating:       5.0,
  totalReviews: 16,
  source:       "fallback",
  reviews:      [],
};

export async function fetchReviews(): Promise<ReviewsData> {
  const fallback = { ...FALLBACK, reviews: mergeReviews([]) };
  const apiKey  = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) return fallback;
  try {
    // Places API (New) — the legacy place/details endpoint isn't enabled on new GCP projects
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key":   apiKey,
        "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews",
      },
      next: { revalidate: 3600 },
    });
    const data = await res.json() as any;
    if (!res.ok || !data.rating) {
      console.warn("[reviews] Places API error:", data.error?.status ?? res.status, data.error?.message ?? "", "— using fallback");
      return fallback;
    }
    return {
      name:         data.displayName?.text ?? FALLBACK.name,
      rating:       data.rating,
      totalReviews: data.userRatingCount ?? 0,
      source:       "live",
      reviews:      mergeReviews((data.reviews ?? []).map((r: any) => ({
        author_name:               r.authorAttribution?.displayName ?? "Google user",
        profile_photo_url:         r.authorAttribution?.photoUri ?? "",
        rating:                    r.rating ?? 5,
        relative_time_description: r.relativePublishTimeDescription ?? "",
        text:                      r.originalText?.text ?? r.text?.text ?? "",
        time:                      new Date(r.publishTime ?? 0).getTime(),
      }))),
    };
  } catch (err) {
    console.error("[reviews]", err);
    return fallback;
  }
}
