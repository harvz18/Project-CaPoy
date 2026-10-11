import assert from "node:assert/strict";
import test from "node:test";
import { toUserFacingError } from "../src/utils/userFacingError";

test("permission failures are translated into an actionable explanation", () => {
  assert.equal(
    toUserFacingError({ code: "permission-denied", message: "Missing or insufficient permissions." }),
    "TaskLink could not verify permission for this action. The task, application, or conversation may have changed. Refresh the page, reopen the task, and try again."
  );
});

test("domain errors stay specific and active-applicant failures explain the remedy", () => {
  assert.equal(
    toUserFacingError(new Error("Choose an active applicant before accepting a worker.")),
    "That tasker does not have an active application for this task. Open Review Applicants and select a tasker marked Applied."
  );
  assert.equal(toUserFacingError(new Error("Enter a message before sending.")), "Enter a message before sending.");
});
