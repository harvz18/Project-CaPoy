const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { scoreWorkerForTask } = require("./matching");
const { buildExpoPushMessage, isExpoPushToken, isNotificationCategoryEnabled } = require("./push");
const { buildIdentityReview } = require("./identity");
const {
  authorityFromClaims,
  buildAccountStatusChange,
  buildLockedNameCorrection,
  buildViolationReport,
  hasSuperadminAuthority,
  toModerationUser
} = require("./authority");

initializeApp();

const REGION = "asia-southeast1";

function nowIso() {
  return new Date().toISOString();
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }
  return value.trim();
}

function requireSignedIn(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireSignedIn(request);
  if (!new Set(["admin", "superadmin"]).has(authorityFromClaims(request.auth.token))) {
    throw new HttpsError("permission-denied", "An administrator account is required.");
  }
  return uid;
}

function requireSuperadmin(request) {
  const uid = requireSignedIn(request);
  if (!hasSuperadminAuthority(request.auth.token)) {
    throw new HttpsError("permission-denied", "A superadministrator account is required.");
  }
  return uid;
}

function buildModerationChange(builder) {
  try {
    return builder();
  } catch (error) {
    throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Invalid moderation request.");
  }
}

function writeAudit(transaction, db, entry) {
  transaction.set(db.collection("auditLogs").doc(), {
    ...entry,
    createdAt: nowIso()
  });
}

exports.reviewWorkerVerification = onCall({ region: REGION }, async (request) => {
  const adminId = requireAdmin(request);
  const userId = requiredString(request.data?.userId, "userId");
  const decision = requiredString(request.data?.decision, "decision");
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim() : "";
  if (!["Verified", "Rejected", "Needs Resubmission"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Unsupported verification decision.");
  }
  if (decision !== "Verified" && !reason) {
    throw new HttpsError("invalid-argument", "A reason is required when verification is not approved.");
  }

  const db = getFirestore();
  const requestRef = db.collection("verificationRequests").doc(userId);
  const userRef = db.collection("users").doc(userId);
  const workerRef = db.collection("workerProfiles").doc(userId);
  const publicRef = db.collection("publicProfiles").doc(userId);
  const reviewedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [verificationSnapshot, userSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(userRef)
    ]);
    if (!verificationSnapshot.exists || !userSnapshot.exists) {
      throw new HttpsError("not-found", "Verification request or worker account was not found.");
    }
    if (verificationSnapshot.data().status !== "Pending Verification") {
      throw new HttpsError("failed-precondition", "This verification request has already been reviewed.");
    }
    if (userSnapshot.data().role !== "worker") {
      throw new HttpsError("failed-precondition", "Only worker accounts can be verified.");
    }

    const review = {
      status: decision,
      reviewedAt,
      reviewedBy: adminId,
      reviewReason: reason,
      updatedAt: reviewedAt
    };
    const identityReview = buildIdentityReview(decision, reviewedAt, adminId);
    transaction.update(requestRef, review);
    transaction.update(userRef, { verificationStatus: decision, ...identityReview, updatedAt: reviewedAt });
    transaction.set(workerRef, { verificationStatus: decision, updatedAt: reviewedAt }, { merge: true });
    transaction.set(publicRef, { verificationStatus: decision, updatedAt: reviewedAt }, { merge: true });
    transaction.set(db.collection("notifications").doc(), {
      userId,
      createdBy: adminId,
      notificationType: "Verification review",
      message: decision === "Verified"
        ? "Your worker verification was approved."
        : `Your worker verification needs attention: ${reason}`,
      readStatus: false,
      createdAt: reviewedAt
    });
    writeAudit(transaction, db, {
      actorId: adminId,
      action: "review_worker_verification",
      targetType: "verification",
      targetId: userId,
      reason,
      metadata: { decision }
    });
  });
  return { ok: true, status: decision };
});

