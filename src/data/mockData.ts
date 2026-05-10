import { AppNotification, ChatMessage, Rating, Task, UserProfile } from "../types";

export const mockUsers: UserProfile[] = [
  {
    id: "worker-1",
    role: "worker",
    fullName: "Juan Dela Cruz",
    mobileNumber: "09170000001",
    address: "Bacolod City",
    rating: 4.7,
    skills: ["Carrying goods", "Cleaning", "Unloading inventory"],
    availabilityStatus: "Available"
  },
  {
    id: "client-1",
    role: "client",
    fullName: "Maria Santos",
    mobileNumber: "09170000002",
    address: "Bacolod City",
    rating: 4.8,
    businessName: "Santos Sari-Sari Store"
  }
];

export const mockTasks: Task[] = [
  {
    id: "task-1",
    clientId: "client-1",
    title: "Unload rice sacks",
    description: "Need help unloading 15 sacks from a delivery truck.",
    category: "Unloading inventory",
    location: "Downtown Bacolod City",
    wage: "500",
    estimatedDuration: "2 hours",
    status: "Finding Workers",
    paymentMethod: "COD",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-2",
    clientId: "client-1",
    title: "Clean small storage room",
    description: "Sweep and organize boxes in a small storage room.",
    category: "Cleaning",
    location: "Mandalagan, Bacolod City",
    wage: "350",
    estimatedDuration: "3 hours",
    status: "Finding Workers",
    paymentMethod: "GCash link",
    createdAt: new Date().toISOString()
  }
];

export const mockMessages: ChatMessage[] = [
  {
    id: "message-1",
    taskId: "task-1",
    senderId: "client-1",
    receiverId: "worker-1",
    message: "Please go to the store entrance when you arrive.",
    timestamp: new Date().toISOString()
  }
];

export const mockRatings: Rating[] = [];

export const mockNotifications: AppNotification[] = [
  {
    id: "notification-1",
    userId: "worker-1",
    notificationType: "Nearby task",
    message: "New task posted in Bacolod City: Unload rice sacks.",
    readStatus: false,
    createdAt: new Date().toISOString()
  }
];
