import { useState } from "react";
import { Check, Loader2, AlertCircle, ShieldAlert, ArrowLeft } from "lucide-react";
import { QrScanner } from "./QrScanner";
import { parseUpiUri } from "../lib/upiParser";
import { createPayment, confirmPayment, cancelPayment, type Payment } from "../lib/paymentsApi";
import { useWallet } from "../context/WalletContext";

type Step = "scan" | "needsAmount" | "reviewing" | "confirming" | "processing" | "succeeded" | "failed" | "cancelled" | "rejected";

const REJECT_REASON_LABEL: Record<string, string> = {
  empty_qr_data: "That QR code didn't contain any data.",
  not_a_valid_uri: "That doesn't look like a valid QR payload.",
  unsupported_scheme: "That QR code isn't a UPI payment code.",
  unsupported_upi_action: "This UPI code isn't a payment request.",
  missing_or_invalid_payee_vpa: "This QR code doesn't have a valid payee UPI ID.",
  unsupported_currency: "This UPI code isn't in INR.",
  invalid_amount: "This QR code has an invalid amount.",
  missing_or_invalid_amount: "Enter a valid amount to continue.",
  insufficient_balance: "Insufficient balance for this payment.",
};

export function UpiPayFlow({ onDone }: { onDone: () => void }) {
  const { refresh } = useWallet();
  const [step, setStep] = useState<Step>("scan");
  const [rawQr, setRawQr] = useState<string | null>(null);
  const [parsedVpa, setParsedVpa] = useState<string | null>(null);
  const [parsedPayeeName, setParsedPayeeName] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");

  const handleDecode = (raw: string) => {
    const parsed = parseUpiUri(raw);
    if (!parsed.valid) {
      setError(REJECT_REASON_LABEL[parsed.reason ?? ""] ?? "Couldn't read that QR code.");
      setStep("rejected");
      return;
    }
    setRawQr(raw);
    setParsedVpa(parsed.vpa ?? null);
    setParsedPayeeName(parsed.payeeName ?? null);
    if (parsed.amountInr == null) {
      setStep("needsAmount");
    } else {
      void requestQuote(raw, undefined);
    }
  };

  const requestQuote = async (qrData: string, amountInr: number | undefined) => {
    setStep("confirming");
    setError("");
    try {
      const result = await createPayment({ paymentId, qrData, amountInr });
      setPayment(result);
      setStep(result.status === "awaiting_confirmation" ? "reviewing" : "rejected");
      if (result.status !== "awaiting_confirmation") {
        setError(REJECT_REASON_LABEL[result.failureReason ?? ""] ?? "This payment can't be completed.");
      }
    } catch {
      setError("Couldn't reach Sendr Pay — check your connection and try again.");
      setStep("rejected");
    }
  };

  const submitManualAmount = () => {
    const amt = parseFloat(manualAmount);
    if (!(amt > 0) || !rawQr) return;
    void requestQuote(rawQr, amt);
  };

  const handleConfirm = async () => {
    if (!payment) return;
    setStep("processing");
    try {
      const { payment: confirmed } = await confirmPayment(payment.paymentId);
      setPayment(confirmed);
      setStep(confirmed.status === "succeeded" ? "succeeded" : "failed");
      if (confirmed.status !== "succeeded") {
        setError(REJECT_REASON_LABEL[confirmed.failureReason ?? ""] ?? "The payment couldn't be completed.");
      }
      await refresh();
    } catch {
      setError("Couldn't reach Sendr Pay — check your connection and try again.");
      setStep("failed");
    }
  };

  const handleCancel = async () => {
    if (payment) {
      try {
        await cancelPayment(payment.paymentId);
      } catch {
        // best-effort — the review screen is closing regardless
      }
    }
    setStep("cancelled");
  };

  return (
    <div className="flex flex-col items-center px-6 py-4 text-center">
      {step === "scan" && <QrScanner onDecode={handleDecode} />}

      {step === "rejected" && (
        <div className="flex flex-col items-center py-6">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <ShieldAlert className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">Can't pay this one</p>
          <p className="mt-1.5 max-w-xs text-sm text-neutral-500">{error}</p>
          <button
            type="button"
            onClick={() => {
              setRawQr(null);
              setError("");
              setStep("scan");
            }}
            className="mt-5 flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" /> Try another QR code
          </button>
        </div>
      )}

      {step === "needsAmount" && (
        <div className="w-full max-w-xs text-left">
          <p className="mb-1 text-sm text-neutral-500">{parsedPayeeName ?? parsedVpa}</p>
          <p className="mb-4 text-xs text-neutral-400">This QR code has no fixed amount — enter one to continue.</p>
          <label htmlFor="upi-amount" className="mb-1.5 block text-sm text-neutral-500">
            Amount
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-900">
            <span className="text-lg font-semibold text-neutral-400">₹</span>
            <input
              id="upi-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
              autoFocus
            />
            <span className="text-sm font-medium text-neutral-400">INR</span>
          </div>
          <button
            type="button"
            disabled={!(parseFloat(manualAmount) > 0)}
            onClick={submitManualAmount}
            className="mt-4 h-12 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Continue
          </button>
        </div>
      )}

      {step === "confirming" && (
        <div className="flex flex-col items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
          <p className="mt-3 text-sm text-neutral-500">Getting a quote…</p>
        </div>
      )}

      {step === "reviewing" && payment && (
        <div className="w-full max-w-xs text-left">
          <p className="mb-4 text-center text-sm font-semibold text-neutral-900">Review payment</p>
          <dl className="space-y-2.5 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Pay to</dt>
              <dd className="font-medium text-neutral-900">{payment.payeeName ?? payment.vpa}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">UPI ID</dt>
              <dd className="font-mono text-xs font-medium text-neutral-700">{payment.vpa}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Amount</dt>
              <dd className="font-medium text-neutral-900">₹{payment.amountInr?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Rate</dt>
              <dd className="font-medium text-neutral-900">₹{payment.quotedRateInrPerUsdc?.toLocaleString(undefined, { maximumFractionDigits: 2 })} / USDC</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Converted</dt>
              <dd className="font-medium text-neutral-900">{payment.amountUsdc?.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Fee</dt>
              <dd className="font-medium text-neutral-900">{payment.feeUsdc?.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC</dd>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 pt-2.5">
              <dt className="font-medium text-neutral-500">Total deduction</dt>
              <dd className="font-semibold text-neutral-900">{payment.totalUsdc?.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC</dd>
            </div>
          </dl>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-neutral-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The conversion rate and INR payout are illustrative/simulated — no real UPI transfer is made.
          </p>

          <button
            type="button"
            onClick={handleConfirm}
            className="mt-4 h-12 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Confirm payment
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center py-10">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
          <p className="text-sm font-medium text-neutral-900">Processing payment…</p>
        </div>
      )}

      {step === "succeeded" && payment && (
        <div className="flex flex-col items-center py-2">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900">
            <Check className="h-6 w-6 text-white" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">Payment successful</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
            ₹{payment.amountInr?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {payment.totalUsdc?.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC · to {payment.payeeName ?? payment.vpa}
          </p>

          <dl className="mt-4 w-full max-w-xs space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Payment ID</dt>
              <dd className="font-mono text-xs font-medium text-neutral-900">{payment.paymentId.slice(0, 8)}…</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Payout reference</dt>
              <dd className="font-mono text-xs font-medium text-neutral-900">{payment.payoutReference}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={onDone}
            className="mt-5 h-12 w-full max-w-xs rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}

      {step === "failed" && (
        <div className="flex flex-col items-center py-6">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <AlertCircle className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">Payment failed</p>
          <p className="mt-1.5 max-w-xs text-sm text-neutral-500">{error || "The payout couldn't be completed. Nothing was deducted."}</p>
          <button
            type="button"
            onClick={onDone}
            className="mt-5 h-11 w-full max-w-xs rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}

      {step === "cancelled" && (
        <div className="flex flex-col items-center py-6">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <AlertCircle className="h-6 w-6 text-neutral-400" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">Payment cancelled</p>
          <p className="mt-1.5 text-sm text-neutral-500">Nothing was deducted.</p>
          <button
            type="button"
            onClick={onDone}
            className="mt-5 h-11 w-full max-w-xs rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
