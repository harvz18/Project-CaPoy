const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");
const {
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch
} = require("firebase/firestore");

const PROJECT_ID = "demo-tasklink";
const CLIENT_ID = "client-1";
const WORKER_ID = "worker-1";
const OUTSIDER_ID = "worker-2";
const SUSPENDED_ID = "worker-suspended";
const TASK_ID = "task-1";

let testEnvironment;

function user(id, role) {
  const profile = {
    id,
    role,
    fullName: `${role} ${id}`,
    mobileNumber: `0900000${id.slice(-3)}`,
    address: "Bacolod City",
    rating: 0,
    accountStatus: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  if (role === "worker") {
    profile.verificationStatus = "Pending Verification";
    profile.availabilityStatus = "Available";
    profile.availability = "Available";
    profile.completedTasks = 0;
  }
  return profile;
}

function publicProfile(id, role) {
  const profile = {
    id,
    role,
    fullName: `${role} ${id}`,
    rating: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  if (role === "worker") {
    profile.verificationStatus = "Pending Verification";
    profile.availabilityStatus = "Available";
    profile.availability = "Available";
    profile.completedTasks = 0;
  }
  return profile;
}

function taskData(overrides = {}) {
  return {
    clientId: CLIENT_ID,
    clientName: "Client One",
    title: "Repair a sink",
    description: "Replace a leaking fitting",
    category: "Plumbing",
    budget: 1200,
    location: "Bacolod City",
    latitude: 10.6765,
    longitude: 122.9509,
    status: "Finding Workers",
    applicantIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function dbFor(userId) {
  return testEnvironment.authenticatedContext(userId).firestore();
}

async function seedBaseData() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", CLIENT_ID), user(CLIENT_ID, "client")),
      setDoc(doc(db, "users", WORKER_ID), user(WORKER_ID, "worker")),
      setDoc(doc(db, "users", OUTSIDER_ID), user(OUTSIDER_ID, "worker")),
      setDoc(doc(db, "users", SUSPENDED_ID), {
        ...user(SUSPENDED_ID, "worker"),
        accountStatus: "suspended"
      }),
      setDoc(doc(db, "publicProfiles", CLIENT_ID), publicProfile(CLIENT_ID, "client")),
      setDoc(doc(db, "publicProfiles", WORKER_ID), publicProfile(WORKER_ID, "worker")),
      setDoc(doc(db, "publicProfiles", OUTSIDER_ID), publicProfile(OUTSIDER_ID, "worker")),
      setDoc(doc(db, "workerProfiles", WORKER_ID), {
        userId: WORKER_ID,
        availabilityStatus: "Available",
        availability: "Available",
        completedTasks: 0,
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
      setDoc(doc(db, "workerProfiles", OUTSIDER_ID), {
        userId: OUTSIDER_ID,
        availabilityStatus: "Available",
        availability: "Available",
        completedTasks: 0,
        updatedAt: "2026-01-01T00:00:00.000Z"
      })
    ]);
  });
}

async function seedWorkflowTask(overrides = {}) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = "2026-01-01T00:00:00.000Z";
    await Promise.all([
      setDoc(doc(db, "workerProfiles", WORKER_ID), {
        userId: WORKER_ID,
        availabilityStatus: "Available",
        availability: "Available",
        completedTasks: 0,
        updatedAt: now
      }),
      setDoc(doc(db, "workerProfiles", OUTSIDER_ID), {
        userId: OUTSIDER_ID,
        availabilityStatus: "Available",
        availability: "Available",
        completedTasks: 0,
        updatedAt: now
      }),
      setDoc(doc(db, "tasks", TASK_ID), taskData({
        status: "Applied",
        applicantIds: [WORKER_ID, OUTSIDER_ID],
        paymentStatus: "Submitted",
        updatedAt: now,
        ...overrides
      })),
      setDoc(doc(db, "payments", TASK_ID), {
        id: TASK_ID,
        taskId: TASK_ID,
        clientId: CLIENT_ID,
        paymentMethod: "COD",
        paymentStatus: overrides.paymentStatus ?? "Submitted",
        createdAt: now,
        updatedAt: now
      }),
      setDoc(doc(db, "taskMatches", `${TASK_ID}_${WORKER_ID}`), {
        id: `${TASK_ID}_${WORKER_ID}`,
        taskId: TASK_ID,
        clientId: CLIENT_ID,
        workerId: WORKER_ID,
        acceptanceStatus: "Applied",
        createdAt: now,
        updatedAt: now
      }),
      setDoc(doc(db, "taskMatches", `${TASK_ID}_${OUTSIDER_ID}`), {
        id: `${TASK_ID}_${OUTSIDER_ID}`,
        taskId: TASK_ID,
        clientId: CLIENT_ID,
        workerId: OUTSIDER_ID,
        acceptanceStatus: "Applied",
        createdAt: now,
        updatedAt: now
      })
    ]);
  });
}