exports.reviewPaymentEvidence = onCall({ region: REGION }, async (request) => {
  const adminId = requireAdmin(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const decision = requiredString(request.data?.decision, "decision");
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim() : "";
  if (!["Verified", "Rejected"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Unsupported payment decision.");
  }
  if (decision === "Rejected" && !reason) {
    throw new HttpsError("invalid-argument", "A rejection reason is required.");
  }

  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const reviewedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(taskRef),
      transaction.get(paymentRef)
    ]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) {
      throw new HttpsError("not-found", "Task or payment record was not found.");
    }
    const task = taskSnapshot.data();
    const payment = paymentSnapshot.data();
    if (payment.paymentMethod !== "GCash link" || task.paymentMethod !== "GCash link") {
      throw new HttpsError("failed-precondition", "Cash payments use worker confirmation instead of administrator review.");
    }
    if (payment.paymentStatus !== "Submitted" || task.paymentStatus !== "Submitted") {
      throw new HttpsError("failed-precondition", "Only submitted payment evidence can be reviewed.");
    }
    if (!payment.proofOfPaymentUrl) {
      throw new HttpsError("failed-precondition", "The payment proof file is missing.");
    }

    transaction.update(paymentRef, {
      paymentStatus: decision,
      reviewedAt,
      reviewedBy: adminId,
      reviewReason: reason,
      updatedAt: reviewedAt
    });
    transaction.update(taskRef, {
      paymentStatus: decision,
      paymentReviewedAt: reviewedAt,
      paymentReviewedBy: adminId,
      paymentReviewReason: reason,
      updatedAt: reviewedAt
    });
    [task.clientId, task.workerId].filter(Boolean).forEach((userId) => {
      transaction.set(db.collection("notifications").doc(), {
        userId,
        taskId,
        createdBy: adminId,
        notificationType: "Payment review",
        message: decision === "Verified"
          ? `Payment for ${task.title ?? "the task"} was verified.`
          : `Payment evidence for ${task.title ?? "the task"} was rejected: ${reason}`,
        readStatus: false,
        createdAt: reviewedAt
      });
    });
    writeAudit(transaction, db, {
      actorId: adminId,
      action: "review_payment_evidence",
      targetType: "payment",
      targetId: taskId,
      reason,
      metadata: { decision }
    });
  });
  return { ok: true, status: decision };
});

exports.setUserAccountStatus = onCall({ region: REGION }, async (request) => {
  const superadminId = requireSuperadmin(request);
  const userId = requiredString(request.data?.userId, "userId");
  const accountStatus = requiredString(request.data?.accountStatus, "accountStatus");
  const reason = requiredString(request.data?.reason, "reason");
  const evidenceReference = typeof request.data?.evidenceReference === "string"
    ? request.data.evidenceReference.trim()
    : "";
  const violationReportId = typeof request.data?.violationReportId === "string"
    ? request.data.violationReportId.trim()
    : "";

  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  await db.runTransaction(async (transaction) => {
    const reportRef = violationReportId ? db.collection("violationReports").doc(violationReportId) : null;
    const [userSnapshot, reportSnapshot] = await Promise.all([
      transaction.get(userRef),
      reportRef ? transaction.get(reportRef) : Promise.resolve(null)
    ]);
    if (!userSnapshot.exists) throw new HttpsError("not-found", "User account was not found.");
    if (reportRef && (!reportSnapshot?.exists || reportSnapshot.data().targetUserId !== userId)) {
      throw new HttpsError("failed-precondition", "The violation report does not belong to this account.");
    }
    const changedAt = nowIso();
    const change = buildModerationChange(() => buildAccountStatusChange({
      actorId: superadminId,
      targetId: userId,
      target: userSnapshot.data(),
      accountStatus,
      reason,
      evidenceReference,
      violationReportId,
      changedAt
    }));
    transaction.update(userRef, change.update);
    if (reportRef && accountStatus === "suspended") {
      transaction.update(reportRef, {
        status: "Actioned",
        actionedAt: changedAt,
        actionedBy: superadminId,
        updatedAt: changedAt
      });
    }
    writeAudit(transaction, db, change.audit);
  });
  return { ok: true, accountStatus };
});

