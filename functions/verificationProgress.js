const DOCUMENT_KINDS = ["valid-id", "selfie-with-id", "medical-certificate", "police-clearance"];
const DOCUMENT_STATUS = new Set(["Pending", "Verified", "Needs Resubmission", "Rejected"]);

const profileFieldByKind = {
  "valid-id": "validIdUrl",
  "selfie-with-id": "selfieWithIdUrl",
  "medical-certificate": "medicalCertificateUrl",
  "police-clearance": "policeClearanceUrl"
};
const requestFieldByKind = {
  "valid-id": "validIdPath",
  "selfie-with-id": "selfieWithIdPath",
  "medical-certificate": "medicalCertificatePath",
  "police-clearance": "policeClearancePath"
};

function hasText(value, minimumLength = 1) {
  return typeof value === "string" && value.trim().length >= minimumLength;
}

function documentDecision(user, verification, kind) {
  const hasDocument = hasText(user?.[profileFieldByKind[kind]]) || hasText(verification?.[requestFieldByKind[kind]]);
  if (!hasDocument) return "Missing";
  const reviewed = verification?.documentReviews?.[kind]?.status;
  if (DOCUMENT_STATUS.has(reviewed)) return reviewed;
  if (user?.verificationStatus === "Verified" || user?.identityStatus === "Approved") return "Verified";
  if (verification?.status === "Rejected" || user?.verificationStatus === "Rejected") return "Rejected";
  if (verification?.status === "Needs Resubmission" || user?.verificationStatus === "Needs Resubmission") return "Needs Resubmission";
  return "Pending";
}

function calculateVerificationProgress(user = {}, verification = {}) {
  if (user.verificationStatus === "Verified" || user.identityStatus === "Approved") {
    return {
      percentage: 100,
      level: "Verification Complete",
      profileComplete: true,
      allDocumentsVerified: true,
      documents: Object.fromEntries(DOCUMENT_KINDS.map((kind) => [kind, "Verified"]))
    };
  }
  const documents = Object.fromEntries(DOCUMENT_KINDS.map((kind) => [kind, documentDecision(user, verification, kind)]));
  const identityVerified = documents["valid-id"] === "Verified" && documents["selfie-with-id"] === "Verified";
  const medicalVerified = documents["medical-certificate"] === "Verified";
  const policeVerified = documents["police-clearance"] === "Verified";
  const profileComplete = hasText(user.profilePhotoUrl);
  const allDocumentsVerified = identityVerified && medicalVerified && policeVerified;
  const percentage = (profileComplete ? 10 : 0) + (identityVerified ? 60 : 0)
    + (medicalVerified ? 15 : 0) + (policeVerified ? 15 : 0);
  const level = percentage === 100 ? "Verification Complete" : percentage >= 70 ? "Near Completion" : percentage >= 40 ? "In Progress" : "Incomplete";
  return { percentage, level, profileComplete, allDocumentsVerified, documents };
}

function documentReviewsForSubmission(previous, submitted, now) {
  const reviews = {};
  for (const kind of DOCUMENT_KINDS) {
    const oldPath = previous?.[requestFieldByKind[kind]];
    const oldReview = previous?.documentReviews?.[kind];
    if (oldPath === submitted[kind] && oldReview?.status === "Verified") {
      reviews[kind] = oldReview;
    } else {
      reviews[kind] = { status: "Pending", reviewedAt: now };
    }
  }
  return reviews;
}

module.exports = { DOCUMENT_KINDS, calculateVerificationProgress, documentReviewsForSubmission, requestFieldByKind, profileFieldByKind };
