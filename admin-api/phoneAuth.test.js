const assert = require("node:assert/strict");
const test = require("node:test");
const { buildVerifiedPhoneUpdate, hasMatchingVerifiedPhone, normalizePhilippineMobileNumber, normalizeStoredPhilippineMobileNumber } = require("./phoneAuth");

test("trusted phone verification accepts only the supported Philippine formats", () => {
  assert.equal(normalizePhilippineMobileNumber("0917 123 4567"), "+639171234567");
  assert.equal(normalizePhilippineMobileNumber("+639171234567"), "+639171234567");
  assert.equal(normalizePhilippineMobileNumber("9171234567"), undefined);
  assert.equal(normalizeStoredPhilippineMobileNumber("9171234567"), "+639171234567");
});

test("trusted phone verification requires Firebase Auth and profile numbers to match", () => {
  assert.equal(buildVerifiedPhoneUpdate("09171234567", "+639171234567", "now").phoneVerified, true);
  assert.throws(() => buildVerifiedPhoneUpdate("09171234567", "+639181234567", "now"));
  assert.equal(hasMatchingVerifiedPhone("09171234567", "+639171234567"), true);
  assert.equal(hasMatchingVerifiedPhone("9171234567", "+639171234567"), true);
  assert.equal(hasMatchingVerifiedPhone("09171234567", "+639181234567"), false);
});
