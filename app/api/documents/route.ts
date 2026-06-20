// GET  /api/documents        — list user's files
// POST /api/documents        — upload a file (multipart/form-data)
// DELETE /api/documents?file — delete a file
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documents";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function ensureBucket(admin: ReturnType<typeof adminClient>) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find(b => b.id === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false });
  }
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  await ensureBucket(admin);

  const { data, error } = await admin.storage.from(BUCKET).list(user.id, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const files = (data ?? []).filter(f => f.name !== ".emptyFolderPlaceholder");
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const admin = adminClient();
  await ensureBucket(admin);

  const bytes = await file.arrayBuffer();
  const path  = `${user.id}/${file.name}`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, name: file.name });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = new URL(req.url).searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file param required" }, { status: 400 });

  const admin = adminClient();
  const { error } = await admin.storage.from(BUCKET).remove([`${user.id}/${file}`]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
