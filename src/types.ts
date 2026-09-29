export type Role = "worker" | "client";

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
export type AccountStatus = "active" | "pending_verification" | "suspended" | "deleted";

export type UserProfile = {
  id: string;
  role: Role;
  fullName: string;
  mobileNumber: string;
  address: string;
  rating: number;
  accountStatus?: AccountStatus;
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
  phoneVerified?: boolean;
  thirdPartyProvider?: "none" | "google";
  currentLatitude?: number;
  currentLongitude?: number;
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
  requiredCapability?: string;
  wage: string;
  estimatedDuration: string;
  status: TaskStatus;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  proofOfPaymentUrl?: string;
  proofOfPaymentText?: string;
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
  taskId: string;
  senderId: string;
  receiverId: string;
  participantIds?: string[];
  message: string;
  timestamp: string;
};

export type Rating = {
  id: string;
  reviewerId: string;
  targetUserId: string;
  taskId: string;
  score: number;
  feedback: string;
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
};

export type TaskMatch = {
  id: string;
  taskId: string;
  workerId: string;
  clientId: string;
  acceptanceStatus: "Applied" | "Accepted" | "Rejected" | "Withdrawn" | "Cancelled";
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
  createdAt: string;
  updatedAt?: string;
};
