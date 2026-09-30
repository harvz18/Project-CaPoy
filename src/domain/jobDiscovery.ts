import { MatchResult } from "./matching";
import { Task } from "../types";

export type RankedJob = { task: Task; match: MatchResult };
export type JobSort = "recommended" | "nearest" | "newest" | "highest-pay";

export type JobDiscoveryFilters = {
  category: string;
  query: string;
  sort: JobSort;
};

function timestamp(value?: string) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function wage(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getJobCategories(tasks: Task[]) {
  return [...new Set(tasks
    .map((task) => task.category.trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function filterAndSortRankedJobs(items: RankedJob[], filters: JobDiscoveryFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  const category = filters.category.trim().toLocaleLowerCase();
  const filtered = items.filter(({ task }) => {
    const categoryMatches = !category || task.category.trim().toLocaleLowerCase() === category;
    if (!categoryMatches) return false;
    if (!query) return true;
    return [
      task.title,
      task.description,
      task.category,
      task.requiredCapability,
      task.locationAddress,
      task.location
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === "nearest") {
      return (left.match.distanceKm ?? Number.POSITIVE_INFINITY)
        - (right.match.distanceKm ?? Number.POSITIVE_INFINITY)
        || right.match.score - left.match.score
        || left.task.id.localeCompare(right.task.id);
    }
    if (filters.sort === "newest") {
      return timestamp(right.task.createdAt) - timestamp(left.task.createdAt)
        || left.task.id.localeCompare(right.task.id);
    }
    if (filters.sort === "highest-pay") {
      return wage(right.task.wage) - wage(left.task.wage)
        || right.match.score - left.match.score
        || left.task.id.localeCompare(right.task.id);
    }
    return Number(right.match.eligible) - Number(left.match.eligible)
      || right.match.score - left.match.score
      || (left.match.distanceKm ?? Number.POSITIVE_INFINITY)
        - (right.match.distanceKm ?? Number.POSITIVE_INFINITY)
      || timestamp(right.task.createdAt) - timestamp(left.task.createdAt)
      || left.task.id.localeCompare(right.task.id);
  });
}
