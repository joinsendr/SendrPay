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
}

export type TabKey = "home" | "wallet" | "pay" | "settings";
