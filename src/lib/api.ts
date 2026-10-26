// Client for the Sendr Pay backend (AWS Lambda + API Gateway + DynamoDB
// ledger + Stellar testnet polling). See backend/README or the repo root
// README for the full architecture.
const API_BASE = "https://govki2oce0.execute-api.us-east-1.amazonaws.com";

export type LedgerEntryType = "stellar_deposit" | "simulated_fiat" | "simulated_payment";
export type LedgerStatus = "pending" | "confirmed" | "failed" | "reversed";

export interface LedgerEntry {
  entryId: string;
  type: LedgerEntryType;
  status: LedgerStatus;
  amountUsdc: number;
  feeUsdc?: number;
  feeRate?: number;
  txHash: string | null;
  stellarNetwork?: string;
  assetIssuer?: string;
  destination?: string;
  source?: string;
  originalAmount?: number;
  originalCurrency?: string;
  method?: string | null;
  country?: string | null;
  createdAt: string;
  confirmedAt?: string;
}

export interface WalletSnapshot {
  balanceUsdc: number;
  transactions: LedgerEntry[];
}

export interface DepositAddressInfo {
  address: string;
  network: string;
  horizonUrl: string;
  asset: { code: string; issuer: string };
}

export interface CheckDepositsResult extends WalletSnapshot {
  newlyCredited: LedgerEntry[];
  rejected: { txHash: string; reason: string }[];
  checkedAt: string;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status, body });
  }
  return res.json() as Promise<T>;
}

export const getWallet = () => request<WalletSnapshot>("/wallet");

export const getDepositAddress = () => request<DepositAddressInfo>("/wallet/address");

export const checkDeposits = () => request<CheckDepositsResult>("/deposits/check", { method: "POST" });

export const simulateFunding = (amount: number, currency: string, method?: string) =>
  request<{ entry: LedgerEntry } & WalletSnapshot>("/funding/simulate", {
    method: "POST",
    body: JSON.stringify({ amount, currency, method }),
  });

export const simulatePayment = (amount: number, currency: string, method?: string, country?: string) =>
  request<{ entry: LedgerEntry } & WalletSnapshot>("/payments/simulate", {
    method: "POST",
    body: JSON.stringify({ amount, currency, method, country }),
  });

export function stellarExplorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}
