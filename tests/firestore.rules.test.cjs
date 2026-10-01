const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");
const {
  deleteField,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  or,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch
} = require("firebase/firestore");

const PROJECT_ID = "demo-tasklink";
const CLIENT_ID = "client-1";
const WORKER_ID = "worker-1";
const OUTSIDER_ID = "worker-2";
const SUSPENDED_ID = "worker-suspended";
const ADMIN_ID = "admin-1";
const SUPERADMIN_ID = "superadmin-1";
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
    geofenceRadius: 500,
    locationCapturedAt: "2026-01-01T00:00:00.000Z",
    locationSource: "manual",
    status: "Finding Workers",
    paymentMethod: "COD",
    applicantIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    ...overrides
  };
}

function dbFor(userId, tokenOptions) {
  return testEnvironment.authenticatedContext(userId, tokenOptions).firestore();
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
      setDoc(doc(db, "users", ADMIN_ID), user(ADMIN_ID, "admin")),
      setDoc(doc(db, "users", SUPERADMIN_ID), user(SUPERADMIN_ID, "admin")),
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
  await assertFails(
    updateDoc(doc(workerDb, "publicProfiles", WORKER_ID), { fullName: "Forged public name" })
  );
});

test("unapproved names update atomically while approved and legacy verified names stay locked", async () => {
  const clientDb = dbFor(CLIENT_ID);
  const workerDb = dbFor(WORKER_ID);
  const renamedAt = "2026-01-01T00:05:00.000Z";

  const allowedRename = writeBatch(clientDb);
  allowedRename.update(doc(clientDb, "users", CLIENT_ID), {
    fullName: "Updated Client Name",
    updatedAt: renamedAt
  });
  allowedRename.update(doc(clientDb, "publicProfiles", CLIENT_ID), {
    fullName: "Updated Client Name",
    updatedAt: renamedAt
  });
  await assertSucceeds(allowedRename.commit());

  await assertFails(updateDoc(doc(clientDb, "users", CLIENT_ID), {
    address: "x",
    updatedAt: renamedAt
  }));
  await assertSucceeds(updateDoc(doc(clientDb, "users", CLIENT_ID), {
    address: "Barangay Villamonte, Bacolod City",
    updatedAt: renamedAt
  }));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      updateDoc(doc(db, "users", CLIENT_ID), {
        identityStatus: "Approved",
        identityApprovedAt: renamedAt,
        identityApprovedBy: ADMIN_ID,
        identityLockedAt: renamedAt
      }),
      updateDoc(doc(db, "users", WORKER_ID), {
        verificationStatus: "Verified"
      }),
      updateDoc(doc(db, "publicProfiles", WORKER_ID), {
        verificationStatus: "Verified"
      })
    ]);
  });

  const lockedClientRename = writeBatch(clientDb);
  lockedClientRename.update(doc(clientDb, "users", CLIENT_ID), {
    fullName: "Changed After Approval",
    updatedAt: "2026-01-01T00:06:00.000Z"
  });
  lockedClientRename.update(doc(clientDb, "publicProfiles", CLIENT_ID), {
    fullName: "Changed After Approval",
    updatedAt: "2026-01-01T00:06:00.000Z"
  });
  await assertFails(lockedClientRename.commit());

  const legacyWorkerRename = writeBatch(workerDb);
  legacyWorkerRename.update(doc(workerDb, "users", WORKER_ID), {
    fullName: "Changed Legacy Worker",
    updatedAt: "2026-01-01T00:06:00.000Z"
  });
  legacyWorkerRename.update(doc(workerDb, "publicProfiles", WORKER_ID), {
    fullName: "Changed Legacy Worker",
    updatedAt: "2026-01-01T00:06:00.000Z"
  });
  await assertFails(legacyWorkerRename.commit());
});

