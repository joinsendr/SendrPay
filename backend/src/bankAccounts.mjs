// Penny-drop bank account verification — PayPal/Stripe-style: we "send" a
// small random amount to the customer's bank account, they check their
// statement and type the amount back in, and only then is the account
// considered verified and usable for payouts (specifically intended as a
// precondition for selling crypto for INR, once that flow exists).
//
// No real bank transfer happens here. This Lambda has no connection to any
// real payment rail — the "send" step is a simulated adapter, exactly like
// backend/src/indiaPayoutAdapter.mjs for UPI payouts. The amount is
// generated and compared server-side; it is returned to the client once,
// at creation time, only because there is no real external channel (a real
// bank SMS/statement) for a demo user to discover it any other way.
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { BANK_ACCOUNTS_TABLE, BANK_VERIFY_MAX_ATTEMPTS } from "./config.mjs";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

// Single shared demo wallet — no auth system in this prototype, same
// constant used by the payment orchestrator.
const USER_ID = "demo-wallet";

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^[0-9]{9,18}$/;

export function validateBankDetails({ accountHolderName, accountNumber, confirmAccountNumber, ifsc }) {
  if (!accountHolderName || !accountHolderName.trim()) {
    return { valid: false, reason: "missing_account_holder_name" };
  }
  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber ?? "")) {
    return { valid: false, reason: "invalid_account_number" };
  }
  if (accountNumber !== confirmAccountNumber) {
    return { valid: false, reason: "account_numbers_do_not_match" };
  }
  if (!IFSC_PATTERN.test((ifsc ?? "").toUpperCase())) {
    return { valid: false, reason: "invalid_ifsc" };
  }
  return { valid: true };
}

function maskAccountNumber(accountNumber) {
  return `••••••${accountNumber.slice(-4)}`;
}

// Strips server-only fields (the real account number, the penny-drop
// amount once it's no longer fresh) before anything goes back to a client.
function toClientRecord(record, { includeAmount } = {}) {
  if (!record) return null;
  const { accountNumber: _accountNumber, pennyDropAmount, ...rest } = record;
  return includeAmount ? { ...rest, pennyDropAmount } : rest;
}

export async function getBankAccount() {
  const res = await doc.send(new GetCommand({ TableName: BANK_ACCOUNTS_TABLE, Key: { userId: USER_ID } }));
  return toClientRecord(res.Item ?? null);
}

/**
 * Starts (or restarts) verification for a bank account, replacing whatever
 * was there before — this prototype supports exactly one active/pending
 * account per user, matching "changing your bank account means verifying
 * a new one the same way."
 */
export async function createBankAccount(input) {
  const check = validateBankDetails(input);
  if (!check.valid) {
    const err = new Error(check.reason);
    err.code = check.reason;
    throw err;
  }

  const pennyDropAmount = Math.round((Math.random() * 0.98 + 0.01) * 100) / 100; // 0.01–0.99 INR
  const now = new Date().toISOString();
  const record = {
    userId: USER_ID,
    bankAccountId: randomUUID(),
    status: "pending_verification",
    accountHolderName: input.accountHolderName.trim(),
    accountNumber: input.accountNumber, // server-side only; never returned as-is
    accountNumberMasked: maskAccountNumber(input.accountNumber),
    ifsc: input.ifsc.toUpperCase(),
    pennyDropAmount,
    attempts: 0,
    createdAt: now,
    verifiedAt: null,
  };

  await doc.send(new PutCommand({ TableName: BANK_ACCOUNTS_TABLE, Item: record }));
  return toClientRecord(record, { includeAmount: true });
}

/**
 * @returns {Promise<{ valid: boolean, record: object|null, attemptsRemaining?: number, reason?: string }>}
 */
export async function verifyBankAccount(amount) {
  const res = await doc.send(new GetCommand({ TableName: BANK_ACCOUNTS_TABLE, Key: { userId: USER_ID } }));
  const record = res.Item;
  if (!record) {
    return { valid: false, record: null, reason: "no_pending_account" };
  }
  if (record.status !== "pending_verification") {
    return { valid: false, record: toClientRecord(record), reason: "not_pending" };
  }

  const submitted = Math.round(Number(amount) * 100) / 100;
  const matches = Number.isFinite(submitted) && submitted === record.pennyDropAmount;

  if (matches) {
    const now = new Date().toISOString();
    await doc.send(
      new UpdateCommand({
        TableName: BANK_ACCOUNTS_TABLE,
        Key: { userId: USER_ID },
        UpdateExpression: "SET #status = :verified, verifiedAt = :now REMOVE pennyDropAmount",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":verified": "verified", ":now": now },
      })
    );
    const updated = await getBankAccount();
    return { valid: true, record: updated };
  }

  const attempts = record.attempts + 1;
  const exhausted = attempts >= BANK_VERIFY_MAX_ATTEMPTS;
  await doc.send(
    new UpdateCommand({
      TableName: BANK_ACCOUNTS_TABLE,
      Key: { userId: USER_ID },
      UpdateExpression: "SET attempts = :attempts, #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":attempts": attempts, ":status": exhausted ? "failed" : "pending_verification" },
    })
  );
  return {
    valid: false,
    record: toClientRecord({ ...record, attempts, status: exhausted ? "failed" : "pending_verification" }),
    attemptsRemaining: Math.max(0, BANK_VERIFY_MAX_ATTEMPTS - attempts),
    reason: exhausted ? "max_attempts_exceeded" : "incorrect_amount",
  };
}
