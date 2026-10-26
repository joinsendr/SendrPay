export type TransactionKind = "debit" | "credit";

export interface Transaction {
  id: string;
  merchant: string;
  category: "grocery" | "coffee" | "topup" | "restaurant" | "transport" | "shopping";
  amountUsdc: number;
  kind: TransactionKind;
  date: string; // ISO date
  status: "completed" | "pending" | "failed";
  reference: string;
  /** Stellar testnet transaction hash — present only for verified on-chain deposits. */
  txHash?: string | null;
  /** true for a verified on-chain Stellar deposit; false/undefined for a simulated entry. */
  verifiedOnChain?: boolean;
}

export type TabKey = "home" | "wallet" | "pay" | "settings";