test("workers can submit private verification metadata atomically but cannot approve themselves", async () => {
  const workerDb = dbFor(WORKER_ID);
  const now = "2026-01-01T00:10:00.000Z";
  const verification = {
    userId: WORKER_ID,
    validIdType: "PhilSys ID",
    validIdPath: `verification/${WORKER_ID}/valid-id.pdf`,
    medicalCertificatePath: `verification/${WORKER_ID}/medical.pdf`,
    status: "Pending Verification",
    submittedAt: now,
    updatedAt: now
  };
  const profileUpdate = {
    validIdType: verification.validIdType,
    validIdUrl: verification.validIdPath,
    medicalCertificateUrl: verification.medicalCertificatePath,
    verificationStatus: verification.status,
    updatedAt: now
  };
  const privateUserUpdate = {
    ...profileUpdate,
    identityStatus: "Pending Approval"
  };
  const batch = writeBatch(workerDb);
  batch.set(doc(workerDb, "verificationRequests", WORKER_ID), verification);
  batch.update(doc(workerDb, "users", WORKER_ID), privateUserUpdate);
  batch.update(doc(workerDb, "workerProfiles", WORKER_ID), profileUpdate);
  batch.update(doc(workerDb, "publicProfiles", WORKER_ID), {
    verificationStatus: verification.status,
    updatedAt: now
  });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(workerDb, "verificationRequests", WORKER_ID), {
    status: "Verified",
    updatedAt: "2026-01-01T00:11:00.000Z"
  }));
});

test("only a custom-claim administrator can read private review queues and audit logs", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "verificationRequests", WORKER_ID), {
        userId: WORKER_ID,
        validIdType: "PhilSys ID",
        validIdPath: `verification/${WORKER_ID}/valid-id.pdf`,
        medicalCertificatePath: `verification/${WORKER_ID}/medical.pdf`,
        status: "Pending Verification",
        submittedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
      setDoc(doc(db, "auditLogs", "audit-1"), {
        actorId: ADMIN_ID,
        action: "test",
        targetType: "user",
        targetId: WORKER_ID,
        createdAt: "2026-01-01T00:00:00.000Z"
      })
    ]);
  });
  const adminDb = dbFor(ADMIN_ID, { admin: true });
  const superadminDb = dbFor(SUPERADMIN_ID, { superadmin: true });
  const unclaimedAdminDb = dbFor(ADMIN_ID);
  const clientDb = dbFor(CLIENT_ID);
  await assertFails(getDocs(collection(adminDb, "users")));
  await assertSucceeds(getDocs(collection(adminDb, "verificationRequests")));
  await assertSucceeds(getDocs(collection(adminDb, "auditLogs")));
  await assertFails(getDocs(collection(superadminDb, "users")));
  await assertSucceeds(getDocs(collection(superadminDb, "auditLogs")));
  await assertFails(getDocs(collection(unclaimedAdminDb, "auditLogs")));
  await assertFails(getDocs(collection(clientDb, "verificationRequests")));
  await assertFails(getDocs(collection(clientDb, "auditLogs")));
  await assertFails(setDoc(doc(adminDb, "auditLogs", "forged"), {
    actorId: ADMIN_ID,
    action: "forged",
    targetType: "user",
    targetId: CLIENT_ID,
    createdAt: "2026-01-01T00:00:00.000Z"
  }));
});

test("only custom-claim administrators can read trusted analytics snapshots", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "analyticsSnapshots", "v1_2026-09-25_2026-10-01"), {
      version: 1,
      source: "trusted-function",
      generatedAt: "2026-10-01T00:00:00.000Z",
      range: { startDate: "2026-09-25", endDate: "2026-10-01", timeZone: "Asia/Manila" },
      accounts: { employers: 1, taskers: 2, active: 2, restricted: 1 }
    });
  });
  const snapshotId = "v1_2026-09-25_2026-10-01";
  const adminDb = dbFor(ADMIN_ID, { admin: true });
  const superadminDb = dbFor(SUPERADMIN_ID, { superadmin: true });
  await assertSucceeds(getDoc(doc(adminDb, "analyticsSnapshots", snapshotId)));
  await assertSucceeds(getDoc(doc(superadminDb, "analyticsSnapshots", snapshotId)));
  await assertFails(getDoc(doc(dbFor(ADMIN_ID), "analyticsSnapshots", snapshotId)));
  await assertFails(getDoc(doc(dbFor(CLIENT_ID), "analyticsSnapshots", snapshotId)));
  await assertFails(getDoc(doc(dbFor(WORKER_ID), "analyticsSnapshots", snapshotId)));
  await assertFails(setDoc(doc(adminDb, "analyticsSnapshots", "forged"), {
    source: "client",
    accounts: { active: 999 }
  }));
});

