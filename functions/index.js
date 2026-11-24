const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { buildAnalyticsReport } = require("./analytics");
const {
  buildMatchSnapshot,
  MATCH_POLICY_VERSION,
  matchingNotificationId,
  matchingNotificationsEnabled,
  scoreWorkerForTask
} = require("./matching");
const { buildExpoPushMessage, isExpoPushToken, isNotificationCategoryEnabled } = require("./push");
const { buildIdentityReview } = require("./identity");
const { findConflictingAssignment } = require("./marketplace");
const {
  DEFAULT_RATE_BASIS_POINTS,
  buildFeeAuditEntry,
  buildFeeSnapshot,
  isPostingBlockedByPlatformFee,
  normalizeOptionalHttpsUrl,
  shouldCreatePlatformFeeForSelection
} = require("./revenue");
const {
  authorityFromClaims,
  buildAccountStatusChange,
  buildLockedNameCorrection,
  buildViolationReport,
  hasSuperadminAuthority,
  toModerationUser
} = require("./authority");
const {
  CASH_PIN_MAX_ATTEMPTS,
  CASH_PIN_MAX_GENERATIONS,
  CASH_PIN_RETRY_COOLDOWN_MS,
  decryptCashPin,
  generateCashPinRecord,
  hasActiveCashPin,
  requireCashPinSecret,
  verifyCashPin
} = require("./cashPin");

initializeApp();

const REGION = "asia-southeast1";

function nowIso() {
  return new Date().toISOString();
}

