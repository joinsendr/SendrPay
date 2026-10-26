import { FlaskConical } from "lucide-react";

export function TestnetBanner() {
  return (
    <div className="flex items-center justify-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-center text-[11px] font-medium text-white">
      <FlaskConical className="h-3 w-3 shrink-0" />
      Stellar Testnet — USDC deposits are real on-chain testnet transactions, but have no monetary value. Fiat &amp; local payouts are simulated.
    </div>
  );
}