exports.correctLockedFullName = onCall({ region: REGION }, async (request) => {
  const superadminId = requireSuperadmin(request);
  const userId = requiredString(request.data?.userId, "userId");
  const fullName = requiredString(request.data?.fullName, "fullName");
  const reason = requiredString(request.data?.reason, "reason");
  const evidenceReference = typeof request.data?.evidenceReference === "string"
    ? request.data.evidenceReference.trim()
    : "";
  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  const publicRef = db.collection("publicProfiles").doc(userId);
  await db.runTransaction(async (transaction) => {
    const [userSnapshot, publicSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(publicRef)
    ]);
    if (!userSnapshot.exists || !publicSnapshot.exists) {
      throw new HttpsError("not-found", "The account or its public profile was not found.");
    }
    const change = buildModerationChange(() => buildLockedNameCorrection({
      actorId: superadminId,
      targetId: userId,
      target: userSnapshot.data(),
      fullName,
      reason,
      evidenceReference,
      changedAt: nowIso()
    }));
    transaction.update(userRef, change.update);
    transaction.update(publicRef, change.update);
    writeAudit(transaction, db, change.audit);
  });
  return { ok: true, fullName: fullName.trim().replace(/\s+/g, " ") };
});

exports.submitViolationReport = onCall({ region: REGION }, async (request) => {
  const reporterId = requireSignedIn(request);
  const targetId = requiredString(request.data?.targetUserId, "targetUserId");
  const category = requiredString(request.data?.category, "category");
  const reason = requiredString(request.data?.reason, "reason");
  const evidenceReference = typeof request.data?.evidenceReference === "string"
    ? request.data.evidenceReference.trim()
    : "";
  const taskId = typeof request.data?.taskId === "string" ? request.data.taskId.trim() : "";
  const db = getFirestore();
  const reportRef = db.collection("violationReports").doc();
  await db.runTransaction(async (transaction) => {
    const taskRef = taskId ? db.collection("tasks").doc(taskId) : null;
    const [reporterSnapshot, targetSnapshot, taskSnapshot] = await Promise.all([
      transaction.get(db.collection("users").doc(reporterId)),
      transaction.get(db.collection("users").doc(targetId)),
      taskRef ? transaction.get(taskRef) : Promise.resolve(null)
    ]);
    if (!reporterSnapshot.exists || !targetSnapshot.exists) {
      throw new HttpsError("not-found", "The reporting or reported account was not found.");
    }
    const reporter = reporterSnapshot.data();
    const target = targetSnapshot.data();
    if (!["active", "pending_verification"].includes(reporter.accountStatus ?? "active")) {
      throw new HttpsError("permission-denied", "This account cannot submit reports.");
    }
    if (!["client", "worker"].includes(reporter.role) || !["client", "worker"].includes(target.role)) {
      throw new HttpsError("failed-precondition", "Reports are limited to employer and tasker accounts.");
    }
    if (taskRef) {
      if (!taskSnapshot?.exists) throw new HttpsError("not-found", "The related task was not found.");
      const task = taskSnapshot.data();
      const participantIds = [task.clientId, task.workerId, ...(task.applicantIds ?? [])].filter(Boolean);
      if (!participantIds.includes(reporterId) || !participantIds.includes(targetId)) {
        throw new HttpsError("failed-precondition", "Both accounts must participate in the related task.");
      }
    }
    const report = buildModerationChange(() => buildViolationReport({
      reporterId,
      targetId,
      category,
      reason,
      evidenceReference,
      taskId,
      createdAt: nowIso()
    }));
    transaction.create(reportRef, report);
  });
  return { ok: true, reportId: reportRef.id };
});

exports.getSuperadminOverview = onCall({ region: REGION }, async (request) => {
  requireSuperadmin(request);
  const db = getFirestore();
  const [usersSnapshot, reportsSnapshot, auditSnapshot] = await Promise.all([
    db.collection("users").where("role", "in", ["client", "worker"]).get(),
    db.collection("violationReports").orderBy("createdAt", "desc").limit(50).get(),
    db.collection("auditLogs").orderBy("createdAt", "desc").limit(50).get()
  ]);
  return {
    users: usersSnapshot.docs.map((document) => toModerationUser(document.id, document.data())),
    reports: reportsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
    auditLogs: auditSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
  };
});