function isCashPaymentMethod(value) {
  return value === "Cash" || value === "COD";
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

async function hasStoredVerificationDocument(transaction, db, userId, path, kind) {
  if (typeof path !== "string") return false;
  if (path.startsWith(`verification/${userId}/`)) return true;
  if (path !== `firestoreVerification/${userId}/${kind}`) return false;
  const snapshot = await transaction.get(
    db.collection("verificationFiles").doc(userId).collection("uploads").doc(kind)
  );
  if (!snapshot.exists) return false;
  const file = snapshot.data();
  const validMetadata = file.userId === userId
    && file.kind === kind
    && file.uploaderId === userId
    && file.status === "ready"
    && typeof file.fileName === "string"
    && typeof file.mimeType === "string"
    && typeof file.version === "string"
    && Number.isInteger(file.chunkCount)
    && file.chunkCount > 0
    && file.chunkCount <= 16
    && Number.isInteger(file.encodedSize)
    && file.encodedSize > 0;
  if (!validMetadata) return false;
  const chunkLengths = await Promise.all(Array.from({ length: file.chunkCount }, async (_, index) => {
      const chunk = await transaction.get(
        db.collection("verificationFiles").doc(userId).collection("uploads").doc(kind)
          .collection("chunks").doc(index.toString().padStart(3, "0"))
      );
      const data = chunk.data();
      const validChunk = chunk.exists
        && data.userId === userId
        && data.kind === kind
        && data.uploaderId === userId
        && data.version === file.version
        && data.index === index
        && typeof data.data === "string"
        && data.data.length > 0;
      return validChunk ? data.data.length : -1;
    }));
  return chunkLengths.every((length) => length > 0)
    && chunkLengths.reduce((total, length) => total + length, 0) === file.encodedSize;
}

exports.acceptTaskApplication = onCall({ region: REGION }, async (request) => {
  const clientId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const workerId = requiredString(request.data?.workerId, "workerId");
  if (workerId === clientId) throw new HttpsError("failed-precondition", "Employers cannot accept themselves for their own task.");
  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const matchRef = db.collection("taskMatches").doc(`${taskId}_${workerId}`);
  const paymentRef = db.collection("payments").doc(taskId);
  const feeRef = db.collection("platformFees").doc(taskId);
  const revenueConfigRef = db.collection("platformRevenue").doc("config");
  const workerRef = db.collection("users").doc(workerId);
  const workerProfileRef = db.collection("workerProfiles").doc(workerId);
  const publicProfileRef = db.collection("publicProfiles").doc(workerId);
  const acceptedAt = nowIso();

  await db.runTransaction(async (transaction) => {
    const assignedQuery = db.collection("tasks").where("workerId", "==", workerId);
    const [taskSnapshot, matchSnapshot, paymentSnapshot, feeSnapshot, revenueConfigSnapshot, clientSnapshot, workerSnapshot, assignedSnapshot] = await Promise.all([
      transaction.get(taskRef), transaction.get(matchRef), transaction.get(paymentRef),
      transaction.get(feeRef), transaction.get(revenueConfigRef),
      transaction.get(db.collection("users").doc(clientId)), transaction.get(workerRef),
      transaction.get(assignedQuery)
    ]);
    if (!taskSnapshot.exists || !matchSnapshot.exists || !paymentSnapshot.exists || !workerSnapshot.exists) {
      throw new HttpsError("not-found", "Task, application, payment, or tasker was not found.");
    }
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() };
    const match = matchSnapshot.data();
    if (!clientSnapshot.exists || clientSnapshot.data().role !== "client" || task.clientId !== clientId) {
      throw new HttpsError("permission-denied", "Only the employer who posted this task can accept an applicant.");
    }
    if (task.status !== "Applied" || task.workerId || match.acceptanceStatus !== "Applied") {
      throw new HttpsError("failed-precondition", "This application is no longer available for acceptance.");
    }
    const conflict = findConflictingAssignment(
      assignedSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })), task, taskId
    );
    if (conflict) {
      throw new HttpsError("failed-precondition", `This tasker already has a confirmed task that overlaps this schedule (${conflict.title ?? conflict.id}).`);
    }

    const allMatches = await transaction.get(db.collection("taskMatches").where("taskId", "==", taskId));
    const agreedAmount = task.pricingMode === "bidding" ? match.proposedAmount : task.wage;
    if (!agreedAmount || Number(agreedAmount) <= 0) {
      throw new HttpsError("failed-precondition", "The selected application does not have a valid agreed amount.");
    }
    transaction.update(taskRef, {
      status: "Accepted", workerId, applicantIds: [workerId], selectedMatchId: matchRef.id,
      agreedAmount: String(agreedAmount), acceptedAt, updatedAt: acceptedAt
    });
    transaction.update(paymentRef, { workerId, agreedAmount: String(agreedAmount), updatedAt: acceptedAt });
    const revenueConfig = revenueConfigSnapshot.exists ? revenueConfigSnapshot.data() : undefined;
    if (shouldCreatePlatformFeeForSelection({ task, config: revenueConfig, hasExistingFee: feeSnapshot.exists })) {
      let fee;
      try {
        fee = buildFeeSnapshot({
          task: { ...task, id: taskId, workerId, agreedAmount: String(agreedAmount) },
          config: revenueConfig,
          now: acceptedAt
        });
      } catch (error) {
        throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "The agreed worker wage cannot create a service fee.");
      }
      transaction.create(feeRef, fee);
      transaction.update(db.collection("users").doc(clientId), {
        unsettledPlatformFeeCount: FieldValue.increment(1)
      });
      transaction.set(db.collection("notifications").doc(`${taskId}_platform-fee-payable_${clientId}`), {
        userId: clientId, taskId, createdBy: clientId,
        notificationType: "TASKLINK service fee payable",
        message: `A TASKLINK service fee is now payable for ${task.title || "this task"}. New task posts stay restricted until the fee is verified.`,
        readStatus: false, createdAt: acceptedAt
      }, { merge: true });
      writeAudit(transaction, db, {
        actorId: clientId,
        action: "create_platform_fee_obligation",
        targetType: "payment",
        targetId: taskId,
        metadata: { feeCentavos: fee.feeCentavos, workerWageCentavos: fee.workerWageCentavos, rateBasisPoints: fee.rateBasisPoints }
      });
    }
    allMatches.docs.forEach((document) => {
      const candidate = document.data();
      if (candidate.acceptanceStatus !== "Applied") return;
      const accepted = candidate.workerId === workerId;
      transaction.update(document.ref, accepted
        ? { acceptanceStatus: "Accepted", hiredAt: acceptedAt, updatedAt: acceptedAt }
        : { acceptanceStatus: "Rejected", rejectedAt: acceptedAt, updatedAt: acceptedAt });
      transaction.set(db.collection("notifications").doc(`${taskId}_${accepted ? "accepted" : "rejected"}_${candidate.workerId}`), {
        userId: candidate.workerId, taskId, createdBy: clientId,
        notificationType: accepted ? "Application accepted" : "Application update",
        message: accepted ? `Your application for ${task.title} was accepted.` : `Another tasker was selected for ${task.title}.`,
        readStatus: false, createdAt: acceptedAt
      });
    });
    const availabilityUpdate = { availabilityStatus: "Busy", availability: "Busy", activeTaskId: taskId, updatedAt: acceptedAt };
    transaction.update(workerRef, availabilityUpdate);
    transaction.set(workerProfileRef, availabilityUpdate, { merge: true });
    transaction.set(publicProfileRef, availabilityUpdate, { merge: true });
  });
  return { ok: true, status: "Accepted" };
});

exports.cancelTask = onCall({ region: REGION }, async (request) => {
  const clientId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const cancelledAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists) throw new HttpsError("not-found", "Task was not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() };
    if (task.clientId !== clientId) {
      throw new HttpsError("permission-denied", "Only the employer who posted this task can cancel it.");
    }
    if (!["Finding Workers", "Applied", "Accepted", "In Progress", "Pending Approval"].includes(task.status)) {
      throw new HttpsError("failed-precondition", "This task can no longer be cancelled.");
    }
    const [matches, otherAssignments] = await Promise.all([
      transaction.get(db.collection("taskMatches").where("taskId", "==", taskId)),
      task.workerId
        ? transaction.get(db.collection("tasks").where("workerId", "==", task.workerId))
        : Promise.resolve(null)
    ]);
    transaction.update(taskRef, { status: "Cancelled", cancelledAt, updatedAt: cancelledAt });
    matches.docs.forEach((document) => {
      if (!["Applied", "Accepted"].includes(document.data().acceptanceStatus)) return;
      transaction.update(document.ref, { acceptanceStatus: "Cancelled", cancelledAt, updatedAt: cancelledAt });
      transaction.set(db.collection("notifications").doc(`${taskId}_cancelled_${document.data().workerId}`), {
        userId: document.data().workerId, taskId, createdBy: clientId,
        notificationType: "Task cancelled", message: `${task.title} was cancelled by the employer.`,
        readStatus: false, createdAt: cancelledAt
      });
    });
    if (task.workerId) {
      const nextAssignment = otherAssignments.docs.map((document) => ({ id: document.id, ...document.data() })).find((item) =>
        item.id !== taskId && ["Accepted", "In Progress", "Pending Approval"].includes(item.status)
      );
      const availability = nextAssignment
        ? { availabilityStatus: "Busy", availability: "Busy", activeTaskId: nextAssignment.id, updatedAt: cancelledAt }
        : { availabilityStatus: "Available", availability: "Available", activeTaskId: FieldValue.delete(), updatedAt: cancelledAt };
      transaction.update(db.collection("users").doc(task.workerId), availability);
      transaction.set(db.collection("workerProfiles").doc(task.workerId), availability, { merge: true });
      transaction.set(db.collection("publicProfiles").doc(task.workerId), availability, { merge: true });
    }
  });
  return { ok: true, status: "Cancelled" };
});

