import { NextResponse } from "next/server";
import { fetchReviews } from "@/lib/reviews";

const CORS = {
  "Access-Control-Allow-Origin":  "https://www.jnguyen.co",
  "Access-Control-Allow-Methods": "GET",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  const data = await fetchReviews();
  return NextResponse.json(data, { headers: CORS });
}
