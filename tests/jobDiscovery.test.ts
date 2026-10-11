import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortRankedJobs, getAvailableJobs, getJobCategories, RankedJob } from "../src/domain/jobDiscovery";

const jobs: RankedJob[] = [
  {
    task: {
      id: "repair", clientId: "client", title: "Repair sink", description: "Kitchen plumbing",
      category: "Repair", location: "Mandalagan", wage: "700", estimatedDuration: "2 hours",
      status: "Finding Workers", paymentMethod: "COD", paymentStatus: "Pending", createdAt: "2026-09-30T00:00:00.000Z"
    },
    match: { eligible: true, score: 80, distanceKm: 3, reasons: [], skillMatched: true }
  },
  {
    task: {
      id: "clean", clientId: "client", title: "Clean office", description: "Office cleaning",
      category: "Cleaning", location: "Alijis", wage: "900", estimatedDuration: "4 hours",
      status: "Finding Workers", paymentMethod: "COD", paymentStatus: "Pending", createdAt: "2026-10-01T00:00:00.000Z"
    },
    match: { eligible: true, score: 70, distanceKm: 1, reasons: [], skillMatched: true }
  }
];

test("job categories are derived from current data", () => {
  assert.deepEqual(getJobCategories(jobs.map(({ task }) => task)), ["Cleaning", "Repair"]);
});

test("the job board excludes tasks the tasker already applied to", () => {
  const applied = { ...jobs[0].task, status: "Applied" as const, applicantIds: ["worker-1"] };
  assert.deepEqual(getAvailableJobs([applied, jobs[1].task], "worker-1").map((item) => item.id), ["clean"]);
});

test("job search and category filters inspect real task fields", () => {
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "Repair", query: "kitchen", sort: "recommended" }).map(({ task }) => task.id), ["repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "alijis", sort: "recommended" }).map(({ task }) => task.id), ["clean"]);
});

test("job sort choices are deterministic", () => {
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "nearest" }).map(({ task }) => task.id), ["clean", "repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "newest" }).map(({ task }) => task.id), ["clean", "repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "highest-pay" }).map(({ task }) => task.id), ["clean", "repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "recommended" }).map(({ task }) => task.id), ["clean", "repair"]);
});

test("recommended jobs prioritize a skill match before a newer unmatched task", () => {
  const newerUnmatched: RankedJob = {
    task: { ...jobs[1].task, id: "new-unmatched", createdAt: "2026-10-02T00:00:00.000Z" },
    match: { eligible: false, score: 0, distanceKm: 0.5, reasons: [], skillMatched: false }
  };
  assert.deepEqual(
    filterAndSortRankedJobs([newerUnmatched, ...jobs], { category: "", query: "", sort: "recommended" })
      .map(({ task }) => task.id),
    ["clean", "repair", "new-unmatched"]
  );
});
