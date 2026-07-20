import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid, formatDistanceToNow } from "date-fns";
import type { BookingStatus, InvoiceStatus, PaymentStatus, ServiceType } from "./supabase/types";

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Currency formatting
export function formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
    }).format(amount);
}

// Date formatting
export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
          const date = parseISO(dateStr);
          return isValid(date) ? format(date, "d MMM yyyy") : "—";
    } catch {
          return "—";
    }
}

export function formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
          const date = parseISO(dateStr);
          return isValid(date) ? format(date, "d MMM yyyy, h:mm a") : "—";
    } catch {
          return "—";
    }
}

export function formatRelative(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
          return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
    } catch {
          return "—";
    }
}

// Status helpers
export type StatusBadge = { class: string; label: string };

export function getBookingStatusBadge(status: BookingStatus): StatusBadge {
    const map: Record<BookingStatus, StatusBadge> = {
          INQUIRY:    { class: "badge badge-inquiry",    label: "Inquiry" },
          QUOTED:     { class: "badge badge-quoted",     label: "Quoted" },
          CONTRACTED: { class: "badge badge-contracted", label: "Contracted" },
          CONFIRMED:  { class: "badge badge-confirmed",  label: "Confirmed" },
          COMPLETED:  { class: "badge badge-completed",  label: "Completed" },
          CANCELLED:  { class: "badge badge-cancelled",  label: "Cancelled" },
    };
    return map[status] ?? { class: "badge badge-inquiry", label: status };
}

export function getInvoiceStatusBadge(status: InvoiceStatus): StatusBadge {
    const map: Record<InvoiceStatus, StatusBadge> = {
          DRAFT:   { class: "badge badge-draft",   label: "Draft" },
          SENT:    { class: "badge badge-sent",    label: "Sent" },
          PAID:    { class: "badge badge-paid",    label: "Paid" },
          OVERDUE: { class: "badge badge-overdue", label: "Overdue" },
          VOID:    { class: "badge badge-void",    label: "Void" },
    };
    return map[status] ?? { class: "badge badge-draft", label: status };
}

export function getPaymentStatusBadge(status: PaymentStatus): StatusBadge {
    const map: Record<PaymentStatus, StatusBadge> = {
          PENDING: { class: "badge badge-pending", label: "Pending" },
          PAID:    { class: "badge badge-paid",    label: "Paid" },
          OVERDUE: { class: "badge badge-overdue", label: "Overdue" },
          WAIVED:  { class: "badge badge-draft",   label: "Waived" },
    };
    return map[status] ?? { class: "badge badge-pending", label: status };
}

export function formatServiceType(type: ServiceType): string {
    const map: Record<ServiceType, string> = {
          WEDDING:  "Wedding",
          EVENT:    "Event",
          PORTRAIT: "Portrait",
    };
    return map[type] ?? type;
}

export function formatBookingStatus(status: BookingStatus): string {
    return status.charAt(0) + status.slice(1).toLowerCase();
}

// Invoice number generator
export function generateInvoiceNumber(sequence: number): string {
    const year = new Date().getFullYear();
    return `INV-${year}-${String(sequence).padStart(3, "0")}`;
}

// Phone formatting (Australian)
export function formatPhone(phone: string | null | undefined): string {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("04")) {
          return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    return phone;
}

// Public app URL for links embedded in outgoing emails (signing links, invoice
// links, calendar descriptions, etc).
// NEXT_PUBLIC_APP_URL is meant to be "http://localhost:3000" only during local
// dev. If it's ever misconfigured to localhost in the deployed environment
// (e.g. copied from a local .env into Vercel by mistake), client-facing emails
// would silently contain dead links. Guard against that here instead of
// trusting the env var blindly.
export function getAppUrl(): string {
    const PROD_URL = "https://jnguyenco-crm.vercel.app";
    const raw = process.env.NEXT_PUBLIC_APP_URL;
    const isDeployed = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (isDeployed) {
        if (!raw || raw.includes("localhost")) return PROD_URL;
        return raw;
  }
    return raw ?? "http://localhost:3000";
}

// API response helpers
export function apiSuccess<T>(data: T, status = 200) {
    return Response.json({ data }, { status });
}

export function apiError(message: string, status = 400) {
    return Response.json({ error: message }, { status });
}
