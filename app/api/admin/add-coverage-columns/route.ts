// Superseded — DDL (ALTER TABLE) can't be run via the Supabase JS client;
// the exec_sql RPC isn't available in this project. See the migration file
// supabase/migrations/20260813_booking_contractor_coverage.sql — run that
// SQL manually in the Supabase SQL Editor instead. Safe to delete this file.
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    message: "Superseded — see supabase/migrations/20260813_booking_contractor_coverage.sql",
  });
}
