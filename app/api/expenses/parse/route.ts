// app/api/expenses/parse/route.ts
// Sends a receipt/invoice (PDF or image) to Gemini (Google Workspace AI)
// and returns structured expense data for auto-filling the expense form.
//
// Requires: GEMINI_API_KEY in environment variables.
// Get it free at: https://aistudio.google.com/app/apikey

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

const PROMPT = `You extract expense data from invoices and receipts for JNguyen Co., a photography and videography business based in Canberra, Australia.

Extract the expense details and return ONLY a single valid JSON object — no explanation, no markdown, no code fences. Just raw JSON:

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

Amount: use AUD. If the invoice shows USD or another currency, convert to AUD (~1.60 AUD/USD if rate not shown) and add the original amount to notes.
Date: use the invoice or purchase date. Format as YYYY-MM-DD.
Notes: keep brief — just order/invoice number and any currency conversion note.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI_NOT_CONFIGURED", message: "Add GEMINI_API_KEY to Vercel env vars to enable smart scanning." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large for scanning (max 10 MB)" }, { status: 400 });
  }

  const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = isPDF ? "application/pdf" : (file.type || "image/jpeg");

  // Gemini 2.0 Flash — supports PDF + image natively, included in GW Premium AI
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: PROMPT },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 512,
      temperature: 0,
    },
  };

  try {
    const geminiRes = await fetch(geminiUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[expenses/parse] Gemini error:", errText);
      return NextResponse.json({ error: "AI_FAILED", message: "Scanning failed — fill in manually." }, { status: 502 });
    }

    const result  = await geminiRes.json();
    const rawText = (result.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[expenses/parse] No JSON in Gemini response:", rawText);
      return NextResponse.json({ error: "NO_JSON" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedExpense>;

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
