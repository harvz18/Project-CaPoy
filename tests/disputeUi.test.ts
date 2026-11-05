import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const taskStatusSource = readFileSync(resolve(process.cwd(), "app", "task-status", "[id].tsx"), "utf8");
const helpSource = readFileSync(resolve(process.cwd(), "app", "help.tsx"), "utf8");

test("the user-facing task status screen has no dispute action or modal", () => {
  assert.doesNotMatch(taskStatusSource, /Open Dispute|disputeDialogOpen|handleSecondaryWorkflowAction\("dispute"\)/);
  assert.match(taskStatusSource, /Cancel Assignment|Cancel Task/);
});

test("user help directs post-start problems to the coordinator without exposing disputes", () => {
  assert.doesNotMatch(helpSource, /cancel or dispute|open a dispute/i);
  assert.match(helpSource, /project coordinator/i);
});
