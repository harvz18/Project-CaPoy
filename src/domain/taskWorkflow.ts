import { PaymentStatus, Role, Task, TaskStatus } from "../types";

export type TaskActor = {
  id: string;
  role: Role;
};

export const TERMINAL_TASK_STATUSES: TaskStatus[] = ["Archived", "Cancelled", "Expired"];

export function assertTaskTransition(
  task: Task,
  nextStatus: TaskStatus,
  actor: TaskActor,
  selectedWorkerId?: string
) {
  if (TERMINAL_TASK_STATUSES.includes(task.status)) {
    throw new Error("This task is already closed.");
  }

  if (nextStatus === "Accepted") {
    if (actor.role !== "client" || actor.id !== task.clientId) {
      throw new Error("Only the client who posted this task can accept an applicant.");
    }
    if (task.status !== "Applied" || !selectedWorkerId || !task.applicantIds?.includes(selectedWorkerId)) {
      throw new Error("Choose an active applicant before accepting a worker.");
    }
    return;
  }

  if (nextStatus === "In Progress") {
    requireAssignedWorker(task, actor);
    requireCurrentStatus(task, "Accepted");
    return;
  }

  if (nextStatus === "Pending Approval") {
    requireAssignedWorker(task, actor);
    requireCurrentStatus(task, "In Progress");
    return;
  }

  if (nextStatus === "Finished") {
    requireTaskClient(task, actor);
    requireCurrentStatus(task, "Pending Approval");
    requireSubmittedPayment(task.paymentStatus);
    return;
  }

  if (nextStatus === "Archived") {
    requireTaskClient(task, actor);
    requireCurrentStatus(task, "Finished");
    return;
  }

  if (nextStatus === "Cancelled") {
    requireTaskClient(task, actor);
    if (task.status !== "Finding Workers" && task.status !== "Applied") {
      throw new Error("Only an unassigned task can be cancelled.");
    }
    return;
  }

  if (nextStatus === "Disputed") {
    const isParticipant = actor.id === task.clientId || actor.id === task.workerId;
    const canDispute = ["Accepted", "In Progress", "Pending Approval", "Finished"].includes(task.status);
    if (!isParticipant || !canDispute) {
      throw new Error("Only assigned task participants can open a dispute.");
    }
    return;
  }

  throw new Error(`The transition from ${task.status} to ${nextStatus} is not allowed.`);
}

export function assertCanApply(task: Task, actor: TaskActor, availability?: string) {
  if (actor.role !== "worker") {
    throw new Error("Only workers can apply to tasks.");
  }
  if (task.clientId === actor.id) {
    throw new Error("You cannot apply to your own task.");
  }
  if (task.workerId || (task.status !== "Finding Workers" && task.status !== "Applied")) {
    throw new Error("This task is no longer open for applications.");
  }
  if (task.applicantIds?.includes(actor.id)) {
    throw new Error("You have already applied to this task.");
  }
  if (availability && availability !== "Available") {
    throw new Error("Set your availability to Available before applying.");
  }
}

export function assertCanWithdraw(task: Task, actor: TaskActor, matchStatus?: string) {
  if (actor.role !== "worker" || !task.applicantIds?.includes(actor.id) || matchStatus !== "Applied") {
    throw new Error("Only an active applicant can withdraw this application.");
  }
  if (task.workerId || (task.status !== "Finding Workers" && task.status !== "Applied")) {
    throw new Error("This application can no longer be withdrawn.");
  }
}

export function assertCanRejectApplicant(task: Task, actor: TaskActor, workerId: string, matchStatus?: string) {
  requireTaskClient(task, actor);
  if (!task.applicantIds?.includes(workerId) || matchStatus !== "Applied") {
    throw new Error("This worker does not have an active application.");
  }
  if (task.workerId || task.status !== "Applied") {
    throw new Error("Applications can only be rejected before a worker is accepted.");
  }
}

function requireTaskClient(task: Task, actor: TaskActor) {
  if (actor.role !== "client" || actor.id !== task.clientId) {
    throw new Error("Only the client who posted this task can perform this action.");
  }
}

function requireAssignedWorker(task: Task, actor: TaskActor) {
  if (actor.role !== "worker" || actor.id !== task.workerId) {
    throw new Error("Only the assigned worker can perform this action.");
  }
}

function requireCurrentStatus(task: Task, expectedStatus: TaskStatus) {
  if (task.status !== expectedStatus) {
    throw new Error(`This action requires the task to be ${expectedStatus}.`);
  }
}

function requireSubmittedPayment(paymentStatus?: PaymentStatus) {
  if (paymentStatus !== "Submitted" && paymentStatus !== "Verified") {
    throw new Error("Submit the payment confirmation before approving completion.");
  }
}