exports.confirmCashPaymentReceived = onCall({ region: REGION }, async (request) => {
  const workerId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const confirmedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot, workerSnapshot] = await Promise.all([
      transaction.get(taskRef),
      transaction.get(paymentRef),
      transaction.get(db.collection("users").doc(workerId))
    ]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) {
      throw new HttpsError("not-found", "Task or payment record was not found.");
    }
    const task = taskSnapshot.data();
    const payment = paymentSnapshot.data();
    if (!workerSnapshot.exists
      || !["active", "pending_verification"].includes(workerSnapshot.data().accountStatus ?? "active")) {
      throw new HttpsError("permission-denied", "This worker account is not enabled.");
    }
    if (task.workerId !== workerId || payment.workerId !== workerId) {
      throw new HttpsError("permission-denied", "Only the assigned worker can confirm receipt of cash.");
    }
    if (payment.paymentMethod !== "COD" || payment.paymentStatus !== "Submitted" || !payment.clientConfirmedAt) {
      throw new HttpsError("failed-precondition", "The client must submit the cash-payment confirmation first.");
    }

    transaction.update(paymentRef, {
      paymentStatus: "Verified",
      workerConfirmedAt: confirmedAt,
      updatedAt: confirmedAt
    });
    transaction.update(taskRef, {
      paymentStatus: "Verified",
      workerConfirmedAt: confirmedAt,
      updatedAt: confirmedAt
    });
    transaction.set(db.collection("notifications").doc(), {
      userId: task.clientId,
      taskId,
      createdBy: workerId,
      notificationType: "Cash payment confirmed",
      message: `Cash payment for ${task.title ?? "the task"} was confirmed by the worker.`,
      readStatus: false,
      createdAt: confirmedAt
    });
    writeAudit(transaction, db, {
      actorId: workerId,
      action: "confirm_cash_payment_received",
      targetType: "payment",
      targetId: taskId,
      metadata: { paymentStatus: "Verified" }
    });
  });
  return { ok: true, status: "Verified" };
});

