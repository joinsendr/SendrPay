import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateIndiaPayout } from "../src/indiaPayoutAdapter.mjs";

test("simulated payout success path returns a payout reference", async () => {
  const result = await simulateIndiaPayout({ vpa: "someone@okaxis", amountInr: 100, paymentId: "test-payment-1", forceOutcome: "success" });
  assert.equal(result.success, true);
  assert.ok(result.payoutReference.startsWith("SIMPAYOUT-"));
  assert.ok(result.timestamp);
});

test("simulated payout failure path returns a failure reason, no real reference", async () => {
  const result = await simulateIndiaPayout({ vpa: "someone@okaxis", amountInr: 100, paymentId: "test-payment-2", forceOutcome: "failure" });
  assert.equal(result.success, false);
  assert.equal(result.failureReason, "simulated_payout_declined");
});
