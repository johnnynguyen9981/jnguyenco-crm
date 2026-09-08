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
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id",    placeId);
    url.searchParams.set("fields",      "name,rating,user_ratings_total,reviews");
    url.searchParams.set("reviews_sort","newest");
    url.searchParams.set("key",         apiKey);
    const res  = await fetch(url.toString(), { next: { revalidate: 3600 } });
    const data = await res.json() as any;
    if (!data.result) {
      console.warn("[reviews] Places API status:", data.status, "— using fallback");
      return FALLBACK;
    }
    return {
      name:         data.result.name,
      rating:       data.result.rating,
      totalReviews: data.result.user_ratings_total,
      source:       "live",
      reviews:      data.result.reviews ?? [],
    };
  } catch (err) {
    console.error("[reviews]", err);
    return FALLBACK;
  }
}
