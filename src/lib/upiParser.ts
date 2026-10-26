// Client-side mirror of the backend's UPI URI parser (backend/src/upi.mjs).
// Used ONLY to decide what the review screen should show immediately after
// a scan (e.g. whether to ask the user for an amount) — the backend
// re-parses the raw QR payload itself and is the sole authority on what
// actually gets charged. Never trust this parse for the amount that's
// actually sent to the create-payment call; always send the raw qrData
// alongside it.
const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa);
}

export interface ParsedUpi {
  valid: boolean;
  reason?: string;
  vpa?: string;
  payeeName?: string | null;
  amountInr?: number | null;
  note?: string | null;
}

export function parseUpiUri(raw: string): ParsedUpi {
  if (!raw || raw.trim().length === 0) return { valid: false, reason: "empty_qr_data" };

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { valid: false, reason: "not_a_valid_uri" };
  }

  if (url.protocol !== "upi:") return { valid: false, reason: "unsupported_scheme" };
  if (url.hostname !== "pay" && url.pathname.replace(/^\/+/, "") !== "pay") {
    return { valid: false, reason: "unsupported_upi_action" };
  }

  const params = url.searchParams;
  const vpa = params.get("pa");
  if (!vpa || !VPA_PATTERN.test(vpa)) return { valid: false, reason: "missing_or_invalid_payee_vpa" };

  const currency = params.get("cu") || "INR";
  if (currency !== "INR") return { valid: false, reason: "unsupported_currency" };

  let amountInr: number | null = null;
  const amRaw = params.get("am");
  if (amRaw) {
    const parsed = Number(amRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) return { valid: false, reason: "invalid_amount" };
    amountInr = parsed;
  }

  return {
    valid: true,
    vpa,
    payeeName: params.get("pn") || null,
    amountInr,
    note: params.get("tn") || null,
  };
}
