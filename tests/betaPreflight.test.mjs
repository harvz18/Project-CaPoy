import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { evaluateBetaPreflight, parseEnv } from "../scripts/lib/beta-preflight.mjs";

const require = createRequire(import.meta.url);
const resolveAppConfig = require("../app.config.js");

const completeEnv = {
  EXPO_PUBLIC_FIREBASE_API_KEY: "key",
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "beta.example.test",
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "tasklink-beta",
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "tasklink-beta.example.test",
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
  EXPO_PUBLIC_FIREBASE_APP_ID: "app-id",
  EXPO_PUBLIC_SUPPORT_EMAIL: "support@example.test",
  GOOGLE_MAPS_API_KEY: "maps-key"
};

const config = {
  env: completeEnv,
  app: { expo: { extra: { eas: { projectId: "eas-project" } } } },
  eas: { build: { preview: { environment: "preview", distribution: "internal", android: { buildType: "apk" } } } },
  firebaseRc: { projects: { beta: "tasklink-beta" } },
  hasDynamicConfig: true
};

test("beta preflight passes a complete isolated configuration", () => {
  assert.equal(evaluateBetaPreflight(config).every(({ level }) => level === "pass"), true);
});

test("beta preflight fails a Firebase target mismatch", () => {
  const results = evaluateBetaPreflight({ ...config, firebaseRc: { projects: { beta: "wrong-project" } } });
  assert.equal(results.find(({ id }) => id === "firebase:target-match")?.level, "fail");
});

test("distribution-only settings are warnings while core Firebase settings fail closed", () => {
  const results = evaluateBetaPreflight({ ...config, env: {} });
  assert.equal(results.find(({ id }) => id === "support:email")?.level, "warn");
  assert.equal(results.find(({ id }) => id === "maps:android-key")?.level, "warn");
  assert.equal(results.find(({ id }) => id === "env:EXPO_PUBLIC_FIREBASE_PROJECT_ID")?.level, "fail");
});

test("environment parsing ignores comments and preserves equals signs in values", () => {
  assert.deepEqual(parseEnv("# comment\nA=one=two\nB=\"three\"\n"), { A: "one=two", B: "three" });
});

test("dynamic app config injects the Android map key only when configured", () => {
  const original = process.env.GOOGLE_MAPS_API_KEY;
  try {
    delete process.env.GOOGLE_MAPS_API_KEY;
    assert.equal(resolveAppConfig().android.config, undefined);
    process.env.GOOGLE_MAPS_API_KEY = "test-map-key";
    assert.equal(resolveAppConfig().android.config.googleMaps.apiKey, "test-map-key");
  } finally {
    if (original === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = original;
  }
});
