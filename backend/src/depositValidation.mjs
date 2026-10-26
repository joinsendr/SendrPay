import { USDC_ASSET_CODE, USDC_ISSUER, DEPOSIT_ADDRESS } from "./config.mjs";

/**
 * Pure function: given a Horizon payment-operation record, decides whether
 * it's a valid, creditable deposit to our address. Kept separate from any
 * network/DB calls so it's directly unit-testable with fixture data.
 *
 * Two assets are accepted to the same deposit address:
 *   - Native XLM (Stellar's own asset — no issuer to check).
 *   - USDC issued by the exact configured issuer. A token that merely
 *     calls itself "USDC" from an unrecognized issuer must never be
 *     credited — this is the critical anti-spoofing check.
 * Anything else (any other asset code/issuer) is rejected outright; this
 * function never guesses at crediting an unrecognized asset.
 *
 * @param {object} op - a Horizon payment operation record (the shape returned
 *   by `server.payments().forAccount(...).call()`), expected to also carry a
 *   `transaction_successful` boolean (joined in by the caller).
 * @returns {{ valid: true, assetCode: "XLM"|"USDC", amount: number } | { valid: false, reason: string }}
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

  const amount = parseFloat(op.amount);
  if (!(amount > 0) || !Number.isFinite(amount)) {
    return { valid: false, reason: "invalid_amount" };
  }

  if (op.asset_type === "native") {
    return { valid: true, assetCode: "XLM", amount };
  }
  if (op.asset_code !== USDC_ASSET_CODE) {
    return { valid: false, reason: "wrong_asset_code" };
  }
  if (op.asset_issuer !== USDC_ISSUER) {
    return { valid: false, reason: "wrong_asset_issuer" };
  }
  return { valid: true, assetCode: "USDC", amount };
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
