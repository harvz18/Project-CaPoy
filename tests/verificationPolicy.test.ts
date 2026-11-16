import assert from "node:assert/strict";
import test from "node:test";
import { isMarketplaceVerified, verificationRequiredMessage } from "../src/domain/verificationPolicy";

test("only an administrator-approved identity grants marketplace access", () => {
  assert.equal(isMarketplaceVerified({ verificationStatus: "Verified" }), true);
  assert.equal(isMarketplaceVerified({ identityStatus: "Approved" }), true);
  assert.equal(isMarketplaceVerified({ verificationStatus: "Pending Verification", identityStatus: "Pending Approval" }), false);
  assert.equal(isMarketplaceVerified({ verificationStatus: "Rejected", identityStatus: "Rejected" }), false);
});

test("verification feedback distinguishes pending and rejected accounts", () => {
  assert.match(verificationRequiredMessage({ verificationStatus: "Pending Verification" }, "post tasks"), /pending administrator review/i);
  assert.match(verificationRequiredMessage({ verificationStatus: "Rejected", verificationReviewReason: "ID is unreadable." }, "apply to tasks"), /ID is unreadable/);
});