exports.updateRatingAggregate = onDocumentCreated(
  { document: "ratings/{ratingId}", region: REGION },
  async (event) => {
    const rating = event.data?.data();
    if (!rating?.targetUserId) return;
    const db = getFirestore();
    const ratings = await db.collection("ratings").where("targetUserId", "==", rating.targetUserId).get();
    const scores = ratings.docs.map((document) => Number(document.data().score)).filter((score) => Number.isFinite(score));
    if (!scores.length) return;
    const ratingTotal = scores.reduce((total, score) => total + score, 0);
    const aggregate = {
      rating: Number((ratingTotal / scores.length).toFixed(2)),
      ratingCount: scores.length,
      ratingTotal,
      updatedAt: nowIso()
    };
    const userSnapshot = await db.collection("users").doc(rating.targetUserId).get();
    if (!userSnapshot.exists) return;
    const roleProfile = userSnapshot.data().role === "worker" ? "workerProfiles" : "clientProfiles";
    const batch = db.batch();
    batch.update(db.collection("users").doc(rating.targetUserId), aggregate);
    batch.set(db.collection("publicProfiles").doc(rating.targetUserId), aggregate, { merge: true });
    batch.set(db.collection(roleProfile).doc(rating.targetUserId), aggregate, { merge: true });
    await batch.commit();
  }
);

