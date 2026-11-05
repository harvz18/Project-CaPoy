import assert from "node:assert/strict";
import test from "node:test";
import { assertCanCancelTask, assertValidCancellationReason, getCancellationEligibility } from "../src/domain/cancellation";
import { Task, UserProfile } from "../src/types";

const client = { id: "client-1", role: "client" } as UserProfile;
const worker = { id: "worker-1", role: "worker" } as UserProfile;
const task: Task = {
  id: "task-1", clientId: client.id, workerId: worker.id, applicantIds: [worker.id], title: "Move boxes", description: "Help move boxes",
  category: "Moving assistance", location: "Barangay Hall", wage: "500", estimatedDuration: "1 day", status: "Accepted",
  paymentMethod: "COD", paymentStatus: "Pending", createdAt: "2026-11-05T00:00:00.000Z"
};

test("both assigned parties may cancel an accepted task even with a stale start timestamp", () => {
  const acceptedTask = { ...task, startedAt: "2026-11-05T01:00:00.000Z" };
  assert.equal(getCancellationEligibility(acceptedTask, client).allowed, true);
  assert.equal(getCancellationEligibility(acceptedTask, worker).allowed, true);
});

test("worker cancellation does not infer location and is unavailable after check-in", () => {
  const eligibility = getCancellationEligibility({ ...task, status: "In Progress", startedAt: "2026-11-05T01:00:00.000Z" }, worker);
  assert.equal(eligibility.allowed, false);
  assert.match(eligibility.reason, /check-in/i);
});

test("open tasks remain cancellable only by their employer and require an auditable reason", () => {
  assert.equal(getCancellationEligibility({ ...task, workerId: undefined, status: "Finding Workers" }, client).allowed, true);
  assert.equal(getCancellationEligibility({ ...task, workerId: undefined, status: "Finding Workers" }, worker).allowed, false);
  assert.equal(assertValidCancellationReason("  Schedule changed \n "), "Schedule changed");
  assert.throws(() => assertValidCancellationReason("no"));
  assert.doesNotThrow(() => assertCanCancelTask(task, worker));
});
