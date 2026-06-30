// app/api/expenses/parse/route.ts
// Sends a receipt/invoice (PDF or image) to the Anthropic API and returns
// structured expense data for auto-filling the expense form.
//
// Requires: ANTHROPIC_API_KEY in environment variables.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ParsedExpense = {
  title:    string;
  vendor:   string;
  amount:   number;
  date:     string;   // YYYY-MM-DD
  category: string;
  notes:    string;
};

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI_NOT_CONFIGURED", message: "Add ANTHROPIC_API_KEY to Vercel env vars to enable smart scanning." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // 10 MB limit for parsing (generous for receipts)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large for scanning (max 10 MB)" }, { status: 400 });
  }

  const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Build the Anthropic content block
  const fileBlock = isPDF
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } };

  const systemPrompt = `You extract expense data from invoices and receipts for JNguyen Co., a photography and videography business based in Canberra, Australia.

Always respond with ONLY a single valid JSON object — no explanation, no markdown, no code fences. Just the raw JSON.`;

  const userPrompt = `Extract the expense details from this ${isPDF ? "invoice PDF" : "receipt image"}.

Return exactly this JSON structure:
{
  "title": "Concise item name (e.g. 'Sony FE 35mm f/1.8 Lens', 'Adobe Creative Cloud', 'SanDisk 128GB Memory Card')",
  "vendor": "Seller/store name (e.g. 'JB Hi-Fi', 'Amazon AU', 'digiDirect', 'Adobe Inc.')",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "category": "EQUIPMENT_GEAR",
  "notes": "Order number or reference if visible (e.g. 'Order #JB-25703105')"
}

Category rules (pick one):
- EQUIPMENT_GEAR — cameras, lenses, lighting, audio gear, memory cards, batteries, tripods, gimbals, monitors, cages, filters, accessories
- SOFTWARE_SUBSCRIPTIONS — Adobe, apps, cloud services, software licences, online subscriptions
- VEHICLE_TRAVEL — fuel, parking, tolls, car hire, flights, accommodation, transport
- MARKETING_PROFESSIONAL — advertising, website hosting, printing, business cards, professional services

Amount: use AUD. If the invoice shows USD or another currency, convert to AUD (use ~1.60 AUD/USD if rate not shown) and add the original amount to notes.
Date: use the invoice or purchase date (not today). Format as YYYY-MM-DD.
Notes: keep brief — just the order/invoice number and any currency conversion note if needed.`;

  try {
    const headers: Record<string, string> = {
      "x-api-key":          apiKey,
      "anthropic-version":  "2023-06-01",
      "content-type":       "application/json",
    };
    // PDF support requires the beta header
    if (isPDF) headers["anthropic-beta"] = "pdfs-2024-09-25";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model:      "claude-3-5-haiku-20241022",
        max_tokens: 512,
        system:     systemPrompt,
        messages: [{
          role:    "user",
          content: [fileBlock, { type: "text", text: userPrompt }],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[expenses/parse] Anthropic error:", errText);
      return NextResponse.json({ error: "AI_FAILED", message: "Scanning failed — fill in manually." }, { status: 502 });
    }

    const result  = await anthropicRes.json();
    const rawText = (result.content?.[0]?.text ?? "") as string;

    // Extract JSON block from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[expenses/parse] No JSON in response:", rawText);
      return NextResponse.json({ error: "NO_JSON" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedExpense>;

    // Validate and sanitise the parsed fields
    const safe: ParsedExpense = {
      title:    String(parsed.title    ?? "").trim().slice(0, 200),
      vendor:   String(parsed.vendor   ?? "").trim().slice(0, 100),
      amount:   Math.abs(Number(parsed.amount) || 0),
      date:     /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date ?? ""))
                  ? String(parsed.date)
                  : new Date().toISOString().split("T")[0],
      category: ["EQUIPMENT_GEAR","SOFTWARE_SUBSCRIPTIONS","VEHICLE_TRAVEL","MARKETING_PROFESSIONAL"]
                  .includes(String(parsed.category ?? ""))
                  ? String(parsed.category)
                  : "EQUIPMENT_GEAR",
      notes:    String(parsed.notes ?? "").trim().slice(0, 500),
    };

    return NextResponse.json(safe);
  } catch (err: any) {
    console.error("[expenses/parse]", err);
    return NextResponse.json({ error: err.message ?? "Parse error" }, { status: 500 });
  }
}
