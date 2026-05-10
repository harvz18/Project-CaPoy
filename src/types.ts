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
};

export type Task = {
  id: string;
  clientId: string;
  workerId?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  wage: string;
  estimatedDuration: string;
  status: TaskStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
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
