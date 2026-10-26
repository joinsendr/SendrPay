import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { MOCK_FX_RATE_INR_PER_USDC } from "../data/mockData";
import { useWallet } from "../context/WalletContext";

export function WalletBalance() {
  const { balanceUsdc, loading } = useWallet();
  const [hidden, setHidden] = useState(false);
  const inrEquivalent = balanceUsdc * MOCK_FX_RATE_INR_PER_USDC;

  return (
    <div className="px-5 pt-6 pb-2 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Total Balance
        <button
          type="button"
          onClick={() => setHidden((v) => !v)}
          aria-label={hidden ? "Show balance" : "Hide balance"}
          aria-pressed={hidden}
          className="rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white">
          $
        </span>
        <span className="text-4xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
          {loading ? <Loader2 className="h-8 w-8 animate-spin text-neutral-300" /> : hidden ? "••••••" : balanceUsdc.toFixed(2)}
        </span>
        <span className="text-lg font-semibold text-neutral-400">USDC</span>
      </div>

      <p className="mt-1.5 text-sm text-neutral-400">
        {hidden
          ? "≈ ••••••• INR"
          : `≈ ₹${inrEquivalent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`}
      </p>
    </div>
  );
}
