import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Integration tests — these exercise the real DynamoDB-backed orchestrator
// (consistent with how this backend already tests, via live AWS resources
// rather than mocks). They run against DEDICATED test tables, never the
// tables backing the live demo wallet at sendrpay.sendr.cash — otherwise
// every test run would leave real "UPI Payment" entries in the ledger
// judges will actually look at. Requires AWS credentials with access to
// sendrpay_ledger_test / sendrpay_payments_test (provisioned alongside the
// production tables).
process.env.LEDGER_TABLE = "sendrpay_ledger_test";
process.env.PAYMENTS_TABLE = "sendrpay_payments_test";
process.env.STELLAR_DEPOSIT_ADDRESS = "GDEPOSITADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const { createPayment, confirmPayment, cancelPayment, reversePayment, getPayment } = await import("../src/payments.mjs");
const { putEntryIfAbsent, listEntries } = await import("../src/ledger.mjs");
const { computeBalance } = await import("../src/depositValidation.mjs");
const { MOCK_USDC_RATE, UPI_FEE_RATE } = await import("../src/config.mjs");

// Every test needs wallet balance to draw against — seed a one-off
// simulated-fiat credit per test file run instead of depending on
// whatever's already in the (empty, dedicated) test table.
await putEntryIfAbsent({
  entryId: `sim:seed-${randomUUID()}`,
  type: "simulated_fiat",
  status: "confirmed",
  amountUsdc: 1000,
  txHash: null,
  originalAmount: 1000,
  originalCurrency: "USD",
  method: "test-seed",
  createdAt: new Date().toISOString(),
  confirmedAt: new Date().toISOString(),
});

function expectedUsdc(amountInr) {
  const amountUsdc = amountInr * MOCK_USDC_RATE.INR;
  const feeUsdc = amountUsdc * UPI_FEE_RATE;
  return { amountUsdc, feeUsdc, totalUsdc: amountUsdc + feeUsdc };
}

test("creates a payment from a valid QR with a fixed amount and quotes it correctly", async () => {
  const paymentId = randomUUID();
  const payment = await createPayment({
    paymentId,
    qrData: "upi://pay?pa=merchant@okaxis&pn=Test%20Merchant&am=100&cu=INR&tn=Order1",
  });
  assert.equal(payment.status, "awaiting_confirmation");
  assert.equal(payment.vpa, "merchant@okaxis");
  assert.equal(payment.payeeName, "Test Merchant");
  assert.equal(payment.amountInr, 100);
  const expected = expectedUsdc(100);
  assert.ok(Math.abs(payment.totalUsdc - expected.totalUsdc) < 1e-6);
});

test("creates a payment from a QR with no fixed amount, using the user-entered amount", async () => {
  const paymentId = randomUUID();
  const payment = await createPayment({
    paymentId,
    qrData: "upi://pay?pa=merchant@okaxis&pn=Test%20Merchant",
    amountInr: 50,
  });
  assert.equal(payment.status, "awaiting_confirmation");
  assert.equal(payment.amountInr, 50);
});

test("rejects invalid QR data and does not create a payable payment", async () => {
  const paymentId = randomUUID();
  const payment = await createPayment({ paymentId, qrData: "not a upi uri" });
  assert.equal(payment.status, "failed");
  assert.ok(payment.failureReason);
});

test("rejects an amount that exceeds the current wallet balance", async () => {
  const paymentId = randomUUID();
  const payment = await createPayment({
    paymentId,
    qrData: "upi://pay?pa=merchant@okaxis&am=999999999&cu=INR",
  });
  assert.equal(payment.status, "failed");
  assert.equal(payment.failureReason, "insufficient_balance");
});

test("a duplicate create request with the same paymentId returns the original, not a new payment", async () => {
  const paymentId = randomUUID();
  const first = await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=10&cu=INR" });
  // Second call uses a different amount — if idempotency worked, this must be ignored.
  const second = await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=99999&cu=INR" });
  assert.equal(second.validatedAt, first.validatedAt);
  assert.equal(second.amountInr, 10);
});

test("confirming a valid payment with a simulated successful payout credits a ledger debit", async () => {
  const paymentId = randomUUID();
  const created = await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=10&cu=INR" });
  const before = computeBalance(await listEntries());

  const confirmed = await confirmPayment(paymentId, { forceOutcome: "success" });
  assert.equal(confirmed.status, "succeeded");
  assert.equal(confirmed.payoutStatus, "success");
  assert.ok(confirmed.payoutReference.startsWith("SIMPAYOUT-"));
  assert.equal(confirmed.ledgerEntryId, `upi:${paymentId}`);

  const after = computeBalance(await listEntries());
  assert.ok(Math.abs(before - after - created.totalUsdc) < 1e-6);
});

test("confirming an already-succeeded payment is idempotent — no reprocessing", async () => {
  const paymentId = randomUUID();
  await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=5&cu=INR" });
  const first = await confirmPayment(paymentId, { forceOutcome: "success" });
  const second = await confirmPayment(paymentId, { forceOutcome: "success" });
  assert.equal(second.succeededAt, first.succeededAt);
  assert.equal(second.payoutReference, first.payoutReference);
});

test("a simulated payout failure leaves the payment failed with no ledger deduction", async () => {
  const paymentId = randomUUID();
  await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=5&cu=INR" });
  const before = computeBalance(await listEntries());

  const result = await confirmPayment(paymentId, { forceOutcome: "failure" });
  assert.equal(result.status, "failed");
  assert.equal(result.payoutStatus, "failed");
  assert.equal(result.ledgerEntryId, null);

  const after = computeBalance(await listEntries());
  assert.equal(before, after);
});

test("cancelling an awaiting_confirmation payment prevents it from ever being confirmed", async () => {
  const paymentId = randomUUID();
  await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=5&cu=INR" });
  const cancelled = await cancelPayment(paymentId);
  assert.equal(cancelled.status, "cancelled");

  const afterConfirmAttempt = await confirmPayment(paymentId, { forceOutcome: "success" });
  assert.equal(afterConfirmAttempt.status, "cancelled");
  assert.equal(afterConfirmAttempt.ledgerEntryId, null);
});

test("reversing a succeeded payment credits back the full deducted amount", async () => {
  const paymentId = randomUUID();
  const created = await createPayment({ paymentId, qrData: "upi://pay?pa=merchant@okaxis&am=8&cu=INR" });
  await confirmPayment(paymentId, { forceOutcome: "success" });
  const afterConfirm = computeBalance(await listEntries());

  const reversed = await reversePayment(paymentId);
  assert.equal(reversed.status, "reversed");

  const afterReversal = computeBalance(await listEntries());
  assert.ok(Math.abs(afterReversal - afterConfirm - created.totalUsdc) < 1e-6);
});

test("getPayment returns null for an unknown id", async () => {
  const result = await getPayment(randomUUID());
  assert.equal(result, null);
});