test("violation reports are validated, staff-readable, and immutable to clients", async () => {
  const clientDb = dbFor(CLIENT_ID);
  const reportRef = doc(clientDb, "violationReports", "report-1");
  const report = {
    reporterId: CLIENT_ID,
    targetUserId: WORKER_ID,
    category: "Safety",
    reason: "Unsafe behavior was observed at the task location.",
    evidenceReference: null,
    taskId: TASK_ID,
    status: "Open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  await assertFails(setDoc(reportRef, report));
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "violationReports", "report-1"), report);
  });
  await assertFails(getDoc(reportRef));
  await assertFails(getDoc(doc(dbFor(ADMIN_ID, { admin: true }), "violationReports", "report-1")));
  await assertSucceeds(getDoc(doc(dbFor(SUPERADMIN_ID, { superadmin: true }), "violationReports", "report-1")));
  await assertFails(updateDoc(reportRef, { status: "Actioned" }));
  await assertFails(setDoc(doc(clientDb, "violationReports", "self-report"), {
    ...report,
    targetUserId: CLIENT_ID
  }));
  await assertFails(setDoc(doc(dbFor(SUSPENDED_ID), "violationReports", "blocked-report"), {
    ...report,
    reporterId: SUSPENDED_ID
  }));
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

  const newClientId = "new-client";
  const clientRegistrationDb = dbFor(newClientId);
  const clientBatch = writeBatch(clientRegistrationDb);
  clientBatch.set(doc(clientRegistrationDb, "users", newClientId), user(newClientId, "client"));
  clientBatch.set(doc(clientRegistrationDb, "publicProfiles", newClientId), publicProfile(newClientId, "client"));
  clientBatch.set(doc(clientRegistrationDb, "clientProfiles", newClientId), {
    userId: newClientId,
    businessName: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });

  await assertSucceeds(clientBatch.commit());

  const forgedUserId = "forged-approved-client";
  const forgedDb = dbFor(forgedUserId);
  const forgedBatch = writeBatch(forgedDb);
  forgedBatch.set(doc(forgedDb, "users", forgedUserId), {
    ...user(forgedUserId, "client"),
    identityStatus: "Approved",
    identityLockedAt: "2026-01-01T00:00:00.000Z"
  });
  forgedBatch.set(doc(forgedDb, "publicProfiles", forgedUserId), publicProfile(forgedUserId, "client"));
  forgedBatch.set(doc(forgedDb, "clientProfiles", forgedUserId), {
    userId: forgedUserId,
    businessName: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
  await assertFails(forgedBatch.commit());
});

test("an idle tasker can switch to employer mode atomically", async () => {
  const db = dbFor(WORKER_ID);
  const batch = writeBatch(db);
  const updatedAt = "2026-01-02T00:00:00.000Z";

  batch.update(doc(db, "users", WORKER_ID), { role: "client", updatedAt });
  batch.set(doc(db, "publicProfiles", WORKER_ID), {
    ...publicProfile(WORKER_ID, "worker"),
    role: "client",
    updatedAt
  });
  batch.set(doc(db, "clientProfiles", WORKER_ID), {
    userId: WORKER_ID,
    businessName: "",
    updatedAt
  }, { merge: true });

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
  await assertFails(
    setDoc(doc(clientDb, "tasks", "invalid-location"), taskData({ latitude: 200 }))
  );
  await assertFails(updateDoc(doc(clientDb, "tasks", TASK_ID), {
    latitude: 10.7,
    longitude: 122.96,
    updatedAt: "2026-01-01T00:01:00.000Z"
  }));
});

