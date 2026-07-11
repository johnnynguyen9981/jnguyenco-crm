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
  totalReviews: 13,
  source:       "fallback",
  reviews: [
    {
      author_name:               "Vinh Dong",
      profile_photo_url:         "",
      rating:                    5,
      relative_time_description: "3 weeks ago",
      text: "The photos were amazing! Johnny was so kind, patient, and friendly, and we received photos and videos that couldn't have been better. Highly recommend to anyone looking for a photographer or videographer!",
    },
    {
      author_name:               "Hannah Pham",
      profile_photo_url:         "",
      rating:                    5,
      relative_time_description: "4 weeks ago",
      text: "We couldn't be happier with our experience. Johnny was professional, unobtrusive, and captured our day beautifully. They kept everyone calm during busy moments and instinctively knew exactly where to be to catch the best memories. The final photos exceeded all expectations!",
    },
    {
      author_name:               "Anna Marcus",
      profile_photo_url:         "",
      rating:                    5,
      relative_time_description: "3 weeks ago",
      text: "Johnny captured our Autumn photos not too long ago. They turned out so beautifully! Johnny was really kind, patient, and welcoming, and made sure our experience made us leave with a smile on our faces. Will definitely be booking in the future for our photos! Thank you Johnny 🫰☺️",
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
