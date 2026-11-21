const express = require("express");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { authorityFromClaims, buildAccountStatusChange, hasSuperadminAuthority, isIdentityLocked, toModerationUser } = require("../functions/authority");
const { buildIdentityReview } = require("../functions/identity");
const { DEFAULT_RATE_BASIS_POINTS, buildFeeSnapshot } = require("../functions/revenue");
const { DOCUMENT_KINDS, calculateVerificationProgress, documentReviewsForSubmission, requestFieldByKind } = require("../functions/verificationProgress");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function firebaseOptions() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || "tasklink-fb027";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  try {
    return { credential: cert(JSON.parse(raw)), projectId };
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");
  }
}

function services() {
  const app = getApps()[0] || initializeApp(firebaseOptions());
  return { auth: getAuth(app), db: getFirestore(app) };
}

function withIds(snapshot) {
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

function allowedOrigins() {
  return new Set([
    "https://tasklink-fb027.web.app",
    "https://tasklink-web-ixue.onrender.com",
    ...(process.env.ADMIN_PORTAL_ORIGINS || "").split(",")
  ].map((origin) => origin.trim()).filter(Boolean));
}

async function authenticate(request, requiredAuthority = "admin") {
  const bearer = request.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) throw new ApiError(401, "Sign in to continue.");
  let claims;
  try {
    claims = await services().auth.verifyIdToken(bearer.slice(7));
  } catch {
    throw new ApiError(401, "Your sign-in session is invalid or expired. Sign in again.");
  }
  const authority = authorityFromClaims(claims);
  if (requiredAuthority === "user") return claims;
  if (requiredAuthority === "superadmin" ? !hasSuperadminAuthority(claims) : authority === "user") {
    throw new ApiError(403, "This administrator action is not permitted for this account.");
  }
  return claims;
}

function nowIso() { return new Date().toISOString(); }

function writeAudit(transaction, db, { actorId, action, targetType, targetId, reason = "", metadata = {} }) {
  transaction.set(db.collection("auditLogs").doc(), {
    actorId, action, targetType, targetId, reason, metadata, createdAt: nowIso()
  });
}

function route(requiredAuthority, action) {
  return async (request, response, next) => {
    try {
      const claims = await authenticate(request, requiredAuthority);
      response.json(await action({ request, db: services().db, claims }));
    } catch (error) {
      next(error);
    }
  };
}

function requestedIds(request) {
  if (!Array.isArray(request.body?.ids)) throw new ApiError(400, "ids must be an array.");
  const ids = [...new Set(request.body.ids.filter((id) => typeof id === "string").map((id) => id.trim()).filter(Boolean))];
  if (ids.length > 100) throw new ApiError(400, "At most 100 profiles can be requested at once.");
  return ids;
}

