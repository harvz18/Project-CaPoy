import assert from "node:assert/strict";
import test from "node:test";
import { formatPhilippineMobileNumber, normalizePhilippineMobileNumber } from "../src/domain/gcashPayment";

test("GCash receiving numbers accept Philippine local and international formats", () => {
  assert.equal(normalizePhilippineMobileNumber("09171234567"), "09171234567");
  assert.equal(normalizePhilippineMobileNumber("9171234567"), "09171234567");
  assert.equal(normalizePhilippineMobileNumber("+639171234567"), "09171234567");
  assert.equal(normalizePhilippineMobileNumber("0917 123 4567"), "09171234567");
});

test("GCash receiving numbers reject malformed or non-Philippine values", () => {
  assert.equal(normalizePhilippineMobileNumber("0917123456"), undefined);
  assert.equal(normalizePhilippineMobileNumber("+63917123456"), undefined);
  assert.equal(normalizePhilippineMobileNumber("+14155552671"), undefined);
});

test("GCash receiving numbers have a readable display form", () => {
  assert.equal(formatPhilippineMobileNumber("+639171234567"), "0917 123 4567");
});
