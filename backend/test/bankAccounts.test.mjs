import { test } from "node:test";
import assert from "node:assert/strict";

// Integration tests against a dedicated test table — never the table
// backing the live demo wallet's Settings screen. Same pattern as
// payments.test.mjs.
process.env.BANK_ACCOUNTS_TABLE = "sendrpay_bank_accounts_test";

const { validateBankDetails, createBankAccount, verifyBankAccount, getBankAccount } = await import("../src/bankAccounts.mjs");

function validInput(overrides = {}) {
  return {
    accountHolderName: "Varinder Vaish",
    accountNumber: "123456789012",
    confirmAccountNumber: "123456789012",
    ifsc: "HDFC0001234",
    ...overrides,
  };
}

test("validateBankDetails accepts well-formed details", () => {
  assert.equal(validateBankDetails(validInput()).valid, true);
});

test("validateBankDetails rejects a missing account holder name", () => {
  const result = validateBankDetails(validInput({ accountHolderName: "  " }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_account_holder_name");
});

test("validateBankDetails rejects a malformed account number", () => {
  const result = validateBankDetails(validInput({ accountNumber: "abc123", confirmAccountNumber: "abc123" }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_account_number");
});

test("validateBankDetails rejects mismatched account number confirmation", () => {
  const result = validateBankDetails(validInput({ confirmAccountNumber: "999999999999" }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "account_numbers_do_not_match");
});

test("validateBankDetails rejects a malformed IFSC code", () => {
  const result = validateBankDetails(validInput({ ifsc: "NOTIFSC" }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_ifsc");
});

test("createBankAccount starts a pending_verification record and returns the penny-drop amount once", async () => {
  const account = await createBankAccount(validInput());
  assert.equal(account.status, "pending_verification");
  assert.equal(account.accountNumberMasked, "••••••9012");
  assert.ok(account.pennyDropAmount >= 0.01 && account.pennyDropAmount <= 0.99);
  // Never leaks the real account number to the client.
  assert.equal(account.accountNumber, undefined);
});

test("verifying with the correct amount marks the account verified and clears the secret amount", async () => {
  const created = await createBankAccount(validInput({ accountHolderName: "Test Verify Success" }));
  const result = await verifyBankAccount(created.pennyDropAmount);
  assert.equal(result.valid, true);
  assert.equal(result.record.status, "verified");
  assert.ok(result.record.verifiedAt);
  assert.equal(result.record.pennyDropAmount, undefined);

  const fetched = await getBankAccount();
  assert.equal(fetched.status, "verified");
});

test("verifying with the wrong amount fails and decrements attempts without verifying", async () => {
  const created = await createBankAccount(validInput({ accountHolderName: "Test Verify Wrong" }));
  const wrongAmount = created.pennyDropAmount === 0.5 ? 0.51 : 0.5;
  const result = await verifyBankAccount(wrongAmount);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "incorrect_amount");
  assert.equal(result.record.status, "pending_verification");
  assert.ok(result.attemptsRemaining < 5);
});

test("exhausting all verification attempts marks the account failed", async () => {
  const created = await createBankAccount(validInput({ accountHolderName: "Test Exhaust Attempts" }));
  const wrongAmount = created.pennyDropAmount === 0.5 ? 0.51 : 0.5;
  let last;
  for (let i = 0; i < 5; i++) {
    last = await verifyBankAccount(wrongAmount);
  }
  assert.equal(last.valid, false);
  assert.equal(last.reason, "max_attempts_exceeded");
  assert.equal(last.record.status, "failed");
  assert.equal(last.attemptsRemaining, 0);
});

test("starting a new bank account replaces the previous pending one (changing accounts)", async () => {
  const first = await createBankAccount(validInput({ accountHolderName: "Old Account", accountNumber: "111111111", confirmAccountNumber: "111111111" }));
  assert.equal(first.accountNumberMasked, "••••••1111");

  const second = await createBankAccount(validInput({ accountHolderName: "New Account", accountNumber: "222222222", confirmAccountNumber: "222222222" }));
  assert.equal(second.accountNumberMasked, "••••••2222");

  const fetched = await getBankAccount();
  assert.equal(fetched.accountHolderName, "New Account");
  assert.equal(fetched.accountNumberMasked, "••••••2222");
});
