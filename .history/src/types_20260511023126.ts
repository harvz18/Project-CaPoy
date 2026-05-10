export type Role = "worker" | "client";

export type TaskStatus =
  | "Finding Workers"
  | "Applied"
  | "Accepted"
  | "In Progress"
  | "Pending Approval"
  | "Finished"
  | "Archived";

export type PaymentMethod = "COD" | "GCash link";

export type UserProfile = {
  id: string;
  role: Role;
  fullName: string;
  mobileNumber: string;
  address: string;
  rating: number;
  skills?: string[];
  availabilityStatus?: "Available" | "Busy";
  businessName?: string;
  profilePhoto?: string;
  completedTasks?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Task = {
  id: string;
  clientId: string;
  workerId?: string;
  applicantIds?: string[];
  title: string;
  description: string;
  category: string;
  location: string;
  wage: string;
  estimatedDuration: string;
  status: TaskStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  workerFinishedAt?: string;
  finishedAt?: string;
  archivedAt?: string;
};

export type ChatMessage = {
  id: string;
  taskId: string;
  senderId: string;
  receiverId: string;
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
  message: string;
  readStatus: boolean;
  createdAt: string;
};

export type TaskMatch = {
  id: string;
  taskId: string;
  workerId: string;
  clientId: string;
  acceptanceStatus: "Applied" | "Accepted" | "Rejected";
  createdAt: string;
  hiredAt?: string;
};

export type Payment = {
  id: string;
  taskId: string;
  clientId: string;
  workerId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: "Selected" | "Pending" | "Paid";
  createdAt: string;
};
