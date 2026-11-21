import { postTrustedApi } from "./trustedApi";

export type TaskerScheduleEligibility = {
  eligible: boolean;
  message: string;
};

/** The server is the source of truth because only it can safely inspect the
 * tasker's other confirmed assignments without exposing them to an employer. */
export function checkTaskerScheduleEligibility(taskId: string, workerId: string) {
  return postTrustedApi<TaskerScheduleEligibility>("/api/tasks/acceptance-eligibility", { taskId, workerId });
}

export function acceptTaskerApplication(taskId: string, workerId: string) {
  return postTrustedApi<{ ok: true; status: "Accepted" }>("/api/tasks/accept-application", { taskId, workerId });
}
