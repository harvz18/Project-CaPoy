const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFeeSnapshot, calculateServiceFee, pesosToCentavos } = require("./revenue");

test("service fees use exact centavos and half-up rounding", () => {
  assert.equal(calculateServiceFee(pesosToCentavos("500.00")), 2500);
  assert.equal(calculateServiceFee(pesosToCentavos("1000")), 5000);
  assert.equal(calculateServiceFee(pesosToCentavos("10.01")), 50);
});

test("fee snapshots retain the accepted wage and configured rate", () => {
  const fee = buildFeeSnapshot({ task: { id: "task-1", clientId: "employer", workerId: "worker", title: "Clean", category: "Cleaning", agreedAmount: "500" }, config: { rateBasisPoints: 500, gcashAccountName: "TaskLink", gcashNumber: "09170000000" }, now: "2026-11-17T00:00:00.000Z" });
  assert.equal(fee.workerWage, "500.00"); assert.equal(fee.feeAmount, "25.00"); assert.equal(fee.totalEmployerObligation, "525.00");
});
