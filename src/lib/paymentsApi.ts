// Client for the payment orchestrator endpoints (UPI QR payments). See
// backend/src/payments.mjs for the full state machine this mirrors.
import { request } from "./api";

const API_BASE = "https://govki2oce0.execute-api.us-east-1.amazonaws.com";

export type PaymentStatus =
  | "awaiting_confirmation"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "reversed";

export interface Payment {
  paymentId: string;
  userId: string;
  destinationType: "upi";
  status: PaymentStatus;
  vpa: string | null;
  payeeName: string | null;
  note: string | null;
  amountInr: number | null;
  quotedRateInrPerUsdc: number | null;
  amountUsdc: number | null;
  feeUsdc: number | null;
  totalUsdc: number | null;
  ledgerEntryId: string | null;
  payoutReference: string | null;
  payoutStatus: "success" | "failed" | null;
  failureReason: string | null;
  createdAt: string;
  validatedAt?: string;
  processingAt?: string;
  succeededAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  reversedAt?: string;
}

export interface CreatePaymentInput {
  paymentId: string;
  qrData?: string;
  vpa?: string;
  payeeName?: string;
  amountInr?: number;
  note?: string;
}

// Create returns a payment body on BOTH success (201, awaiting_confirmation)
// and a rejected quote (400, status "failed" with a failureReason) — both
// are "we got a payment record back", so this doesn't throw on 400 the way
// the generic request() helper would; it throws only on a response with no
// usable payment body at all (network error, 5xx, malformed JSON).
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const res = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!body?.payment) {
    throw Object.assign(new Error(body?.error ?? `HTTP ${res.status}`), { status: res.status, body });
  }
  return body.payment as Payment;
}

export interface ConfirmPaymentResult {
  payment: Payment;
  balanceUsdc: number;
}

export const confirmPayment = (paymentId: string) =>
  request<ConfirmPaymentResult>(`/payments/${paymentId}/confirm`, { method: "POST" });

export const cancelPayment = (paymentId: string) =>
  request<{ payment: Payment }>(`/payments/${paymentId}/cancel`, { method: "POST" }).then((r) => r.payment);

export const getPayment = (paymentId: string) =>
  request<{ payment: Payment }>(`/payments/${paymentId}`).then((r) => r.payment);
