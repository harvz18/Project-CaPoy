export type Role = "worker" | "client" | "admin";
export type PublicRole = Exclude<Role, "admin">;
export type Authority = "user" | "admin" | "superadmin";

export type TaskStatus =
  | "Finding Workers"
  | "Applied"
  | "Accepted"
  | "In Progress"
  | "Pending Approval"
  | "Finished"
  | "Archived"
  | "Cancelled"
  | "Disputed"
  | "Expired";

export type PaymentMethod = "COD" | "GCash link";
export type PaymentStatus = "Pending" | "Submitted" | "Verified" | "Rejected";
export type VerificationStatus = "Pending Verification" | "Verified" | "Rejected" | "Needs Resubmission";
export type IdentityStatus = "Unverified" | "Pending Approval" | "Approved" | "Rejected" | "Needs Resubmission";
export type AccountStatus = "active" | "pending_verification" | "suspended" | "deleted";
export type LocationSource = "device" | "manual" | "map";

export type UserProfile = {
  id: string;
  role: Role;
  fullName: string;
  mobileNumber: string;
  address: string;
  rating: number;
  accountStatus?: AccountStatus;
  restrictionReason?: string | null;
  restrictionEvidenceReference?: string | null;
  restrictedAt?: string;
  restrictedBy?: string;
  reactivatedAt?: string;
  reactivatedBy?: string;
  ratingCount?: number;
  ratingTotal?: number;
  skills?: string[];
  capabilities?: string[];
  availabilityStatus?: "Available" | "Busy";
  availability?: "Available" | "Busy" | "Unavailable";
  businessName?: string;
  profilePhoto?: string;
  profilePhotoUrl?: string;
  experienceDescription?: string;
  yearsOfExperience?: string;
  validIdType?: string;
  validIdUrl?: string;
  medicalCertificateUrl?: string;
  verificationStatus?: VerificationStatus;
  identityStatus?: IdentityStatus;
  identityApprovedAt?: string;
  identityApprovedBy?: string;
  identityLockedAt?: string;
  phoneVerified?: boolean;
  thirdPartyProvider?: "none" | "google";
  currentLatitude?: number;
  currentLongitude?: number;
  locationUpdatedAt?: string;
  locationAccuracyMeters?: number;
  locationSource?: Extract<LocationSource, "device" | "manual">;
  preferredRadiusKm?: number;
  completedTasks?: number;
  activeTaskId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Task = {
  id: string;
  clientId: string;
  workerId?: string;
  applicantIds?: string[];
  lastApplicationWorkerId?: string;
  lastApplicationMatchId?: string;
  lastApplicationAction?: "Applied" | "Withdrawn" | "Rejected";
  selectedMatchId?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
  locationCapturedAt?: string;
  locationAccuracyMeters?: number;
  locationSource?: LocationSource;
  requiredCapability?: string;
  wage: string;
  estimatedDuration: string;
  status: TaskStatus;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  proofOfPaymentUrl?: string;
  proofOfPaymentText?: string;
  clientConfirmedAt?: string;
  workerConfirmedAt?: string;
  paymentReviewedAt?: string;
  paymentReviewedBy?: string;
  paymentReviewReason?: string;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  workerFinishedAt?: string;
  finishedAt?: string;
  archivedAt?: string;
  cancelledAt?: string;
  disputedAt?: string;
  expiresAt?: string;
  updatedAt?: string;
};

export type ChatMessage = {
  id: string;
  conversationId?: string;
  taskId: string;
  senderId: string;
  receiverId: string;
  participantIds?: string[];
  message: string;
  timestamp: string;
  readAt?: string;
};

export type Rating = {
  id: string;
  reviewerId: string;
  targetUserId: string;
  taskId: string;
  score: number;
  feedback: string;
};

export type MatchScoreBreakdown = {
  skill: number;
  proximity: number;
  availability: number;
  verification: number;
  experience: number;
  rating: number;
  completedTasks: number;
};

export type AppNotification = {
  id: string;
  userId: string;
  notificationType: string;
  taskId?: string;
  createdBy?: string;
  message: string;
  readStatus: boolean;
  createdAt: string;
  route?: "task" | "chat";
  senderId?: string;
  conversationId?: string;
  matchScore?: number;
  matchReasons?: string[];
  matchPolicyVersion?: number;
  scoreBreakdown?: MatchScoreBreakdown;
  distanceKm?: number;
  openedAt?: string;
  applicationConvertedAt?: string;
};

export type NotificationPreferences = {
  pushEnabled: boolean;
  messagesEnabled: boolean;
  taskUpdatesEnabled: boolean;
  matchingEnabled: boolean;
};

export type TaskMatch = {
  id: string;
  taskId: string;
  workerId: string;
  clientId: string;
  acceptanceStatus: "Applied" | "Accepted" | "Rejected" | "Withdrawn" | "Cancelled";
  matchScore?: number;
  matchReasons?: string[];
  distanceKm?: number;
  eligible?: boolean;
  matchPolicyVersion?: number;
  scoreBreakdown?: MatchScoreBreakdown;
  createdAt: string;
  hiredAt?: string;
  rejectedAt?: string;
  withdrawnAt?: string;
  cancelledAt?: string;
  updatedAt?: string;
};

export type Payment = {
  id: string;
  taskId: string;
  clientId: string;
  workerId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  proofOfPaymentUrl?: string;
  proofOfPaymentText?: string;
  clientConfirmedAt?: string;
  workerConfirmedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
  createdAt: string;
  updatedAt?: string;
};

export type VerificationRequest = {
  id: string;
  userId: string;
  validIdType: string;
  validIdPath: string;
  medicalCertificatePath: string;
  status: VerificationStatus;
  submittedAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  targetType: "user" | "verification" | "payment" | "task" | "violation_report";
  targetId: string;
  reason?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type ViolationReport = {
  id: string;
  reporterId: string;
  targetUserId: string;
  category: "Safety" | "Fraud" | "Harassment" | "Payment" | "Other";
  reason: string;
  evidenceReference?: string | null;
  taskId?: string | null;
  status: "Open" | "Actioned" | "Dismissed";
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
  actionedBy?: string;
};

export type ModerationUser = Pick<
  UserProfile,
  "id" | "role" | "fullName" | "accountStatus" | "identityStatus" | "restrictionReason" |
  "restrictionEvidenceReference" | "restrictedAt"
>;
