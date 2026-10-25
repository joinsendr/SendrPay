import { useState } from "react";
import { ChevronRight, Check, Loader2, Landmark, Zap, ArrowLeftRight, Shield } from "lucide-react";
import { Modal } from "./Modal";
import { useWallet } from "../context/WalletContext";
import {
  DEPOSIT_CURRENCIES, CURRENCY_SYMBOL, MOCK_USDC_RATE, FUNDING_OPTIONS,
  type DepositCurrency, type FundingOption, type FundingIcon,
} from "../data/depositData";

type Step = "currency" | "amount" | "funding" | "processing" | "success";

const STEP_TITLE: Record<Step, string> = {
  currency: "Add Balance",
  amount: "Deposit amount",
  funding: "Choose a funding method",
  processing: "Processing deposit",
  success: "Add Balance",
};

const OPTION_ICON: Record<FundingIcon, React.ElementType> = {
  bank: Landmark,
  instant: Zap,
  wise: ArrowLeftRight,
  plaid: Shield,
};

const initialState = {
  step: "currency" as Step,
  currency: null as DepositCurrency | null,
  amount: "",
  option: null as FundingOption | null,
  creditedUsdc: 0,
};

export function AddBalanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addDeposit } = useWallet();
  const [state, setState] = useState(initialState);
  const { step, currency, amount, option, creditedUsdc } = state;

  const reset = () => setState(initialState);
  const close = () => {
    onClose();
    // Reset after the close animation so a mid-flow jump isn't visible
    window.setTimeout(reset, 200);
  };

  const goBack = () => {
    if (step === "amount") setState((s) => ({ ...s, step: "currency" }));
    else if (step === "funding") setState((s) => ({ ...s, step: "amount" }));
  };

  const selectCurrency = (c: DepositCurrency) => setState((s) => ({ ...s, currency: c, step: "amount" }));

  const selectOption = (opt: FundingOption) => {
    if (!currency) return;
    const usdc = parseFloat(amount) * MOCK_USDC_RATE[currency];
    setState((s) => ({ ...s, option: opt, step: "processing" }));
    window.setTimeout(() => {
      addDeposit(usdc);
      setState((s) => ({ ...s, creditedUsdc: usdc, step: "success" }));
    }, 1500);
  };

  const previewUsdc = currency && parseFloat(amount) > 0 ? parseFloat(amount) * MOCK_USDC_RATE[currency] : null;

  return (
    <Modal
      open={open}
      onClose={close}
      onBack={step === "amount" || step === "funding" ? goBack : undefined}
      title={STEP_TITLE[step]}
    >
      {step === "currency" && (
        <div className="space-y-1.5">
          <p className="mb-2 text-sm text-neutral-500">Which currency are you funding from?</p>
          {DEPOSIT_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCurrency(c)}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                  {CURRENCY_SYMBOL[c]}
                </span>
                {c}
              </span>
              <ChevronRight className="h-4 w-4 text-neutral-300" />
            </button>
          ))}
        </div>
      )}

      {step === "amount" && currency && (
        <div>
          <label htmlFor="deposit-amount" className="mb-1.5 block text-sm text-neutral-500">
            How much {currency} do you want to deposit?
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-900">
            <span className="text-lg font-semibold text-neutral-400">{CURRENCY_SYMBOL[currency]}</span>
            <input
              id="deposit-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setState((s) => ({ ...s, amount: e.target.value }))}
              className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
              autoFocus
            />
            <span className="text-sm font-medium text-neutral-400">{currency}</span>
          </div>
          <p className="mt-1.5 h-4 text-xs text-neutral-400">
            {previewUsdc != null && `≈ ${previewUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
          </p>

          <button
            type="button"
            disabled={!(parseFloat(amount) > 0)}
            onClick={() => setState((s) => ({ ...s, step: "funding" }))}
            className="mt-3 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Continue
          </button>
        </div>
      )}

      {step === "funding" && currency && (
        <div className="space-y-1.5">
          <p className="mb-2 text-sm text-neutral-500">Available ways to send {currency}:</p>
          {FUNDING_OPTIONS[currency].map((opt) => {
            const Icon = OPTION_ICON[opt.icon];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => selectOption(opt)}
                className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{opt.label}</span>
                  <span className="block text-xs text-neutral-400">{opt.timing}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </button>
            );
          })}
        </div>
      )}

      {step === "processing" && option && (
        <div className="flex flex-col items-center py-8 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
          <p className="text-sm font-medium text-neutral-900">Processing your deposit via {option.label}…</p>
          <p className="mt-1 text-xs text-neutral-400">This is a demo — no real money is moved.</p>
        </div>
      )}

      {step === "success" && currency && option && (
        <div>
          <div className="flex flex-col items-center py-2 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
              <Check className="h-5 w-5 text-white" />
            </span>
            <p className="text-sm font-semibold text-neutral-900">Money added to your wallet</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
              +{creditedUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-semibold text-neutral-400">USDC</span>
            </p>
          </div>

          <dl className="mt-4 space-y-2.5 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Deposited</dt>
              <dd className="font-medium text-neutral-900">
                {CURRENCY_SYMBOL[currency]}{Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Method</dt>
              <dd className="font-medium text-neutral-900">{option.label}</dd>
            </div>
          </dl>

          <p className="mt-3 text-center text-xs text-neutral-400">Logged as "Wallet Top-up" in your transaction history.</p>

          <button
            type="button"
            onClick={close}
            className="mt-4 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
