import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import {
  AppNotification,
  ChatMessage,
  PaymentMethod,
  PaymentStatus,
  Rating,
  Role,
  Task,
  TaskMatch,
  TaskStatus,
  UserProfile
} from "../types";
import {
  deleteCurrentAuthUser,
  loginWithMobileNumber,
  logoutFromFirebase,
  registerWithMobileNumber,
  subscribeToAuthState
} from "../services/authService";
import { assertCanApply, assertTaskTransition } from "../domain/taskWorkflow";
import { sendMessageToFirestore, subscribeToMessages } from "../services/chatService";
import { hasFirebaseConfig } from "../services/firebase";
import { addNotification, subscribeToNotifications } from "../services/notificationService";
import { addRatingToFirestore, subscribeToRatings } from "../services/ratingService";
import {
  applyToTask,
  createTaskInFirestore,
  rejectTaskApplication,
  subscribeToTaskMatchesForUser,
  subscribeToTasksForUser,
  updateTaskPaymentVerification,
  updateTaskStatusInFirestore,
  withdrawTaskApplication
} from "../services/taskRepository";
import {
  getUserProfile,
  ensurePublicProfile,
  saveUserProfile,
  subscribeToPublicProfiles,
  subscribeToUserProfile,
  updateUserProfile
} from "../services/userService";
import { formatDistance, getTaskDistanceKm, isWorkerInsideTaskGeofence } from "../utils/location";

