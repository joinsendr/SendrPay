// Payment orchestrator — manages the full lifecycle of a UPI payment from
// a scanned/entered QR through to a simulated India-side payout and (only
// on success) a real ledger deduction.
//
// State machine: created -> validated -> awaiting_confirmation -> processing
//                -> succeeded | failed  (succeeded -> reversed is separate)
//                any of created/validated/awaiting_confirmation -> cancelled
//
// "created" and "validated" are transient — createPayment() runs both
// synchronously and persists the resulting "awaiting_confirmation" (or
// "failed", if validation fails) record in one step; validatedAt/createdAt
// timestamps record that those stages happened. Only awaiting_confirmation
// onward are states a client will ever see as the *current* status.
//
// Idempotency: paymentId is caller-supplied and doubles as the idempotency
// key for creation (a conditional put — a retried create for the same key
// returns the existing record rather than creating a duplicate or
// re-validating against a balance that may have since changed). Status
// transitions use conditional updates so a double-submitted confirm can
// only ever move the state machine forward once.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PAYMENTS_TABLE, MOCK_USDC_RATE, UPI_FEE_RATE } from "./config.mjs";
import { parseUpiUri, isValidVpa } from "./upi.mjs";
import { listEntries, putEntryIfAbsent } from "./ledger.mjs";
import { computeBalance } from "./depositValidation.mjs";
import { simulateIndiaPayout } from "./indiaPayoutAdapter.mjs";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

// Single shared demo wallet — there is no authentication system in this
// prototype (documented known limitation), so every payment is associated
// with this constant rather than a real per-user identity.
const USER_ID = "demo-wallet";

function round7(n) {
  return Math.round(n * 1e7) / 1e7;
}

export async function getPayment(paymentId) {
  const res = await doc.send(new GetCommand({ TableName: PAYMENTS_TABLE, Key: { paymentId } }));
  return res.Item ?? null;
}

async function putIfAbsent(payment) {
  try {
    await doc.send(
      new PutCommand({
        TableName: PAYMENTS_TABLE,
        Item: payment,
        ConditionExpression: "attribute_not_exists(paymentId)",
      })
    );
    return payment;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return getPayment(payment.paymentId);
    throw err;
  }
}

/**
 * @param {{
 *   paymentId: string,            // caller-supplied idempotency key
 *   qrData?: string,              // raw decoded QR payload, if scanned
 *   vpa?: string,                 // manual entry, used only when qrData absent
 *   payeeName?: string,
 *   amountInr?: number|string,    // required if the QR had no fixed amount
 *   note?: string,
 * }} input
 */
