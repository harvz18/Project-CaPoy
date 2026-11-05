import assert from "node:assert/strict";
import test from "node:test";
import { getRoleHomeRoute, goBackOrHome } from "../src/utils/navigation";

test("role-aware fallback returns the correct safe home route", () => {
  assert.equal(getRoleHomeRoute("worker", "user"), "/worker-dashboard");
  assert.equal(getRoleHomeRoute("client", "user"), "/client-dashboard");
  assert.equal(getRoleHomeRoute("admin", "admin"), "/admin");
  assert.equal(getRoleHomeRoute("admin", "superadmin"), "/superadmin");
  assert.equal(getRoleHomeRoute(), "/login");
});

test("safe back uses history when it exists and a role home route when it does not", () => {
  let backCalls = 0;
  const replacements: string[] = [];
  const withHistory = {
    canGoBack: () => true,
    back: () => { backCalls += 1; },
    replace: (route: string) => { replacements.push(route); }
  };
  goBackOrHome(withHistory, "worker", "user");
  assert.equal(backCalls, 1);
  assert.deepEqual(replacements, []);

  const withoutHistory = {
    canGoBack: () => false,
    back: () => { throw new Error("Back should not run without history."); },
    replace: (route: string) => { replacements.push(route); }
  };
  goBackOrHome(withoutHistory, "client", "user");
  assert.deepEqual(replacements, ["/client-dashboard"]);
});
