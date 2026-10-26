// Provider abstraction for the India-side payout leg of a UPI payment.
//
// No real payout provider is connected for this hackathon build. This
// adapter simulates the outcome of a UPI payout so the rest of the
// orchestrator (ledger debit, receipt, status lifecycle) can be built and
// tested against a stable interface — swapping in a real licensed payout
// provider later means implementing this same function shape against their
// API, nothing upstream needs to change.
//
// This NEVER sends real INR and NEVER claims to execute a real UPI payment.

import { randomUUID } from "node:crypto";

/**
 * @param {{ vpa: string, amountInr: number, paymentId: string, forceOutcome?: "success"|"failure" }} input
 * @returns {Promise<{ success: boolean, payoutReference: string, timestamp: string, failureReason?: string }>}
 */
export async function simulateIndiaPayout({ vpa: _vpa, amountInr: _amountInr, paymentId, forceOutcome }) {
  // Tiny artificial delay so the UI's "processing" state is visibly real
  // rather than an instant flash — not a stand-in for an actual network call.
  await new Promise((r) => setTimeout(r, 300));

  const timestamp = new Date().toISOString();

  const outcome =
    forceOutcome ??
    // Simulated ~92% success rate so the failure path is exercised
    // organically during a demo/testing session, not only in unit tests.
    (Math.random() < 0.92 ? "success" : "failure");

  if (outcome === "failure") {
    return {
      success: false,
      payoutReference: `SIMPAYOUT-FAILED-${paymentId.slice(0, 8)}`,
      timestamp,
      failureReason: "simulated_payout_declined",
    };
  }

  return {
    success: true,
    payoutReference: `SIMPAYOUT-${randomUUID()}`,
    timestamp,
  };
}
