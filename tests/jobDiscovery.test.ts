import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortRankedJobs, getJobCategories, RankedJob } from "../src/domain/jobDiscovery";

const jobs: RankedJob[] = [
  {
    task: {
      id: "repair", clientId: "client", title: "Repair sink", description: "Kitchen plumbing",
      category: "Repair", location: "Mandalagan", wage: "700", estimatedDuration: "2 hours",
      status: "Finding Workers", paymentMethod: "COD", paymentStatus: "Pending", createdAt: "2026-09-30T00:00:00.000Z"
    },
    match: { eligible: true, score: 80, distanceKm: 3, reasons: [] }
  },
  {
    task: {
      id: "clean", clientId: "client", title: "Clean office", description: "Office cleaning",
      category: "Cleaning", location: "Alijis", wage: "900", estimatedDuration: "4 hours",
      status: "Finding Workers", paymentMethod: "COD", paymentStatus: "Pending", createdAt: "2026-10-01T00:00:00.000Z"
    },
    match: { eligible: true, score: 70, distanceKm: 1, reasons: [] }
  }
];

test("job categories are derived from current data", () => {
  assert.deepEqual(getJobCategories(jobs.map(({ task }) => task)), ["Cleaning", "Repair"]);
});

test("job search and category filters inspect real task fields", () => {
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "Repair", query: "kitchen", sort: "recommended" }).map(({ task }) => task.id), ["repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "alijis", sort: "recommended" }).map(({ task }) => task.id), ["clean"]);
});

test("job sort choices are deterministic", () => {
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "nearest" }).map(({ task }) => task.id), ["clean", "repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "newest" }).map(({ task }) => task.id), ["clean", "repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "highest-pay" }).map(({ task }) => task.id), ["clean", "repair"]);
  assert.deepEqual(filterAndSortRankedJobs(jobs, { category: "", query: "", sort: "recommended" }).map(({ task }) => task.id), ["repair", "clean"]);
});
