const assert = require("node:assert/strict");
const test = require("node:test");
const { createServer } = require("../server");

test("health is public and protected API data requires a bearer token", async () => {
  const server = createServer().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/admin/superadmin/overview`);
    assert.equal(protectedRoute.status, 401);
    const protectedUsers = await fetch(`http://127.0.0.1:${port}/api/admin/users`);
    assert.equal(protectedUsers.status, 401);
    const protectedUserDeletion = await fetch(`http://127.0.0.1:${port}/api/admin/users/delete`, { method: "POST" });
    assert.equal(protectedUserDeletion.status, 401);
    const protectedUserReset = await fetch(`http://127.0.0.1:${port}/api/admin/users/reset-demo`, { method: "POST" });
    assert.equal(protectedUserReset.status, 401);
    const protectedTasks = await fetch(`http://127.0.0.1:${port}/api/admin/tasks`);
    assert.equal(protectedTasks.status, 401);
    const protectedAudit = await fetch(`http://127.0.0.1:${port}/api/admin/audit`);
    assert.equal(protectedAudit.status, 401);
    const protectedModeration = await fetch(`http://127.0.0.1:${port}/api/admin/moderation/account-status`, { method: "POST" });
    assert.equal(protectedModeration.status, 401);
    const protectedVerificationReview = await fetch(`http://127.0.0.1:${port}/api/admin/verifications/review`, { method: "POST" });
    assert.equal(protectedVerificationReview.status, 401);
    const protectedDocumentReview = await fetch(`http://127.0.0.1:${port}/api/admin/verifications/document-review`, { method: "POST" });
    assert.equal(protectedDocumentReview.status, 401);
    const protectedRevenue = await fetch(`http://127.0.0.1:${port}/api/revenue/config`);
    assert.equal(protectedRevenue.status, 401);
    const protectedVerificationCompletion = await fetch(`http://127.0.0.1:${port}/api/verification/complete-missing`, { method: "POST" });
    assert.equal(protectedVerificationCompletion.status, 401);
    const protectedVerificationSubmission = await fetch(`http://127.0.0.1:${port}/api/verification/submit`, { method: "POST" });
    assert.equal(protectedVerificationSubmission.status, 401);
    const protectedProgressRefresh = await fetch(`http://127.0.0.1:${port}/api/verification/progress/refresh`, { method: "POST" });
    assert.equal(protectedProgressRefresh.status, 401);
    const protectedAcceptanceEligibility = await fetch(`http://127.0.0.1:${port}/api/tasks/acceptance-eligibility`, { method: "POST" });
    assert.equal(protectedAcceptanceEligibility.status, 401);
    const protectedTaskAcceptance = await fetch(`http://127.0.0.1:${port}/api/tasks/accept-application`, { method: "POST" });
    assert.equal(protectedTaskAcceptance.status, 401);
    const protectedPostingEligibility = await fetch(`http://127.0.0.1:${port}/api/revenue/fees/posting-eligibility`, { method: "POST" });
    assert.equal(protectedPostingEligibility.status, 401);
    const protectedProgressionEligibility = await fetch(`http://127.0.0.1:${port}/api/revenue/fees/progression-eligibility`, { method: "POST" });
    assert.equal(protectedProgressionEligibility.status, 401);
    const protectedCashPaid = await fetch(`http://127.0.0.1:${port}/api/payments/cash/mark-paid`, { method: "POST" });
    assert.equal(protectedCashPaid.status, 401);
    const protectedCashReceipt = await fetch(`http://127.0.0.1:${port}/api/payments/cash/acknowledge-receipt`, { method: "POST" });
    assert.equal(protectedCashReceipt.status, 401);
    const protectedCashPin = await fetch(`http://127.0.0.1:${port}/api/payments/cash/verify-pin`, { method: "POST" });
    assert.equal(protectedCashPin.status, 401);
    const preflight = await fetch(`http://127.0.0.1:${port}/api/revenue/config`, {
      method: "OPTIONS",
      headers: { Origin: "https://tasklink-fb027.web.app" }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://tasklink-fb027.web.app");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
