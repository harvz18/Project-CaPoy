import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanApply,
  assertCanRejectApplicant,
  assertCanWithdraw,
  assertTaskTransition,
  type TaskActor,
} from "../src/domain/taskWorkflow";
import type { Task, TaskStatus } from "../src/types";

const CLIENT: TaskActor = { id: "client-1", role: "client" };
const WORKER: TaskActor = { id: "worker-1", role: "worker" };
const OTHER_WORKER: TaskActor = { id: "worker-2", role: "worker" };

function task(status: TaskStatus, overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    clientId: CLIENT.id,
    applicantIds: [WORKER.id],
    title: "Test task",
    description: "A workflow test task",
    category: "General",
    location: "Test location",
    wage: "500",
    estimatedDuration: "1 hour",
    status,
    paymentMethod: "COD",
    paymentStatus: "Pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("allows every supported happy-path task transition", () => {
  const cases: Array<{
    current: TaskStatus;
    next: TaskStatus;
    actor: TaskActor;
    overrides?: Partial<Task>;
    selectedWorkerId?: string;
  }> = [
    { current: "Applied", next: "Accepted", actor: CLIENT, selectedWorkerId: WORKER.id },
    { current: "Accepted", next: "In Progress", actor: WORKER, overrides: { workerId: WORKER.id } },
    { current: "In Progress", next: "Pending Approval", actor: WORKER, overrides: { workerId: WORKER.id } },
    {
      current: "Pending Approval",
      next: "Finished",
      actor: CLIENT,
      overrides: { workerId: WORKER.id, paymentStatus: "Verified" },
    },
    { current: "Finished", next: "Archived", actor: CLIENT, overrides: { workerId: WORKER.id } },
    { current: "Finding Workers", next: "Cancelled", actor: CLIENT },
    { current: "Applied", next: "Cancelled", actor: CLIENT },
    { current: "Accepted", next: "Disputed", actor: CLIENT, overrides: { workerId: WORKER.id } },
    { current: "In Progress", next: "Disputed", actor: WORKER, overrides: { workerId: WORKER.id } },
    { current: "Pending Approval", next: "Disputed", actor: CLIENT, overrides: { workerId: WORKER.id } },
    { current: "Finished", next: "Disputed", actor: WORKER, overrides: { workerId: WORKER.id } },
  ];

  for (const item of cases) {
    assert.doesNotThrow(() =>
      assertTaskTransition(task(item.current, item.overrides), item.next, item.actor, item.selectedWorkerId)
    );
  }
});

test("rejects skipped, reversed, system-only, and terminal transitions", () => {
  const cases: Array<[TaskStatus, TaskStatus, Partial<Task>?]> = [
    ["Finding Workers", "Accepted"],
    ["Accepted", "Pending Approval", { workerId: WORKER.id }],
    ["In Progress", "Finished", { workerId: WORKER.id, paymentStatus: "Submitted" }],
    ["Finished", "In Progress", { workerId: WORKER.id }],
    ["Applied", "Expired"],
    ["Archived", "Disputed", { workerId: WORKER.id }],
    ["Cancelled", "Applied"],
    ["Expired", "Finding Workers"],
  ];

  for (const [current, next, overrides] of cases) {
    assert.throws(() => assertTaskTransition(task(current, overrides), next, CLIENT, WORKER.id));
  }
});

test("enforces the actor for client and assigned-worker transitions", () => {
  assert.throws(() => assertTaskTransition(task("Applied"), "Accepted", WORKER, WORKER.id));
  assert.throws(() =>
    assertTaskTransition(task("Accepted", { workerId: WORKER.id }), "In Progress", OTHER_WORKER)
  );
  assert.throws(() =>
    assertTaskTransition(task("In Progress", { workerId: WORKER.id }), "Pending Approval", CLIENT)
  );
  assert.throws(() =>
    assertTaskTransition(
      task("Pending Approval", { workerId: WORKER.id, paymentStatus: "Submitted" }),
      "Finished",
      WORKER
    )
  );
  assert.throws(() => assertTaskTransition(task("Finished"), "Archived", WORKER));
  assert.throws(() => assertTaskTransition(task("Finding Workers"), "Cancelled", WORKER));
  assert.throws(() =>
    assertTaskTransition(task("Accepted", { workerId: WORKER.id }), "Disputed", OTHER_WORKER)
  );
});

test("requires an active selected applicant for acceptance", () => {
  assert.throws(() => assertTaskTransition(task("Applied"), "Accepted", CLIENT));
  assert.throws(() => assertTaskTransition(task("Applied"), "Accepted", CLIENT, OTHER_WORKER.id));
});

test("requires verified payment before completion", () => {
  for (const paymentStatus of ["Pending", "Submitted", "Rejected"] as const) {
    assert.throws(() =>
      assertTaskTransition(
        task("Pending Approval", { workerId: WORKER.id, paymentStatus }),
        "Finished",
        CLIENT
      )
    );
  }

  assert.doesNotThrow(() =>
    assertTaskTransition(
      task("Pending Approval", { workerId: WORKER.id, paymentStatus: "Verified" }),
      "Finished",
      CLIENT
    )
  );
});

test("application policy is task-specific and requires a bid only for bidding tasks", () => {
  assert.doesNotThrow(() => assertCanApply(task("Finding Workers", { applicantIds: [] }), WORKER));
  assert.doesNotThrow(
    () => assertCanApply(task("Finding Workers", { applicantIds: [], requiredCapability: "Laundry" }), WORKER)
  );
  assert.doesNotThrow(() => assertCanApply(
    task("Finding Workers", { applicantIds: [], requiredCapability: "Laundry" }),
    { ...WORKER, capabilities: ["Laundry"] }
  ));
  assert.doesNotThrow(() => assertCanApply(task("Finding Workers", { applicantIds: [], pricingMode: "bidding" }), WORKER, "750"));
  assert.throws(() => assertCanApply(task("Finding Workers", { applicantIds: [], pricingMode: "bidding" }), WORKER));
  assert.throws(() => assertCanApply(task("Finding Workers", { applicantIds: [] }), CLIENT));
  assert.throws(() => assertCanApply(task("Applied"), WORKER));
  assert.throws(() =>
    assertCanApply(task("Accepted", { applicantIds: [], workerId: OTHER_WORKER.id }), WORKER)
  );
});

test("withdrawal and rejection require an active application", () => {
  assert.doesNotThrow(() => assertCanWithdraw(task("Applied"), WORKER, "Applied"));
  assert.throws(() => assertCanWithdraw(task("Applied"), OTHER_WORKER, "Applied"));
  assert.throws(() => assertCanWithdraw(task("Applied"), WORKER, "Withdrawn"));

  assert.doesNotThrow(() => assertCanRejectApplicant(task("Applied"), CLIENT, WORKER.id, "Applied"));
  assert.throws(() => assertCanRejectApplicant(task("Applied"), WORKER, WORKER.id, "Applied"));
  assert.throws(() => assertCanRejectApplicant(task("Applied"), CLIENT, WORKER.id, "Rejected"));
});
