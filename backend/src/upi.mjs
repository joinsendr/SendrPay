// Parses UPI deep-link payment URIs (the standard scheme Indian payment
// apps encode into merchant/person QR codes), e.g.:
//   upi://pay?pa=merchant@okaxis&pn=Example%20Store&am=250.00&cu=INR&tn=Order%20123
//
// We only ever use this to populate a review screen and a payment record —
// we never execute a real UPI payment ourselves (no provider is connected),
// so this module's only job is extracting and sanity-checking the fields a
// human needs to review before confirming a simulated payout.

const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

export function isValidVpa(vpa) {
  return typeof vpa === "string" && VPA_PATTERN.test(vpa);
}

/**
 * @param {string} raw - the raw decoded QR payload (any string).
 * @returns {{ valid: true, vpa: string, payeeName: string|null, amountInr: number|null, currency: string, note: string|null }
 *          | { valid: false, reason: string }}
 */
export function parseUpiUri(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { valid: false, reason: "empty_qr_data" };
  }

  let url;
  try {
    // Some UPI QR payloads use "upi://" (a valid URL the WHATWG parser
    // handles fine) — parse directly rather than string-splitting, so we
    // correctly handle encoded characters, repeated params, etc.
    url = new URL(raw.trim());
  } catch {
    return { valid: false, reason: "not_a_valid_uri" };
  }

  if (url.protocol !== "upi:") {
    return { valid: false, reason: "unsupported_scheme" };
  }

  // Only "pay" is a payment intent; UPI also defines other actions
  // (e.g. "mandate") we don't support and must not treat as payable.
  if (url.hostname !== "pay" && url.pathname.replace(/^\/+/, "") !== "pay") {
    return { valid: false, reason: "unsupported_upi_action" };
  }

  const params = url.searchParams;
  const vpa = params.get("pa");
  if (!vpa || !VPA_PATTERN.test(vpa)) {
    return { valid: false, reason: "missing_or_invalid_payee_vpa" };
  }

  const currency = params.get("cu") || "INR";
  if (currency !== "INR") {
    // UPI is INR-only in practice; reject anything claiming otherwise
    // rather than silently treating it as INR.
    return { valid: false, reason: "unsupported_currency" };
  }

  let amountInr = null;
  const amRaw = params.get("am");
  if (amRaw !== null && amRaw !== "") {
    const parsed = Number(amRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { valid: false, reason: "invalid_amount" };
    }
    amountInr = parsed;
  }

  return {
    valid: true,
    vpa,
    payeeName: params.get("pn") || null,
    amountInr, // null means the QR had no fixed amount — caller must collect one
    currency,
    note: params.get("tn") || null,
  };
}
