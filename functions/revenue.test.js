const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFeeSnapshot,
  calculateServiceFee,
  isActiveRevenueConfigurationForTask,
  isPostingBlockedByPlatformFee,
  normalizeOptionalHttpsUrl,
  pesosToCentavos,
  shouldCreatePlatformFeeForSelection
} = require("./revenue");

test("service fees use exact centavos and half-up rounding", () => {
  assert.equal(calculateServiceFee(pesosToCentavos("500.00")), 2500);
  assert.equal(calculateServiceFee(pesosToCentavos("1000")), 5000);
  assert.equal(calculateServiceFee(pesosToCentavos("10.01")), 50);
});

test("fee snapshots retain the accepted wage and configured rate", () => {
  const fee = buildFeeSnapshot({ task: { id: "task-1", clientId: "employer", workerId: "worker", title: "Clean", category: "Cleaning", agreedAmount: "500" }, config: { rateBasisPoints: 500, gcashAccountName: "TaskLink", gcashNumber: "09170000000", gcashQrImageUrl: "https://example.com/tasklink-qr.png" }, now: "2026-11-17T00:00:00.000Z" });
  assert.equal(fee.workerWage, "500.00"); assert.equal(fee.feeAmount, "25.00"); assert.equal(fee.totalEmployerObligation, "525.00");
  assert.equal(fee.status, "pending_payment");
  assert.equal(fee.obligationCreatedAt, "2026-11-17T00:00:00.000Z");
  assert.deepEqual(fee.auditHistory, [{ action: "obligation_created", status: "pending_payment", at: "2026-11-17T00:00:00.000Z", actorId: "system", reason: null }]);
  assert.equal(fee.destination.gcashQrImageUrl, "https://example.com/tasklink-qr.png");
});

test("optional QR image URLs are limited to HTTPS", () => {
  assert.equal(normalizeOptionalHttpsUrl(""), "");
  assert.equal(normalizeOptionalHttpsUrl("https://example.com/qr.png"), "https://example.com/qr.png");
  assert.throws(() => normalizeOptionalHttpsUrl("http://example.com/qr.png"));
  assert.throws(() => normalizeOptionalHttpsUrl("not-a-url"));
});

test("only unresolved fee-payment states block another task post", () => {
  for (const status of ["pending_payment", "submitted_for_review", "rejected"]) {
    assert.equal(isPostingBlockedByPlatformFee(status), true);
  }
  for (const status of ["verified", "cancelled", "refund_pending", "credited", "waived"]) {
    assert.equal(isPostingBlockedByPlatformFee(status), false);
  }
});

test("only tasks created after an active revenue configuration become fee eligible", () => {
  const config = { enabled: true, gcashAccountName: "TaskLink", gcashNumber: "09170000000", activatedAt: "2026-11-17T00:00:00.000Z" };
  assert.equal(isActiveRevenueConfigurationForTask({ createdAt: "2026-11-17T00:00:00.000Z" }, config), true);
  assert.equal(isActiveRevenueConfigurationForTask({ createdAt: "2026-11-16T23:59:59.999Z" }, config), false);
  assert.equal(isActiveRevenueConfigurationForTask({ createdAt: "2026-11-18T00:00:00.000Z" }, { ...config, enabled: false }), false);
  assert.equal(shouldCreatePlatformFeeForSelection({ task: { createdAt: "2026-11-18T00:00:00.000Z" }, config, hasExistingFee: false }), true);
  assert.equal(shouldCreatePlatformFeeForSelection({ task: { createdAt: "2026-11-18T00:00:00.000Z" }, config, hasExistingFee: true }), false);
});
