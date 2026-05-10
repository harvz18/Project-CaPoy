import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { AppNotification, ChatMessage, PaymentMethod, Rating, Role, Task, TaskStatus, UserProfile } from "../types";
import { mockMessages, mockNotifications, mockRatings, mockTasks, mockUsers } from "../data/mockData";
import { hasFirebaseConfig } from "../services/firebase";
import {
  addMessageToFirestore,
  addRatingToFirestore,
  createTaskInFirestore,
  fetchMessagesFromFirestore,
  fetchTasksFromFirestore,
  updateTaskStatusInFirestore
} from "../services/taskRepository";

type RegisterInput = {
  fullName: string;
  mobileNumber: string;
  role: Role;
  address: string;
  skills?: string[];
  businessName?: string;
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
  tasks: Task[];
  messages: ChatMessage[];
  ratings: Rating[];
  notifications: AppNotification[];
  usingFirebase: boolean;
  login: (role: Role) => void;
  register: (input: RegisterInput) => void;
  setRole: (role: Role) => void;
  logout: () => void;
  createTask: (input: TaskInput) => Promise<Task>;
  acceptTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus, workerId?: string) => Promise<void>;
  sendMessage: (taskId: string, message: string) => Promise<void>;
  submitRating: (taskId: string, score: number, feedback: string) => Promise<void>;
  getTaskMessages: (taskId: string) => ChatMessage[];
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [ratings, setRatings] = useState<Rating[]>(mockRatings);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);

  useEffect(() => {
    async function loadFirebaseTasks() {
      if (!hasFirebaseConfig) {
        return;
      }

      const remoteTasks = await fetchTasksFromFirestore();
      if (remoteTasks.length > 0) {
        setTasks(remoteTasks);
      }
    }

    loadFirebaseTasks().catch(() => undefined);
  }, []);

  function login(role: Role) {
    const user = mockUsers.find((item) => item.role === role) ?? mockUsers[0];
    setCurrentUser(user);
  }

  function register(input: RegisterInput) {
    const user: UserProfile = {
      id: `${input.role}-${Date.now()}`,
      role: input.role,
      fullName: input.fullName,
      mobileNumber: input.mobileNumber,
      address: input.address || "Bacolod City",
      rating: 0,
      skills: input.skills,
      availabilityStatus: input.role === "worker" ? "Available" : undefined,
      businessName: input.businessName
    };
    setCurrentUser(user);
  }

  function setRole(role: Role) {
    if (!currentUser) {
      login(role);
      return;
    }

    setCurrentUser({
      ...currentUser,
      role,
      availabilityStatus: role === "worker" ? "Available" : undefined
    });
  }

  function logout() {
    setCurrentUser(null);
  }

  async function createTask(input: TaskInput) {
    const task: Omit<Task, "id"> = {
      ...input,
      clientId: currentUser?.id ?? "client-1",
      location: input.location.includes("Bacolod") ? input.location : `${input.location}, Bacolod City`,
      status: "Posted",
      createdAt: new Date().toISOString()
    };

    const firestoreId = hasFirebaseConfig ? await createTaskInFirestore(task) : undefined;
    const newTask: Task = {
      id: firestoreId ?? `task-${Date.now()}`,
      ...task
    };
    setTasks((items) => [newTask, ...items]);
    setNotifications((items) => [
      {
        id: `notification-${Date.now()}`,
        userId: "worker-1",
        notificationType: "Nearby task",
        message: `New task posted in Bacolod City: ${newTask.title}.`,
        readStatus: false,
        createdAt: new Date().toISOString()
      },
      ...items
    ]);
    return newTask;
  }

  async function acceptTask(taskId: string) {
    const workerId = currentUser?.id ?? "worker-1";
    await updateTaskStatus(taskId, "Accepted", workerId);
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus, workerId?: string) {
    const activeWorkerId = workerId ?? currentUser?.id;
    if (hasFirebaseConfig) {
      await updateTaskStatusInFirestore(taskId, status, activeWorkerId);
    }

    setTasks((items) =>
      items.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              workerId: activeWorkerId ?? task.workerId
            }
          : task
      )
    );

    if (status === "Finished" && currentUser?.role === "worker") {
      setCurrentUser({ ...currentUser, availabilityStatus: "Available" });
    }
  }

  async function sendMessage(taskId: string, message: string) {
    const task = tasks.find((item) => item.id === taskId);
    const senderId = currentUser?.id ?? "worker-1";
    const receiverId = currentUser?.role === "worker" ? task?.clientId ?? "client-1" : task?.workerId ?? "worker-1";
    const newMessage: Omit<ChatMessage, "id"> = {
      taskId,
      senderId,
      receiverId,
      message,
      timestamp: new Date().toISOString()
    };

    if (hasFirebaseConfig) {
      await addMessageToFirestore(newMessage);
    }

    setMessages((items) => [
      ...items,
      {
        id: `message-${Date.now()}`,
        ...newMessage
      }
    ]);
  }

  async function submitRating(taskId: string, score: number, feedback: string) {
    const task = tasks.find((item) => item.id === taskId);
    const reviewerId = currentUser?.id ?? "worker-1";
    const targetUserId = currentUser?.role === "worker" ? task?.clientId ?? "client-1" : task?.workerId ?? "worker-1";
    const rating: Omit<Rating, "id"> = {
      reviewerId,
      targetUserId,
      taskId,
      score,
      feedback
    };

    if (hasFirebaseConfig) {
      await addRatingToFirestore(rating);
    }

    setRatings((items) => [
      {
        id: `rating-${Date.now()}`,
        ...rating
      },
      ...items
    ]);
  }

  function getTaskMessages(taskId: string) {
    return messages.filter((message) => message.taskId === taskId);
  }

  useEffect(() => {
    async function loadMessagesForAcceptedTasks() {
      if (!hasFirebaseConfig) {
        return;
      }

      const taskIds = tasks.map((task) => task.id);
      const remoteMessages = await Promise.all(taskIds.map((taskId) => fetchMessagesFromFirestore(taskId)));
      const flatMessages = remoteMessages.flat();
      if (flatMessages.length > 0) {
        setMessages(flatMessages);
      }
    }

    loadMessagesForAcceptedTasks().catch(() => undefined);
  }, [tasks]);

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      tasks,
      messages,
      ratings,
      notifications,
      usingFirebase: hasFirebaseConfig,
      login,
      register,
      setRole,
      logout,
      createTask,
      acceptTask,
      updateTaskStatus,
      sendMessage,
      submitRating,
      getTaskMessages
    }),
    [currentUser, tasks, messages, ratings, notifications]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }

  return context;
}
