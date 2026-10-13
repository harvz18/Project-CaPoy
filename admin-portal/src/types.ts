export type Authority = "loading" | "guest" | "admin" | "superadmin" | "denied";
export type Role = "worker" | "client" | "admin";
export type AccountStatus = "active" | "pending_verification" | "suspended" | "deleted";
export type TaskStatus = "Finding Workers" | "Applied" | "Accepted" | "In Progress" | "Pending Approval" | "Finished" | "Archived" | "Cancelled" | "Disputed" | "Expired";
export type VerificationStatus = "Not Submitted" | "Pending Verification" | "Verified" | "Rejected" | "Needs Resubmission";

export type Profile = {
  id: string; fullName?: string; role?: Role; rating?: number; ratingCount?: number; createdAt?: string;
  accountStatus?: AccountStatus; verificationStatus?: VerificationStatus; identityStatus?: string; businessName?: string;
};

export type Task = {
  id: string; title?: string; clientId?: string; workerId?: string; applicantIds?: string[]; category?: string;
  location?: string; wage?: string; agreedAmount?: string; estimatedDuration?: string; pricingMode?: string;
  status?: TaskStatus; paymentMethod?: string; paymentStatus?: string; createdAt?: string; updatedAt?: string;
};

export type TaskMatch = {
  id: string; taskId?: string; workerId?: string; clientId?: string; acceptanceStatus?: string;
  proposedAmount?: string; createdAt?: string; updatedAt?: string;
};

export type VerificationRequest = { id: string; userId: string; validIdType?: string; validIdPath?: string; medicalCertificatePath?: string; policeClearancePath?: string; status?: VerificationStatus; submittedAt?: string; reviewReason?: string };
export type Payment = { id: string; taskId?: string; paymentMethod?: string; paymentStatus?: string; agreedAmount?: string; updatedAt?: string; createdAt?: string };
export type Rating = { id: string; reviewerId?: string; targetUserId?: string; taskId?: string; score?: number; feedback?: string; createdAt?: string };
export type AuditLog = { id: string; actorId?: string; action?: string; targetType?: string; targetId?: string; reason?: string; createdAt?: string };
export type ViolationReport = { id: string; reporterId?: string; targetUserId?: string; category?: string; reason?: string; status?: string; createdAt?: string };
export type ModerationUser = Profile & { accountStatus?: AccountStatus; restrictionReason?: string; restrictionEvidenceReference?: string; restrictedAt?: string };

export type Analytics = {
  range: { label: string; preset: string }; accounts: { employers: number; taskers: number; active: number; restricted: number };
  verification: { pending: number; approved: number; rejected: number; resubmission: number };
  taskInventory: { total: number; byStatus: Record<string, number> };
  activity: { posted: number; applications: number; accepted: number; completed: number; cancelled: number; disputed: number; byCategory: Array<{ category: string; count: number }> };
  payments: { Pending: number; Submitted: number; Verified: number; Rejected: number; unresolvedReviews: number };
  daily: Array<{ date: string; posted: number; applications: number; accepted: number; completed: number }>;
};

export type SuperadminOverview = { users: ModerationUser[]; reports: ViolationReport[]; auditLogs: AuditLog[] };
export type BasicDashboardCounts = { users: number; employers: number; taskers: number; tasks: number; activeTasks: number; completedTasks: number; paymentRecords: number; submittedPayments: number; pendingVerifications: number };