before(async () => {
  testEnvironment = await initializeTestEnvironment({ projectId: PROJECT_ID });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await seedBaseData();
});

after(async () => {
  await testEnvironment.cleanup();
});

test("unauthenticated users cannot read public profiles", async () => {
  const db = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "publicProfiles", WORKER_ID)));
});

test("private profiles are owner-only while public profiles are authenticated-readable", async () => {
  const workerDb = dbFor(WORKER_ID);

  await assertSucceeds(getDoc(doc(workerDb, "users", WORKER_ID)));
  await assertFails(getDoc(doc(workerDb, "users", CLIENT_ID)));
  const publicSnapshot = await assertSucceeds(
    getDoc(doc(workerDb, "publicProfiles", CLIENT_ID))
  );
  assert.equal(publicSnapshot.data().mobileNumber, undefined);
  assert.equal(publicSnapshot.data().address, undefined);
});

test("account status cannot be self-changed and suspended accounts lose application access", async () => {
  const workerDb = dbFor(WORKER_ID);
  const suspendedDb = dbFor(SUSPENDED_ID);

  await assertFails(
    updateDoc(doc(workerDb, "users", WORKER_ID), { accountStatus: "suspended" })
  );
  await assertSucceeds(getDoc(doc(suspendedDb, "users", SUSPENDED_ID)));
  await assertFails(getDoc(doc(suspendedDb, "publicProfiles", WORKER_ID)));
});

test("users cannot forge ratings, verification, or private fields in public profiles", async () => {
  const workerDb = dbFor(WORKER_ID);

  await assertFails(updateDoc(doc(workerDb, "users", WORKER_ID), { rating: 5 }));
  await assertFails(
    updateDoc(doc(workerDb, "users", WORKER_ID), { verificationStatus: "Verified" })
  );
  await assertFails(
    updateDoc(doc(workerDb, "publicProfiles", WORKER_ID), { address: "Private address" })
  );
});

test("registration can atomically create private, public, and role profiles", async () => {
  const newUserId = "new-worker";
  const db = dbFor(newUserId);
  const batch = writeBatch(db);
  batch.set(doc(db, "users", newUserId), user(newUserId, "worker"));
  batch.set(doc(db, "publicProfiles", newUserId), publicProfile(newUserId, "worker"));
  batch.set(doc(db, "workerProfiles", newUserId), {
    userId: newUserId,
    skills: [],
    availabilityStatus: "Available"
  });

  await assertSucceeds(batch.commit());
});

