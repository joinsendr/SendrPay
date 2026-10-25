import { useState } from "react";
import { ScanLine, Loader2, ChevronRight, Check, AlertCircle } from "lucide-react";
import { ScreenHeader } from "../components/ScreenHeader";
import { useWallet } from "../context/WalletContext";
import { CURRENCY_SYMBOL, MOCK_USDC_RATE } from "../data/depositData";
import { PAY_CURRENCIES, PAY_COUNTRY_BY_CURRENCY, EU_COUNTRIES, type PayCurrency, type PayMethod } from "../data/payData";

type Step = "currency" | "euCountry" | "method" | "pay" | "processing" | "success";

const STEP_TITLE: Record<Step, string> = {
  currency: "Pay",
  euCountry: "Choose a country",
  method: "Choose a payment method",
  pay: "Pay",
  processing: "Processing",
  success: "Pay",
};

const initialState = {
  step: "currency" as Step,
  currency: null as PayCurrency | null,
  country: null as string | null,
  methods: [] as PayMethod[],
  method: null as PayMethod | null,
  scanning: false,
  qrScanned: false,
  phone: "",
  amount: "",
  error: "",
  creditedUsdc: 0,
};

export function PayScreen() {
  const { addPayment } = useWallet();
  const [s, setS] = useState(initialState);

  const reset = () => setS(initialState);

  const goBack = () => {
    if (s.step === "pay") setS((p) => ({ ...p, step: "method", scanning: false, qrScanned: false, error: "" }));
    else if (s.step === "method") setS((p) => ({ ...p, step: p.currency === "EUR" ? "euCountry" : "currency" }));
    else if (s.step === "euCountry") setS((p) => ({ ...p, step: "currency" }));
  };

  const selectCurrency = (c: PayCurrency) => {
    if (c === "EUR") {
      setS((p) => ({ ...p, currency: c, step: "euCountry" }));
      return;
    }
    const entry = PAY_COUNTRY_BY_CURRENCY[c];
    setS((p) => ({ ...p, currency: c, country: entry?.country ?? null, methods: entry?.methods ?? [], step: "method" }));
  };

  const selectEuCountry = (name: string, methods: PayMethod[]) => {
    setS((p) => ({ ...p, country: name, methods, step: "method" }));
  };

  const selectMethod = (m: PayMethod) => {
    setS((p) => ({ ...p, method: m, step: "pay", scanning: false, qrScanned: false, phone: "", amount: "", error: "" }));
  };

  const handleScan = () => {
    setS((p) => ({ ...p, scanning: true }));
    window.setTimeout(() => setS((p) => ({ ...p, scanning: false, qrScanned: true })), 1300);
  };

  const submitPayment = () => {
    if (!s.currency || !s.method) return;
    const amt = parseFloat(s.amount);
    if (!(amt > 0)) return;
    const usdc = amt * MOCK_USDC_RATE[s.currency];

    setS((p) => ({ ...p, step: "processing", error: "" }));
    window.setTimeout(() => {
      const txn = addPayment(usdc, s.method!.label);
      if (!txn) {
        setS((p) => ({ ...p, step: "pay", error: "Insufficient balance for this payment." }));
        return;
      }
      setS((p) => ({ ...p, step: "success", creditedUsdc: usdc }));
    }, 1400);
  };

  const showBack = s.step === "euCountry" || s.step === "method" || s.step === "pay";

  return (
    <div className="animate-fade-up flex min-h-[calc(100%-4rem)] flex-col">
      <ScreenHeader title={STEP_TITLE[s.step]} onBack={showBack ? goBack : undefined} />

      {s.step === "currency" && (
        <div className="flex flex-1 flex-col px-6 py-4">
          <p className="mb-4 text-sm text-neutral-500">Which currency are you paying in?</p>
          <div className="space-y-1.5">
            {PAY_CURRENCIES.map((c) => (
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
                  {c === "EUR" && <span className="text-xs font-normal text-neutral-400">· choose a country next</span>}
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {s.step === "euCountry" && (
        <div className="flex flex-1 flex-col px-6 py-4">
          <p className="mb-4 text-sm text-neutral-500">Which European country are you paying in?</p>
          <div className="space-y-1.5">
            {EU_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => selectEuCountry(c.name, c.methods)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <span>
                  <span className="block text-sm font-medium text-neutral-900">{c.name}</span>
                  <span className="block text-xs text-neutral-400">{c.methods.map((m) => m.label).join(", ")}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {s.step === "method" && (
        <div className="flex flex-1 flex-col px-6 py-4">
          <p className="mb-4 text-sm text-neutral-500">Local payment methods in {s.country}:</p>
          <div className="space-y-1.5">
            {s.methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMethod(m)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <span className="text-sm font-medium text-neutral-900">{m.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {s.step === "pay" && s.currency && s.method && (
        <div className="flex flex-1 flex-col items-center px-6 py-4 text-center">
          {s.method.inputMode === "qr" ? (
            <>
              <div
                className={`relative mb-5 flex h-48 w-48 items-center justify-center rounded-3xl border-2 border-dashed transition-colors ${
                  s.scanning || s.qrScanned ? "border-neutral-900" : "border-neutral-200"
                }`}
              >
                {s.scanning ? (
                  <Loader2 className="h-10 w-10 animate-spin text-neutral-900" />
                ) : s.qrScanned ? (
                  <Check className="h-10 w-10 text-neutral-900" />
                ) : (
                  <ScanLine className="h-12 w-12 text-neutral-300" />
                )}
                <span className="absolute left-4 top-4 h-6 w-6 rounded-tl-2xl border-l-2 border-t-2 border-neutral-900" />
                <span className="absolute right-4 top-4 h-6 w-6 rounded-tr-2xl border-r-2 border-t-2 border-neutral-900" />
                <span className="absolute bottom-4 left-4 h-6 w-6 rounded-bl-2xl border-b-2 border-l-2 border-neutral-900" />
                <span className="absolute bottom-4 right-4 h-6 w-6 rounded-br-2xl border-b-2 border-r-2 border-neutral-900" />
              </div>

              {!s.qrScanned ? (
                <>
                  <p className="mb-1 text-sm font-semibold text-neutral-900">Scan the merchant's {s.method.label} QR</p>
                  <p className="mb-5 text-xs text-neutral-400">Point your camera at the code at checkout.</p>
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={s.scanning}
                    className="flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                  >
                    {s.scanning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
                      </>
                    ) : (
                      <>
                        <ScanLine className="h-4 w-4" /> Scan QR Code
                      </>
                    )}
                  </button>
                </>
              ) : (
                <p className="mb-4 text-sm font-medium text-neutral-900">QR code recognized — enter the amount to pay</p>
              )}
            </>
          ) : (
            <div className="w-full max-w-xs text-left">
              <label htmlFor="pay-phone" className="mb-1.5 block text-sm text-neutral-500">
                Recipient's {s.method.label} phone number
              </label>
              <input
                id="pay-phone"
                type="tel"
                placeholder="+00 000 000 000"
                value={s.phone}
                onChange={(e) => setS((p) => ({ ...p, phone: e.target.value }))}
                className="mb-4 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-900"
              />
            </div>
          )}

          {(s.method.inputMode === "phone" || s.qrScanned) && (
            <div className="w-full max-w-xs text-left">
              <label htmlFor="pay-amount" className="mb-1.5 block text-sm text-neutral-500">
                Amount
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-900">
                <span className="text-lg font-semibold text-neutral-400">{CURRENCY_SYMBOL[s.currency]}</span>
                <input
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={s.amount}
                  onChange={(e) => setS((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
                  autoFocus
                />
                <span className="text-sm font-medium text-neutral-400">{s.currency}</span>
              </div>

              {s.error && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <AlertCircle className="h-3.5 w-3.5" /> {s.error}
                </p>
              )}

              <button
                type="button"
                disabled={!(parseFloat(s.amount) > 0) || (s.method.inputMode === "phone" && !s.phone.trim())}
                onClick={submitPayment}
                className="mt-4 h-12 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              >
                Pay {s.amount ? `${CURRENCY_SYMBOL[s.currency]}${s.amount}` : ""}
              </button>
            </div>
          )}
        </div>
      )}

      {s.step === "processing" && s.method && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-neutral-900" />
          <p className="text-sm font-medium text-neutral-900">Processing payment via {s.method.label}…</p>
          <p className="mt-1 text-xs text-neutral-400">This is a demo — no real money is moved.</p>
        </div>
      )}

      {s.step === "success" && s.currency && s.method && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-4 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900">
            <Check className="h-6 w-6 text-white" />
          </span>
          <p className="text-sm font-semibold text-neutral-900">Payment successful</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
            {CURRENCY_SYMBOL[s.currency]}{Number(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {s.currency}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {s.creditedUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC · via {s.method.label} · {s.country}
          </p>

          <button
            type="button"
            onClick={reset}
            className="mt-6 h-12 w-full max-w-xs rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
