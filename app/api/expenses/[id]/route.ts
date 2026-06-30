// app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAustralianFY } from "@/lib/expenses";

type Params = { params: { id: string } };

// PATCH /api/expenses/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, any> = {};

  const fields = [
    "title", "vendor", "category", "amount", "date", "notes",
    "is_recurring", "recurring_frequency",
    "gdrive_file_id", "gdrive_file_name", "gdrive_file_url",
  ];
  for (const f of fields) {
    if (f in body) updates[f] = body[f];
  }

  // Re-derive financial year if date changed
  if (body.date) {
    updates.financial_year = getAustralianFY(body.date);
  }

  const { data, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

// DELETE /api/expenses/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optionally cascade: delete child recurring entries too
  const { searchParams } = new URL(req.url);
  const cascade = searchParams.get("cascade") === "true";

  if (cascade) {
    await supabase
      .from("expenses")
      .delete()
      .eq("parent_expense_id", params.id)
      .eq("owner_id", user.id);
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", params.id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