test("only a client can create an open task owned by that client", async () => {
  const clientDb = dbFor(CLIENT_ID);
  const workerDb = dbFor(WORKER_ID);

  const batch = writeBatch(clientDb);
  batch.set(doc(clientDb, "tasks", TASK_ID), taskData({ paymentStatus: "Pending" }));
  batch.set(doc(clientDb, "payments", TASK_ID), {
    id: TASK_ID,
    taskId: TASK_ID,
    clientId: CLIENT_ID,
    paymentMethod: "COD",
    paymentStatus: "Pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
  await assertSucceeds(batch.commit());
  await assertFails(
    setDoc(doc(workerDb, "tasks", "worker-task"), taskData({ clientId: WORKER_ID }))
  );
});

test("a worker can apply atomically but cannot assign themselves", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tasks", TASK_ID), taskData());
  });

  const workerDb = dbFor(WORKER_ID);
  const batch = writeBatch(workerDb);
  batch.update(doc(workerDb, "tasks", TASK_ID), {
    applicantIds: [WORKER_ID],
    status: "Applied",
    lastApplicationWorkerId: WORKER_ID,
    lastApplicationMatchId: `${TASK_ID}_${WORKER_ID}`,
    lastApplicationAction: "Applied",
    updatedAt: "2026-01-01T00:01:00.000Z"
  });
  batch.set(doc(workerDb, "taskMatches", `${TASK_ID}_${WORKER_ID}`), {
    taskId: TASK_ID,
    clientId: CLIENT_ID,
    workerId: WORKER_ID,
    acceptanceStatus: "Applied",
    createdAt: "2026-01-01T00:00:00.000Z"
  });

  await assertSucceeds(batch.commit());
  await assertFails(
    updateDoc(doc(workerDb, "tasks", TASK_ID), {
      status: "Accepted",
      workerId: WORKER_ID,
      acceptedAt: "2026-01-01T01:00:00.000Z"
    })
  );
});

