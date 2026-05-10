import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { AppNotification, ChatMessage, PaymentMethod, Rating, Role, Task, TaskStatus, UserProfile } from "../types";
import { loginWithMobileNumber, registerWithMobileNumber } from "../services/authService";
import { sendMessageToFirestore, subscribeToMessages } from "../services/chatService";
import { hasFirebaseConfig } from "../services/firebase";
import { addNotification, subscribeToNotifications } from "../services/notificationService";
import { addRatingToFirestore, subscribeToRatings } from "../services/ratingService";
import {
  applyToTask,
  createTaskInFirestore,
  subscribeToTasks,
  updateTaskPaymentWorker,
  updateTaskStatusInFirestore
} from "../services/taskRepository";
import { getUserProfile, saveUserProfile, subscribeToUsers, updateUserProfile } from "../services/userService";

type RegisterInput = {
  fullName: string;
  mobileNumber: string;
  role: Role;
  address: string;
  password?: string;
  skills?: string[];
  businessName?: string;
};

type LoginInput = {
  mobileNumber: string;
  password?: string;
};

type TaskInput = {
  title: string;
  description: string;
  category: string;
  location: string;
  wage: string;
  estimatedDuration: string;
  paymentMethod: PaymentMethod;
};

type AppContextValue = {
  currentUser: UserProfile | null;
  users: UserProfile[];
  tasks: Task[];
  messages: ChatMessage[];
  ratings: Rating[];
  notifications: AppNotification[];
  usingFirebase: boolean;
  appLoading: boolean;
  actionLoading: boolean;
  error: string | null;
  login: (role: Role, input?: LoginInput) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<void>;
  setRole: (role: Role) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  getUserById: (userId?: string) => UserProfile | undefined;
  createTask: (input: TaskInput) => Promise<Task>;
  acceptTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus, workerId?: string) => Promise<void>;
  sendMessage: (taskId: string, message: string) => Promise<void>;
  submitRating: (taskId: string, score: number, feedback: string) => Promise<void>;
  getTaskMessages: (taskId: string) => ChatMessage[];
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const usingFirebase = hasFirebaseConfig;

