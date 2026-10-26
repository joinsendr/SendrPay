import { useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { WalletBalance } from "../components/WalletBalance";
import { TransactionHistory } from "../components/TransactionHistory";
import { TransactionDetailsModal } from "../components/TransactionDetailsModal";
import { AddBalanceModal } from "../components/AddBalanceModal";
import { useWallet } from "../context/WalletContext";
import { ledgerEntryToTransaction } from "../lib/ledgerAdapter";
import { Plus } from "lucide-react";
import type { Transaction } from "../types";

export function WalletScreen() {
  const { transactions } = useWallet();
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);

  return (
    <div className="animate-fade-up">
      <ScreenHeader title="Wallet" />
      <WalletBalance />

      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => setAddBalanceOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Add Balance
        </button>
      </div>

      <TransactionHistory transactions={transactions.map(ledgerEntryToTransaction)} onSelect={setSelectedTxn} />

      <TransactionDetailsModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
      <AddBalanceModal open={addBalanceOpen} onClose={() => setAddBalanceOpen(false)} />
    </div>
  );
}