test("workers can save valid private location metadata but invalid coordinates fail", async () => {
  const workerDb = dbFor(WORKER_ID);
  await assertSucceeds(updateDoc(doc(workerDb, "users", WORKER_ID), {
    currentLatitude: 10.6765,
    currentLongitude: 122.9509,
    locationUpdatedAt: "2026-01-01T00:00:00.000Z",
    locationAccuracyMeters: 15,
    locationSource: "device",
    updatedAt: "2026-01-01T00:00:01.000Z"
  }));
  await assertSucceeds(updateDoc(doc(workerDb, "users", WORKER_ID), {
    preferredRadiusKm: 10,
    updatedAt: "2026-01-01T00:00:01.750Z"
  }));
  await assertFails(updateDoc(doc(workerDb, "users", WORKER_ID), {
    preferredRadiusKm: 100,
    updatedAt: "2026-01-01T00:00:01.800Z"
  }));
  await assertSucceeds(updateDoc(doc(workerDb, "users", WORKER_ID), {
    currentLatitude: 10.6766,
    currentLongitude: 122.951,
    locationUpdatedAt: "2026-01-01T00:00:01.500Z",
    locationAccuracyMeters: deleteField(),
    locationSource: "manual",
    updatedAt: "2026-01-01T00:00:01.500Z"
  }));
  await assertFails(updateDoc(doc(workerDb, "users", WORKER_ID), {
    currentLatitude: -100,
    currentLongitude: 122.9509,
    locationUpdatedAt: "2026-01-01T00:00:02.000Z",
    locationSource: "manual",
    updatedAt: "2026-01-01T00:00:02.000Z"
  }));
});

test("clients cannot fan out a new-task notification to an unrelated worker", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tasks", TASK_ID), taskData());
  });
  const clientDb = dbFor(CLIENT_ID);
  await assertFails(setDoc(doc(clientDb, "notifications", "broad-notification"), {
    userId: OUTSIDER_ID,
    taskId: TASK_ID,
    createdBy: CLIENT_ID,
    notificationType: "Nearby task",
    message: "New task",
    readStatus: false,
    createdAt: "2026-01-01T00:00:01.000Z"
  }));
});

test("a worker can apply atomically but cannot assign themselves", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tasks", TASK_ID), taskData());
  });

  const workerDb = dbFor(WORKER_ID);
  await assertFails(setDoc(doc(workerDb, "taskMatches", `${TASK_ID}_${WORKER_ID}`), {
    taskId: TASK_ID,
    clientId: CLIENT_ID,
    workerId: WORKER_ID,
    acceptanceStatus: "Applied",
    matchScore: 100,
    createdAt: "2026-01-01T00:00:00.000Z"
  }));
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