type RegisterInput = {
  fullName: string;
  mobileNumber: string;
  role: Role;
  address: string;
  password?: string;
  skills?: string[];
  capabilities?: string[];
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
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
  requiredCapability?: string;
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
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  getUserById: (userId?: string) => UserProfile | undefined;
  createTask: (input: TaskInput) => Promise<Task>;
  acceptTask: (taskId: string) => Promise<void>;
  withdrawApplication: (taskId: string) => Promise<void>;
  rejectApplication: (taskId: string, workerId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus, workerId?: string) => Promise<void>;
  submitPaymentProof: (taskId: string, proofOfPaymentText: string) => Promise<void>;
  sendMessage: (taskId: string, message: string, receiverId?: string) => Promise<void>;
  submitRating: (taskId: string, score: number, feedback: string) => Promise<void>;
  getTaskMessages: (taskId: string) => ChatMessage[];
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const usingFirebase = hasFirebaseConfig;

export function AppProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [taskSnapshots, setTaskSnapshots] = useState<Task[]>([]);
  const [taskMatches, setTaskMatches] = useState<TaskMatch[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appLoading, setAppLoading] = useState(usingFirebase);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tasks = useMemo(
    () =>
      taskSnapshots.map((task) => {
        const matches = taskMatches.filter((match) => match.taskId === task.id);
        const canonicalApplicantIds = matches
          .filter((match) => match.acceptanceStatus === "Applied" || match.acceptanceStatus === "Accepted")
          .map((match) => match.workerId);
        return matches.length ? { ...task, applicantIds: canonicalApplicantIds } : task;
      }),
    [taskMatches, taskSnapshots]
  );

  useEffect(() => {
    if (!usingFirebase) {
      setAppLoading(false);
      return () => undefined;
    }

    return subscribeToAuthState(
      async (authUser) => {
        if (!authUser) {
          setCurrentUser(null);
          setAppLoading(false);
          return;
        }

        try {
          const profile = await getUserProfile(authUser.uid);
          if (profile && isBlockedAccount(profile)) {
            await logoutFromFirebase();
            setError("This account is unavailable. Please contact support.");
            setCurrentUser(null);
            return;
          }
          if (profile) {
            await ensurePublicProfile(profile);
          }
          setCurrentUser(profile);
        } catch (authError) {
          handleListenerError(authError instanceof Error ? authError : new Error("Unable to restore your session."));
        } finally {
          setAppLoading(false);
        }
      },
      handleListenerError
    );
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setUsers([]);
      setTaskSnapshots([]);
      setTaskMatches([]);
      setMessages([]);
      setRatings([]);
      setNotifications([]);
      return () => undefined;
    }

    const unsubscribers = [
      subscribeToUserProfile(
        currentUser.id,
        (user) => {
          if (!user) {
            return;
          }
          if (isBlockedAccount(user)) {
            setError("This account is unavailable. Please contact support.");
            void logoutFromFirebase();
            setCurrentUser(null);
            return;
          }
          setCurrentUser(user);
        },
        handleListenerError
      ),
      subscribeToPublicProfiles(setUsers, handleListenerError),
      subscribeToTasksForUser(currentUser, setTaskSnapshots, handleListenerError),
      subscribeToTaskMatchesForUser(currentUser, setTaskMatches, handleListenerError),
      subscribeToMessages(currentUser.id, setMessages, handleListenerError),
      subscribeToRatings(setRatings, handleListenerError),
      subscribeToNotifications(currentUser.id, setNotifications, handleListenerError)
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [currentUser?.id, currentUser?.role]);

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
      const mobileNumber = input?.mobileNumber.trim() ?? "";
      if (!mobileNumber) {
        throw new Error("Please enter your mobile number.");
      }
      const authSession = await loginWithMobileNumber(mobileNumber, input?.password);
      const user = await getUserProfile(authSession.localId);

      if (!user) {
        throw new Error("Account found, but profile data is missing in Firestore.");
      }
      if (isBlockedAccount(user)) {
        await logoutFromFirebase();
        throw new Error("This account is unavailable. Please contact support.");
      }

      await ensurePublicProfile(user);
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
      try {
        const user = await saveUserProfile({
          id: authSession.localId,
          role: input.role,
          fullName: input.fullName.trim(),
          mobileNumber: input.mobileNumber.trim(),
          address: input.address.trim() || "Bacolod City",
          skills: input.skills,
          capabilities: input.capabilities ?? input.skills,
          businessName: input.businessName
        });

        setCurrentUser(user);
      } catch (profileError) {
        await deleteCurrentAuthUser().catch(() => undefined);
        throw profileError;
      }
    });
  }

  async function setRole(role: Role) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before selecting a role.");
      }

      const updates: Partial<UserProfile> = {
        role,
        availabilityStatus: role === "worker" ? "Available" : undefined,
        availability: role === "worker" ? "Available" : undefined,
        verificationStatus: role === "worker" ? currentUser.verificationStatus ?? "Pending Verification" : undefined,
        preferredRadiusKm: role === "worker" ? currentUser.preferredRadiusKm ?? 5 : undefined,
        currentLatitude: role === "worker" ? currentUser.currentLatitude ?? 10.6765 : undefined,
        currentLongitude: role === "worker" ? currentUser.currentLongitude ?? 122.9509 : undefined
      };
      await updateUserProfile(currentUser.id, updates);
      setCurrentUser({
        ...currentUser,
        ...updates
      });
    });
  }

  async function logout() {
    await runAction(async () => {
      await logoutFromFirebase();
      setCurrentUser(null);
      setNotifications([]);
    });
  }

  async function updateProfile(updates: Partial<UserProfile>) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before updating your profile.");
      }

      const safeUpdates: Partial<UserProfile> = {
        fullName: updates.fullName,
        address: updates.address,
        skills: updates.skills,
        capabilities: updates.capabilities,
        availabilityStatus: updates.availabilityStatus,
        availability: updates.availability,
        businessName: updates.businessName,
        profilePhotoUrl: updates.profilePhotoUrl,
        experienceDescription: updates.experienceDescription,
        yearsOfExperience: updates.yearsOfExperience,
        validIdType: updates.validIdType,
        validIdUrl: updates.validIdUrl,
        medicalCertificateUrl: updates.medicalCertificateUrl,
        currentLatitude: updates.currentLatitude,
        currentLongitude: updates.currentLongitude,
        preferredRadiusKm: updates.preferredRadiusKm
      };

      await updateUserProfile(currentUser.id, safeUpdates);
      setCurrentUser({
        ...currentUser,
        ...safeUpdates
      });
    });
  }

  async function createTask(input: TaskInput) {
    let createdTask: Task | undefined;

    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before posting a task.");
      }

      if (currentUser.role !== "client") {
        throw new Error("Only clients can post tasks.");
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

      await notifyWorkers(createdTask.id, `New task posted in Bacolod City: ${createdTask.title}.`);
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

      if (currentUser.role !== "worker") {
        throw new Error("Only workers can apply to tasks.");
      }

      const task = tasks.find((item) => item.id === taskId);
      if (!task) throw new Error("Task not found.");
      assertCanApply(task, currentUser, currentUser.availabilityStatus ?? currentUser.availability);
      await applyToTask(taskId, currentUser);
    });
  }

  async function withdrawApplication(taskId: string) {
    await runAction(async () => {
      if (!currentUser || currentUser.role !== "worker") {
        throw new Error("Only workers can withdraw an application.");
      }
      await withdrawTaskApplication(taskId, currentUser);
    });
  }

  async function rejectApplication(taskId: string, workerId: string) {
    await runAction(async () => {
      if (!currentUser || currentUser.role !== "client") {
        throw new Error("Only clients can reject an application.");
      }
      await rejectTaskApplication(taskId, workerId, currentUser);
    });
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus, workerId?: string) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before updating a task.");
      }

      const task = tasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      const nextWorkerId = workerId ?? task?.workerId ?? (currentUser?.role === "worker" ? currentUser.id : undefined);
      assertTaskTransition(task, status, currentUser, nextWorkerId);

      if (
        currentUser?.role === "worker" &&
        task &&
        (status === "In Progress" || status === "Pending Approval") &&
        !isWorkerInsideTaskGeofence(currentUser, task)
      ) {
        const distance = formatDistance(getTaskDistanceKm(currentUser, task));
        const radius = task.geofenceRadius ?? 0;
        throw new Error(
          `Location check: you are ${distance}. Please move within ${radius} meters of the task area before continuing.`
        );
      }

      await updateTaskStatusInFirestore(taskId, status, currentUser, nextWorkerId);
    });
  }

  async function submitPaymentProof(taskId: string, proofOfPaymentText: string) {
    await runAction(async () => {
      if (!currentUser || currentUser.role !== "client") {
        throw new Error("Only the client can submit payment proof for this task.");
      }

      const task = tasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      if (task.clientId !== currentUser.id) {
        throw new Error("Only the client who posted this task can submit payment proof.");
      }

      const nextStatus: PaymentStatus = proofOfPaymentText.trim() ? "Submitted" : "Pending";
      await updateTaskPaymentVerification(taskId, currentUser.id, nextStatus, proofOfPaymentText.trim());
    });
  }

  async function sendMessage(taskId: string, message: string, receiverId?: string) {
    await runAction(async () => {
      if (!currentUser) {
        throw new Error("Please log in before sending a message.");
      }

      const task = tasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error("Task not found.");
      }

      const participantIds = [task.clientId, task.workerId, ...(task.applicantIds ?? [])].filter(Boolean);

      if (!participantIds.includes(currentUser.id)) {
        throw new Error("Only task participants can use this chat.");
      }

      const nextReceiverId =
        currentUser.role === "worker"
          ? task.clientId
          : getClientMessageReceiverId(task, receiverId);

      if (!nextReceiverId) {
        throw new Error("This chat will be available after a worker applies.");
      }

      await sendMessageToFirestore({
        taskId,
        senderId: currentUser.id,
        receiverId: nextReceiverId,
        message,
        timestamp: new Date().toISOString()
      });
    });
  }

  function getClientMessageReceiverId(task: Task, requestedReceiverId?: string) {
    const applicantIds = task.applicantIds ?? [];
    const validWorkerIds = [task.workerId, ...applicantIds].filter(Boolean);

    if (requestedReceiverId && validWorkerIds.includes(requestedReceiverId)) {
      return requestedReceiverId;
    }

    if (task.workerId) {
      return task.workerId;
    }

    return applicantIds.length === 1 ? applicantIds[0] : undefined;
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

      if (task.status !== "Finished" && task.status !== "Archived") {
        throw new Error("Ratings are available after the task is finished.");
      }

      if (score < 1 || score > 5 || !Number.isInteger(score)) {
        throw new Error("Choose a rating from 1 to 5.");
      }

      if (currentUser.id !== task.clientId && currentUser.id !== task.workerId) {
        throw new Error("Only task participants can submit a rating.");
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

  async function notifyWorkers(taskId: string, message: string) {
    const workerUsers = users.filter((user) => user.role === "worker");

    await Promise.all(
      workerUsers.map((worker) =>
        addNotification({
          userId: worker.id,
          taskId,
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
      withdrawApplication,
      rejectApplication,
      updateTaskStatus,
      submitPaymentProof,
      sendMessage,
      submitRating,
      getTaskMessages,
      clearError
    }),
    [currentUser, users, tasks, messages, ratings, notifications, appLoading, actionLoading, error]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function isBlockedAccount(user: UserProfile) {
  return user.accountStatus === "suspended" || user.accountStatus === "deleted";
}

function validateRegistration(input: RegisterInput) {
  if (!input.fullName.trim()) {
    throw new Error("Full name is required.");
  }

  if (input.mobileNumber.replace(/\D/g, "").length < 10) {
    throw new Error("Enter a valid mobile number.");
  }

  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
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
