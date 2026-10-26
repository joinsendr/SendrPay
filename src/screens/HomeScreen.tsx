import { useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { WalletBalance } from "../components/WalletBalance";
import { PrimaryActions } from "../components/PrimaryActions";
import { TransactionHistory } from "../components/TransactionHistory";
import { TransactionDetailsModal } from "../components/TransactionDetailsModal";
import { AddBalanceModal } from "../components/AddBalanceModal";
import { useWallet } from "../context/WalletContext";
import { ledgerEntryToTransaction } from "../lib/ledgerAdapter";
import type { Transaction, TabKey } from "../types";

export function HomeScreen({ onNavigate, onOpenPay }: { onNavigate: (tab: TabKey) => void; onOpenPay: () => void }) {
  const { transactions } = useWallet();
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);

  return (
    <div className="animate-fade-up">
      <AppHeader />
      <WalletBalance />
      <PrimaryActions onAddBalance={() => setAddBalanceOpen(true)} onPay={onOpenPay} />
      <TransactionHistory
        transactions={transactions.map(ledgerEntryToTransaction)}
        limit={4}
        onSelect={setSelectedTxn}
        onViewAll={() => onNavigate("wallet")}
      />

      <TransactionDetailsModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
      <AddBalanceModal open={addBalanceOpen} onClose={() => setAddBalanceOpen(false)} />
    </div>
  );
}
