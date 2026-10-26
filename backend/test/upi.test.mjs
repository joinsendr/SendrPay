import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUpiUri, isValidVpa } from "../src/upi.mjs";

test("parses a valid UPI URI with a fixed amount", () => {
  const result = parseUpiUri("upi://pay?pa=merchant@okaxis&pn=Example%20Store&am=250.50&cu=INR&tn=Order%20123");
  assert.equal(result.valid, true);
  assert.equal(result.vpa, "merchant@okaxis");
  assert.equal(result.payeeName, "Example Store");
  assert.equal(result.amountInr, 250.5);
  assert.equal(result.note, "Order 123");
});

test("parses a valid UPI URI with no fixed amount", () => {
  const result = parseUpiUri("upi://pay?pa=merchant@okaxis&pn=Example%20Store");
  assert.equal(result.valid, true);
  assert.equal(result.amountInr, null);
});

test("rejects a non-UPI scheme", () => {
  const result = parseUpiUri("https://pay?pa=merchant@okaxis");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "unsupported_scheme");
});

test("rejects an unsupported UPI action", () => {
  const result = parseUpiUri("upi://mandate?pa=merchant@okaxis");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "unsupported_upi_action");
});

test("rejects a missing payee VPA", () => {
  const result = parseUpiUri("upi://pay?pn=Example%20Store&am=10");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_or_invalid_payee_vpa");
});

test("rejects a malformed payee VPA", () => {
  const result = parseUpiUri("upi://pay?pa=not-a-vpa&am=10");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_or_invalid_payee_vpa");
});

test("rejects a non-INR currency", () => {
  const result = parseUpiUri("upi://pay?pa=merchant@okaxis&am=10&cu=USD");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "unsupported_currency");
});

test("rejects a zero or negative amount", () => {
  assert.equal(parseUpiUri("upi://pay?pa=merchant@okaxis&am=0").valid, false);
  assert.equal(parseUpiUri("upi://pay?pa=merchant@okaxis&am=-5").valid, false);
});

test("rejects garbage that isn't a URI at all", () => {
  const result = parseUpiUri("not a uri at all, just random QR text");
  assert.equal(result.valid, false);
});

test("rejects empty input", () => {
  assert.equal(parseUpiUri("").valid, false);
  assert.equal(parseUpiUri(null).valid, false);
  assert.equal(parseUpiUri(undefined).valid, false);
});

test("isValidVpa accepts well-formed VPAs and rejects malformed ones", () => {
  assert.equal(isValidVpa("someone@okhdfcbank"), true);
  assert.equal(isValidVpa("no-at-sign"), false);
  assert.equal(isValidVpa(""), false);
  assert.equal(isValidVpa(null), false);
});
