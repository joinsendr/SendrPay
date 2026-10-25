import { ShoppingCart, Coffee, ArrowDownToLine, UtensilsCrossed, Car, ShoppingBag } from "lucide-react";
import type { Transaction } from "../types";

const CATEGORY_ICON: Record<Transaction["category"], React.ElementType> = {
  grocery: ShoppingCart,
  coffee: Coffee,
  topup: ArrowDownToLine,
  restaurant: UtensilsCrossed,
  transport: Car,
  shopping: ShoppingBag,
};

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TransactionRow({ txn, onSelect }: { txn: Transaction; onSelect: (txn: Transaction) => void }) {
  const Icon = CATEGORY_ICON[txn.category];
  const isCredit = txn.kind === "credit";

  return (
    <button
      type="button"
      onClick={() => onSelect(txn)}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-inset rounded-xl px-2 -mx-2"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-900">{txn.merchant}</span>
        <span className="block text-xs text-neutral-400">{relativeDate(txn.date)}</span>
      </span>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${isCredit ? "text-neutral-900" : "text-neutral-900"}`}>
        {isCredit ? "+" : "−"}{txn.amountUsdc.toFixed(2)}
      </span>
    </button>
  );
}
