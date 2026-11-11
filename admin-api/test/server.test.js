const assert = require("node:assert/strict");
const test = require("node:test");
const { createServer } = require("../server");

async function withServer(run) {
  const server = createServer().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health endpoint is public and protected routes reject missing credentials", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const protectedRoute = await fetch(`${baseUrl}/api/admin/analytics`, { method: "POST" });
    assert.equal(protectedRoute.status, 401);
    assert.equal((await protectedRoute.json()).error, "Sign in to continue.");

    const profileLookup = await fetch(`${baseUrl}/api/admin/profiles/lookup`, { method: "POST" });
    assert.equal(profileLookup.status, 401);
    assert.equal((await profileLookup.json()).error, "Sign in to continue.");

    const moderationLookup = await fetch(`${baseUrl}/api/admin/profiles/moderation-lookup`, { method: "POST" });
    assert.equal(moderationLookup.status, 401);
    assert.equal((await moderationLookup.json()).error, "Sign in to continue.");
  });
});
