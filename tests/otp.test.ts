import assert from "node:assert/strict";
import test from "node:test";
import { canResendOtp, getOtpResendRemainingSeconds, isValidOtpCode, sanitizeOtpInput } from "../src/utils/otp";

test("OTP input is numeric and constrained to six digits", () => {
  assert.equal(sanitizeOtpInput("12a-34 5678"), "123456");
  assert.equal(isValidOtpCode("123456"), true);
  assert.equal(isValidOtpCode("12345"), false);
  assert.equal(isValidOtpCode("1234567"), false);
});

test("OTP resend cooldown never treats a future timestamp as ready", () => {
  const requestedAt = 1_000_000;
  assert.equal(getOtpResendRemainingSeconds(requestedAt, requestedAt + 30_000), 30);
  assert.equal(canResendOtp(requestedAt, requestedAt + 59_000), false);
  assert.equal(canResendOtp(requestedAt, requestedAt + 60_000), true);
  assert.equal(canResendOtp(requestedAt, requestedAt - 10_000), false);
});
