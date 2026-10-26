import type { LedgerEntry } from "./api";
import type { Transaction } from "../types";

const STATUS_MAP: Record<LedgerEntry["status"], Transaction["status"]> = {
  confirmed: "completed",
  pending: "pending",
  failed: "failed",
  reversed: "failed",
};

/**
 * Adapts a backend ledger entry into the existing frontend Transaction shape
 * so TransactionRow/TransactionHistory/TransactionDetailsModal can be reused
 * as-is — only the data source changed (local mock -> real backend ledger),
 * not the UI.
 */
export function ledgerEntryToTransaction(entry: LedgerEntry): Transaction {
  const kind: Transaction["kind"] = entry.amountUsdc >= 0 ? "credit" : "debit";

  if (entry.type === "stellar_deposit") {
    return {
      id: entry.entryId,
      merchant: "USDC Deposit (Stellar)",
      category: "topup",
      amountUsdc: Math.abs(entry.amountUsdc),
      kind,
      date: entry.createdAt,
      status: STATUS_MAP[entry.status],
      reference: entry.txHash ?? entry.entryId,
      txHash: entry.txHash,
      verifiedOnChain: true,
    };
  }

  if (entry.type === "simulated_fiat") {
    return {
      id: entry.entryId,
      merchant: `${entry.method ?? "Fiat"} Top-up`,
      category: "topup",
      amountUsdc: Math.abs(entry.amountUsdc),
      kind,
      date: entry.createdAt,
      status: STATUS_MAP[entry.status],
      reference: entry.entryId,
      verifiedOnChain: false,
    };
  }

  // simulated_payment
  return {
    id: entry.entryId,
    merchant: `${entry.method ?? "Local"} Payment`,
    category: "shopping",
    amountUsdc: Math.abs(entry.amountUsdc),
    kind,
    date: entry.createdAt,
    status: STATUS_MAP[entry.status],
    reference: entry.entryId,
    verifiedOnChain: false,
  };
}
