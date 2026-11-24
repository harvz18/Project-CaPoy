const assert = require("node:assert/strict");
const test = require("node:test");
const { portalTasksPage } = require("../server");

function createTaskDb(tasks, users) {
  const calls = { taskLimits: [], profileLookups: 0, cursorLookups: 0 };
  const taskDocuments = new Map(tasks.map((task) => [task.id, task]));
  const userDocuments = new Map(Object.entries(users));

  const taskDocument = (id) => ({
    id,
    get: async () => {
      calls.cursorLookups += 1;
      const task = taskDocuments.get(id);
      return task ? { id, exists: true, data: () => task } : { id, exists: false, data: () => undefined };
    }
  });

  const makeTaskQuery = (state = {}) => ({
    where: (_field, _operator, value) => makeTaskQuery({ ...state, status: value }),
    orderBy: (_field, direction) => makeTaskQuery({ ...state, direction }),
    limit: (value) => makeTaskQuery({ ...state, limit: value }),
    startAfter: (document) => makeTaskQuery({ ...state, cursor: document.id }),
    get: async () => {
      calls.taskLimits.push(state.limit);
      const ordered = [...tasks]
        .filter((task) => !state.status || task.status === state.status)
        .sort((left, right) => state.direction === "asc"
          ? left.createdAt.localeCompare(right.createdAt)
          : right.createdAt.localeCompare(left.createdAt));
      const start = state.cursor ? ordered.findIndex((task) => task.id === state.cursor) + 1 : 0;
      return {
        docs: ordered.slice(start, start + state.limit).map((task) => ({ id: task.id, data: () => task }))
      };
    }
  });

  return {
    calls,
    collection(name) {
      if (name === "tasks") return { ...makeTaskQuery(), doc: taskDocument };
      if (name === "users") return { doc: (id) => ({ id, collection: "users" }) };
      throw new Error(`Unexpected collection: ${name}`);
    },
    async getAll(...references) {
      calls.profileLookups += references.length;
      return references.flatMap((reference) => {
        const user = userDocuments.get(reference.id);
        return user ? [{ id: reference.id, data: () => user }] : [];
      });
    }
  };
}

test("task oversight reads one limited task page and only its related profiles", async () => {
  const tasks = Array.from({ length: 12 }, (_, index) => ({
    id: `task-${index + 1}`,
    title: `Task ${index + 1}`,
    clientId: "employer-1",
    workerId: index % 2 ? "worker-1" : undefined,
    status: "Finding Workers",
    createdAt: `2026-11-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`
  }));
  const db = createTaskDb(tasks, {
    "employer-1": { fullName: "Employer One" },
    "worker-1": { fullName: "Worker One" }
  });

  const first = await portalTasksPage({ request: { query: { page: "1", pageSize: "10", direction: "desc", status: "all" } }, db });

  assert.equal(first.items.length, 10);
  assert.equal(first.items[0].title, "Task 12");
  assert.equal(first.items[0].employerName, "Employer One");
  assert.equal(first.items[0].workerName, "Worker One");
  assert.equal(first.hasMore, true);
  assert.equal(first.nextCursor, "task-3");
  assert.deepEqual(db.calls.taskLimits, [11]);
  assert.equal(db.calls.profileLookups, 2);

  const second = await portalTasksPage({ request: { query: { page: "2", pageSize: "10", direction: "desc", status: "all", cursor: first.nextCursor } }, db });
  assert.equal(second.items.length, 2);
  assert.equal(second.items[0].title, "Task 2");
  assert.equal(second.hasMore, false);
  assert.equal(db.calls.cursorLookups, 1);
});