exports.reviewWorkerVerification = onCall({ region: REGION }, async (request) => {
  // Identity decisions are governance actions. Analytics-only Admin accounts
  // must never be able to approve or reject a person's credentials.
  const adminId = requireSuperadmin(request);
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
      throw new HttpsError("not-found", "Verification request or user account was not found.");
    }
    if (verificationSnapshot.data().status !== "Pending Verification") {
      throw new HttpsError("failed-precondition", "This verification request has already been reviewed.");
    }
    if (!["worker", "client"].includes(userSnapshot.data().role)) {
      throw new HttpsError("failed-precondition", "Only employer and tasker accounts can be verified.");
    }
    const verification = verificationSnapshot.data();
    const hasAllRequiredDocuments = (await Promise.all([
      hasStoredVerificationDocument(transaction, db, userId, verification.validIdPath, "valid-id"),
      hasStoredVerificationDocument(transaction, db, userId, verification.selfieWithIdPath, "selfie-with-id"),
      hasStoredVerificationDocument(transaction, db, userId, verification.medicalCertificatePath, "medical-certificate"),
      hasStoredVerificationDocument(transaction, db, userId, verification.policeClearancePath, "police-clearance")
    ])).every(Boolean);
    if (decision === "Verified" && !hasAllRequiredDocuments) {
      throw new HttpsError("failed-precondition", "A valid ID, a selfie holding that ID, a medical certificate, and police clearance are required before approval.");
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
    const role = userSnapshot.data().role;
    const roleProfileRef = role === "worker" ? workerRef : db.collection("clientProfiles").doc(userId);
    const verificationReview = {
      verificationStatus: decision,
      verificationReviewReason: reason || null,
      ...identityReview,
      updatedAt: reviewedAt
    };
    transaction.update(userRef, verificationReview);
    transaction.set(roleProfileRef, verificationReview, { merge: true });
    transaction.set(publicRef, { verificationStatus: decision, updatedAt: reviewedAt }, { merge: true });
    transaction.set(db.collection("notifications").doc(), {
      userId,
      createdBy: adminId,
      notificationType: "Verification review",
      message: decision === "Verified"
        ? "Your TaskLink verification was approved."
        : `Your TaskLink verification needs attention: ${reason}`,
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
  // Payment evidence decisions are reserved for the financial governor.
  const adminId = requireSuperadmin(request);
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
  const adminId = requireSuperadmin(request);
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
      actorId: adminId,
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
        actionedBy: adminId,
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

exports.getAdminAnalytics = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const db = getFirestore();
  let rangeInput;
  try {
    rangeInput = {
      preset: request.data?.preset ?? "7d",
      startDate: request.data?.startDate,
      endDate: request.data?.endDate
    };
    const [usersSnapshot, verificationSnapshot, tasksSnapshot, paymentsSnapshot, platformFeesSnapshot, matchesSnapshot, notificationsSnapshot] = await Promise.all([
      db.collection("users").where("role", "in", ["client", "worker"]).get(),
      db.collection("verificationRequests").get(),
      db.collection("tasks").get(),
      db.collection("payments").get(),
      db.collection("platformFees").get(),
      db.collection("taskMatches").get(),
      db.collection("notifications").where("notificationType", "in", ["Matching task", "Smart Match"]).get()
    ]);
    const withIds = (snapshot) => snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const report = buildAnalyticsReport({
      users: withIds(usersSnapshot),
      verificationRequests: withIds(verificationSnapshot),
      tasks: withIds(tasksSnapshot),
      payments: withIds(paymentsSnapshot),
      platformFees: withIds(platformFeesSnapshot),
      taskMatches: withIds(matchesSnapshot),
      notifications: withIds(notificationsSnapshot)
    }, rangeInput, nowIso());
    await db.collection("analyticsSnapshots").doc(report.snapshotId).set(report);
    return report;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const message = error instanceof Error ? error.message : "Unable to generate analytics.";
    if (/^(Custom analytics dates|Analytics end date|Analytics ranges|Unsupported analytics range)/.test(message)) {
      throw new HttpsError("invalid-argument", message);
    }
    logger.error("TaskLink analytics generation failed", { error: message, rangeInput });
    throw new HttpsError("internal", "Unable to generate administrator analytics.");
  }
});

function cashPinSecretForCallable() {
  try {
    return requireCashPinSecret();
  } catch (error) {
    throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Cash payment confirmation is not configured.");
  }
}

function cashPinAmount(task, payment) {
  if (typeof task.agreedAmount !== "string" || typeof payment.agreedAmount !== "string" || task.agreedAmount !== payment.agreedAmount) {
    throw new HttpsError("failed-precondition", "The agreed task payment amount is missing or no longer matches its payment record.");
  }
  return payment.agreedAmount;
}

function assertCashCallableParticipants(task, payment, uid, role) {
  if (task.status !== "Pending Approval" || !isCashPaymentMethod(task.paymentMethod) || !isCashPaymentMethod(payment.paymentMethod)) {
    throw new HttpsError("failed-precondition", "Cash confirmation is unavailable for this task.");
  }
  if (role === "client" && (task.clientId !== uid || payment.clientId !== uid)) {
    throw new HttpsError("permission-denied", "Only the task employer can confirm paying cash.");
  }
  if (role === "worker" && (task.workerId !== uid || payment.workerId !== uid)) {
    throw new HttpsError("permission-denied", "Only the assigned tasker can confirm receiving cash.");
  }
}

function clearCallableCashPin() {
  return {
    cashPinHash: FieldValue.delete(), cashPinCiphertext: FieldValue.delete(),
    cashPinIv: FieldValue.delete(), cashPinTag: FieldValue.delete()
  };
}

exports.markCashPaymentPaid = onCall({ region: REGION }, async (request) => {
  const clientId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const markedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new HttpsError("not-found", "Task payment record was not found.");
    const task = taskSnapshot.data(); const payment = paymentSnapshot.data();
    assertCashCallableParticipants(task, payment, clientId, "client");
    cashPinAmount(task, payment);
    if (payment.paymentStatus === "Awaiting Worker Confirmation" && task.paymentStatus === "Awaiting Worker Confirmation") return;
    if (payment.paymentStatus !== "Pending" || task.paymentStatus !== "Pending") throw new HttpsError("failed-precondition", "This cash payment is already being confirmed or completed.");
    transaction.update(taskRef, { paymentStatus: "Awaiting Worker Confirmation", clientConfirmedAt: markedAt, updatedAt: markedAt });
    transaction.update(paymentRef, { paymentStatus: "Awaiting Worker Confirmation", clientConfirmedAt: markedAt, cashPaymentMarkedPaidAt: markedAt, updatedAt: markedAt });
    transaction.set(db.collection("notifications").doc(`${taskId}_cash-awaiting_${task.workerId}`), {
      userId: task.workerId, taskId, createdBy: clientId,
      notificationType: "Cash payment awaiting confirmation",
      message: `The employer marked the cash payment for ${task.title || "this task"} as paid. Confirm only after you have received and counted the full amount.`,
      readStatus: false, createdAt: markedAt
    }, { merge: true });
    writeAudit(transaction, db, { actorId: clientId, action: "cash_payment_marked_paid", targetType: "payment", targetId: taskId, metadata: { paymentMethod: "Cash" } });
  });
  return { ok: true, status: "Awaiting Worker Confirmation" };
});

