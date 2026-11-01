// Client for the penny-drop bank account verification endpoints. See
// backend/src/bankAccounts.mjs for the full flow this mirrors.
import { request } from "./api";

export type BankAccountStatus = "pending_verification" | "verified" | "failed";

export interface BankAccount {
  userId: string;
  bankAccountId: string;
  status: BankAccountStatus;
  accountHolderName: string;
  accountNumberMasked: string;
  ifsc: string;
  attempts: number;
  createdAt: string;
  verifiedAt: string | null;
  // Only ever present in the response right after creation — the backend
  // never returns it again afterward (there is no real bank statement to
  // check it against in this demo, so it's surfaced once here instead,
  // behind an explicit "reveal" in the UI rather than shown by default).
  pennyDropAmount?: number;
}

export interface CreateBankAccountInput {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
}

export const getBankAccount = () => request<{ account: BankAccount | null }>("/bank-account").then((r) => r.account);

export async function createBankAccount(input: CreateBankAccountInput): Promise<BankAccount> {
  const res = await fetch("https://govki2oce0.execute-api.us-east-1.amazonaws.com/bank-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(body?.error ?? `HTTP ${res.status}`), { status: res.status, code: body?.error });
  }
  return body.account as BankAccount;
}

export interface VerifyBankAccountResult {
  valid: boolean;
  account: BankAccount | null;
  attemptsRemaining?: number;
  reason?: string;
}

export async function verifyBankAccount(amount: number): Promise<VerifyBankAccountResult> {
  const res = await fetch("https://govki2oce0.execute-api.us-east-1.amazonaws.com/bank-account/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  const body = await res.json().catch(() => ({}));
  return body as VerifyBankAccountResult;
}
