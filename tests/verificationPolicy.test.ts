import assert from "node:assert/strict";
import test from "node:test";
import { isMarketplaceVerified, verificationRequiredMessage } from "../src/domain/verificationPolicy";
import { calculateVerificationProgress, verificationProgressPublicLabel } from "../src/domain/verificationProgress";

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

test("verification progress remains separate from official marketplace verification", () => {
  const profile = {
    fullName: "Tasker Person",
    mobileNumber: "09171234567",
    address: "Bacolod City",
    validIdUrl: "valid-id",
    selfieWithIdUrl: "selfie",
    medicalCertificateUrl: "medical",
    policeClearanceUrl: "police",
    verificationStatus: "Pending Verification" as const
  };
  const progress = calculateVerificationProgress(profile, {
    status: "Pending Verification",
    documentReviews: {
      "valid-id": { status: "Verified" },
      "selfie-with-id": { status: "Verified" },
      "medical-certificate": { status: "Verified" },
      "police-clearance": { status: "Pending" }
    }
  });
  assert.equal(progress.percentage, 65);
  assert.equal(isMarketplaceVerified(profile), false);
  assert.equal(verificationProgressPublicLabel({ ...profile, verificationProgress: progress.percentage }), "Verification: 65% complete");
});

test("legacy verified accounts remain fully verified in progress displays", () => {
  const progress = calculateVerificationProgress({ fullName: "Legacy User", mobileNumber: "09171234567", address: "Bacolod", verificationStatus: "Verified" });
  assert.equal(progress.percentage, 100);
});