/** Worker-only: returns the code only after it has acknowledged receiving cash. */
exports.confirmCashPaymentReceived = onCall({ region: REGION }, async (request) => {
  const workerId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const secret = cashPinSecretForCallable();
  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const now = new Date();
  let result;
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new HttpsError("not-found", "Task payment record was not found.");
    const task = taskSnapshot.data(); const payment = paymentSnapshot.data();
    assertCashCallableParticipants(task, payment, workerId, "worker");
    const agreedAmount = cashPinAmount(task, payment);
    if (payment.paymentStatus !== "Awaiting Worker Confirmation" || task.paymentStatus !== "Awaiting Worker Confirmation") {
      throw new HttpsError("failed-precondition", "Wait for the employer to mark the cash payment as paid.");
    }
    if (hasActiveCashPin(payment, now)) {
      if (payment.cashPinEmployerId !== task.clientId || payment.cashPinWorkerId !== workerId || payment.cashPinAgreedAmount !== agreedAmount) {
        throw new HttpsError("failed-precondition", "The cash confirmation session no longer matches this task.");
      }
      result = { ok: true, pin: decryptCashPin(payment, secret), expiresAt: payment.cashPinExpiresAt, reused: true };
      return;
    }
    const generations = Number.isInteger(payment.cashPinGenerationCount) ? payment.cashPinGenerationCount : 0;
    const retryAt = Date.parse(payment.cashPinRetryAvailableAt || "");
    if (generations > 0 && Number.isFinite(retryAt) && now.getTime() < retryAt) throw new HttpsError("resource-exhausted", "Wait briefly before requesting another cash confirmation PIN.");
    if (generations >= CASH_PIN_MAX_GENERATIONS) throw new HttpsError("resource-exhausted", "The cash confirmation PIN limit has been reached. Please contact TaskLink support.");
    const generated = generateCashPinRecord({ taskId, clientId: task.clientId, workerId, agreedAmount, now, generationCount: generations + 1, secret });
    const retryAvailableAt = new Date(Date.parse(generated.record.cashPinExpiresAt) + CASH_PIN_RETRY_COOLDOWN_MS).toISOString();
    transaction.update(paymentRef, { ...generated.record, cashPinRetryAvailableAt: retryAvailableAt, cashPinLockedAt: FieldValue.delete(), cashPinInvalidatedAt: FieldValue.delete(), cashPinInvalidationReason: FieldValue.delete(), updatedAt: now.toISOString() });
    transaction.set(db.collection("notifications").doc(`${taskId}_cash-pin-ready_${task.clientId}`), {
      userId: task.clientId, taskId, createdBy: workerId,
      notificationType: "Cash confirmation PIN ready",
      message: `The tasker is ready to confirm the cash payment for ${task.title || "this task"}. Ask them for the 4-digit confirmation PIN.`,
      readStatus: false, createdAt: now.toISOString()
    }, { merge: true });
    writeAudit(transaction, db, { actorId: workerId, action: "cash_payment_pin_issued", targetType: "payment", targetId: taskId, metadata: { paymentMethod: "Cash", generation: generations + 1 } });
    result = { ok: true, pin: generated.pin, expiresAt: generated.record.cashPinExpiresAt, reused: false };
  });
  return result;
});

exports.verifyCashPaymentPin = onCall({ region: REGION }, async (request) => {
  const clientId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const pin = requiredString(request.data?.pin, "pin");
  if (!/^\d{4}$/.test(pin)) throw new HttpsError("invalid-argument", "Enter the four-digit confirmation PIN from the tasker.");
  const secret = cashPinSecretForCallable();
  const db = getFirestore();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const now = new Date();
  let failure;
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new HttpsError("not-found", "Task payment record was not found.");
    const task = taskSnapshot.data(); const payment = paymentSnapshot.data();
    assertCashCallableParticipants(task, payment, clientId, "client");
    const agreedAmount = cashPinAmount(task, payment);
    if (payment.paymentStatus !== "Awaiting Worker Confirmation" || task.paymentStatus !== "Awaiting Worker Confirmation") throw new HttpsError("failed-precondition", "This cash payment is not awaiting PIN confirmation.");
    if (!hasActiveCashPin(payment, now)) {
      transaction.update(paymentRef, { ...clearCallableCashPin(), cashPinInvalidatedAt: now.toISOString(), cashPinInvalidationReason: payment.cashPinLockedAt ? "attempt_limit" : "expired", updatedAt: now.toISOString() });
      failure = payment.cashPinLockedAt ? "This cash confirmation PIN has been locked after too many attempts." : "This cash confirmation PIN has expired. Ask the tasker to generate a new one.";
      return;
    }
    const matches = payment.cashPinEmployerId === clientId && payment.cashPinWorkerId === task.workerId && payment.cashPinAgreedAmount === agreedAmount && verifyCashPin({ record: payment, taskId, clientId, workerId: task.workerId, agreedAmount, pin, secret });
    if (!matches) {
      const attempts = (Number.isInteger(payment.cashPinAttempts) ? payment.cashPinAttempts : 0) + 1;
      const locked = attempts >= CASH_PIN_MAX_ATTEMPTS;
      transaction.update(paymentRef, { cashPinAttempts: attempts, ...(locked ? { ...clearCallableCashPin(), cashPinLockedAt: now.toISOString(), cashPinInvalidatedAt: now.toISOString(), cashPinInvalidationReason: "attempt_limit" } : {}), updatedAt: now.toISOString() });
      writeAudit(transaction, db, { actorId: clientId, action: "cash_payment_pin_failed", targetType: "payment", targetId: taskId, metadata: { attempts, locked } });
      failure = locked ? "This cash confirmation PIN has been locked after three incorrect attempts." : "The cash confirmation PIN is incorrect. Please try again.";
      return;
    }
    const confirmedAt = now.toISOString();
    transaction.update(taskRef, { paymentStatus: "Verified", workerConfirmedAt: confirmedAt, updatedAt: confirmedAt });
    transaction.update(paymentRef, { ...clearCallableCashPin(), paymentStatus: "Verified", workerConfirmedAt: confirmedAt, cashPinConfirmedAt: confirmedAt, cashPinUsedAt: confirmedAt, updatedAt: confirmedAt });
    transaction.set(db.collection("notifications").doc(`${taskId}_cash-confirmed_${task.workerId}`), {
      userId: task.workerId, taskId, createdBy: clientId,
      notificationType: "Cash payment confirmed",
      message: `Cash payment for ${task.title || "this task"} was mutually confirmed.`,
      readStatus: false, createdAt: confirmedAt
    }, { merge: true });
    writeAudit(transaction, db, { actorId: clientId, action: "cash_payment_pin_verified", targetType: "payment", targetId: taskId, metadata: { paymentMethod: "Cash", agreedAmount } });
  });
  if (failure) throw new HttpsError("failed-precondition", failure);
  return { ok: true, status: "Verified" };
});