export async function createPayment({ paymentId, qrData, vpa: manualVpa, payeeName: manualPayeeName, amountInr: manualAmountInr, note }) {
  if (!paymentId || typeof paymentId !== "string") {
    throw new Error("paymentId (idempotency key) is required");
  }

  const now = new Date().toISOString();
  let vpa = null;
  let payeeName = null;
  let amountInr = null;
  let resolvedNote = note ?? null;
  let rejectReason = null;

  if (qrData) {
    const parsed = parseUpiUri(qrData);
    if (!parsed.valid) {
      rejectReason = parsed.reason;
    } else {
      vpa = parsed.vpa;
      payeeName = parsed.payeeName;
      resolvedNote = parsed.note ?? resolvedNote;
      // The QR's own amount is authoritative when present. Only fall back
      // to a user-entered amount when the QR had none — a user can never
      // override an amount the QR itself specified.
      amountInr = parsed.amountInr ?? (manualAmountInr != null && manualAmountInr !== "" ? Number(manualAmountInr) : null);
    }
  } else {
    vpa = typeof manualVpa === "string" ? manualVpa : null;
    payeeName = manualPayeeName ?? null;
    amountInr = manualAmountInr != null && manualAmountInr !== "" ? Number(manualAmountInr) : null;
    if (!isValidVpa(vpa)) rejectReason = "missing_or_invalid_payee_vpa";
  }

  const base = {
    paymentId,
    userId: USER_ID,
    destinationType: "upi",
    vpa,
    payeeName,
    note: resolvedNote,
    createdAt: now,
  };

  if (!rejectReason && !isValidVpa(vpa)) rejectReason = "missing_or_invalid_payee_vpa";
  if (!rejectReason && !(amountInr > 0)) rejectReason = "missing_or_invalid_amount";

  if (rejectReason) {
    return putIfAbsent({
      ...base,
      status: "failed",
      amountInr: amountInr ?? null,
      quotedRateInrPerUsdc: null,
      amountUsdc: null,
      feeUsdc: null,
      totalUsdc: null,
      ledgerEntryId: null,
      payoutReference: null,
      payoutStatus: null,
      failedAt: now,
      failureReason: rejectReason,
    });
  }

  // Same illustrative INR<->USDC rate used everywhere else in the app
  // (deposit funding, the generic Pay flow) — kept consistent rather than
  // inventing a second rate just for this flow.
  const rate = MOCK_USDC_RATE.INR; // USDC per 1 INR
  const amountUsdc = round7(amountInr * rate);
  const feeUsdc = round7(amountUsdc * UPI_FEE_RATE);
  const totalUsdc = round7(amountUsdc + feeUsdc);

  const balance = computeBalance(await listEntries());
  if (totalUsdc > balance) {
    return putIfAbsent({
      ...base,
      status: "failed",
      amountInr,
      quotedRateInrPerUsdc: round7(1 / rate),
      amountUsdc,
      feeUsdc,
      totalUsdc,
      ledgerEntryId: null,
      payoutReference: null,
      payoutStatus: null,
      failedAt: now,
      failureReason: "insufficient_balance",
    });
  }

  return putIfAbsent({
    ...base,
    status: "awaiting_confirmation",
    amountInr,
    quotedRateInrPerUsdc: round7(1 / rate),
    amountUsdc,
    feeUsdc,
    totalUsdc,
    validatedAt: now,
    ledgerEntryId: null,
    payoutReference: null,
    payoutStatus: null,
    failureReason: null,
  });
}

/**
 * Moves a payment from awaiting_confirmation through processing to a
 * terminal succeeded/failed state, calling the (simulated) India payout
 * adapter and — only on payout success — writing the real ledger debit.
 * `forceOutcome` is test-only, letting tests deterministically exercise
 * both the success and failure branches instead of relying on the
 * adapter's randomness.
 */
