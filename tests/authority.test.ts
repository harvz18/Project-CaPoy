import assert from "node:assert/strict";
import test from "node:test";
import { authorityFromClaims, isStaffAuthority, resolveProfileAuthority } from "../src/domain/authority";

test("client authority uses boolean custom claims and prefers superadmin", () => {
  assert.equal(authorityFromClaims(undefined), "user");
  assert.equal(authorityFromClaims({ admin: true }), "admin");
  assert.equal(authorityFromClaims({ admin: true, superadmin: true }), "superadmin");
  assert.equal(authorityFromClaims({ admin: "true" }), "user");
});

test("a public profile role cannot grant staff authority", () => {
  assert.equal(resolveProfileAuthority("worker", { superadmin: true }), "user");
  assert.equal(resolveProfileAuthority("client", { admin: true }), "user");
  assert.equal(resolveProfileAuthority("admin", { admin: true }), "admin");
  assert.equal(resolveProfileAuthority("admin", { superadmin: true }), "superadmin");
  assert.equal(isStaffAuthority("user"), false);
  assert.equal(isStaffAuthority("superadmin"), true);
});
