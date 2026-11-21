import assert from "node:assert/strict";
import test from "node:test";
import { canResendOtp, getOtpResendRemainingSeconds, isValidOtpCode, sanitizeOtpInput } from "../src/utils/otp";
import { formatPhilippineMobileForInput, normalizePhilippineMobileNumber, normalizeStoredPhilippineMobileNumber, phoneVerificationErrorMessage, removePhilippineMobileLeadingZero } from "../src/domain/phoneVerification";

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

test("phone verification accepts local, compact, and E.164 Philippine formats and keeps the E.164 number", () => {
  assert.equal(normalizePhilippineMobileNumber("0917 123 4567"), "+639171234567");
  assert.equal(normalizePhilippineMobileNumber("9171234567"), "+639171234567");
  assert.equal(normalizePhilippineMobileNumber("+639171234567"), "+639171234567");
  assert.equal(normalizePhilippineMobileNumber("0917123456"), undefined);
  assert.equal(removePhilippineMobileLeadingZero("0917 123 4567"), "9171234567");
  assert.equal(removePhilippineMobileLeadingZero("0917123456"), "0917123456");
  assert.equal(normalizeStoredPhilippineMobileNumber("9171234567"), "+639171234567");
  assert.equal(formatPhilippineMobileForInput("9171234567"), "09171234567");
  assert.match(phoneVerificationErrorMessage({ code: "auth/code-expired" }), /expired/i);
  assert.match(phoneVerificationErrorMessage({ code: "auth/credential-already-in-use" }), /another account/i);
});