export async function confirmPayment(paymentId, { forceOutcome } = {}) {
  const existing = await getPayment(paymentId);
  if (!existing) return null;

  // Idempotent no-op if this payment already moved past this state —
  // covers both "already fully processed" and "a concurrent confirm call
  // is already handling it".
  if (existing.status !== "awaiting_confirmation") return existing;

  const startedAt = new Date().toISOString();
  try {
    await doc.send(
      new UpdateCommand({
        TableName: PAYMENTS_TABLE,
        Key: { paymentId },
        UpdateExpression: "SET #status = :processing, processingAt = :now",
        ConditionExpression: "#status = :awaiting",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "processing", ":awaiting": "awaiting_confirmation", ":now": startedAt },
      })
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return getPayment(paymentId);
    throw err;
  }

  // Re-check balance immediately before committing the deduction. This
  // narrows (does not fully eliminate, at this prototype's single-table
  // scan-based balance scale) the race window against another concurrent
  // payment from the same wallet — a known limitation, not a production
  // guarantee.
  const balance = computeBalance(await listEntries());
  if (existing.totalUsdc > balance) {
    await doc.send(
      new UpdateCommand({
        TableName: PAYMENTS_TABLE,
        Key: { paymentId },
        UpdateExpression: "SET #status = :failed, failedAt = :now, failureReason = :reason",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":failed": "failed", ":now": new Date().toISOString(), ":reason": "insufficient_balance" },
      })
    );
    return getPayment(paymentId);
  }

  const payout = await simulateIndiaPayout({ vpa: existing.vpa, amountInr: existing.amountInr, paymentId, forceOutcome });

  if (!payout.success) {
    await doc.send(
      new UpdateCommand({
        TableName: PAYMENTS_TABLE,
        Key: { paymentId },
        UpdateExpression:
          "SET #status = :failed, failedAt = :now, payoutStatus = :payoutStatus, payoutReference = :ref, failureReason = :reason",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":failed": "failed",
          ":now": payout.timestamp,
          ":payoutStatus": "failed",
          ":ref": payout.payoutReference,
          ":reason": payout.failureReason,
        },
      })
    );
    return getPayment(paymentId);
  }

  // Payout succeeded — commit the deduction as a real ledger entry. Using
  // the paymentId as the ledger idempotency key means this specific
  // payment's deduction can never be written twice, even if confirm were
  // somehow invoked concurrently past the processing-state guard above.
  const ledgerEntry = {
    entryId: `upi:${paymentId}`,
    type: "upi_payment",
    status: "confirmed",
    amountUsdc: -existing.totalUsdc,
    txHash: null,
    originalAmount: existing.amountInr,
    originalCurrency: "INR",
    method: "UPI",
    country: "India",
    vpa: existing.vpa,
    payeeName: existing.payeeName,
    paymentId,
    payoutReference: payout.payoutReference,
    createdAt: existing.createdAt,
    confirmedAt: payout.timestamp,
  };
  await putEntryIfAbsent(ledgerEntry);

  await doc.send(
    new UpdateCommand({
      TableName: PAYMENTS_TABLE,
      Key: { paymentId },
      UpdateExpression:
        "SET #status = :succeeded, succeededAt = :now, payoutStatus = :payoutStatus, payoutReference = :ref, ledgerEntryId = :entryId",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":succeeded": "succeeded",
        ":now": payout.timestamp,
        ":payoutStatus": "success",
        ":ref": payout.payoutReference,
        ":entryId": ledgerEntry.entryId,
      },
    })
  );

  return getPayment(paymentId);
}

export async function cancelPayment(paymentId) {
  const existing = await getPayment(paymentId);
  if (!existing) return null;
  if (existing.status !== "awaiting_confirmation") return existing; // not cancellable from here (already processing/terminal)

  const now = new Date().toISOString();
  try {
    await doc.send(
      new UpdateCommand({
        TableName: PAYMENTS_TABLE,
        Key: { paymentId },
        UpdateExpression: "SET #status = :cancelled, cancelledAt = :now",
        ConditionExpression: "#status = :awaiting",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":cancelled": "cancelled", ":awaiting": "awaiting_confirmation", ":now": now },
      })
    );
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }
  return getPayment(paymentId);
}

/** Reverses a succeeded payment by crediting back what it deducted. Demo-grade — no separate approval gate, consistent with this prototype having no auth system. */
export async function reversePayment(paymentId) {
  const existing = await getPayment(paymentId);
  if (!existing) return null;
  if (existing.status !== "succeeded") return existing;

  const now = new Date().toISOString();
  try {
    await doc.send(
      new UpdateCommand({
        TableName: PAYMENTS_TABLE,
        Key: { paymentId },
        UpdateExpression: "SET #status = :reversed, reversedAt = :now",
        ConditionExpression: "#status = :succeeded",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":reversed": "reversed", ":succeeded": "succeeded", ":now": now },
      })
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return getPayment(paymentId);
    throw err;
  }

  const reversalEntry = {
    entryId: `upi-reversal:${paymentId}`,
    type: "upi_payment_reversal",
    status: "confirmed",
    amountUsdc: existing.totalUsdc,
    txHash: null,
    paymentId,
    createdAt: now,
    confirmedAt: now,
  };
  await putEntryIfAbsent(reversalEntry);

  return getPayment(paymentId);
}
