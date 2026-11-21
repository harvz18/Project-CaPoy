import type { UserProfile, VerificationStatus } from "../types";

export const verificationDocumentKinds = [
  "valid-id",
  "selfie-with-id",
  "medical-certificate",
  "police-clearance"
] as const;

export type VerificationDocumentKind = (typeof verificationDocumentKinds)[number];
export type VerificationDocumentDecision = "Pending" | "Verified" | "Needs Resubmission" | "Rejected" | "Missing";
export type VerificationDocumentReview = {
  status: Exclude<VerificationDocumentDecision, "Missing">;
  reviewedAt?: string;
  reviewedBy?: string;
  reason?: string | null;
};
export type VerificationDocumentReviews = Partial<Record<VerificationDocumentKind, VerificationDocumentReview>>;
export type VerificationProgressLevel = "Incomplete" | "In Progress" | "Near Completion" | "Verification Complete";

type ProgressProfile = Pick<
  UserProfile,
  "profilePhotoUrl" | "validIdUrl" | "selfieWithIdUrl" | "medicalCertificateUrl" | "policeClearanceUrl" | "verificationStatus" | "identityStatus"
>;

type ProgressRequest = {
  validIdPath?: string;
  selfieWithIdPath?: string;
  medicalCertificatePath?: string;
  policeClearancePath?: string;
  status?: VerificationStatus;
  documentReviews?: VerificationDocumentReviews;
};

export type VerificationProgress = {
  percentage: number;
  level: VerificationProgressLevel;
  profileComplete: boolean;
  allDocumentsVerified: boolean;
  documents: Record<VerificationDocumentKind, VerificationDocumentDecision>;
  criteria: Array<{ label: string; percentage: number; complete: boolean }>;
};

const profileFieldByKind: Record<VerificationDocumentKind, keyof ProgressProfile> = {
  "valid-id": "validIdUrl",
  "selfie-with-id": "selfieWithIdUrl",
  "medical-certificate": "medicalCertificateUrl",
  "police-clearance": "policeClearanceUrl"
};

const requestFieldByKind: Record<VerificationDocumentKind, keyof ProgressRequest> = {
  "valid-id": "validIdPath",
  "selfie-with-id": "selfieWithIdPath",
  "medical-certificate": "medicalCertificatePath",
  "police-clearance": "policeClearancePath"
};

function hasText(value: unknown, minimumLength = 1) {
  return typeof value === "string" && value.trim().length >= minimumLength;
}

function legacyDecision(
  profile: ProgressProfile,
  request: ProgressRequest | undefined,
  hasDocument: boolean
): VerificationDocumentDecision {
  if (!hasDocument) return "Missing";
  if (profile.verificationStatus === "Verified" || profile.identityStatus === "Approved") return "Verified";
  if (request?.status === "Rejected" || profile.verificationStatus === "Rejected") return "Rejected";
  if (request?.status === "Needs Resubmission" || profile.verificationStatus === "Needs Resubmission") return "Needs Resubmission";
  return "Pending";
}

export function getVerificationDocumentDecision(
  profile: ProgressProfile,
  request: ProgressRequest | undefined,
  kind: VerificationDocumentKind
): VerificationDocumentDecision {
  const hasDocument = hasText(profile[profileFieldByKind[kind]]) || hasText(request?.[requestFieldByKind[kind]]);
  const reviewed = request?.documentReviews?.[kind]?.status;
  if (reviewed === "Verified" || reviewed === "Pending" || reviewed === "Needs Resubmission" || reviewed === "Rejected") {
    return hasDocument ? reviewed : "Missing";
  }
  return legacyDecision(profile, request, hasDocument);
}

export function hasVerificationProfilePhoto(profile: ProgressProfile) {
  return hasText(profile.profilePhotoUrl);
}

export function calculateVerificationProgress(profile: ProgressProfile, request?: ProgressRequest): VerificationProgress {
  // Earlier approved accounts did not store individual document decisions.
  // Their official verification remains authoritative rather than forcing a
  // legacy user to submit documents again solely to populate this display.
  if (profile.verificationStatus === "Verified" || profile.identityStatus === "Approved") {
    return {
      percentage: 100,
      level: "Verification Complete",
      profileComplete: true,
      allDocumentsVerified: true,
      documents: Object.fromEntries(verificationDocumentKinds.map((kind) => [kind, "Verified"])) as Record<VerificationDocumentKind, VerificationDocumentDecision>,
      criteria: [
        { label: "Profile picture uploaded", percentage: 10, complete: true },
        { label: "Government ID and matching selfie", percentage: 60, complete: true },
        { label: "Medical certificate", percentage: 15, complete: true },
        { label: "Police clearance", percentage: 15, complete: true }
      ]
    };
  }
  const documents = Object.fromEntries(verificationDocumentKinds.map((kind) => [
    kind,
    getVerificationDocumentDecision(profile, request, kind)
  ])) as Record<VerificationDocumentKind, VerificationDocumentDecision>;
  const identityVerified = documents["valid-id"] === "Verified" && documents["selfie-with-id"] === "Verified";
  const medicalVerified = documents["medical-certificate"] === "Verified";
  const policeVerified = documents["police-clearance"] === "Verified";
  const profileComplete = hasVerificationProfilePhoto(profile);
  const allDocumentsVerified = identityVerified && medicalVerified && policeVerified;
  const percentage = (profileComplete ? 10 : 0)
    + (identityVerified ? 60 : 0)
    + (medicalVerified ? 15 : 0)
    + (policeVerified ? 15 : 0);
  const level: VerificationProgressLevel = percentage === 100
    ? "Verification Complete"
    : percentage >= 70 ? "Near Completion"
      : percentage >= 40 ? "In Progress"
        : "Incomplete";

  return {
    percentage,
    level,
    profileComplete,
    allDocumentsVerified,
    documents,
    criteria: [
      { label: "Profile picture uploaded", percentage: 10, complete: profileComplete },
      { label: "Government ID and matching selfie", percentage: 60, complete: identityVerified },
      { label: "Medical certificate", percentage: 15, complete: medicalVerified },
      { label: "Police clearance", percentage: 15, complete: policeVerified }
    ]
  };
}

export function verificationProgressPublicLabel(profile: ProgressProfile & Pick<UserProfile, "verificationProgress">) {
  if (profile.verificationStatus === "Verified" || profile.identityStatus === "Approved") return "Verified";
  const percentage = typeof profile.verificationProgress === "number"
    ? Math.max(0, Math.min(100, Math.round(profile.verificationProgress)))
    : calculateVerificationProgress(profile).percentage;
  return `Verification: ${percentage}% complete`;
}
