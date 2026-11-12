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
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