exports.notifyEligibleWorkers = onDocumentCreated(
  { document: "tasks/{taskId}", region: "asia-southeast1" },
  async (event) => {
    const task = event.data?.data();
    if (!task || task.status !== "Finding Workers") return;

    const db = getFirestore();
    const workers = await db.collection("users").where("role", "==", "worker").get();
    const eligible = workers.docs.map((workerDocument) => {
      const worker = { id: workerDocument.id, ...workerDocument.data() };
      return { worker, match: scoreWorkerForTask(task, worker) };
    }).filter(({ match }) => match.eligible);

    for (let offset = 0; offset < eligible.length; offset += 400) {
      const batch = db.batch();
      eligible.slice(offset, offset + 400).forEach(({ worker, match }) => {
        const notification = db.collection("notifications").doc(`${event.params.taskId}_nearby_${worker.id}`);
        batch.set(notification, {
          userId: worker.id,
          taskId: event.params.taskId,
          createdBy: task.clientId,
          notificationType: "Matching task",
          message: `${task.title} is a ${match.score}% match for your profile.`,
          matchScore: match.score,
          matchReasons: match.reasons,
          readStatus: false,
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }
    logger.info("TaskLink matching notifications created", { taskId: event.params.taskId, count: eligible.length });
  }
);

exports.materializeApplicationMatch = onDocumentCreated(
  { document: "taskMatches/{matchId}", region: "asia-southeast1" },
  async (event) => {
    const application = event.data?.data();
    if (!application || application.acceptanceStatus !== "Applied") return;
    const db = getFirestore();
    const [taskSnapshot, workerSnapshot] = await Promise.all([
      db.collection("tasks").doc(application.taskId).get(),
      db.collection("users").doc(application.workerId).get()
    ]);
    if (!taskSnapshot.exists || !workerSnapshot.exists) {
      logger.warn("Unable to materialize TaskLink match", { matchId: event.params.matchId });
      return;
    }
    const match = scoreWorkerForTask(taskSnapshot.data(), { id: workerSnapshot.id, ...workerSnapshot.data() });
    await event.data.ref.update({
      matchScore: match.score,
      matchReasons: match.reasons,
      ...(match.distanceKm === undefined ? {} : { distanceKm: match.distanceKm }),
      eligible: match.eligible,
      matchPolicyVersion: 1,
      updatedAt: new Date().toISOString()
    });
  }
);

exports.createMessageNotification = onDocumentCreated(
  { document: "messages/{messageId}", region: "asia-southeast1", retry: true },
  async (event) => {
    const message = event.data?.data();
    if (!message?.receiverId || !message?.senderId || !message?.taskId) return;
    const db = getFirestore();
    const [senderSnapshot, taskSnapshot] = await Promise.all([
      db.collection("publicProfiles").doc(message.senderId).get(),
      db.collection("tasks").doc(message.taskId).get()
    ]);
    const senderName = senderSnapshot.data()?.fullName ?? "A TASKLINK user";
    const taskTitle = taskSnapshot.data()?.title ?? "your task";
    await db.collection("notifications").doc(`message_${event.params.messageId}_${message.receiverId}`).set({
      userId: message.receiverId,
      taskId: message.taskId,
      conversationId: message.conversationId ?? null,
      senderId: message.senderId,
      createdBy: message.senderId,
      notificationType: "New message",
      message: `${senderName} sent a message about ${taskTitle}.`,
      route: "chat",
      readStatus: false,
      createdAt: new Date().toISOString()
    });
  }
);

exports.deliverPushNotification = onDocumentCreated(
  { document: "notifications/{notificationId}", region: "asia-southeast1", retry: true },
  async (event) => {
    const notification = event.data?.data();
    if (!notification?.userId || !notification?.message) return;
    const db = getFirestore();
    const [preferenceSnapshot, tokenSnapshot] = await Promise.all([
      db.collection("notificationPreferences").doc(notification.userId).get(),
      db.collection("pushTokens").where("userId", "==", notification.userId).limit(100).get()
    ]);
    const preferences = preferenceSnapshot.data();
    if (!preferences?.pushEnabled || !isNotificationCategoryEnabled(notification, preferences)) return;

    const tokens = tokenSnapshot.docs
      .map((document) => ({ id: document.id, ref: document.ref, ...document.data() }))
      .filter(({ enabled, token }) => enabled && isExpoPushToken(token));
    if (!tokens.length) return;

    const deliverySnapshots = await db.getAll(...tokens.map(({ id }) =>
      db.collection("pushDeliveries").doc(`${event.params.notificationId}_${id}`)
    ));
    const pendingTokens = tokens.filter((_, index) =>
      !deliverySnapshots[index].exists || deliverySnapshots[index].data()?.status === "retryable"
    );
    if (!pendingTokens.length) return;

    const reservedAt = new Date().toISOString();
    const reservation = db.batch();
    pendingTokens.forEach(({ id, token }) => {
      const deliveryRef = db.collection("pushDeliveries").doc(`${event.params.notificationId}_${id}`);
      const existing = deliverySnapshots.find((snapshot) => snapshot.id === deliveryRef.id);
      if (existing?.exists) {
        reservation.update(deliveryRef, { status: "reserved", updatedAt: reservedAt });
      } else {
        reservation.create(deliveryRef, {
          notificationId: event.params.notificationId,
          userId: notification.userId,
          token,
          status: "reserved",
          createdAt: reservedAt
        });
      }
    });
    await reservation.commit();

    let response;
    try {
      response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(pendingTokens.map(({ token }) =>
          buildExpoPushMessage(token, notification, event.params.notificationId)
        ))
      });
      if (!response.ok) throw new Error(`Expo push service returned HTTP ${response.status}.`);
    } catch (error) {
      const retryBatch = db.batch();
      pendingTokens.forEach(({ id }) => {
        retryBatch.update(db.collection("pushDeliveries").doc(`${event.params.notificationId}_${id}`), {
          status: "retryable",
          error: error instanceof Error ? error.message : "Expo push request failed",
          updatedAt: new Date().toISOString()
        });
      });
      await retryBatch.commit();
      throw error;
    }
    const payload = await response.json();
    const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
    const resultBatch = db.batch();
    pendingTokens.forEach((tokenEntry, index) => {
      const ticket = tickets[index] ?? { status: "error", message: "Missing Expo push ticket" };
      const deliveryRef = db.collection("pushDeliveries").doc(`${event.params.notificationId}_${tokenEntry.id}`);
      resultBatch.update(deliveryRef, {
        status: ticket.status ?? "error",
        ticketId: ticket.id ?? null,
        error: ticket.message ?? null,
        updatedAt: new Date().toISOString()
      });
      if (ticket.details?.error === "DeviceNotRegistered") {
        resultBatch.update(tokenEntry.ref, { enabled: false, updatedAt: new Date().toISOString() });
      }
    });
    await resultBatch.commit();
    logger.info("TASKLINK push notification processed", {
      notificationId: event.params.notificationId,
      tokenCount: pendingTokens.length
    });
  }
);

