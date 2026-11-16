import { UserProfile } from "../types";

/** Marketplace privileges are granted only by an administrator-reviewed status. */
export function isMarketplaceVerified(user: Pick<UserProfile, "verificationStatus" | "identityStatus">) {
  // `identityStatus` preserves access for legacy records approved before the
  // explicit VerificationStatus field was introduced.
  return user.verificationStatus === "Verified" || user.identityStatus === "Approved";
}

export function verificationRequiredMessage(user: Pick<UserProfile, "verificationStatus" | "identityStatus" | "verificationReviewReason">, action: string) {
  if (user.verificationStatus === "Pending Verification" || user.identityStatus === "Pending Approval") {
    return `Your verification is pending administrator review. You must be verified before you can ${action}.`;
  }
  if (user.verificationStatus === "Rejected" || user.identityStatus === "Rejected" || user.identityStatus === "Needs Resubmission" || user.verificationStatus === "Needs Resubmission") {
    return `Your verification was rejected. ${user.verificationReviewReason || "Review the reason and resubmit your documents."}`;
  }
  return `Your account must be verified before you can ${action}.`;
}
