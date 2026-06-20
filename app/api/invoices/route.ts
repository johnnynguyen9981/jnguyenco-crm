// GET  /api/invoices — list invoices (filterable by status, client)
// POST /api/invoices — create invoice with line items
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const sp       = new URL(req.url).searchParams;
  const status   = sp.get("status");
  const clientId = sp.get("client_id");
  const page     = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const limit    = Math.min(50, parseInt(sp.get("limit") ?? "25"));
  const offset   = (page - 1) * limit;

  let query = supabase
    .from("invoices")
    .select(`
      *,
      clients (id, first_name, last_name, email),
      bookings (id, event_date, service_type),
      invoice_line_items (id, description, quantity, unit_price, total, sort_order)
    `, { count: "exact" })
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error, count } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({
    invoices: data,
    pagination: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { invoice, line_items } = await req.json();
  if (!invoice)              return apiError("invoice data required");
  if (!invoice.booking_id)   return apiError("booking_id required");
  if (!invoice.client_id)    return apiError("client_id required");
  if (!invoice.due_date)     return apiError("due_date required");
  if (!line_items?.length)   return apiError("At least one line item required");

  // Verify booking belongs to owner
  const { data: booking } = await supabase
    .from("bookings").select("id").eq("id", invoice.booking_id).eq("owner_id", user.id).maybeSingle();
  if (!booking) return apiError("Booking not found", 404);

  // Auto-generate invoice number: INV-YYYY-NNN
  const { count: existingCount } = await supabase
    .from("invoices").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  const seq    = (existingCount ?? 0) + 1;
  const year   = new Date().getFullYear();
  const invNum = `INV-${year}-${String(seq).padStart(3, "0")}`;

  // Strip client-only fields before inserting — these don't exist as DB columns
  const {
    apply_gst:            applyGstField,
    invoice_payment_type: invoicePaymentType,
    ...invoiceDbFields
  } = invoice;

  // Calculate totals from line items
  const subtotal     = line_items.reduce((s: number, li: any) => s + li.quantity * li.unit_price, 0);
  const applyGst     = applyGstField ?? false;
  const gst_amount   = applyGst ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const total_amount = subtotal + gst_amount;

  // Insert invoice
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      ...invoiceDbFields,
      owner_id:       user.id,
      invoice_number: invNum,
      subtotal,
      gst_amount,
      total_amount,
      amount_paid:    0,
      issue_date:     invoiceDbFields.issue_date ?? new Date().toISOString().split("T")[0],
      status:         "DRAFT",
    })
    .select().single();

  if (invErr) return apiError(invErr.message, 500);

  // Insert line items
  const { error: liErr } = await supabase
    .from("invoice_line_items")
    .insert(
      line_items.map((li: any, i: number) => ({
        invoice_id:  inv.id,
        description: li.description,
        quantity:    li.quantity,
        unit_price:  li.unit_price,
        sort_order:  i,
      }))
    );

  if (liErr) return apiError(liErr.message, 500);

  // Auto-create a payment record for this invoice
  // invoice_payment_type lets callers mark it as DEPOSIT instead of BALANCE
  await supabase.from("payments").insert({
    owner_id:     user.id,
    booking_id:   invoiceDbFields.booking_id,
    invoice_id:   inv.id,
    payment_type: invoicePaymentType ?? "BALANCE",
    amount:       total_amount,
    due_date:     invoiceDbFields.due_date,
    status:       "PENDING",
  });

  // Return full invoice with line items
  const { data: full } = await supabase
    .from("invoices")
    .select(`*, clients(first_name, last_name, email, address),
              bookings(event_date, service_type),
              invoice_line_items(*)`)
    .eq("id", inv.id).single();

  return apiSuccess(full, 201);
}
