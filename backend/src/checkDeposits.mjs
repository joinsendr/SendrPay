import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL, DEPOSIT_ADDRESS, STELLAR_NETWORK, USDC_ISSUER } from "./config.mjs";
import { validateDepositOperation } from "./depositValidation.mjs";
import { putEntryIfAbsent } from "./ledger.mjs";

const server = new Horizon.Server(HORIZON_URL);

/**
 * Polls Horizon testnet for recent payment operations to our deposit
 * address, validates each one (asset code + issuer + success + amount),
 * and idempotently inserts newly-confirmed deposits into the ledger.
 * Safe to call repeatedly/concurrently — already-seen transactions are
 * rejected by DynamoDB's conditional put, not by in-memory state.
 */
export async function checkDeposits() {
  if (!DEPOSIT_ADDRESS) {
    throw new Error("STELLAR_DEPOSIT_ADDRESS is not configured");
  }

  const page = await server.payments().forAccount(DEPOSIT_ADDRESS).order("desc").limit(50).call();
  const newlyCredited = [];
  const rejected = [];

  for (const op of page.records) {
    // Horizon's payment-ops response doesn't include transaction success
    // directly on older SDK versions — fetch it explicitly rather than
    // assume success, per the explicit "verify the transaction succeeded
    // before marking Confirmed" requirement.
    let txSuccessful = op.transaction_successful;
    if (txSuccessful === undefined) {
      const tx = await op.transaction();
      txSuccessful = tx.successful;
    }
    const check = validateDepositOperation({ ...op, transaction_successful: txSuccessful });

    if (!check.valid) {
      if (op.to === DEPOSIT_ADDRESS) rejected.push({ txHash: op.transaction_hash, reason: check.reason });
      continue;
    }

    const now = new Date().toISOString();
    const entry = {
      entryId: `stellar:${op.transaction_hash}`,
      type: "stellar_deposit",
      status: "confirmed",
      amountUsdc: check.amountUsdc,
      txHash: op.transaction_hash,
      stellarNetwork: STELLAR_NETWORK,
      assetIssuer: USDC_ISSUER,
      destination: DEPOSIT_ADDRESS,
      source: op.from,
      createdAt: op.created_at ?? now,
      confirmedAt: now,
    };
    const inserted = await putEntryIfAbsent(entry);
    if (inserted) newlyCredited.push(entry);
  }

  return { newlyCredited, rejected, checkedAt: new Date().toISOString() };
}