export function AppProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appLoading, setAppLoading] = useState(usingFirebase);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribers = [
      subscribeToUsers(setUsers, handleListenerError),
      subscribeToTasks(setTasks, handleListenerError),
      subscribeToMessages(setMessages, handleListenerError),
      subscribeToRatings(setRatings, handleListenerError)
    ];

    setAppLoading(false);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    const latestUser = users.find((user) => user.id === currentUser?.id);

    if (latestUser) {
      setCurrentUser(latestUser);
    }
  }, [currentUser?.id, users]);

  useEffect(() => {
    return subscribeToNotifications(currentUser?.id, setNotifications, handleListenerError);
  }, [currentUser?.id]);

  function handleListenerError(listenerError: Error) {
    setError(listenerError.message);
  }

  async function runAction(action: () => Promise<void>) {
    setActionLoading(true);
    setError(null);

    try {
      await action();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Unable to continue. Please try again.";
      setError(message);
      throw actionError;
    } finally {
      setActionLoading(false);
    }
  }

  async function login(role: Role, input?: LoginInput) {
    let authenticatedUser: UserProfile | undefined;

    await runAction(async () => {
      const mobileNumber = input?.mobileNumber || (role === "worker" ? "9170000001" : "9170000002");
      const authSession = await loginWithMobileNumber(mobileNumber, input?.password);
      const user = await getUserProfile(authSession.localId);

      if (!user) {
        throw new Error("Account found, but profile data is missing in Firestore.");
      }

      setCurrentUser(user);
      authenticatedUser = user;
    });

    if (!authenticatedUser) {
      throw new Error("Unable to continue. Please try again.");
    }

    return authenticatedUser;
  }

  async function register(input: RegisterInput) {
    await runAction(async () => {
      validateRegistration(input);
      const authSession = await registerWithMobileNumber(input.mobileNumber, input.password);
      const user = await saveUserProfile({
        id: authSession.localId,
        role: input.role,
        fullName: input.fullName.trim(),
        mobileNumber: input.mobileNumber.trim(),
        address: input.address.trim() || "Bacolod City",
        skills: input.skills,
        businessName: input.businessName
      });

      setCurrentUser(user);
    });
  }

  async function setRole(role: Role) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before selecting a role.");
      }

      const updates: Partial<UserProfile> = {
        role,
        availabilityStatus: role === "worker" ? "Available" : undefined
      };
      await updateUserProfile(currentUser.id, updates);
      setCurrentUser({
        ...currentUser,
        ...updates
      });
    });
  }

  function logout() {
    setCurrentUser(null);
    setNotifications([]);
  }

  async function updateProfile(updates: Partial<UserProfile>) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before updating your profile.");
      }

      await updateUserProfile(currentUser.id, updates);
      setCurrentUser({
        ...currentUser,
        ...updates
      });
    });
  }

  async function createTask(input: TaskInput) {
    let createdTask: Task | undefined;

    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before posting a task.");
      }

      validateTask(input);
      createdTask = await createTaskInFirestore({
        ...input,
        clientId: currentUser.id,
        title: input.title.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        wage: input.wage.trim()
      });

      await notifyWorkers(`New task posted in Bacolod City: ${createdTask.title}.`);
    });

    if (!createdTask) {
      throw new Error("Unable to create task.");
    }

    return createdTask;
  }

  async function acceptTask(taskId: string) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before applying to a task.");
      }

      await applyToTask(taskId, currentUser.id);
      await updateTaskPaymentWorker(taskId, currentUser.id);
      const task = tasks.find((item) => item.id === taskId);

      if (task) {
        await addNotification({
          userId: task.clientId,
          notificationType: "Worker application",
          message: `${currentUser.fullName} applied to ${task.title}.`
        });
      }
    });
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus, workerId?: string) {
    await runAction(async () => {
      const task = tasks.find((item) => item.id === taskId);
      const nextWorkerId = workerId ?? task?.workerId ?? (currentUser?.role === "worker" ? currentUser.id : undefined);
      await updateTaskStatusInFirestore(taskId, status, nextWorkerId);

      if (!task || !currentUser) {
        return;
      }

      if (status === "Accepted" && task.workerId) {
        await addNotification({
          userId: task.workerId,
          notificationType: "Application accepted",
          message: `Your application for ${task.title} was accepted.`
        });
      }

      if (status === "Pending Approval") {
        await addNotification({
          userId: task.clientId,
          notificationType: "Completion approval",
          message: `${task.title} is waiting for your completion approval.`
        });
      }
    });
  }

  async function sendMessage(taskId: string, message: string) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before sending a message.");
      }

      const task = tasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      const receiverId = currentUser.role === "worker" ? task.clientId : task.workerId;

      if (!receiverId) {
        throw new Error("This chat will be available after a worker applies.");
      }

      await sendMessageToFirestore({
        taskId,
        senderId: currentUser.id,
        receiverId,
        message,
        timestamp: new Date().toISOString()
      });
    });
  }

  async function submitRating(taskId: string, score: number, feedback: string) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before submitting a rating.");
      }

      const task = tasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      const targetUserId = currentUser.role === "worker" ? task.clientId : task.workerId;

      if (!targetUserId) {
        throw new Error("There is no user to rate yet.");
      }

      await addRatingToFirestore({
        reviewerId: currentUser.id,
        targetUserId,
        taskId,
        score,
        feedback
      });
    });
  }

  function getTaskMessages(taskId: string) {
    return messages.filter((message) => message.taskId === taskId);
  }

  function getUserById(userId?: string) {
    return users.find((user) => user.id === userId);
  }

  function clearError() {
    setError(null);
  }

  async function notifyWorkers(message: string) {
    const workerUsers = users.filter((user) => user.role === "worker");

    await Promise.all(
      workerUsers.map((worker) =>
        addNotification({
          userId: worker.id,
          notificationType: "Nearby task",
          message
        })
      )
    );
  }

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      users,
      tasks,
      messages,
      ratings,
      notifications,
      usingFirebase,
      appLoading,
      actionLoading,
      error,
      login,
      register,
      setRole,
      logout,
      updateProfile,
      getUserById,
      createTask,
      acceptTask,
      updateTaskStatus,
      sendMessage,
      submitRating,
      getTaskMessages,
      clearError
    }),
    [currentUser, users, tasks, messages, ratings, notifications, appLoading, actionLoading, error]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function validateRegistration(input: RegisterInput) {
  if (!input.fullName.trim()) {
    throw new Error("Full name is required.");
  }

  if (input.mobileNumber.replace(/\D/g, "").length < 10) {
    throw new Error("Enter a valid mobile number.");
  }
}

function validateTask(input: TaskInput) {
  if (!input.title.trim()) {
    throw new Error("Task title is required.");
  }

  if (!input.location.trim()) {
    throw new Error("Task location is required.");
  }

  if (!input.wage.trim() || Number(input.wage) <= 0) {
    throw new Error("Enter a valid wage offer.");
  }
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }

  return context;
}
