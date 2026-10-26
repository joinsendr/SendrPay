import { randomUUID } from "node:crypto";
import {
  STELLAR_NETWORK, HORIZON_URL, DEPOSIT_ADDRESS, USDC_ASSET_CODE, USDC_ISSUER, MOCK_USDC_RATE, FIAT_CONVERSION_FEE_RATE,
} from "./config.mjs";
import { listEntries, putEntryIfAbsent } from "./ledger.mjs";
import { computeBalance } from "./depositValidation.mjs";
import { checkDeposits } from "./checkDeposits.mjs";
import { createPayment, confirmPayment, cancelPayment, reversePayment, getPayment } from "./payments.mjs";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function walletSnapshot() {
  const entries = await listEntries();
  return { balanceUsdc: computeBalance(entries), transactions: entries };
}

export async function handler(event) {
  // Scheduled invocation (EventBridge) — not an HTTP request, just run the
  // deposit poll so new deposits are detected even with no one looking at
  // the app.
  if (event.source === "aws.events") {
    const result = await checkDeposits();
    console.log("[scheduled check-deposits]", JSON.stringify(result));
    return result;
  }

  const method = event.requestContext?.http?.method;
  const path = event.rawPath || "/";
  const segments = path.split("/").filter(Boolean);

  try {
    // /payments, /payments/{id}, /payments/{id}/confirm|cancel|reverse
    if (segments[0] === "payments") {
      const paymentId = segments[1];

      if (method === "POST" && segments.length === 1) {
        const body = JSON.parse(event.body || "{}");
        if (!body.paymentId) {
          return json(400, { error: "paymentId (idempotency key) is required" });
        }
        const payment = await createPayment(body);
        return json(payment.status === "failed" ? 400 : 201, { payment });
      }

      if (method === "GET" && segments.length === 2) {
        const payment = await getPayment(paymentId);
        if (!payment) return json(404, { error: "payment_not_found" });
        return json(200, { payment });
      }

      if (method === "POST" && segments.length === 3 && segments[2] === "confirm") {
        const payment = await confirmPayment(paymentId);
        if (!payment) return json(404, { error: "payment_not_found" });
        return json(200, { payment, ...(await walletSnapshot()) });
      }

      if (method === "POST" && segments.length === 3 && segments[2] === "cancel") {
        const payment = await cancelPayment(paymentId);
        if (!payment) return json(404, { error: "payment_not_found" });
        return json(200, { payment });
      }

      if (method === "POST" && segments.length === 3 && segments[2] === "reverse") {
        const payment = await reversePayment(paymentId);
        if (!payment) return json(404, { error: "payment_not_found" });
        return json(200, { payment, ...(await walletSnapshot()) });
      }
    }

    if (method === "GET" && path === "/wallet/address") {
      return json(200, {
        address: DEPOSIT_ADDRESS,
        network: STELLAR_NETWORK,
        horizonUrl: HORIZON_URL,
        asset: { code: USDC_ASSET_CODE, issuer: USDC_ISSUER },
      });
    }

    if (method === "GET" && path === "/wallet") {
      return json(200, await walletSnapshot());
    }

    if (method === "POST" && path === "/deposits/check") {
      const result = await checkDeposits();
      return json(200, { ...result, ...(await walletSnapshot()) });
    }

    if (method === "POST" && path === "/funding/simulate") {
      const body = JSON.parse(event.body || "{}");
      const amount = parseFloat(body.amount);
      const currency = body.currency;
      if (!(amount > 0) || !MOCK_USDC_RATE[currency]) {
        return json(400, { error: "amount must be > 0 and currency must be one of " + Object.keys(MOCK_USDC_RATE).join(", ") });
      }
      // Fiat funding carries a flat conversion fee that a direct USDC-on-
      // Stellar deposit never does — the fee is deducted here, before
      // crediting, so the ledger entry's amountUsdc is always the NET
      // amount actually credited, not the gross conversion.
      const grossUsdc = amount * MOCK_USDC_RATE[currency];
      const feeUsdc = grossUsdc * FIAT_CONVERSION_FEE_RATE;
      const netUsdc = grossUsdc - feeUsdc;
      const entry = {
        entryId: `sim:${randomUUID()}`,
        type: "simulated_fiat",
        status: "confirmed",
        amountUsdc: netUsdc,
        feeUsdc,
        feeRate: FIAT_CONVERSION_FEE_RATE,
        txHash: null,
        originalAmount: amount,
        originalCurrency: currency,
        method: body.method || null,
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      };
      await putEntryIfAbsent(entry);
      return json(201, { entry, ...(await walletSnapshot()) });
    }

    if (method === "POST" && path === "/payments/simulate") {
      const body = JSON.parse(event.body || "{}");
      const amount = parseFloat(body.amount);
      const currency = body.currency;
      if (!(amount > 0) || !MOCK_USDC_RATE[currency]) {
        return json(400, { error: "amount must be > 0 and currency must be one of " + Object.keys(MOCK_USDC_RATE).join(", ") });
      }
      const amountUsdc = amount * MOCK_USDC_RATE[currency];

      const current = await walletSnapshot();
      if (amountUsdc > current.balanceUsdc) {
        return json(400, { error: "insufficient_balance", balanceUsdc: current.balanceUsdc });
      }

      const entry = {
        entryId: `sim:${randomUUID()}`,
        type: "simulated_payment",
        status: "confirmed",
        amountUsdc: -amountUsdc,
        txHash: null,
        originalAmount: amount,
        originalCurrency: currency,
        method: body.method || null,
        country: body.country || null,
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      };
      await putEntryIfAbsent(entry);
      return json(201, { entry, ...(await walletSnapshot()) });
    }

    return json(404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "internal_error", message: err.message });
  }
}
