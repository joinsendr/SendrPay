import type { Transaction } from "../types";
import { TransactionRow } from "./TransactionRow";

export function TransactionHistory({
  transactions,
  onSelect,
  onViewAll,
  limit,
}: {
  transactions: Transaction[];
  onSelect: (txn: Transaction) => void;
  onViewAll?: () => void;
  limit?: number;
}) {
  const shown = limit ? transactions.slice(0, limit) : transactions;

  return (
    <section className="px-5 pb-6">
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-semibold text-neutral-900">Recent Transactions</h2>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded px-1"
          >
            View all
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">No transactions yet.</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {shown.map((txn) => (
            <TransactionRow key={txn.id} txn={txn} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}
