import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getWallet, checkDeposits, simulateFunding, simulatePayment,
  type LedgerEntry, type CheckDepositsResult,
} from "../lib/api";

interface WalletContextValue {
  balanceUsdc: number;
  transactions: LedgerEntry[];
  loading: boolean;
  /** Re-fetches the ledger snapshot from the backend (the only source of truth for balance). */
  refresh: () => Promise<void>;
  /** Polls the backend to check Stellar testnet for new verified deposits. */
  checkForDeposits: () => Promise<CheckDepositsResult>;
  /** Records a simulated fiat funding event server-side and refreshes local state. */
  fundSimulated: (amount: number, currency: string, method?: string) => Promise<LedgerEntry>;
  /** Records a simulated local payment (debit). Returns null if the backend rejected it for insufficient balance. */
  paySimulated: (amount: number, currency: string, method?: string, country?: string) => Promise<LedgerEntry | null>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balanceUsdc, setBalanceUsdc] = useState(0);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const snap = await getWallet();
    setBalanceUsdc(snap.balanceUsdc);
    setTransactions(snap.transactions);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const checkForDeposits = useCallback(async () => {
    const result = await checkDeposits();
    setBalanceUsdc(result.balanceUsdc);
    setTransactions(result.transactions);
    return result;
  }, []);

  const fundSimulated = useCallback(async (amount: number, currency: string, method?: string) => {
    const res = await simulateFunding(amount, currency, method);
    setBalanceUsdc(res.balanceUsdc);
    setTransactions(res.transactions);
    return res.entry;
  }, []);

  const paySimulated = useCallback(async (amount: number, currency: string, method?: string, country?: string) => {
    try {
      const res = await simulatePayment(amount, currency, method, country);
      setBalanceUsdc(res.balanceUsdc);
      setTransactions(res.transactions);
      return res.entry;
    } catch (err) {
      if ((err as { status?: number }).status === 400) return null;
      throw err;
    }
  }, []);

  return (
    <WalletContext.Provider value={{ balanceUsdc, transactions, loading, refresh, checkForDeposits, fundSimulated, paySimulated }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