exports.updatePlatformRevenueConfig = onCall({ region: REGION }, async (request) => {
  const actorId = requireSuperadmin(request);
  const data = request.data || {};
  const gcashAccountName = requiredString(data.gcashAccountName, "gcashAccountName");
  const gcashNumber = requiredString(data.gcashNumber, "gcashNumber");
  const rateBasisPoints = data.rateBasisPoints === undefined ? DEFAULT_RATE_BASIS_POINTS : Number(data.rateBasisPoints);
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10_000) {
    throw new HttpsError("invalid-argument", "Service fee rate must be between 0% and 100%.");
  }
  const instructions = typeof data.instructions === "string" ? data.instructions.trim().slice(0, 1000) : "";
  let gcashQrImageUrl;
  try {
    gcashQrImageUrl = normalizeOptionalHttpsUrl(data.gcashQrImageUrl);
  } catch (error) {
    throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "GCash QR image URL is invalid.");
  }
  const now = nowIso();
  const db = getFirestore();
  await db.runTransaction(async (transaction) => {
    const ref = db.collection("platformRevenue").doc("config");
    const existing = await transaction.get(ref);
    const update = { enabled: true, gcashAccountName, gcashNumber, gcashQrImageUrl, rateBasisPoints, instructions, activatedAt: existing.data()?.activatedAt || now, updatedAt: now, updatedBy: actorId };
    transaction.set(ref, update, { merge: true });
    writeAudit(transaction, db, { actorId, action: "update_platform_revenue_config", targetType: "payment", targetId: "platformRevenue/config", metadata: { rateBasisPoints } });
  });
  return { ok: true, rateBasisPoints };
});

exports.submitPlatformFeePayment = onCall({ region: REGION }, async (request) => {
  const employerId = requireSignedIn(request);
  const taskId = requiredString(request.data?.taskId, "taskId");
  const receiptPath = requiredString(request.data?.receiptPath, "receiptPath");
  const transactionReference = requiredString(request.data?.transactionReference, "transactionReference");
  if (!/^[-A-Za-z0-9 ]{4,100}$/.test(transactionReference)) throw new HttpsError("invalid-argument", "Enter a valid GCash transaction reference.");
  const db = getFirestore(); const feeRef = db.collection("platformFees").doc(taskId); const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const feeSnapshot = await transaction.get(feeRef);
    if (!feeSnapshot.exists) throw new HttpsError("not-found", "No TASKLINK service fee is due for this task.");
    const fee = feeSnapshot.data();
    if (fee.employerId !== employerId) throw new HttpsError("permission-denied", "Only the employer can submit this service-fee payment.");
    if (!['pending_payment', 'rejected', 'overdue'].includes(fee.status)) throw new HttpsError("failed-precondition", "This service-fee payment cannot be submitted again.");
    if (!receiptPath.startsWith(`paymentProofs/${taskId}/`) && receiptPath !== `firestorePaymentProofs/${taskId}/platform-fee`) {
      throw new HttpsError("invalid-argument", "Upload a private receipt before submitting.");
    }
    transaction.update(feeRef, {
      status: 'submitted_for_review',
      receiptPath,
      transactionReference,
      submittedAt: now,
      updatedAt: now,
      rejectionReason: null,
      auditHistory: FieldValue.arrayUnion(buildFeeAuditEntry({
        action: 'payment_submitted',
        status: 'submitted_for_review',
        at: now,
        actorId: employerId
      }))
    });
    transaction.set(db.collection("notifications").doc(), { userId: employerId, taskId, createdBy: employerId, notificationType: "TASKLINK fee submitted", message: `Your TASKLINK service-fee payment for ${fee.taskTitle} was submitted for administrator review.`, readStatus: false, createdAt: now });
    writeAudit(transaction, db, { actorId: employerId, action: "submit_platform_fee_payment", targetType: "payment", targetId: taskId, metadata: { feeCentavos: fee.feeCentavos } });
  });
  return { ok: true, status: 'submitted_for_review' };
});

