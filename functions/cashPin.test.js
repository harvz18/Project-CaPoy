const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CASH_PIN_TTL_MS,
  decryptCashPin,
  generateCashPinRecord,
  hasActiveCashPin,
  verifyCashPin
} = require("./cashPin");

const secret = "cash-pin-test-secret-that-is-long-enough-to-be-secure";
const input = {
  taskId: "task-1",
  clientId: "client-1",
  workerId: "worker-1",
  agreedAmount: "500.00",
  now: new Date("2026-01-01T00:00:00.000Z"),
  secret
};

test("cash PIN records preserve leading zeroes and never store plaintext", () => {
  const generated = generateCashPinRecord({ ...input, random: () => 7 });
  assert.equal(generated.pin, "0007");
  assert.notEqual(generated.record.cashPinCiphertext, generated.pin);
  assert.equal(decryptCashPin(generated.record, secret), generated.pin);
});

test("cash PIN verification is bound to the task, parties, amount, and issued timestamp", () => {
  const generated = generateCashPinRecord(input);
  assert.equal(verifyCashPin({ ...input, record: generated.record, pin: generated.pin }), true);
  assert.equal(verifyCashPin({ ...input, record: generated.record, pin: "9999" }), false);
  assert.equal(verifyCashPin({ ...input, record: generated.record, pin: generated.pin, agreedAmount: "501.00" }), false);
  assert.equal(verifyCashPin({ ...input, record: generated.record, pin: generated.pin, clientId: "other-client" }), false);
});

test("cash PIN activity ends at expiry or after use/lock/invalidation", () => {
  const generated = generateCashPinRecord(input);
  assert.equal(hasActiveCashPin(generated.record, new Date(input.now.getTime() + CASH_PIN_TTL_MS - 1)), true);
  assert.equal(hasActiveCashPin(generated.record, new Date(input.now.getTime() + CASH_PIN_TTL_MS)), false);
  assert.equal(hasActiveCashPin({ ...generated.record, cashPinUsedAt: input.now.toISOString() }, input.now), false);
  assert.equal(hasActiveCashPin({ ...generated.record, cashPinLockedAt: input.now.toISOString() }, input.now), false);
  assert.equal(hasActiveCashPin({ ...generated.record, cashPinInvalidatedAt: input.now.toISOString() }, input.now), false);
});
