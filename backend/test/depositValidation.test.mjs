import { test } from "node:test";
import assert from "node:assert/strict";

// Set before the dynamic import so config.mjs picks it up at module init —
// a static top-of-file import would run before this line executes.
process.env.STELLAR_DEPOSIT_ADDRESS = "GDEPOSITADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const { validateDepositOperation, computeBalance } = await import("../src/depositValidation.mjs");
const { USDC_ISSUER, DEPOSIT_ADDRESS } = await import("../src/config.mjs");

function baseOp(overrides = {}) {
  return {
    type: "payment",
    to: DEPOSIT_ADDRESS,
    from: "GSENDERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    transaction_successful: true,
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: USDC_ISSUER,
    amount: "25.5000000",
    transaction_hash: "abc123",
    ...overrides,
  };
}

test("accepts a valid USDC payment to our address", () => {
  const result = validateDepositOperation(baseOp());
  assert.equal(result.valid, true);
  assert.equal(result.amountUsdc, 25.5);
});

test("rejects a payment to a different destination", () => {
  const result = validateDepositOperation(baseOp({ to: "GSOMEONEELSEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "wrong_destination");
});

test("rejects a failed transaction", () => {
  const result = validateDepositOperation(baseOp({ transaction_successful: false }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "transaction_not_successful");
});

test("rejects native XLM (not an asset payment at all)", () => {
  const result = validateDepositOperation(baseOp({ asset_type: "native", asset_code: undefined, asset_issuer: undefined }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "wrong_asset_native_xlm");
});

test("rejects an asset that isn't code USDC", () => {
  const result = validateDepositOperation(baseOp({ asset_code: "USDT" }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "wrong_asset_code");
});

test("rejects USDC from an unrecognized issuer — the critical anti-spoofing check", () => {
  const result = validateDepositOperation(
    baseOp({ asset_issuer: "GFAKEISSUERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" })
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "wrong_asset_issuer");
});

test("rejects a zero or invalid amount", () => {
  assert.equal(validateDepositOperation(baseOp({ amount: "0" })).valid, false);
  assert.equal(validateDepositOperation(baseOp({ amount: "not-a-number" })).valid, false);
});

test("rejects a non-payment operation type", () => {
  const result = validateDepositOperation(baseOp({ type: "create_account" }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "not_a_payment_operation");
});

test("computeBalance sums only confirmed entries, credits and debits both", () => {
  const entries = [
    { status: "confirmed", amountUsdc: 100 },
    { status: "confirmed", amountUsdc: -30 },
    { status: "pending", amountUsdc: 9999 },
    { status: "failed", amountUsdc: 9999 },
    { status: "reversed", amountUsdc: 9999 },
  ];
  assert.equal(computeBalance(entries), 70);
});

test("computeBalance returns 0 for an empty ledger", () => {
  assert.equal(computeBalance([]), 0);
});
