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
const FALLBACK: ReviewsData = {
  name:         "Jnguyen.co | Canberra Photographer & Videographer",
  rating:       5.0,
  totalReviews: 15,
  source:       "fallback",
  reviews: [
    {
      author_name:               "Shradha Dhakal",
      profile_photo_url:         "",
      rating:                    5,
      relative_time_description: "8 weeks ago",
      text: "Jonny was very friendly and created a warm and welcoming environment for us during the photo session. The photos turned out beautifully, capturing our perfect moments.",
    },
    {
      author_name:               "DIMIL JOSE",
      profile_photo_url:         "",
      rating:                    5,
      relative_time_description: "13 weeks ago",
      text: "Great work, guys! 🎉 Amazing job. I absolutely loved it. Everything was handled very professionally. Thank you for all your hard work and dedication.",
    },
    {
      author_name:               "Shashmitha Reddy",
      profile_photo_url:         "",
      rating:                    5,
      relative_time_description: "6 weeks ago",
      text: "Johnny did an amazing job capturing our daughter's First Holy Communion. He was professional, friendly, and made the whole experience special.",
    },
  ],
};
export async function fetchReviews(): Promise<ReviewsData> {
  const apiKey  = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) return FALLBACK;
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
      return FALLBACK;
    }
    return {
      name:         data.displayName?.text ?? FALLBACK.name,
      rating:       data.rating,
      totalReviews: data.userRatingCount ?? 0,
      source:       "live",
      // API returns its 5 "most relevant" reviews with no sort option — show newest first
      reviews:      [...(data.reviews ?? [])]
        .sort((a: any, b: any) => new Date(b.publishTime ?? 0).getTime() - new Date(a.publishTime ?? 0).getTime())
        .map((r: any): Review => ({
          author_name:               r.authorAttribution?.displayName ?? "Google user",
          profile_photo_url:         r.authorAttribution?.photoUri ?? "",
          rating:                    r.rating ?? 5,
          relative_time_description: r.relativePublishTimeDescription ?? "",
          text:                      r.originalText?.text ?? r.text?.text ?? "",
        })),
    };
  } catch (err) {
    console.error("[reviews]", err);
    return FALLBACK;
  }
}
