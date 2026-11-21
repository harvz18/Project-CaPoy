const assert = require("node:assert/strict");
const test = require("node:test");
const { allowedOrigins } = require("./server");

test("phone verification API permits the hosted app and local Expo web origins", () => {
  const origins = allowedOrigins();
  assert.equal(origins.has("https://tasklink-fb027.web.app"), true);
  assert.equal(origins.has("http://localhost:8081"), true);
  assert.equal(origins.has("http://127.0.0.1:8081"), true);
});
