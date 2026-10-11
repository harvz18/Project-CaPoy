type ErrorWithCode = {
  code?: unknown;
  message?: unknown;
};

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return { code: (error as ErrorWithCode).code, message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    const candidate = error as ErrorWithCode;
    return { code: candidate.code, message: candidate.message };
  }
  return { code: undefined, message: typeof error === "string" ? error : undefined };
}

export function toUserFacingError(error: unknown) {
  const details = errorDetails(error);
  const code = typeof details.code === "string" ? details.code.toLowerCase() : "";
  const message = typeof details.message === "string" ? details.message.trim() : "";
  const normalized = `${code} ${message}`.toLowerCase();

  if (normalized.includes("permission-denied") || normalized.includes("missing or insufficient permissions")) {
    return "TaskLink could not verify permission for this action. The task, application, or conversation may have changed. Refresh the page, reopen the task, and try again.";
  }
  if (normalized.includes("unauthenticated") || normalized.includes("auth/user-token-expired")) {
    return "Your session has expired. Log in again, then retry the action.";
  }
  if (normalized.includes("auth/invalid-credential") || normalized.includes("invalid_login_credentials")) {
    return "The mobile number or password is incorrect. Check both fields and try again.";
  }
  if (normalized.includes("auth/too-many-requests") || normalized.includes("resource-exhausted")) {
    return "Too many attempts were made. Wait a few minutes before trying again.";
  }
  if (normalized.includes("unavailable") || normalized.includes("network-request-failed") || normalized.includes("failed to fetch")) {
    return "TaskLink could not reach the server. Check your internet connection, then try again.";
  }
  if (normalized.includes("already-exists")) {
    return "This action was already completed. Refresh the task to see its latest status.";
  }
  if (normalized.includes("choose an active applicant")) {
    return "That tasker does not have an active application for this task. Open Review Applicants and select a tasker marked Applied.";
  }

  return message || "Unable to continue. Please try again.";
}
