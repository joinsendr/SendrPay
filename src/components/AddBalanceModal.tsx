import { useState } from "react";
import {
  ChevronRight, Check, Loader2, Sparkles, Landmark, Zap, ArrowLeftRight,
} from "lucide-react";
import { Modal } from "./Modal";
import {
  DEPOSIT_CURRENCIES, CURRENCY_SYMBOL, DEPOSIT_METHODS, FUNDING_PROVIDERS,
  type DepositCurrency, type DepositMethod, type FundingProvider,
} from "../data/depositData";

type Step = "currency" | "amount" | "method" | "connect" | "connecting" | "done";

const STEP_TITLE: Record<Step, string> = {
  currency: "Add Balance",
  amount: "Deposit amount",
  method: "Deposit method",
  connect: "Connect a funding source",
  connecting: "Connecting",
  done: "Add Balance",
};

const PROVIDER_ICON: Record<FundingProvider["id"], React.ElementType> = {
  plaid: Landmark,
  revolut: Zap,
  wise: ArrowLeftRight,
};

const initialState = {
  step: "currency" as Step,
  currency: null as DepositCurrency | null,
  amount: "",
  method: null as DepositMethod | null,
  provider: null as FundingProvider | null,
};

export function AddBalanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState(initialState);
  const { step, currency, amount, method, provider } = state;

  const reset = () => setState(initialState);
  const close = () => {
    onClose();
    // Reset after the close animation would read oddly mid-flow otherwise
    window.setTimeout(reset, 200);
  };

  const goBack = () => {
    if (step === "amount") setState((s) => ({ ...s, step: "currency" }));
    else if (step === "method") setState((s) => ({ ...s, step: "amount" }));
    else if (step === "connect") setState((s) => ({ ...s, step: "method" }));
  };

  const selectCurrency = (c: DepositCurrency) => setState((s) => ({ ...s, currency: c, step: "amount" }));
  const selectMethod = (m: DepositMethod) => setState((s) => ({ ...s, method: m, step: "connect" }));
  const selectProvider = (p: FundingProvider) => {
    setState((s) => ({ ...s, provider: p, step: "connecting" }));
    window.setTimeout(() => setState((s) => ({ ...s, step: "done" })), 1300);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      onBack={step === "amount" || step === "method" || step === "connect" ? goBack : undefined}
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
        <AmountStep
          currency={currency}
          amount={amount}
          onChange={(v) => setState((s) => ({ ...s, amount: v }))}
          onContinue={() => setState((s) => ({ ...s, step: "method" }))}
        />
      )}

      {step === "method" && currency && (
        <div className="space-y-1.5">
          <p className="mb-2 text-sm text-neutral-500">How would you like to send {currency}?</p>
          {DEPOSIT_METHODS[currency].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => selectMethod(m)}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              <span>
                <span className="block text-sm font-medium text-neutral-900">{m.label}</span>
                <span className="block text-xs text-neutral-400">{m.timing}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
            </button>
          ))}
        </div>
      )}

      {step === "connect" && (
        <div className="space-y-1.5">
          <p className="mb-2 text-sm text-neutral-500">Choose how to fund this deposit.</p>
          {FUNDING_PROVIDERS.map((p) => {
            const Icon = PROVIDER_ICON[p.id];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProvider(p)}
                className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{p.label}</span>
                  <span className="block text-xs text-neutral-400">{p.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </button>
            );
          })}
        </div>
      )}

      {step === "connecting" && provider && (
        <div className="flex flex-col items-center py-8 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
          <p className="text-sm font-medium text-neutral-900">Connecting to {provider.name}…</p>
          <p className="mt-1 text-xs text-neutral-400">This is a demo — no real connection is made.</p>
        </div>
      )}

      {step === "done" && currency && method && provider && (
        <div>
          <div className="flex flex-col items-center py-2 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Sparkles className="h-5 w-5 text-neutral-700" />
            </span>
            <p className="text-sm font-medium text-neutral-900">Wallet funding is coming soon</p>
            <p className="mt-1.5 max-w-[22rem] text-sm text-neutral-500">
              Real deposits aren't processed in this prototype yet — here's what you selected:
            </p>
          </div>

          <dl className="mt-4 space-y-2.5 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Amount</dt>
              <dd className="font-medium text-neutral-900">
                {CURRENCY_SYMBOL[currency]}{Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Method</dt>
              <dd className="font-medium text-neutral-900">{method.label}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Funding source</dt>
              <dd className="flex items-center gap-1.5 font-medium text-neutral-900">
                {provider.label}
                <Check className="h-3.5 w-3.5" />
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={close}
            className="mt-5 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Got it
          </button>
        </div>
      )}
    </Modal>
  );
}

function AmountStep({
  currency,
  amount,
  onChange,
  onContinue,
}: {
  currency: DepositCurrency;
  amount: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  const valid = parseFloat(amount) > 0;
  return (
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
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
          autoFocus
        />
        <span className="text-sm font-medium text-neutral-400">{currency}</span>
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={onContinue}
        className="mt-5 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        Continue
      </button>
    </div>
  );
}