test("a pending-verification worker can apply to a legacy open task with null workflow fields", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const legacyTask = taskData({ applicantIds: null, workerId: null });
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "tasks", TASK_ID), legacyTask),
      setDoc(doc(db, "users", WORKER_ID), {
        ...user(WORKER_ID, "worker"),
        accountStatus: "Pending",
        activeTaskId: null
      })
    ]);
  });

  const workerDb = dbFor(WORKER_ID);
  const matchId = `${TASK_ID}_${WORKER_ID}`;
  const now = "2026-01-01T00:01:00.000Z";
  await assertSucceeds(runTransaction(workerDb, async (transaction) => {
    const taskRef = doc(workerDb, "tasks", TASK_ID);
    const workerRef = doc(workerDb, "users", WORKER_ID);
    const [taskSnapshot, workerSnapshot] = await Promise.all([
      transaction.get(taskRef),
      transaction.get(workerRef)
    ]);
    assert.equal(taskSnapshot.exists(), true);
    assert.equal(workerSnapshot.exists(), true);
    transaction.set(doc(workerDb, "taskMatches", matchId), {
      id: matchId,
      taskId: TASK_ID,
      clientId: CLIENT_ID,
      workerId: WORKER_ID,
      acceptanceStatus: "Applied",
      createdAt: now,
      updatedAt: now
    });
    transaction.update(taskRef, {
      applicantIds: [WORKER_ID],
      status: "Applied",
      lastApplicationWorkerId: WORKER_ID,
      lastApplicationMatchId: matchId,
      lastApplicationAction: "Applied",
      updatedAt: now
    });
  }));
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
    clientConfirmedAt: now,
    updatedAt: now
  });
  batch.update(paymentRef, {
    paymentStatus: "Submitted",
    proofOfPaymentText: "COD confirmed by client",
    clientConfirmedAt: now,
    updatedAt: now
  });
  await assertSucceeds(batch.commit());

  const workerConfirmedAt = "2026-01-01T01:22:00.000Z";
  const outsiderDb = dbFor(OUTSIDER_ID);
  const forgedConfirmation = writeBatch(outsiderDb);
  forgedConfirmation.update(doc(outsiderDb, "tasks", TASK_ID), {
    paymentStatus: "Verified",
    workerConfirmedAt,
    updatedAt: workerConfirmedAt
  });
  forgedConfirmation.update(doc(outsiderDb, "payments", TASK_ID), {
    paymentStatus: "Verified",
    workerConfirmedAt,
    updatedAt: workerConfirmedAt
  });
  await assertFails(forgedConfirmation.commit());

  batch = writeBatch(workerDb);
  batch.update(doc(workerDb, "tasks", TASK_ID), {
    paymentStatus: "Verified",
    workerConfirmedAt,
    updatedAt: workerConfirmedAt
  });
  batch.update(doc(workerDb, "payments", TASK_ID), {
    paymentStatus: "Verified",
    workerConfirmedAt,
    updatedAt: workerConfirmedAt
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
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "users", WORKER_ID), { activeTaskId: null });
  });
  const db = dbFor(CLIENT_ID);
  const now = "2026-01-01T01:00:00.000Z";
  await assertSucceeds(runTransaction(db, async (transaction) => {
    const taskRef = doc(db, "tasks", TASK_ID);
    const selectedMatchRef = doc(db, "taskMatches", `${TASK_ID}_${WORKER_ID}`);
    const rejectedMatchRef = doc(db, "taskMatches", `${TASK_ID}_${OUTSIDER_ID}`);
    const [taskSnapshot, selectedMatchSnapshot, publicProfileSnapshot, rejectedMatchSnapshot] = await Promise.all([
      transaction.get(taskRef),
      transaction.get(selectedMatchRef),
      transaction.get(doc(db, "publicProfiles", WORKER_ID)),
      transaction.get(rejectedMatchRef)
    ]);
    assert.equal(taskSnapshot.exists(), true);
    assert.equal(selectedMatchSnapshot.data().acceptanceStatus, "Applied");
    assert.equal(publicProfileSnapshot.exists(), true);
    assert.equal(rejectedMatchSnapshot.data().acceptanceStatus, "Applied");

    transaction.update(taskRef, {
      status: "Accepted",
      workerId: WORKER_ID,
      applicantIds: [WORKER_ID],
      selectedMatchId: `${TASK_ID}_${WORKER_ID}`,
      acceptedAt: now,
      updatedAt: now
    });
    transaction.update(doc(db, "payments", TASK_ID), { workerId: WORKER_ID, updatedAt: now });
    transaction.update(selectedMatchRef, { acceptanceStatus: "Accepted", hiredAt: now, updatedAt: now });
    transaction.update(rejectedMatchRef, { acceptanceStatus: "Rejected", rejectedAt: now, updatedAt: now });
    transaction.update(doc(db, "users", WORKER_ID), {
      availabilityStatus: "Busy",
      availability: "Busy",
      activeTaskId: TASK_ID,
      updatedAt: now
    });
    transaction.update(doc(db, "workerProfiles", WORKER_ID), {
      availabilityStatus: "Busy",
      availability: "Busy",
      updatedAt: now
    });
    transaction.update(doc(db, "publicProfiles", WORKER_ID), {
      availabilityStatus: "Busy",
      availability: "Busy",
      updatedAt: now
    });
    transaction.set(doc(db, "notifications", `${TASK_ID}_accepted_${WORKER_ID}`), {
      userId: WORKER_ID,
      taskId: TASK_ID,
      createdBy: CLIENT_ID,
      notificationType: "Application accepted",
      message: "Accepted",
      readStatus: false,
      createdAt: now
    });
    transaction.set(doc(db, "notifications", `${TASK_ID}_rejected_${OUTSIDER_ID}`), {
      userId: OUTSIDER_ID,
      taskId: TASK_ID,
      createdBy: CLIENT_ID,
      notificationType: "Application update",
      message: "Not selected",
      readStatus: false,
      createdAt: now
    });
  }));
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
    paymentStatus: "Verified"
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

  const conversationId = `${TASK_ID}_${WORKER_ID}`;
  const now = "2026-01-01T00:00:00.000Z";
  const message = {
    conversationId,
    taskId: TASK_ID,
    senderId: WORKER_ID,
    receiverId: CLIENT_ID,
    participantIds: [WORKER_ID, CLIENT_ID],
    message: "I am on my way.",
    timestamp: now
  };

  const workerDb = dbFor(WORKER_ID);
  const batch = writeBatch(workerDb);
  batch.set(doc(workerDb, "chats", conversationId), {
    id: conversationId,
    taskId: TASK_ID,
    workerId: WORKER_ID,
    participantIds: [WORKER_ID, CLIENT_ID],
    lastMessage: message.message,
    lastMessageAt: now,
    lastSenderId: WORKER_ID,
    updatedAt: now
  });
  batch.set(doc(workerDb, "messages", "allowed-message"), message);
  await assertSucceeds(batch.commit());

  await assertSucceeds(getDocs(query(
    collection(dbFor(CLIENT_ID), "messages"),
    or(where("senderId", "==", CLIENT_ID), where("receiverId", "==", CLIENT_ID)),
    orderBy("timestamp", "desc"),
    limit(100)
  )));
  await assertFails(getDocs(query(
    collection(dbFor(OUTSIDER_ID), "messages"),
    where("senderId", "==", WORKER_ID),
    orderBy("timestamp", "desc"),
    limit(100)
  )));

  await assertSucceeds(updateDoc(doc(dbFor(CLIENT_ID), "messages", "allowed-message"), { readAt: now }));
  await assertFails(updateDoc(doc(dbFor(WORKER_ID), "messages", "allowed-message"), { readAt: now }));
  await assertFails(
    setDoc(doc(dbFor(OUTSIDER_ID), "messages", "blocked-message"), {
      ...message,
      senderId: OUTSIDER_ID,
      participantIds: [OUTSIDER_ID, CLIENT_ID]
    })
  );
});

