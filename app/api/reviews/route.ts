// GET /api/reviews
// Uses GOOGLE_PLACE_ID directly from .env.local
// Falls back to scraped reviews if not set.
import { NextResponse } from "next/server";

const API_KEY  = process.env.GOOGLE_PLACES_API_KEY;
const PLACE_ID = process.env.GOOGLE_PLACE_ID;

const FALLBACK = {
  name:         "Jnguyen.co | Canberra Photographer & Videographer",
  rating:       5.0,
  totalReviews: 13,
  source:       "scraped",
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
      text: "Johnny captured our Autumn photos not too long ago. They turned out so beautifully! Johnny was really kind, patient, and welcoming, and made sure our experience made us leave with a smile on our faces. Will definitely be booking in the future for our photos! Thank you Johnny \u{1FAF0}\u263A\uFE0F",
    },
  ],
};

export async function GET() {
  if (!API_KEY || !PLACE_ID) {
    return NextResponse.json(FALLBACK);
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id",    PLACE_ID);
    url.searchParams.set("fields",      "name,rating,user_ratings_total,reviews");
    url.searchParams.set("reviews_sort","newest");
    url.searchParams.set("key",         API_KEY);

    const res  = await fetch(url.toString(), { next: { revalidate: 3600 } });
    const data = await res.json() as {
      result?: {
        name:               string;
        rating:             number;
        user_ratings_total: number;
        reviews?: {
          author_name:               string;
          profile_photo_url:         string;
          rating:                    number;
          relative_time_description: string;
          text:                      string;
        }[];
      };
      status?: string;
    };

    if (!data.result) {
      console.warn("[reviews] Places API status:", data.status, "— using fallback");
      return NextResponse.json(FALLBACK);
    }

    return NextResponse.json({
      name:         data.result.name,
      rating:       data.result.rating,
      totalReviews: data.result.user_ratings_total,
      source:       "live",
      reviews:      data.result.reviews ?? [],
    });

  } catch (err) {
    console.error("[reviews] error:", err);
    return NextResponse.json(FALLBACK);
  }
}
