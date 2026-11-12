import assert from "node:assert/strict";
import test from "node:test";
import { getAuthErrorMessage, getEmailVerificationState, isDeliverableEmail, isTasklinkMobileAlias } from "../src/services/authService";

test("auth configuration errors tell Expo Go testers how to recover", () => {
  assert.equal(
    getAuthErrorMessage({ code: "auth/operation-not-allowed" }),
    "Email/Password sign-in is not enabled for this Firebase project."
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/invalid-api-key" }),
    "This Expo session has an invalid Firebase configuration. Restart the development server after checking its .env file."
  );
});

test("only a real email is eligible for Firebase email links", () => {
  assert.equal(isTasklinkMobileAlias("639171234567@tasklink.local"), true);
  assert.equal(isDeliverableEmail("639171234567@tasklink.local"), false);
  assert.equal(isDeliverableEmail("member@example.com"), true);
  assert.equal(isDeliverableEmail("not-an-email"), false);
  assert.deepEqual(getEmailVerificationState({ email: "639171234567@tasklink.local", emailVerified: false } as never), {
    available: false,
    verified: false,
    reason: "mobile-alias"
  });
});

test("email action errors remain actionable without exposing account membership", () => {
  assert.equal(getAuthErrorMessage({ code: "auth/requires-recent-login" }), "Please sign in again before changing this security setting.");
  assert.equal(getAuthErrorMessage({ code: "auth/unauthorized-continue-uri" }), "Firebase email links are not configured for this app yet. Contact support.");
});
