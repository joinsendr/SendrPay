import { USDC_ASSET_CODE, USDC_ISSUER, DEPOSIT_ADDRESS } from "./config.mjs";

/**
 * Pure function: given a Horizon payment-operation record, decides whether
 * it's a valid, creditable USDC deposit to our address. Kept separate from
 * any network/DB calls so it's directly unit-testable with fixture data —
 * this is the one function that MUST reject anything that isn't exactly
 * "a successful incoming payment, asset code USDC, issued by the configured
 * issuer, sent to our configured deposit address."
 *
 * @param {object} op - a Horizon payment operation record (the shape returned
 *   by `server.payments().forAccount(...).call()`), expected to also carry a
 *   `transaction_successful` boolean (joined in by the caller).
 * @returns {{ valid: true, amountUsdc: number } | { valid: false, reason: string }}
 */
export function validateDepositOperation(op) {
  if (!op || op.type !== "payment") {
    return { valid: false, reason: "not_a_payment_operation" };
  }
  if (op.to !== DEPOSIT_ADDRESS) {
    return { valid: false, reason: "wrong_destination" };
  }
  if (op.transaction_successful !== true) {
    return { valid: false, reason: "transaction_not_successful" };
  }
  if (op.asset_type === "native") {
    return { valid: false, reason: "wrong_asset_native_xlm" };
  }
  if (op.asset_code !== USDC_ASSET_CODE) {
    return { valid: false, reason: "wrong_asset_code" };
  }
  if (op.asset_issuer !== USDC_ISSUER) {
    // This is the critical check the brief calls out explicitly: a token
    // that merely calls itself "USDC" from an unrecognized issuer must
    // never be credited.
    return { valid: false, reason: "wrong_asset_issuer" };
  }
  const amountUsdc = parseFloat(op.amount);
  if (!(amountUsdc > 0) || !Number.isFinite(amountUsdc)) {
    return { valid: false, reason: "invalid_amount" };
  }
  return { valid: true, amountUsdc };
}

/**
 * Computes the wallet's USDC balance from confirmed ledger entries only —
 * never trusts a client-supplied balance. Credits (stellar_deposit,
 * simulated_fiat) are stored as positive amountUsdc; debits
 * (simulated_payment) as negative. Pending/failed/reversed entries never
 * contribute.
 */
export function computeBalance(entries) {
  return entries
    .filter((e) => e.status === "confirmed")
    .reduce((sum, e) => sum + e.amountUsdc, 0);
}
