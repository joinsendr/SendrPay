import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle, ShieldCheck, Landmark, Eye, EyeOff } from "lucide-react";
import { Modal } from "./Modal";
import {
  getBankAccount, createBankAccount, verifyBankAccount,
  type BankAccount,
} from "../lib/bankAccountApi";

type Step = "loading" | "enter" | "verify" | "view";

const initialForm = { accountHolderName: "", accountNumber: "", confirmAccountNumber: "", ifsc: "" };

const FORM_ERROR_LABEL: Record<string, string> = {
  missing_account_holder_name: "Enter the account holder's name.",
  invalid_account_number: "Account number should be 9–18 digits.",
  account_numbers_do_not_match: "Account numbers don't match.",
  invalid_ifsc: "Enter a valid IFSC code (e.g. HDFC0001234).",
};

export function BankAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("loading");
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [changingAccount, setChangingAccount] = useState(false);

  const [verifyAmount, setVerifyAmount] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [revealAmount, setRevealAmount] = useState(false);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("loading");
    setJustVerified(false);
    setChangingAccount(false);
    getBankAccount()
      .then((existing) => {
        setAccount(existing);
        if (!existing) setStep("enter");
        else if (existing.status === "verified") setStep("view");
        else if (existing.status === "pending_verification") setStep("verify");
        else setStep("enter"); // failed — start over
      })
      .catch(() => setStep("enter"));
  }, [open]);

  const startChange = () => {
    setForm(initialForm);
    setFormError("");
    setChangingAccount(true);
    setStep("enter");
  };

  const submitDetails = async () => {
    setFormError("");
    setSubmitting(true);
    try {
      const created = await createBankAccount(form);
      setAccount(created);
      setVerifyAmount("");
      setVerifyError("");
      setAttemptsRemaining(null);
      setRevealAmount(false);
      setStep("verify");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setFormError(FORM_ERROR_LABEL[code ?? ""] ?? "Couldn't save those details — please check them and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerify = async () => {
    const amt = parseFloat(verifyAmount);
    if (!(amt >= 0)) return;
    setSubmitting(true);
    setVerifyError("");
    try {
      const result = await verifyBankAccount(amt);
      if (result.valid && result.account) {
        setAccount(result.account);
        setJustVerified(true);
        setStep("view");
      } else if (result.reason === "max_attempts_exceeded") {
        setFormError("Too many incorrect attempts. Please re-enter your bank details.");
        setForm(initialForm);
        setStep("enter");
      } else {
        setAttemptsRemaining(result.attemptsRemaining ?? null);
        setVerifyError("That doesn't match. Double-check your statement and try again.");
      }
    } catch {
      setVerifyError("Couldn't reach Sendr Pay — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Bank account">
      {step === "loading" && (
        <div className="flex flex-col items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      )}

      {step === "enter" && (
        <div>
          {changingAccount && (
            <p className="mb-3 text-xs text-neutral-400">Verifying a new account will replace your current one once confirmed.</p>
          )}
          <label htmlFor="bank-name" className="mb-1.5 block text-sm text-neutral-500">
            Account holder name
          </label>
          <input
            id="bank-name"
            type="text"
            placeholder="As it appears on your bank account"
            value={form.accountHolderName}
            onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
            className="mb-3 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-900"
            autoFocus
          />

          <label htmlFor="bank-acct" className="mb-1.5 block text-sm text-neutral-500">
            Account number
          </label>
          <input
            id="bank-acct"
            type="text"
            inputMode="numeric"
            placeholder="0000000000"
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
            className="mb-3 w-full rounded-xl border border-neutral-200 px-4 py-3 font-mono text-sm font-medium text-neutral-900 outline-none focus:border-neutral-900"
          />

          <label htmlFor="bank-acct-confirm" className="mb-1.5 block text-sm text-neutral-500">
            Confirm account number
          </label>
          <input
            id="bank-acct-confirm"
            type="text"
            inputMode="numeric"
            placeholder="0000000000"
            value={form.confirmAccountNumber}
            onChange={(e) => setForm((f) => ({ ...f, confirmAccountNumber: e.target.value.replace(/\D/g, "") }))}
            className="mb-3 w-full rounded-xl border border-neutral-200 px-4 py-3 font-mono text-sm font-medium text-neutral-900 outline-none focus:border-neutral-900"
          />

          <label htmlFor="bank-ifsc" className="mb-1.5 block text-sm text-neutral-500">
            IFSC code
          </label>
          <input
            id="bank-ifsc"
            type="text"
            autoCapitalize="characters"
            placeholder="HDFC0001234"
            value={form.ifsc}
            onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 font-mono text-sm font-medium text-neutral-900 outline-none focus:border-neutral-900"
          />

          {formError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> {formError}
            </p>
          )}

          <p className="mt-3 text-xs text-neutral-400">
            We'll send a small deposit (under ₹1) to this account. Enter the amount you receive to verify it's yours.
          </p>

          <button
            type="button"
            disabled={
              submitting ||
              !form.accountHolderName.trim() ||
              !form.accountNumber ||
              !form.confirmAccountNumber ||
              !form.ifsc
            }
            onClick={submitDetails}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Sending…" : "Send verification deposit"}
          </button>
        </div>
      )}

      {step === "verify" && account && (
        <div className="flex flex-col items-center py-2 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <Landmark className="h-6 w-6 text-neutral-500" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">Verify {account.accountNumberMasked}</p>
          <p className="mt-1.5 max-w-xs text-xs text-neutral-400">
            Check your bank statement or SMS for a small deposit (under ₹1) and enter the exact amount below.
          </p>

          <div className="mt-4 flex w-full max-w-[12rem] items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-900">
            <span className="text-lg font-semibold text-neutral-400">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="1"
              step="0.01"
              placeholder="0.00"
              value={verifyAmount}
              onChange={(e) => setVerifyAmount(e.target.value)}
              className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
              autoFocus
            />
          </div>

          {verifyError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {verifyError}
              {attemptsRemaining != null && ` (${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} left)`}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || !(parseFloat(verifyAmount) >= 0)}
            onClick={submitVerify}
            className="mt-4 flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Verifying…" : "Verify"}
          </button>

          {account.pennyDropAmount != null && (
            <button
              type="button"
              onClick={() => setRevealAmount((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-700"
            >
              {revealAmount ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealAmount ? `₹${account.pennyDropAmount.toFixed(2)}` : "Can't find it? Reveal amount"}
            </button>
          )}
        </div>
      )}

      {step === "view" && account && (
        <div>
          {justVerified && (
            <div className="mb-4 flex flex-col items-center text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
                <Check className="h-5 w-5 text-white" />
              </span>
              <p className="text-sm font-semibold text-neutral-900">Bank account verified</p>
            </div>
          )}

          <dl className="space-y-2.5 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Account holder</dt>
              <dd className="font-medium text-neutral-900">{account.accountHolderName}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Account number</dt>
              <dd className="font-mono font-medium text-neutral-900">{account.accountNumberMasked}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">IFSC</dt>
              <dd className="font-mono font-medium text-neutral-900">{account.ifsc}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 pt-2.5">
              <dt className="text-neutral-400">Status</dt>
              <dd className="flex items-center gap-1 font-medium text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-xs text-neutral-400">
            This account is used for your payouts when selling crypto for INR.
          </p>

          <button
            type="button"
            onClick={startChange}
            className="mt-4 h-11 w-full rounded-2xl border border-neutral-200 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Change bank account
          </button>
          <button
            type="button"
            onClick={close}
            className="mt-2 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
