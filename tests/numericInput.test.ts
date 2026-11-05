import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidMoneyAmount,
  sanitizeDurationInput,
  sanitizeMoneyInput,
  sanitizePhoneNumberInput,
  sanitizeWholeNumberInput
} from "../src/utils/numericInput";

test("whole-number and duration inputs reject invalid characters and enforce duration limits", () => {
  assert.equal(sanitizeWholeNumberInput("1a-2.3"), "123");
  assert.equal(sanitizeDurationInput("-4"), "4");
  assert.equal(sanitizeDurationInput("0"), "1");
  assert.equal(sanitizeDurationInput("999"), "365");
  assert.equal(sanitizeDurationInput(""), "");
});

test("money inputs retain one decimal separator and at most two cents", () => {
  assert.equal(sanitizeMoneyInput("1,250.509.7"), "1250.50");
  assert.equal(sanitizeMoneyInput(".75"), "0.75");
  assert.equal(sanitizeMoneyInput("12abc"), "12");
  assert.equal(isValidMoneyAmount("1250.50"), true);
  assert.equal(isValidMoneyAmount("0"), false);
  assert.equal(isValidMoneyAmount("1.234"), false);
  assert.equal(isValidMoneyAmount("12.3.4"), false);
});

test("phone input sanitation preserves a single leading international prefix", () => {
  assert.equal(sanitizePhoneNumberInput("+63 (917) 000-0001"), "+63 (917) 000-0001");
  assert.equal(sanitizePhoneNumberInput("+63+917abc"), "+63917");
});
