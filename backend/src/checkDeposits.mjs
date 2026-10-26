import { Horizon } from "@stellar/stellar-sdk";
import {
  HORIZON_URL, DEPOSIT_ADDRESS, STELLAR_NETWORK, USDC_ISSUER, XLM_USDC_RATE, FIAT_CONVERSION_FEE_RATE,
} from "./config.mjs";
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

    // USDC is credited 1:1, no conversion, no fee. A native XLM deposit is
    // converted to its USDC-equivalent and carries the same conversion fee
    // every other non-USDC funding path charges — only a direct USDC
    // deposit is ever fee-free.
    let amountUsdc, feeUsdc, feeRate;
    if (check.assetCode === "USDC") {
      amountUsdc = check.amount;
      feeUsdc = 0;
      feeRate = 0;
    } else {
      const grossUsdc = check.amount * XLM_USDC_RATE;
      feeUsdc = grossUsdc * FIAT_CONVERSION_FEE_RATE;
      amountUsdc = grossUsdc - feeUsdc;
      feeRate = FIAT_CONVERSION_FEE_RATE;
    }

    const entry = {
      entryId: `stellar:${op.transaction_hash}`,
      type: "stellar_deposit",
      status: "confirmed",
      amountUsdc,
      feeUsdc,
      feeRate,
      assetCode: check.assetCode,
      originalAmount: check.amount,
      originalAsset: check.assetCode,
      quotedRate: check.assetCode === "XLM" ? XLM_USDC_RATE : 1,
      txHash: op.transaction_hash,
      stellarNetwork: STELLAR_NETWORK,
      assetIssuer: check.assetCode === "USDC" ? USDC_ISSUER : null,
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
