// ─────────────────────────────────────────────────────────────────────────────
// JNguyen Co. CRM — Supabase Type Definitions
// Keep in sync with supabase/migrations/001_initial_schema.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceType      = 'WEDDING' | 'EVENT' | 'PORTRAIT';
export type BookingStatus    = 'INQUIRY' | 'QUOTED' | 'CONTRACTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type PaymentType      = 'DEPOSIT' | 'BALANCE' | 'EXTRA_SERVICE';
export type PaymentStatus    = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type DeliverableType  = 'PHOTO_GALLERY' | 'HIGHLIGHT_FILM' | 'TEASER' | 'RAW_FOOTAGE';
export type DeliverableStatus = 'NOT_STARTED' | 'CULLING' | 'EDITING' | 'READY' | 'DELIVERED' | 'CLIENT_APPROVED';
export type ContractorRole   = 'PHOTOGRAPHER' | 'VIDEOGRAPHER' | 'BOTH';
export type InvoiceStatus    = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';
export type ReferralSource   = 'INSTAGRAM' | 'GOOGLE' | 'WORD_OF_MOUTH' | 'WEDDING_WIRE' | 'FACEBOOK' | 'OTHER';

// ── Client ──────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  instagram_handle?: string;
  referral_source?: ReferralSource;
  referral_notes?: string;
  partner_first?: string;
  partner_last?: string;
  partner_email?: string;
  partner_phone?: string;
  gdrive_folder_id?: string;
  created_at: string;
  updated_at: string;
}

export type ClientInsert = Omit<Client, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type ClientUpdate = Partial<ClientInsert>;

// ── Package ──────────────────────────────────────────────────────────────────
export interface Package {
  id: string;
  name: string;
  service_type: ServiceType;
  base_price: number;
  max_hours?: number;
  hourly_rate?: number;
  includes_photography: boolean;
  includes_videography: boolean;
  photo_count_min?: number;
  photo_count_max?: number;
  film_duration_min?: number;
  film_duration_max?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// ── Booking ──────────────────────────────────────────────────────────────────
export interface Booking {
  id: string;
  owner_id: string;
  client_id: string;
  package_id?: string;
  service_type: ServiceType;
  status: BookingStatus;
  event_date: string;
  event_start_time?: string;
  event_end_time?: string;
  venue_name?: string;
  venue_address?: string;
  ceremony_venue?: string;
  reception_venue?: string;
  quoted_total?: number;
  deposit_amount?: number;
  hours_booked?: number;
  shot_list?: string;
  special_requests?: string;
  internal_notes?: string;
  contract_sent_at?: string;
  contract_signed_at?: string;
  contract_signed_url?: string;
  contract_sign_token?: string;
  contract_sign_expires_at?: string;
  gcal_event_id?: string;
  created_at: string;
  updated_at: string;
}

export type BookingInsert = Omit<Booking, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type BookingUpdate = Partial<BookingInsert>;

// ── Invoice ──────────────────────────────────────────────────────────────────
export interface Invoice {
  id: string;
  owner_id: string;
  booking_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  notes?: string;
  internal_notes?: string;
  sent_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export type InvoiceLineItemInsert = Omit<InvoiceLineItem, 'id' | 'total'>;

// ── Payment ──────────────────────────────────────────────────────────────────
export interface Payment {
  id: string;
  owner_id: string;
  booking_id: string;
  invoice_id?: string;
  payment_type: PaymentType;
  amount: number;
  due_date?: string;
  paid_date?: string;
  status: PaymentStatus;
  method?: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

// ── Contractor ───────────────────────────────────────────────────────────────
export interface Contractor {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role: ContractorRole;
  default_rate?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

// ── Deliverable ───────────────────────────────────────────────────────────────
export interface Deliverable {
  id: string;
  owner_id: string;
  booking_id: string;
  type: DeliverableType;
  status: DeliverableStatus;
  image_count?: number;
  film_duration_sec?: number;
  delivery_url?: string;
  delivery_platform?: string;
  password?: string;
  due_date?: string;
  delivered_at?: string;
  client_viewed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Google Token ──────────────────────────────────────────────────────────────
export interface GoogleToken {
  id: string;
  owner_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  scopes?: string;
  updated_at: string;
}

// ── View types ────────────────────────────────────────────────────────────────
export interface DashboardBooking {
  id: string;
  event_date: string;
  status: BookingStatus;
  service_type: ServiceType;
  client_name: string;
  client_email: string;
  package_name?: string;
  quoted_total?: number;
  total_paid: number;
  balance_due: number;
}

export interface InvoiceAging {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  days_overdue: number;
  client_name: string;
  client_email: string;
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'SOFTWARE_SUBSCRIPTIONS'
  | 'EQUIPMENT_GEAR'
  | 'VEHICLE_TRAVEL'
  | 'MARKETING_PROFESSIONAL';

export type RecurringFrequency = 'MONTHLY' | 'ANNUAL';

export interface Expense {
  id: string;
  owner_id: string;
  title: string;
  vendor?: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  last_generated_date?: string;
  gdrive_file_id?: string;
  gdrive_file_name?: string;
  gdrive_file_url?: string;
  financial_year: string;
  parent_expense_id?: string;
  created_at: string;
}

export type ExpenseInsert = Omit<Expense, 'id' | 'owner_id' | 'created_at'>;
export type ExpenseUpdate = Partial<ExpenseInsert>;

// ── Joined/enriched types for UI ──────────────────────────────────────────────
export interface BookingWithClient extends Booking {
  clients: Pick<Client, 'first_name' | 'last_name' | 'email' | 'phone'>;
}

export interface InvoiceWithClient extends Invoice {
  clients: Pick<Client, 'first_name' | 'last_name' | 'email'>;
  bookings: Pick<Booking, 'event_date' | 'service_type'>;
}

// Extended version used by PDF templates
export interface InvoiceWithDetails extends Invoice {
  clients: Pick<Client, 'first_name' | 'last_name' | 'email' | 'address'>;
  bookings: Pick<Booking, 'event_date' | 'service_type'>;
  invoice_line_items: InvoiceLineItem[];
}
