import { ShoppingCart, Coffee, ArrowDownToLine, UtensilsCrossed, Car, ShoppingBag, Copy } from "lucide-react";
import { useState } from "react";
import type { Transaction } from "../types";
import { Modal } from "./Modal";

const CATEGORY_ICON: Record<Transaction["category"], React.ElementType> = {
  grocery: ShoppingCart,
  coffee: Coffee,
  topup: ArrowDownToLine,
  restaurant: UtensilsCrossed,
  transport: Car,
  shopping: ShoppingBag,
};

const STATUS_LABEL: Record<Transaction["status"], string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
};

const STATUS_CLASS: Record<Transaction["status"], string> = {
  completed: "bg-neutral-900 text-white",
  pending: "bg-neutral-100 text-neutral-600",
  failed: "bg-neutral-100 text-neutral-400 line-through",
};

export function TransactionDetailsModal({
  txn,
  onClose,
}: {
  txn: Transaction | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!txn) return null;
  const Icon = CATEGORY_ICON[txn.category];
  const isCredit = txn.kind === "credit";

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(txn.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — non-critical for a demo prototype
    }
  };

  return (
    <Modal open={!!txn} onClose={onClose} title="Transaction">
      <div className="flex flex-col items-center py-2 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <Icon className="h-5 w-5 text-neutral-700" />
        </span>
        <p className="text-sm font-medium text-neutral-500">{txn.merchant}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
          {isCredit ? "+" : "−"}{txn.amountUsdc.toFixed(2)} <span className="text-lg font-semibold text-neutral-400">USDC</span>
        </p>
        <span className={`mt-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[txn.status]}`}>
          {STATUS_LABEL[txn.status]}
        </span>
      </div>

      <dl className="mt-5 space-y-3 border-t border-neutral-100 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-neutral-400">Date</dt>
          <dd className="font-medium text-neutral-900">
            {new Date(txn.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-neutral-400">Reference</dt>
          <dd>
            <button
              type="button"
              onClick={copyRef}
              className="flex items-center gap-1.5 font-mono text-xs font-medium text-neutral-900 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded px-1"
            >
              {txn.reference}
              <Copy className="h-3 w-3" />
            </button>
          </dd>
        </div>
      </dl>

      {copied && <p className="mt-2 text-center text-xs text-neutral-400">Copied</p>}

      <p className="mt-4 text-center text-[11px] text-neutral-300">Demo transaction — not a real payment.</p>
    </Modal>
  );
}