function requiredBodyString(request, fieldName) {
  const value = request.body?.[fieldName];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${fieldName} is required.`);
  }
  return value.trim();
}

function optionalBodyString(request, fieldName) {
  const value = request.body?.[fieldName];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ApiError(400, `${fieldName} must be text.`);
  return value.trim();
}

async function hasStoredVerificationDocument(transaction, db, userId, path, kind) {
  if (typeof path !== "string") return false;
  // Keep support for legacy Storage-backed documents while rigorously checking
  // the Firestore-backed upload format used by the current free-plan flow.
  if (path.startsWith(`verification/${userId}/`)) return true;
  if (path !== `firestoreVerification/${userId}/${kind}`) return false;
  const fileRef = db.collection("verificationFiles").doc(userId).collection("uploads").doc(kind);
  const snapshot = await transaction.get(fileRef);
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
    const chunk = await transaction.get(fileRef.collection("chunks").doc(index.toString().padStart(3, "0")));
    const data = chunk.data();
    return chunk.exists
      && data.userId === userId
      && data.kind === kind
      && data.uploaderId === userId
      && data.version === file.version
      && data.index === index
      && typeof data.data === "string"
      && data.data.length > 0
      ? data.data.length
      : -1;
  }));
  return chunkLengths.every((length) => length > 0)
    && chunkLengths.reduce((total, length) => total + length, 0) === file.encodedSize;
}

function verificationProfileFields(progress) {
  return { verificationProgress: progress.percentage, verificationProgressLevel: progress.level };
}

function submissionPaths(request) {
  return {
    "valid-id": requiredBodyString(request, "validIdPath"),
    "selfie-with-id": requiredBodyString(request, "selfieWithIdPath"),
    "medical-certificate": requiredBodyString(request, "medicalCertificatePath"),
    "police-clearance": requiredBodyString(request, "policeClearancePath")
  };
}

function requestDocumentFields(paths) {
  return {
    validIdPath: paths["valid-id"],
    selfieWithIdPath: paths["selfie-with-id"],
    medicalCertificatePath: paths["medical-certificate"],
    policeClearancePath: paths["police-clearance"]
  };
}

async function submitVerificationRequest({ request, db, claims }) {
  const validIdType = requiredBodyString(request, "validIdType");
  const submitted = submissionPaths(request);
  const userRef = db.collection("users").doc(claims.uid);
  const verificationRef = db.collection("verificationRequests").doc(claims.uid);
  const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const [userSnapshot, previousSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(verificationRef)]);
    if (!userSnapshot.exists) throw new ApiError(404, "User account was not found.");
    const user = userSnapshot.data();
    if (!new Set(["worker", "client"]).has(user.role)) throw new ApiError(409, "Only employer and tasker accounts can submit verification documents.");
    if (isIdentityLocked(user)) throw new ApiError(409, "Approved accounts can only submit documents that were previously missing.");
    const valid = (await Promise.all(DOCUMENT_KINDS.map((kind) => hasStoredVerificationDocument(transaction, db, claims.uid, submitted[kind], kind)))).every(Boolean);
    if (!valid) throw new ApiError(409, "Upload complete private copies of all required documents before saving.");
    const previous = previousSnapshot.exists ? previousSnapshot.data() : undefined;
    const verification = {
      userId: claims.uid,
      validIdType,
      ...requestDocumentFields(submitted),
      documentReviews: documentReviewsForSubmission(previous, submitted, now),
      status: "Pending Verification",
      submittedAt: now,
      updatedAt: now
    };
    const nextUser = {
      ...user,
      validIdType,
      validIdUrl: submitted["valid-id"],
      selfieWithIdUrl: submitted["selfie-with-id"],
      medicalCertificateUrl: submitted["medical-certificate"],
      policeClearanceUrl: submitted["police-clearance"],
      verificationStatus: "Pending Verification",
      identityStatus: "Pending Approval"
    };
    const progress = calculateVerificationProgress(nextUser, verification);
    const profileUpdate = {
      validIdType,
      validIdUrl: submitted["valid-id"],
      selfieWithIdUrl: submitted["selfie-with-id"],
      medicalCertificateUrl: submitted["medical-certificate"],
      policeClearanceUrl: submitted["police-clearance"],
      verificationStatus: "Pending Verification",
      identityStatus: "Pending Approval",
      ...verificationProfileFields(progress),
      updatedAt: now
    };
    transaction.update(userRef, profileUpdate);
    transaction.set(db.collection(user.role === "client" ? "clientProfiles" : "workerProfiles").doc(claims.uid), { userId: claims.uid, ...profileUpdate }, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(claims.uid), { verificationStatus: "Pending Verification", ...verificationProfileFields(progress), updatedAt: now }, { merge: true });
    transaction.set(verificationRef, verification);
    writeAudit(transaction, db, { actorId: claims.uid, action: "submit_verification_documents", targetType: "verification", targetId: claims.uid, metadata: { verificationProgress: progress.percentage } });
  });
  return { ok: true, status: "Pending Verification" };
}

/** Recalculates the trusted public percentage after a profile picture changes. */
async function refreshVerificationProgress({ db, claims }) {
  const userRef = db.collection("users").doc(claims.uid);
  const requestRef = db.collection("verificationRequests").doc(claims.uid);
  const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const [userSnapshot, verificationSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(requestRef)]);
    if (!userSnapshot.exists) throw new ApiError(404, "User account was not found.");
    const user = userSnapshot.data();
    if (!new Set(["worker", "client"]).has(user.role)) throw new ApiError(409, "Only employer and tasker accounts have verification progress.");
    const progress = calculateVerificationProgress(user, verificationSnapshot.exists ? verificationSnapshot.data() : undefined);
    const progressFields = verificationProfileFields(progress);
    transaction.update(userRef, { ...progressFields, updatedAt: now });
    transaction.set(db.collection(user.role === "worker" ? "workerProfiles" : "clientProfiles").doc(claims.uid), { ...progressFields, updatedAt: now }, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(claims.uid), { ...progressFields, updatedAt: now }, { merge: true });
  });
  return { ok: true };
}

/** Completes a legacy approval without allowing any approved evidence to change. */
async function submitMissingVerificationDocuments({ request, db, claims }) {
  const validIdType = requiredBodyString(request, "validIdType");
  const submitted = {
    "valid-id": requiredBodyString(request, "validIdPath"),
    "selfie-with-id": requiredBodyString(request, "selfieWithIdPath"),
    "medical-certificate": requiredBodyString(request, "medicalCertificatePath"),
    "police-clearance": requiredBodyString(request, "policeClearancePath")
  };
  const fieldByKind = {
    "valid-id": "validIdUrl",
    "selfie-with-id": "selfieWithIdUrl",
    "medical-certificate": "medicalCertificateUrl",
    "police-clearance": "policeClearanceUrl"
  };
  const userRef = db.collection("users").doc(claims.uid);
  const requestRef = db.collection("verificationRequests").doc(claims.uid);
  const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new ApiError(404, "User account was not found.");
    const user = userSnapshot.data();
    if (!new Set(["worker", "client"]).has(user.role) || !isIdentityLocked(user)) {
      throw new ApiError(409, "This account does not have an approved identity to complete.");
    }
    if (user.validIdType && user.validIdType !== validIdType) {
      throw new ApiError(409, "The approved ID type cannot be changed.");
    }
    const missingKinds = Object.keys(fieldByKind).filter((kind) => !user[fieldByKind[kind]]);
    if (!missingKinds.length) throw new ApiError(409, "All approved verification documents are already present.");
    for (const kind of Object.keys(fieldByKind)) {
      const stored = user[fieldByKind[kind]];
      if (stored && stored !== submitted[kind]) {
        throw new ApiError(409, "Approved verification documents cannot be replaced.");
      }
    }
    const documentsValid = (await Promise.all(Object.keys(fieldByKind).map((kind) => (
      hasStoredVerificationDocument(transaction, db, claims.uid, submitted[kind], kind)
    )))).every(Boolean);
    if (!documentsValid) throw new ApiError(409, "Upload complete private copies of all required documents before saving.");
    const previous = (await transaction.get(requestRef)).data();
    const documentReviews = Object.fromEntries(DOCUMENT_KINDS.map((kind) => {
      const previousReview = previous?.documentReviews?.[kind];
      const alreadyApproved = Boolean(user[fieldByKind[kind]]);
      return [kind, alreadyApproved ? (previousReview?.status === "Verified" ? previousReview : { status: "Verified", reviewedAt: now }) : { status: "Pending", reviewedAt: now }];
    }));
    const verification = {
      userId: claims.uid,
      validIdType,
      validIdPath: submitted["valid-id"],
      selfieWithIdPath: submitted["selfie-with-id"],
      medicalCertificatePath: submitted["medical-certificate"],
      policeClearancePath: submitted["police-clearance"],
      documentReviews,
      status: "Pending Verification",
      submittedAt: now,
      updatedAt: now
    };
    const nextUser = { ...user, validIdType, validIdUrl: submitted["valid-id"], selfieWithIdUrl: submitted["selfie-with-id"], medicalCertificateUrl: submitted["medical-certificate"], policeClearanceUrl: submitted["police-clearance"], verificationStatus: "Pending Verification", identityStatus: "Pending Approval" };
    const progress = calculateVerificationProgress(nextUser, verification);
    const profileUpdate = {
      validIdType,
      validIdUrl: submitted["valid-id"],
      selfieWithIdUrl: submitted["selfie-with-id"],
      medicalCertificateUrl: submitted["medical-certificate"],
      policeClearanceUrl: submitted["police-clearance"],
      verificationStatus: "Pending Verification",
      identityStatus: "Pending Approval",
      ...verificationProfileFields(progress),
      updatedAt: now
    };
    transaction.update(userRef, profileUpdate);
    transaction.set(db.collection(user.role === "client" ? "clientProfiles" : "workerProfiles").doc(claims.uid), { userId: claims.uid, ...profileUpdate }, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(claims.uid), { verificationStatus: "Pending Verification", ...verificationProfileFields(progress), updatedAt: now }, { merge: true });
    transaction.set(requestRef, verification);
    transaction.set(db.collection("notifications").doc(), {
      userId: claims.uid, createdBy: claims.uid, notificationType: "Verification completion",
      message: "Your missing verification document was submitted for administrator review.", readStatus: false, createdAt: now
    });
    writeAudit(transaction, db, { actorId: claims.uid, action: "submit_missing_verification_document", targetType: "verification", targetId: claims.uid, metadata: { missingKinds, verificationProgress: progress.percentage } });
  });
  return { ok: true, status: "Pending Verification" };
}

async function hasStoredPlatformFeeReceipt(transaction, db, employerId, taskId, path) {
  if (typeof path !== "string") return false;
  // Legacy Storage receipts remain readable for existing records. New web/mobile
  // uploads are verified against their private Firestore-backed chunks.
  if (path.startsWith(`paymentProofs/${taskId}/`)) return true;
  if (path !== `firestorePaymentProofs/${taskId}/platform-fee`) return false;
  const fileRef = db.collection("paymentProofFiles").doc(taskId).collection("uploads").doc("platform-fee");
  const snapshot = await transaction.get(fileRef);
  if (!snapshot.exists) return false;
  const file = snapshot.data();
  const validMetadata = file.taskId === taskId
    && file.party === "platform-fee"
    && file.uploaderId === employerId
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
  const chunks = await Promise.all(Array.from({ length: file.chunkCount }, async (_, index) => {
    const chunk = await transaction.get(fileRef.collection("chunks").doc(index.toString().padStart(3, "0")));
    const data = chunk.data();
    return chunk.exists
      && data.taskId === taskId
      && data.party === "platform-fee"
      && data.uploaderId === employerId
      && data.version === file.version
      && data.index === index
      && typeof data.data === "string"
      && data.data.length > 0
      ? data.data.length
      : -1;
  }));
  return chunks.every((length) => length > 0)
    && chunks.reduce((total, length) => total + length, 0) === file.encodedSize;
}

async function ensurePlatformFee({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const feeRef = db.collection("platformFees").doc(taskId);
  const taskRef = db.collection("tasks").doc(taskId);
  const configRef = db.collection("platformRevenue").doc("config");
  const now = nowIso();
  let created = false;
  await db.runTransaction(async (transaction) => {
    const [existing, taskSnapshot, configSnapshot] = await Promise.all([
      transaction.get(feeRef), transaction.get(taskRef), transaction.get(configRef)
    ]);
    if (existing.exists) return;
    if (!taskSnapshot.exists) throw new ApiError(404, "Task not found.");
    const task = taskSnapshot.data();
    if (task.clientId !== claims.uid) throw new ApiError(403, "Only the employer can prepare this service fee.");
    if (!['Finished', 'Archived'].includes(task.status) || task.paymentStatus !== "Verified" || !task.agreedAmount) {
      throw new ApiError(409, "A service fee is available after a paid task is finished.");
    }
    const config = configSnapshot.data();
    if (!config?.enabled || !config.gcashAccountName || !config.gcashNumber || !config.activatedAt || String(task.createdAt || "") < String(config.activatedAt)) {
      throw new ApiError(409, "Service-fee payment is not configured for this task.");
    }
    let fee;
    try {
      fee = buildFeeSnapshot({ task: { ...task, id: taskId }, config, now });
    } catch (error) {
      throw new ApiError(409, error instanceof Error ? error.message : "The task wage is invalid.");
    }
    transaction.create(feeRef, fee);
    transaction.set(db.collection("notifications").doc(`${taskId}_platform-fee-due`), {
      userId: task.clientId, taskId, createdBy: "system", notificationType: "TASKLINK service fee due",
      message: `Your TASKLINK service fee of ₱${fee.feeAmount} for ${fee.taskTitle} is now payable.`,
      route: "task", readStatus: false, createdAt: now
    });
    created = true;
  });
  return { ok: true, created };
}

async function submitPlatformFee({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const receiptPath = requiredBodyString(request, "receiptPath");
  const transactionReference = requiredBodyString(request, "transactionReference");
  if (!/^[-A-Za-z0-9 ]{4,100}$/.test(transactionReference)) throw new ApiError(400, "Enter a valid GCash transaction reference.");
  const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const feeRef = db.collection("platformFees").doc(taskId);
    const snapshot = await transaction.get(feeRef);
    if (!snapshot.exists) throw new ApiError(404, "No TASKLINK service fee is due for this task.");
    const fee = snapshot.data();
    if (fee.employerId !== claims.uid) throw new ApiError(403, "Only the employer can submit this service-fee payment.");
    if (!['pending_payment', 'rejected', 'overdue'].includes(fee.status)) throw new ApiError(409, "This service-fee payment cannot be submitted again.");
    if (!(await hasStoredPlatformFeeReceipt(transaction, db, claims.uid, taskId, receiptPath))) {
      throw new ApiError(409, "Upload a complete private receipt before submitting.");
    }
    transaction.update(feeRef, { status: "submitted_for_review", receiptPath, transactionReference, submittedAt: now, updatedAt: now, rejectionReason: null });
    transaction.set(db.collection("notifications").doc(), { userId: claims.uid, taskId, createdBy: claims.uid, notificationType: "TASKLINK fee submitted", message: `Your TASKLINK service-fee payment for ${fee.taskTitle} was submitted for administrator review.`, readStatus: false, createdAt: now });
    writeAudit(transaction, db, { actorId: claims.uid, action: "submit_platform_fee_payment", targetType: "payment", targetId: taskId, metadata: { feeCentavos: fee.feeCentavos } });
  });
  return { ok: true, status: "submitted_for_review" };
}

async function reviewPlatformFee({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const decision = requiredBodyString(request, "decision");
  const reason = optionalBodyString(request, "reason");
  if (!['verified', 'rejected'].includes(decision)) throw new ApiError(400, "Unsupported service-fee decision.");
  if (decision === "rejected" && !reason) throw new ApiError(400, "A rejection reason is required.");
  const now = nowIso();
  await db.runTransaction(async (transaction) => {
    const feeRef = db.collection("platformFees").doc(taskId);
    const snapshot = await transaction.get(feeRef);
    if (!snapshot.exists) throw new ApiError(404, "Service-fee record not found.");
    const fee = snapshot.data();
    if (fee.status !== "submitted_for_review") throw new ApiError(409, "Only a submitted service fee can be reviewed.");
    const update = decision === "verified"
      ? { status: "verified", verifiedAt: now, reviewedAt: now, reviewedBy: claims.uid, verifiedCollectedCentavos: fee.feeCentavos, updatedAt: now }
      : { status: "rejected", reviewedAt: now, reviewedBy: claims.uid, rejectionReason: reason, updatedAt: now };
    transaction.update(feeRef, update);
    transaction.set(db.collection("notifications").doc(), { userId: fee.employerId, taskId, createdBy: claims.uid, notificationType: "TASKLINK fee review", message: decision === "verified" ? `Your TASKLINK service fee for ${fee.taskTitle} was verified.` : `Your TASKLINK service fee was rejected: ${reason}`, readStatus: false, createdAt: now });
    writeAudit(transaction, db, { actorId: claims.uid, action: decision === "verified" ? "verify_platform_fee_payment" : "reject_platform_fee_payment", targetType: "payment", targetId: taskId, reason, metadata: { feeCentavos: fee.feeCentavos } });
  });
  return { ok: true, status: decision };
}

async function platformRevenueOverview({ db }) {
  const fees = await db.collection("platformFees").get();
  const summary = { revenueGeneratingCompletedTasks: fees.size, totalCollectedCentavos: 0, pendingPaymentCentavos: 0, submittedForReviewCentavos: 0, overdueCentavos: 0, rejectedCentavos: 0, byCategory: {}, monthlyCollected: {} };
  for (const document of fees.docs) {
    const fee = document.data(); const amount = Number.isSafeInteger(fee.feeCentavos) && fee.feeCentavos >= 0 ? fee.feeCentavos : 0;
    if (fee.status === "verified") { summary.totalCollectedCentavos += amount; const month = typeof fee.verifiedAt === "string" && /^\d{4}-\d{2}/.test(fee.verifiedAt) ? fee.verifiedAt.slice(0, 7) : "Unknown"; summary.monthlyCollected[month] = (summary.monthlyCollected[month] || 0) + amount; }
    else if (fee.status === "pending_payment") summary.pendingPaymentCentavos += amount;
    else if (fee.status === "submitted_for_review") summary.submittedForReviewCentavos += amount;
    else if (fee.status === "overdue") summary.overdueCentavos += amount;
    else if (fee.status === "rejected") summary.rejectedCentavos += amount;
    const category = typeof fee.taskCategory === "string" && fee.taskCategory.trim() ? fee.taskCategory.trim() : "Uncategorized";
    summary.byCategory[category] = (summary.byCategory[category] || 0) + amount;
  }
  return { ...summary, byCategory: Object.entries(summary.byCategory).map(([category, feeCentavos]) => ({ category, feeCentavos })), monthlyCollected: Object.entries(summary.monthlyCollected).map(([month, feeCentavos]) => ({ month, feeCentavos })).sort((left, right) => right.month.localeCompare(left.month)), generatedAt: nowIso() };
}

async function reviewVerification({ request, db, claims }) {
  const userId = requiredBodyString(request, "userId");
  const decision = requiredBodyString(request, "decision");
  const reason = optionalBodyString(request, "reason");
  if (!new Set(["Verified", "Rejected", "Needs Resubmission"]).has(decision)) {
    throw new ApiError(400, "Unsupported verification decision.");
  }
  if (decision !== "Verified" && !reason) {
    throw new ApiError(400, "A reason is required when verification is not approved.");
  }

  const requestRef = db.collection("verificationRequests").doc(userId);
  const userRef = db.collection("users").doc(userId);
  const reviewedAt = new Date().toISOString();
  await db.runTransaction(async (transaction) => {
    const [verificationSnapshot, userSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(userRef)
    ]);
    if (!verificationSnapshot.exists || !userSnapshot.exists) {
      throw new ApiError(404, "Verification request or user account was not found.");
    }
    if (verificationSnapshot.data().status !== "Pending Verification") {
      throw new ApiError(409, "This verification request has already been reviewed.");
    }
    const user = userSnapshot.data();
    if (!new Set(["worker", "client"]).has(user.role)) {
      throw new ApiError(409, "Only employer and tasker accounts can be verified.");
    }
    const verification = verificationSnapshot.data();
    const hasAllRequiredDocuments = (await Promise.all([
      hasStoredVerificationDocument(transaction, db, userId, verification.validIdPath, "valid-id"),
      hasStoredVerificationDocument(transaction, db, userId, verification.selfieWithIdPath, "selfie-with-id"),
      hasStoredVerificationDocument(transaction, db, userId, verification.medicalCertificatePath, "medical-certificate"),
      hasStoredVerificationDocument(transaction, db, userId, verification.policeClearancePath, "police-clearance")
    ])).every(Boolean);
    if (decision === "Verified" && !hasAllRequiredDocuments) {
      throw new ApiError(409, "A valid ID, selfie with ID, medical certificate, and police clearance are required before approval.");
    }

    const documentReviews = Object.fromEntries(DOCUMENT_KINDS.map((kind) => [kind, { status: decision, reviewedAt, reviewedBy: claims.uid, reason: reason || null }]));
    const reviewedVerification = { ...verification, documentReviews, status: decision };
    const progress = calculateVerificationProgress({ ...user, verificationStatus: decision }, reviewedVerification);
    const identityReview = buildIdentityReview(decision, reviewedAt, claims.uid);
    const verificationReview = {
      verificationStatus: decision,
      verificationReviewReason: reason || null,
      ...identityReview,
      ...verificationProfileFields(progress),
      updatedAt: reviewedAt
    };
    transaction.update(requestRef, {
      status: decision,
      reviewedAt,
      reviewedBy: claims.uid,
      reviewReason: reason,
      documentReviews,
      updatedAt: reviewedAt
    });
    transaction.update(userRef, verificationReview);
    transaction.set(db.collection(user.role === "worker" ? "workerProfiles" : "clientProfiles").doc(userId), verificationReview, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(userId), { verificationStatus: decision, ...verificationProfileFields(progress), updatedAt: reviewedAt }, { merge: true });
    transaction.set(db.collection("notifications").doc(), {
      userId,
      createdBy: claims.uid,
      notificationType: "Verification review",
      message: decision === "Verified"
        ? "Your TaskLink verification was approved."
        : `Your TaskLink verification needs attention: ${reason}`,
      readStatus: false,
      createdAt: reviewedAt
    });
    transaction.set(db.collection("auditLogs").doc(), {
      actorId: claims.uid,
      action: "review_worker_verification",
      targetType: "verification",
      targetId: userId,
      reason,
      metadata: { decision, verificationProgress: progress.percentage },
      createdAt: reviewedAt
    });
  });
  return { ok: true, status: decision };
}

async function reviewVerificationDocument({ request, db, claims }) {
  const userId = requiredBodyString(request, "userId");
  const kind = requiredBodyString(request, "kind");
  const decision = requiredBodyString(request, "decision");
  const reason = optionalBodyString(request, "reason");
  if (!DOCUMENT_KINDS.includes(kind)) throw new ApiError(400, "Unsupported verification document.");
  if (!new Set(["Verified", "Rejected", "Needs Resubmission"]).has(decision)) throw new ApiError(400, "Unsupported document decision.");
  if (decision !== "Verified" && !reason) throw new ApiError(400, "A reason is required when a document is not verified.");
  const requestRef = db.collection("verificationRequests").doc(userId);
  const userRef = db.collection("users").doc(userId);
  const reviewedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [verificationSnapshot, userSnapshot] = await Promise.all([transaction.get(requestRef), transaction.get(userRef)]);
    if (!verificationSnapshot.exists || !userSnapshot.exists) throw new ApiError(404, "Verification request or user account was not found.");
    const verification = verificationSnapshot.data();
    const user = userSnapshot.data();
    if (!new Set(["worker", "client"]).has(user.role)) throw new ApiError(409, "Only employer and tasker accounts can be verified.");
    if (verification.status !== "Pending Verification") throw new ApiError(409, "This verification request is not awaiting review.");
    const path = verification[requestFieldByKind[kind]];
    if (!await hasStoredVerificationDocument(transaction, db, userId, path, kind)) throw new ApiError(409, "This document is missing or its private upload is incomplete.");
    const documentReviews = { ...(verification.documentReviews || {}), [kind]: { status: decision, reviewedAt, reviewedBy: claims.uid, reason: reason || null } };
    const provisional = { ...verification, documentReviews };
    const provisionalProgress = calculateVerificationProgress({ ...user, verificationStatus: "Pending Verification", identityStatus: "Pending Approval" }, provisional);
    const complete = provisionalProgress.allDocumentsVerified;
    const status = complete ? "Verified" : decision === "Rejected" ? "Rejected" : decision === "Needs Resubmission" ? "Needs Resubmission" : "Pending Verification";
    const finalVerification = { ...provisional, status };
    const identityReview = complete ? buildIdentityReview("Verified", reviewedAt, claims.uid) : status === "Rejected" ? buildIdentityReview("Rejected", reviewedAt, claims.uid) : status === "Needs Resubmission" ? buildIdentityReview("Needs Resubmission", reviewedAt, claims.uid) : { identityStatus: "Pending Approval" };
    const progress = calculateVerificationProgress({ ...user, verificationStatus: status, ...identityReview }, finalVerification);
    const profileUpdate = { verificationStatus: status, verificationReviewReason: decision === "Verified" ? null : reason, ...identityReview, ...verificationProfileFields(progress), updatedAt: reviewedAt };
    transaction.update(requestRef, { documentReviews, status, reviewedAt, reviewedBy: claims.uid, reviewReason: decision === "Verified" ? null : reason, updatedAt: reviewedAt });
    transaction.update(userRef, profileUpdate);
    transaction.set(db.collection(user.role === "worker" ? "workerProfiles" : "clientProfiles").doc(userId), profileUpdate, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(userId), { verificationStatus: status, ...verificationProfileFields(progress), updatedAt: reviewedAt }, { merge: true });
    transaction.set(db.collection("notifications").doc(), { userId, createdBy: claims.uid, notificationType: "Verification document review", message: decision === "Verified" ? `Your ${kind.replace(/-/g, " ")} was verified.` : `Your ${kind.replace(/-/g, " ")} needs attention: ${reason}`, readStatus: false, createdAt: reviewedAt });
    writeAudit(transaction, db, { actorId: claims.uid, action: "review_verification_document", targetType: "verification", targetId: userId, reason, metadata: { kind, decision, verificationProgress: progress.percentage } });
  });
  return { ok: true };
}

async function changeAccountStatus({ request, db, claims }) {
  const userId = requiredBodyString(request, "userId");
  const accountStatus = requiredBodyString(request, "accountStatus");
  const reason = requiredBodyString(request, "reason");
  const violationReportId = typeof request.body?.violationReportId === "string"
    ? request.body.violationReportId.trim()
    : "";
  const userRef = db.collection("users").doc(userId);

  await db.runTransaction(async (transaction) => {
    const reportRef = violationReportId ? db.collection("violationReports").doc(violationReportId) : null;
    const [userSnapshot, reportSnapshot] = await Promise.all([
      transaction.get(userRef),
      reportRef ? transaction.get(reportRef) : Promise.resolve(null)
    ]);
    if (!userSnapshot.exists) throw new ApiError(404, "User account was not found.");
    if (reportRef && (!reportSnapshot?.exists || reportSnapshot.data().targetUserId !== userId)) {
      throw new ApiError(409, "The violation report does not belong to this account.");
    }
    const changedAt = new Date().toISOString();
    let change;
    try {
      change = buildAccountStatusChange({
        actorId: claims.uid,
        targetId: userId,
        target: userSnapshot.data(),
        accountStatus,
        reason,
        evidenceReference: "",
        violationReportId,
        changedAt
      });
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : "Invalid moderation request.");
    }
    transaction.update(userRef, change.update);
    if (reportRef && accountStatus === "suspended") {
      transaction.update(reportRef, {
        status: "Actioned",
        actionedAt: changedAt,
        actionedBy: claims.uid,
        updatedAt: changedAt
      });
    }
    transaction.set(db.collection("auditLogs").doc(), { ...change.audit, createdAt: changedAt });
  });
  return { ok: true, accountStatus };
}

async function profileLookup({ request, db }) {
  const profiles = {};
  await Promise.all(requestedIds(request).map(async (id) => {
    const [publicProfile, user] = await Promise.all([
      db.collection("publicProfiles").doc(id).get(),
      db.collection("users").doc(id).get()
    ]);
    const publicData = publicProfile.exists ? publicProfile.data() : {};
    const userData = user.exists ? user.data() : {};
    const fullName = typeof publicData.fullName === "string" && publicData.fullName.trim()
      ? publicData.fullName.trim()
      : typeof userData.fullName === "string" && userData.fullName.trim() ? userData.fullName.trim() : "";
    if (fullName) {
      const progress = calculateVerificationProgress(userData);
      profiles[id] = {
        id,
        fullName,
        role: publicData.role || userData.role,
        verificationProgress: Number.isFinite(userData.verificationProgress) ? userData.verificationProgress : progress.percentage,
        verificationProgressLevel: userData.verificationProgressLevel || progress.level,
        verificationStatus: userData.verificationStatus || publicData.verificationStatus
      };
    }
  }));
  return { profiles };
}

function createServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const origin = request.get("origin");
    if (origin && allowedOrigins().has(origin)) {
      response.set("Access-Control-Allow-Origin", origin);
      response.set("Vary", "Origin");
      response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (request.method === "OPTIONS") return response.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_request, response) => response.json({ ok: true }));
  app.get("/api/revenue/config", route("user", async ({ db }) => {
    const snapshot = await db.collection("platformRevenue").doc("config").get();
    return { config: snapshot.exists ? snapshot.data() : null };
  }));
  app.post("/api/revenue/config", route("superadmin", async ({ request, db, claims }) => {
    const gcashAccountName = requiredBodyString(request, "gcashAccountName");
    const gcashNumber = requiredBodyString(request, "gcashNumber");
    const value = request.body?.rateBasisPoints === undefined ? DEFAULT_RATE_BASIS_POINTS : Number(request.body.rateBasisPoints);
    if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new ApiError(400, "Service fee rate must be between 0% and 100%.");
    const instructions = optionalBodyString(request, "instructions").slice(0, 1000);
    const now = nowIso();
    await db.runTransaction(async (transaction) => {
      const ref = db.collection("platformRevenue").doc("config");
      const existing = await transaction.get(ref);
      transaction.set(ref, { enabled: true, gcashAccountName, gcashNumber, rateBasisPoints: value, instructions, activatedAt: existing.data()?.activatedAt || now, updatedAt: now, updatedBy: claims.uid }, { merge: true });
      writeAudit(transaction, db, { actorId: claims.uid, action: "update_platform_revenue_config", targetType: "payment", targetId: "platformRevenue/config", metadata: { rateBasisPoints: value } });
    });
    return { ok: true, rateBasisPoints: value };
  }));
  app.post("/api/revenue/fees/ensure", route("user", ensurePlatformFee));
  app.post("/api/revenue/fees/submit", route("user", submitPlatformFee));
  app.post("/api/revenue/fees/review", route("admin", reviewPlatformFee));
  app.get("/api/revenue/overview", route("superadmin", platformRevenueOverview));
  app.post("/api/verification/submit", route("user", submitVerificationRequest));
  app.post("/api/verification/progress/refresh", route("user", refreshVerificationProgress));
  app.post("/api/verification/complete-missing", route("user", submitMissingVerificationDocuments));
  app.post("/api/admin/profiles/lookup", route("admin", profileLookup));
  app.get("/api/admin/verifications/pending", route("admin", async ({ db }) => {
    const snapshot = await db.collection("verificationRequests").where("status", "==", "Pending Verification").limit(100).get();
    return { requests: withIds(snapshot) };
  }));
  app.post("/api/admin/verifications/review", route("admin", reviewVerification));
  app.post("/api/admin/verifications/document-review", route("admin", reviewVerificationDocument));
  app.get("/api/admin/payments/submitted", route("admin", async ({ db }) => {
    const snapshot = await db.collection("payments").where("paymentStatus", "==", "Submitted").limit(100).get();
    return { payments: withIds(snapshot) };
  }));
  app.get("/api/admin/moderation/users", route("admin", async ({ db }) => {
    const users = await db.collection("users").where("role", "in", ["client", "worker"]).get();
    return { users: users.docs.map((document) => toModerationUser(document.id, document.data())) };
  }));
  app.post("/api/admin/moderation/account-status", route("admin", changeAccountStatus));
  app.get("/api/admin/superadmin/overview", route("superadmin", async ({ db }) => {
    const [users, reports, auditLogs] = await Promise.all([
      db.collection("users").where("role", "in", ["client", "worker"]).get(),
      db.collection("violationReports").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("auditLogs").orderBy("createdAt", "desc").limit(50).get()
    ]);
    return {
      users: users.docs.map((document) => toModerationUser(document.id, document.data())),
      reports: withIds(reports),
      auditLogs: withIds(auditLogs)
    };
  }));
  app.use((error, _request, response, _next) => {
    const status = error instanceof ApiError ? error.status : 500;
    response.status(status).json({ error: error instanceof Error ? error.message : "Unexpected server error." });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 10000);
  createServer().listen(port, "0.0.0.0", () => console.log(`TaskLink admin API listening on ${port}`));
}

module.exports = { ApiError, createServer, firebaseOptions };
