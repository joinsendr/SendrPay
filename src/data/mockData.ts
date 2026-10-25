import type { Transaction } from "../types";

// Demo data only — Sendr Pay does not process real transactions yet.
export const MOCK_BALANCE_USDC = 100.0;
export const MOCK_FX_RATE_INR_PER_USDC = 85.0; // illustrative only, not live

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "txn_1",
    merchant: "Grocery Store",
    category: "grocery",
    amountUsdc: 12.5,
    kind: "debit",
    date: "2026-10-25T09:14:00Z",
    status: "completed",
    reference: "SPX-8841-GC",
  },
  {
    id: "txn_2",
    merchant: "Coffee Shop",
    category: "coffee",
    amountUsdc: 4.0,
    kind: "debit",
    date: "2026-10-24T16:02:00Z",
    status: "completed",
    reference: "SPX-8830-CF",
  },
  {
    id: "txn_3",
    merchant: "Wallet Top-up",
    category: "topup",
    amountUsdc: 50.0,
    kind: "credit",
    date: "2026-10-23T11:45:00Z",
    status: "completed",
    reference: "SPX-8812-TU",
  },
  {
    id: "txn_4",
    merchant: "Restaurant",
    category: "restaurant",
    amountUsdc: 18.0,
    kind: "debit",
    date: "2026-10-22T19:30:00Z",
    status: "completed",
    reference: "SPX-8795-RT",
  },
  {
    id: "txn_5",
    merchant: "Auto Rickshaw",
    category: "transport",
    amountUsdc: 2.25,
    kind: "debit",
    date: "2026-10-21T08:05:00Z",
    status: "completed",
    reference: "SPX-8780-TR",
  },
  {
    id: "txn_6",
    merchant: "Local Market",
    category: "shopping",
    amountUsdc: 9.75,
    kind: "debit",
    date: "2026-10-20T13:50:00Z",
    status: "completed",
    reference: "SPX-8761-SH",
  },
];