exports.reviewPlatformFeePayment = onCall({ region: REGION }, async (request) => {
  const adminId = requireSuperadmin(request); const taskId = requiredString(request.data?.taskId, "taskId");
  const decision = requiredString(request.data?.decision, "decision"); const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim() : '';
  if (!['verified', 'rejected'].includes(decision)) throw new HttpsError('invalid-argument', 'Unsupported service-fee decision.');
  if (decision === 'rejected' && !reason) throw new HttpsError('invalid-argument', 'A rejection reason is required.');
  const db = getFirestore(); const ref = db.collection('platformFees').doc(taskId); const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); if (!snapshot.exists) throw new HttpsError('not-found', 'Service-fee record not found.');
    const fee = snapshot.data(); if (fee.status !== 'submitted_for_review') throw new HttpsError('failed-precondition', 'Only a submitted service fee can be reviewed.');
    const employerRef = decision === 'verified' ? db.collection('users').doc(fee.employerId) : null;
    const employerSnapshot = employerRef ? await transaction.get(employerRef) : null;
    const currentCount = employerSnapshot?.exists && Number.isInteger(employerSnapshot.data().unsettledPlatformFeeCount)
      ? employerSnapshot.data().unsettledPlatformFeeCount
      : 0;
    const update = decision === 'verified'
      ? { status: 'verified', verifiedAt: now, reviewedAt: now, reviewedBy: adminId, verifiedCollectedCentavos: fee.feeCentavos, updatedAt: now }
      : { status: 'rejected', reviewedAt: now, reviewedBy: adminId, rejectionReason: reason, updatedAt: now };
    update.auditHistory = FieldValue.arrayUnion(buildFeeAuditEntry({
      action: decision === 'verified' ? 'payment_verified' : 'payment_rejected',
      status: decision,
      at: now,
      actorId: adminId,
      reason: reason || null
    }));
    transaction.update(ref, update);
    if (employerRef) transaction.set(employerRef, { unsettledPlatformFeeCount: Math.max(0, currentCount - 1) }, { merge: true });
    transaction.set(db.collection('notifications').doc(), { userId: fee.employerId, taskId, createdBy: adminId, notificationType: 'TASKLINK fee review', message: decision === 'verified' ? `Your TASKLINK service fee for ${fee.taskTitle} was verified. Your posting restriction has been removed.` : `Your TASKLINK service fee was rejected: ${reason}`, readStatus: false, createdAt: now });
    writeAudit(transaction, db, { actorId: adminId, action: decision === 'verified' ? 'verify_platform_fee_payment' : 'reject_platform_fee_payment', targetType: 'payment', targetId: taskId, reason, metadata: { feeCentavos: fee.feeCentavos } });
  });
  return { ok: true, status: decision };
});

exports.getPlatformRevenueOverview = onCall({ region: REGION }, async (request) => {
  requireSuperadmin(request);
  const fees = await getFirestore().collection('platformFees').get();
  const summary = {
    revenueGeneratingCompletedTasks: fees.size,
    totalCollectedCentavos: 0,
    pendingPaymentCentavos: 0,
    submittedForReviewCentavos: 0,
    overdueCentavos: 0,
    rejectedCentavos: 0,
    byCategory: {},
    monthlyCollected: {}
  };
  for (const document of fees.docs) {
    const fee = document.data();
    const amount = Number.isSafeInteger(fee.feeCentavos) && fee.feeCentavos >= 0 ? fee.feeCentavos : 0;
    if (fee.status === 'verified') {
      summary.totalCollectedCentavos += amount;
      const month = typeof fee.verifiedAt === 'string' && /^\d{4}-\d{2}/.test(fee.verifiedAt)
        ? fee.verifiedAt.slice(0, 7) : 'Unknown';
      summary.monthlyCollected[month] = (summary.monthlyCollected[month] || 0) + amount;
    } else if (fee.status === 'pending_payment') summary.pendingPaymentCentavos += amount;
    else if (fee.status === 'submitted_for_review') summary.submittedForReviewCentavos += amount;
    else if (fee.status === 'overdue') summary.overdueCentavos += amount;
    else if (fee.status === 'rejected') summary.rejectedCentavos += amount;
    const category = typeof fee.taskCategory === 'string' && fee.taskCategory.trim() ? fee.taskCategory.trim() : 'Uncategorized';
    summary.byCategory[category] = (summary.byCategory[category] || 0) + amount;
  }
  return {
    ...summary,
    byCategory: Object.entries(summary.byCategory).map(([category, feeCentavos]) => ({ category, feeCentavos })),
    monthlyCollected: Object.entries(summary.monthlyCollected)
      .map(([month, feeCentavos]) => ({ month, feeCentavos }))
      .sort((left, right) => right.month.localeCompare(left.month)),
    generatedAt: nowIso()
  };
});

