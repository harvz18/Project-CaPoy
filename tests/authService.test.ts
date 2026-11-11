import assert from "node:assert/strict";
import test from "node:test";
import { getAuthErrorMessage } from "../src/services/authService";

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
