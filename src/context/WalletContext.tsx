import { createContext, useContext, useState, type ReactNode } from "react";
import { MOCK_BALANCE_USDC, MOCK_TRANSACTIONS } from "../data/mockData";
import type { Transaction } from "../types";

interface WalletContextValue {
  balanceUsdc: number;
  transactions: Transaction[];
  /** Credits the wallet and inserts a matching "Wallet Top-up" transaction at the top of history. */
  addDeposit: (usdcAmount: number) => Transaction;
}

const WalletContext = createContext<WalletContextValue | null>(null);

let depositSeq = 0;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balanceUsdc, setBalanceUsdc] = useState(MOCK_BALANCE_USDC);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);

  const addDeposit = (usdcAmount: number): Transaction => {
    depositSeq += 1;
    const txn: Transaction = {
      id: `deposit_${Date.now()}_${depositSeq}`,
      merchant: "Wallet Top-up",
      category: "topup",
      amountUsdc: usdcAmount,
      kind: "credit",
      date: new Date().toISOString(),
      status: "completed",
      reference: `SPX-${9000 + depositSeq}-TU`,
    };
    setTransactions((prev) => [txn, ...prev]);
    setBalanceUsdc((prev) => prev + usdcAmount);
    return txn;
  };

  return (
    <WalletContext.Provider value={{ balanceUsdc, transactions, addDeposit }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