// Kept under its deployed export name so a Functions deployment safely replaces
// the former post-completion fee creator. New obligations are created only in
// the trusted acceptance transaction above. This trigger now preserves a fee
// record when a selected task is cancelled without treating it as revenue.
exports.createPlatformFeeOnCompletedTask = onDocumentUpdated({ document: 'tasks/{taskId}', region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const task = event.data?.after.data();
  if (!task || before?.status === 'Cancelled' || task.status !== 'Cancelled') return;
  const db = getFirestore();
  const feeRef = db.collection('platformFees').doc(event.params.taskId);
  const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(feeRef);
    if (!snapshot.exists) return;
    const fee = snapshot.data();
    if (['cancelled', 'credited'].includes(fee.status)) return;
    const employerRef = db.collection('users').doc(fee.employerId);
    const employerSnapshot = await transaction.get(employerRef);
    const currentCount = employerSnapshot.exists && Number.isInteger(employerSnapshot.data().unsettledPlatformFeeCount)
      ? employerSnapshot.data().unsettledPlatformFeeCount
      : 0;
    const releasesPostingLock = isPostingBlockedByPlatformFee(fee.status);
    const requiresReview = ['submitted_for_review', 'verified', 'refund_pending'].includes(fee.status);
    const status = requiresReview ? 'refund_pending' : 'cancelled';
    transaction.update(feeRef, {
      status,
      cancelledAt: now,
      cancellationReason: typeof task.cancellationReason === 'string' ? task.cancellationReason : null,
      cancellationReviewRequired: requiresReview,
      updatedAt: now,
      auditHistory: FieldValue.arrayUnion(buildFeeAuditEntry({
        action: 'task_cancelled',
        status,
        at: now,
        actorId: typeof task.cancelledBy === 'string' ? task.cancelledBy : 'system',
        reason: typeof task.cancellationReason === 'string' ? task.cancellationReason : null
      }))
    });
    if (releasesPostingLock) transaction.set(employerRef, { unsettledPlatformFeeCount: Math.max(0, currentCount - 1) }, { merge: true });
  });
});

// A Cash PIN is valid only while the same task is awaiting final employer
// approval. This clears any recoverable encrypted PIN material if a task is
// cancelled, disputed, or otherwise leaves that state outside the PIN route.
exports.invalidateCashPinOnTaskStateChange = onDocumentUpdated({ document: 'tasks/{taskId}', region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || after.status === "Pending Approval" || !isCashPaymentMethod(before.paymentMethod)) return;
  const taskId = event.params.taskId;
  const db = getFirestore();
  const paymentRef = db.collection("payments").doc(taskId);
  await db.runTransaction(async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists) return;
    const payment = paymentSnapshot.data();
    if (!isCashPaymentMethod(payment.paymentMethod) || !payment.cashPinHash || payment.cashPinUsedAt || payment.cashPinInvalidatedAt) return;
    transaction.update(paymentRef, {
      ...clearCallableCashPin(),
      cashPinInvalidatedAt: nowIso(),
      cashPinInvalidationReason: "task_state_changed",
      updatedAt: nowIso()
    });
  });
});

exports.notifyEligibleWorkers = onDocumentCreated(
  { document: "tasks/{taskId}", region: "asia-southeast1" },
  async (event) => {
    const task = event.data?.data();
    if (!task || task.status !== "Finding Workers") return;

    const db = getFirestore();
    const workers = await db.collection("users").where("role", "==", "worker").get();
    const evaluatedAt = Date.now();
    const eligible = workers.docs.map((workerDocument) => {
      const worker = { id: workerDocument.id, ...workerDocument.data() };
      return { worker, match: scoreWorkerForTask(task, worker, evaluatedAt) };
    }).filter(({ match }) => match.eligible);

    let createdCount = 0;
    for (let offset = 0; offset < eligible.length; offset += 400) {
      const chunk = eligible.slice(offset, offset + 400);
      const preferenceSnapshots = await db.getAll(...chunk.map(({ worker }) =>
        db.collection("notificationPreferences").doc(worker.id)
      ));
      const enabled = chunk.filter((_, index) =>
        matchingNotificationsEnabled(preferenceSnapshots[index].data())
      );
      if (!enabled.length) continue;
      const notificationRefs = enabled.map(({ worker }) =>
        db.collection("notifications").doc(matchingNotificationId(event.params.taskId, worker.id))
      );
      const existingNotifications = await db.getAll(...notificationRefs);
      const batch = db.batch();
      enabled.forEach(({ worker, match }, index) => {
        if (existingNotifications[index].exists) return;
        batch.create(notificationRefs[index], {
          userId: worker.id,
          taskId: event.params.taskId,
          createdBy: task.clientId,
          notificationType: "Smart Match",
          message: `Smart Match: ${task.title} is a ${match.score}% match for you.`,
          matchScore: match.score,
          matchReasons: match.reasons,
          matchPolicyVersion: MATCH_POLICY_VERSION,
          scoreBreakdown: match.breakdown,
          distanceKm: Number(match.distanceKm.toFixed(3)),
          route: "task",
          readStatus: false,
          createdAt: new Date().toISOString()
        });
        createdCount += 1;
      });
      if (enabled.some((_, index) => !existingNotifications[index].exists)) await batch.commit();
    }
    logger.info("TaskLink matching notifications created", {
      taskId: event.params.taskId,
      eligibleCount: eligible.length,
      createdCount
    });
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
    await event.data.ref.update({
      ...buildMatchSnapshot(
        taskSnapshot.data(),
        { id: workerSnapshot.id, ...workerSnapshot.data() }
      ),
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