test("users control only their own push token and notification preferences", async () => {
  const workerDb = dbFor(WORKER_ID);
  await assertSucceeds(setDoc(doc(workerDb, "pushTokens", `${WORKER_ID}_device`), {
    userId: WORKER_ID,
    token: "ExponentPushToken[test]",
    platform: "android",
    enabled: true,
    updatedAt: "2026-01-01T00:00:00.000Z"
  }));
  await assertFails(setDoc(doc(dbFor(OUTSIDER_ID), "pushTokens", `${WORKER_ID}_other`), {
    userId: WORKER_ID,
    token: "ExponentPushToken[forged]",
    platform: "android",
    enabled: true
  }));

  await assertSucceeds(setDoc(doc(workerDb, "notificationPreferences", WORKER_ID), {
    userId: WORKER_ID,
    pushEnabled: true,
    messagesEnabled: true,
    taskUpdatesEnabled: true,
    matchingEnabled: false,
    updatedAt: "2026-01-01T00:00:00.000Z"
  }));
  await assertFails(setDoc(doc(dbFor(OUTSIDER_ID), "notificationPreferences", WORKER_ID), {
    userId: WORKER_ID,
    pushEnabled: false,
    messagesEnabled: false,
    taskUpdatesEnabled: false,
    matchingEnabled: false
  }));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "notifications", "worker-notification"), {
      userId: WORKER_ID,
      taskId: TASK_ID,
      createdBy: CLIENT_ID,
      notificationType: "Task update",
      message: "Task updated",
      readStatus: false,
      createdAt: "2026-01-01T00:00:00.000Z"
    });
  });
  await assertSucceeds(updateDoc(doc(workerDb, "notifications", "worker-notification"), { readStatus: true }));
  await assertSucceeds(updateDoc(doc(workerDb, "notifications", "worker-notification"), {
    openedAt: "2026-01-01T00:01:00.000Z"
  }));
  await assertSucceeds(updateDoc(doc(workerDb, "notifications", "worker-notification"), {
    applicationConvertedAt: "2026-01-01T00:02:00.000Z"
  }));
  await assertFails(updateDoc(doc(workerDb, "notifications", "worker-notification"), { readStatus: false }));
  await assertFails(updateDoc(doc(workerDb, "notifications", "worker-notification"), { openedAt: 123 }));
  await assertFails(updateDoc(doc(workerDb, "notifications", "worker-notification"), { message: "Forged" }));
  await assertFails(updateDoc(doc(dbFor(OUTSIDER_ID), "notifications", "worker-notification"), { readStatus: true }));
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