test("client and worker accounts can complete the full canonical task lifecycle", async () => {
  const clientDb = dbFor(CLIENT_ID);
  const workerDb = dbFor(WORKER_ID);
  const taskRef = doc(clientDb, "tasks", TASK_ID);
  const paymentRef = doc(clientDb, "payments", TASK_ID);
  const matchId = `${TASK_ID}_${WORKER_ID}`;

  let now = "2026-01-01T00:00:00.000Z";
  let batch = writeBatch(clientDb);
  batch.set(taskRef, taskData({ paymentStatus: "Pending", updatedAt: now }));
  batch.set(paymentRef, {
    id: TASK_ID,
    taskId: TASK_ID,
    clientId: CLIENT_ID,
    paymentMethod: "COD",
    paymentStatus: "Pending",
    createdAt: now,
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  now = "2026-01-01T00:05:00.000Z";
  batch = writeBatch(workerDb);
  batch.set(doc(workerDb, "taskMatches", matchId), {
    id: matchId,
    taskId: TASK_ID,
    clientId: CLIENT_ID,
    workerId: WORKER_ID,
    acceptanceStatus: "Applied",
    createdAt: now,
    updatedAt: now
  });
  batch.update(doc(workerDb, "tasks", TASK_ID), {
    applicantIds: [WORKER_ID],
    status: "Applied",
    lastApplicationWorkerId: WORKER_ID,
    lastApplicationMatchId: matchId,
    lastApplicationAction: "Applied",
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  now = "2026-01-01T00:10:00.000Z";
  batch = writeBatch(clientDb);
  batch.update(taskRef, {
    status: "Accepted",
    workerId: WORKER_ID,
    applicantIds: [WORKER_ID],
    selectedMatchId: matchId,
    acceptedAt: now,
    updatedAt: now
  });
  batch.update(paymentRef, { workerId: WORKER_ID, updatedAt: now });
  batch.update(doc(clientDb, "taskMatches", matchId), {
    acceptanceStatus: "Accepted",
    hiredAt: now,
    updatedAt: now
  });
  batch.update(doc(clientDb, "users", WORKER_ID), {
    availabilityStatus: "Busy",
    availability: "Busy",
    activeTaskId: TASK_ID,
    updatedAt: now
  });
  batch.update(doc(clientDb, "workerProfiles", WORKER_ID), {
    availabilityStatus: "Busy",
    availability: "Busy",
    updatedAt: now
  });
  batch.update(doc(clientDb, "publicProfiles", WORKER_ID), {
    availabilityStatus: "Busy",
    availability: "Busy",
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  now = "2026-01-01T00:15:00.000Z";
  await assertSucceeds(updateDoc(doc(workerDb, "tasks", TASK_ID), {
    status: "In Progress",
    startedAt: now,
    updatedAt: now
  }));
  now = "2026-01-01T01:15:00.000Z";
  await assertSucceeds(updateDoc(doc(workerDb, "tasks", TASK_ID), {
    status: "Pending Approval",
    workerFinishedAt: now,
    updatedAt: now
  }));

  now = "2026-01-01T01:20:00.000Z";
  batch = writeBatch(clientDb);
  batch.update(taskRef, {
    paymentStatus: "Submitted",
    proofOfPaymentText: "COD confirmed by client",
    updatedAt: now
  });
  batch.update(paymentRef, {
    paymentStatus: "Submitted",
    proofOfPaymentText: "COD confirmed by client",
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  now = "2026-01-01T01:25:00.000Z";
  batch = writeBatch(clientDb);
  batch.update(taskRef, { status: "Finished", finishedAt: now, updatedAt: now });
  batch.update(doc(clientDb, "users", WORKER_ID), {
    availabilityStatus: "Available",
    availability: "Available",
    activeTaskId: deleteField(),
    completedTasks: 1,
    updatedAt: now
  });
  batch.update(doc(clientDb, "workerProfiles", WORKER_ID), {
    availabilityStatus: "Available",
    availability: "Available",
    completedTasks: 1,
    updatedAt: now
  });
  batch.update(doc(clientDb, "publicProfiles", WORKER_ID), {
    availabilityStatus: "Available",
    availability: "Available",
    completedTasks: 1,
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  now = "2026-01-01T01:30:00.000Z";
  await assertSucceeds(updateDoc(taskRef, { status: "Archived", archivedAt: now, updatedAt: now }));
  assert.equal((await getDoc(taskRef)).data().status, "Archived");
  assert.equal((await getDoc(doc(workerDb, "users", WORKER_ID))).data().completedTasks, 1);
});

test("acceptance atomically selects one worker, rejects the rest, links payment, and marks the worker busy", async () => {
  await seedWorkflowTask();
  const db = dbFor(CLIENT_ID);
  const now = "2026-01-01T01:00:00.000Z";
  const batch = writeBatch(db);
  batch.update(doc(db, "tasks", TASK_ID), {
    status: "Accepted",
    workerId: WORKER_ID,
    applicantIds: [WORKER_ID],
    selectedMatchId: `${TASK_ID}_${WORKER_ID}`,
    acceptedAt: now,
    updatedAt: now
  });
  batch.update(doc(db, "payments", TASK_ID), { workerId: WORKER_ID, updatedAt: now });
  batch.update(doc(db, "taskMatches", `${TASK_ID}_${WORKER_ID}`), {
    acceptanceStatus: "Accepted",
    hiredAt: now,
    updatedAt: now
  });
  batch.update(doc(db, "taskMatches", `${TASK_ID}_${OUTSIDER_ID}`), {
    acceptanceStatus: "Rejected",
    rejectedAt: now,
    updatedAt: now
  });
  batch.update(doc(db, "users", WORKER_ID), {
    availabilityStatus: "Busy",
    availability: "Busy",
    activeTaskId: TASK_ID,
    updatedAt: now
  });
  batch.update(doc(db, "workerProfiles", WORKER_ID), {
    availabilityStatus: "Busy",
    availability: "Busy",
    updatedAt: now
  });
  batch.update(doc(db, "publicProfiles", WORKER_ID), {
    availabilityStatus: "Busy",
    availability: "Busy",
    updatedAt: now
  });
  batch.set(doc(db, "notifications", `${TASK_ID}_accepted_${WORKER_ID}`), {
    userId: WORKER_ID,
    taskId: TASK_ID,
    createdBy: CLIENT_ID,
    notificationType: "Application accepted",
    message: "Accepted",
    readStatus: false,
    createdAt: now
  });
  batch.set(doc(db, "notifications", `${TASK_ID}_rejected_${OUTSIDER_ID}`), {
    userId: OUTSIDER_ID,
    taskId: TASK_ID,
    createdBy: CLIENT_ID,
    notificationType: "Application update",
    message: "Not selected",
    readStatus: false,
    createdAt: now
  });

  await assertSucceeds(batch.commit());
  const [taskSnapshot, workerSnapshot, rejectedMatchSnapshot] = await Promise.all([
    getDoc(doc(db, "tasks", TASK_ID)),
    getDoc(doc(dbFor(WORKER_ID), "users", WORKER_ID)),
    getDoc(doc(db, "taskMatches", `${TASK_ID}_${OUTSIDER_ID}`))
  ]);
  assert.equal(taskSnapshot.data().workerId, WORKER_ID);
  assert.deepEqual(taskSnapshot.data().applicantIds, [WORKER_ID]);
  assert.equal(workerSnapshot.data().activeTaskId, TASK_ID);
  assert.equal(rejectedMatchSnapshot.data().acceptanceStatus, "Rejected");
});

test("acceptance is denied when its required worker and payment writes are omitted", async () => {
  await seedWorkflowTask();
  const db = dbFor(CLIENT_ID);
  await assertFails(updateDoc(doc(db, "tasks", TASK_ID), {
    status: "Accepted",
    workerId: WORKER_ID,
    applicantIds: [WORKER_ID],
    selectedMatchId: `${TASK_ID}_${WORKER_ID}`,
    acceptedAt: "2026-01-01T01:00:00.000Z",
    updatedAt: "2026-01-01T01:00:00.000Z"
  }));
});

test("a worker can withdraw only their active application and the task index follows the match", async () => {
  await seedWorkflowTask({ applicantIds: [WORKER_ID] });
  const db = dbFor(WORKER_ID);
  const now = "2026-01-01T01:00:00.000Z";
  const batch = writeBatch(db);
  batch.update(doc(db, "taskMatches", `${TASK_ID}_${WORKER_ID}`), {
    acceptanceStatus: "Withdrawn",
    withdrawnAt: now,
    updatedAt: now
  });
  batch.update(doc(db, "tasks", TASK_ID), {
    applicantIds: [],
    status: "Finding Workers",
    lastApplicationWorkerId: WORKER_ID,
    lastApplicationMatchId: `${TASK_ID}_${WORKER_ID}`,
    lastApplicationAction: "Withdrawn",
    updatedAt: now
  });
  batch.set(doc(db, "notifications", `${TASK_ID}_withdrawn_${WORKER_ID}`), {
    userId: CLIENT_ID,
    taskId: TASK_ID,
    createdBy: WORKER_ID,
    notificationType: "Application withdrawn",
    message: "Withdrawn",
    readStatus: false,
    createdAt: now
  });
  await assertSucceeds(batch.commit());
});

test("a client can reject one active application without changing the other match", async () => {
  await seedWorkflowTask();
  const db = dbFor(CLIENT_ID);
  const now = "2026-01-01T01:30:00.000Z";
  const batch = writeBatch(db);
  batch.update(doc(db, "taskMatches", `${TASK_ID}_${WORKER_ID}`), {
    acceptanceStatus: "Rejected",
    rejectedAt: now,
    updatedAt: now
  });
  batch.update(doc(db, "tasks", TASK_ID), {
    applicantIds: [OUTSIDER_ID],
    status: "Applied",
    lastApplicationWorkerId: WORKER_ID,
    lastApplicationMatchId: `${TASK_ID}_${WORKER_ID}`,
    lastApplicationAction: "Rejected",
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  const rejectedMatch = await getDoc(doc(dbFor(WORKER_ID), "taskMatches", `${TASK_ID}_${WORKER_ID}`));
  const remainingMatch = await getDoc(doc(db, "taskMatches", `${TASK_ID}_${OUTSIDER_ID}`));
  assert.equal(rejectedMatch.data().acceptanceStatus, "Rejected");
  assert.equal(remainingMatch.data().acceptanceStatus, "Applied");
});

test("the assigned worker can advance Accepted to In Progress to Pending Approval", async () => {
  await seedWorkflowTask({
    status: "Accepted",
    applicantIds: [WORKER_ID],
    workerId: WORKER_ID,
    selectedMatchId: `${TASK_ID}_${WORKER_ID}`
  });
  const db = dbFor(WORKER_ID);
  const startedAt = "2026-01-01T01:00:00.000Z";
  await assertSucceeds(updateDoc(doc(db, "tasks", TASK_ID), {
    status: "In Progress",
    startedAt,
    updatedAt: startedAt
  }));

  const workerFinishedAt = "2026-01-01T02:00:00.000Z";
  await assertSucceeds(updateDoc(doc(db, "tasks", TASK_ID), {
    status: "Pending Approval",
    workerFinishedAt,
    updatedAt: workerFinishedAt
  }));
  assert.equal((await getDoc(doc(db, "tasks", TASK_ID))).data().status, "Pending Approval");
});

test("wrong actors and skipped workflow states are denied at the data boundary", async () => {
  await seedWorkflowTask({
    status: "Accepted",
    applicantIds: [WORKER_ID],
    workerId: WORKER_ID,
    selectedMatchId: `${TASK_ID}_${WORKER_ID}`
  });
  const now = "2026-01-01T01:00:00.000Z";
  await assertFails(updateDoc(doc(dbFor(CLIENT_ID), "tasks", TASK_ID), {
    status: "In Progress",
    startedAt: now,
    updatedAt: now
  }));
  await assertFails(updateDoc(doc(dbFor(OUTSIDER_ID), "tasks", TASK_ID), {
    status: "In Progress",
    startedAt: now,
    updatedAt: now
  }));
  await assertFails(updateDoc(doc(dbFor(WORKER_ID), "tasks", TASK_ID), {
    status: "Pending Approval",
    workerFinishedAt: now,
    updatedAt: now
  }));
  await assertFails(updateDoc(doc(dbFor(CLIENT_ID), "tasks", TASK_ID), {
    status: "Expired",
    updatedAt: now
  }));
});

test("a client can archive only a finished task", async () => {
  await seedWorkflowTask({
    status: "Finished",
    applicantIds: [WORKER_ID],
    workerId: WORKER_ID,
    selectedMatchId: `${TASK_ID}_${WORKER_ID}`
  });
  const db = dbFor(CLIENT_ID);
  const now = "2026-01-01T03:00:00.000Z";
  await assertSucceeds(updateDoc(doc(db, "tasks", TASK_ID), {
    status: "Archived",
    archivedAt: now,
    updatedAt: now
  }));
  await assertFails(updateDoc(doc(dbFor(WORKER_ID), "tasks", TASK_ID), {
    status: "In Progress",
    startedAt: now,
    updatedAt: now
  }));
});

test("cancelling an open task also closes its active application matches", async () => {
  await seedWorkflowTask();
  const db = dbFor(CLIENT_ID);
  const now = "2026-01-01T01:00:00.000Z";
  const batch = writeBatch(db);
  batch.update(doc(db, "tasks", TASK_ID), { status: "Cancelled", cancelledAt: now, updatedAt: now });
  for (const workerId of [WORKER_ID, OUTSIDER_ID]) {
    batch.update(doc(db, "taskMatches", `${TASK_ID}_${workerId}`), {
      acceptanceStatus: "Cancelled",
      cancelledAt: now,
      updatedAt: now
    });
  }
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(doc(db, "tasks", TASK_ID))).data().status, "Cancelled");
});

test("either assigned participant can dispute an active task but an outsider cannot", async () => {
  await seedWorkflowTask({
    status: "In Progress",
    applicantIds: [WORKER_ID],
    workerId: WORKER_ID,
    selectedMatchId: `${TASK_ID}_${WORKER_ID}`
  });
  const now = "2026-01-01T01:00:00.000Z";
  await assertFails(updateDoc(doc(dbFor(OUTSIDER_ID), "tasks", TASK_ID), {
    status: "Disputed",
    disputedAt: now,
    updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(dbFor(WORKER_ID), "tasks", TASK_ID), {
    status: "Disputed",
    disputedAt: now,
    updatedAt: now
  }));
});

test("completion requires submitted payment and atomically restores availability and increments the counter once", async () => {
  await seedWorkflowTask({
    status: "Pending Approval",
    applicantIds: [WORKER_ID],
    workerId: WORKER_ID,
    paymentStatus: "Submitted"
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      updateDoc(doc(db, "users", WORKER_ID), {
        availabilityStatus: "Busy",
        availability: "Busy",
        activeTaskId: TASK_ID
      }),
      updateDoc(doc(db, "workerProfiles", WORKER_ID), {
        availabilityStatus: "Busy",
        availability: "Busy"
      }),
      updateDoc(doc(db, "publicProfiles", WORKER_ID), {
        availabilityStatus: "Busy",
        availability: "Busy"
      })
    ]);
  });
  const db = dbFor(CLIENT_ID);
  const now = "2026-01-01T02:00:00.000Z";
  const batch = writeBatch(db);
  batch.update(doc(db, "tasks", TASK_ID), { status: "Finished", finishedAt: now, updatedAt: now });
  batch.update(doc(db, "users", WORKER_ID), {
    availabilityStatus: "Available",
    availability: "Available",
    activeTaskId: deleteField(),
    completedTasks: 1,
    updatedAt: now
  });
  batch.update(doc(db, "workerProfiles", WORKER_ID), {
    availabilityStatus: "Available",
    availability: "Available",
    completedTasks: 1,
    updatedAt: now
  });
  batch.update(doc(db, "publicProfiles", WORKER_ID), {
    availabilityStatus: "Available",
    availability: "Available",
    completedTasks: 1,
    updatedAt: now
  });
  batch.set(doc(db, "notifications", `${TASK_ID}_finished_${WORKER_ID}`), {
    userId: WORKER_ID,
    taskId: TASK_ID,
    createdBy: CLIENT_ID,
    notificationType: "Task completed",
    message: "Finished",
    readStatus: false,
    createdAt: now
  });
  await assertSucceeds(batch.commit());
  const workerSnapshot = await getDoc(doc(dbFor(WORKER_ID), "users", WORKER_ID));
  assert.equal(workerSnapshot.data().completedTasks, 1);
  assert.equal(workerSnapshot.data().activeTaskId, undefined);
  await assertFails(updateDoc(doc(db, "users", WORKER_ID), { completedTasks: 2 }));
});

test("an unrelated worker cannot read a closed assigned task", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tasks", TASK_ID),
      taskData({
        status: "Accepted",
        applicantIds: [WORKER_ID],
        workerId: WORKER_ID
      })
    );
  });

  await assertSucceeds(getDoc(doc(dbFor(WORKER_ID), "tasks", TASK_ID)));
  await assertFails(getDoc(doc(dbFor(OUTSIDER_ID), "tasks", TASK_ID)));
});

test("task chat is writable only by a task participant", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tasks", TASK_ID),
      taskData({
        status: "Accepted",
        applicantIds: [WORKER_ID],
        workerId: WORKER_ID
      })
    );
  });

  const message = {
    taskId: TASK_ID,
    senderId: WORKER_ID,
    receiverId: CLIENT_ID,
    participantIds: [WORKER_ID, CLIENT_ID],
    message: "I am on my way.",
    createdAt: "2026-01-01T00:00:00.000Z"
  };

  await assertSucceeds(
    setDoc(doc(dbFor(WORKER_ID), "messages", "allowed-message"), message)
  );
  await assertFails(
    setDoc(doc(dbFor(OUTSIDER_ID), "messages", "blocked-message"), {
      ...message,
      senderId: OUTSIDER_ID,
      participantIds: [OUTSIDER_ID, CLIENT_ID]
    })
  );
});

test("ratings require completion, a participant, and a unique deterministic id", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tasks", TASK_ID),
      taskData({
        status: "Pending Approval",
        applicantIds: [WORKER_ID],
        workerId: WORKER_ID
      })
    );
  });

  const clientDb = dbFor(CLIENT_ID);
  const ratingRef = doc(clientDb, "ratings", `${TASK_ID}_${CLIENT_ID}`);
  const rating = {
    taskId: TASK_ID,
    reviewerId: CLIENT_ID,
    targetUserId: WORKER_ID,
    score: 5,
    comment: "Good work",
    createdAt: "2026-01-01T00:00:00.000Z"
  };

  await assertFails(setDoc(ratingRef, rating));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "tasks", TASK_ID), { status: "Finished" });
  });

  await assertSucceeds(setDoc(ratingRef, rating));
  await assertFails(setDoc(ratingRef, { ...rating, score: 4 }));
  await assertFails(
    setDoc(doc(dbFor(OUTSIDER_ID), "ratings", `${TASK_ID}_${OUTSIDER_ID}`), {
      ...rating,
      reviewerId: OUTSIDER_ID
    })
  );
});
