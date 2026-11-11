const express = require("express");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { buildAnalyticsReport } = require("../functions/analytics");
const {
  authorityFromClaims,
  buildAccountStatusChange,
  buildLockedNameCorrection,
  hasSuperadminAuthority,
  toModerationUser
} = require("../functions/authority");
const { buildIdentityReview } = require("../functions/identity");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${fieldName} is required.`);
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
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

function getAdminServices() {
  const app = getApps()[0] || initializeApp(firebaseOptions());
  return { auth: getAuth(app), db: getFirestore(app) };
}

function writeAudit(transaction, db, entry) {
  transaction.set(db.collection("auditLogs").doc(), { ...entry, createdAt: nowIso() });
}

function withIds(snapshot) {
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

function allowOrigins() {
  return new Set((process.env.ADMIN_PORTAL_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

async function authenticate(request, requiredAuthority = "admin") {
  const value = request.get("authorization") || "";
  if (!value.startsWith("Bearer ")) throw new ApiError(401, "Sign in to continue.");
  let claims;
  try {
    claims = await getAdminServices().auth.verifyIdToken(value.slice(7));
  } catch {
    throw new ApiError(401, "Your sign-in session is invalid or expired. Sign in again.");
  }
  const authority = authorityFromClaims(claims);
  if (requiredAuthority === "superadmin" ? !hasSuperadminAuthority(claims) : authority === "user") {
    throw new ApiError(403, "This administrator action is not permitted for this account.");
  }
  return claims;
}

function route(requiredAuthority, action) {
  return async (request, response, next) => {
    try {
      const claims = await authenticate(request, requiredAuthority);
      response.json(await action({ request, claims, db: getAdminServices().db }));
    } catch (error) {
      next(error);
    }
  };
}

async function reviewVerification({ request, claims, db }) {
  const adminId = claims.uid;
  const userId = requiredString(request.body?.userId, "userId");
  const decision = requiredString(request.body?.decision, "decision");
  const reason = optionalString(request.body?.reason);
  if (!["Verified", "Rejected", "Needs Resubmission"].includes(decision)) throw new ApiError(400, "Unsupported verification decision.");
  if (decision !== "Verified" && !reason) throw new ApiError(400, "A reason is required when verification is not approved.");
  const requestRef = db.collection("verificationRequests").doc(userId);
  const userRef = db.collection("users").doc(userId);
  const reviewedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [verificationSnapshot, userSnapshot] = await Promise.all([transaction.get(requestRef), transaction.get(userRef)]);
    if (!verificationSnapshot.exists || !userSnapshot.exists) throw new ApiError(404, "Verification request or user account was not found.");
    if (verificationSnapshot.data().status !== "Pending Verification") throw new ApiError(409, "This verification request has already been reviewed.");
    const user = userSnapshot.data();
    if (!["worker", "client"].includes(user.role)) throw new ApiError(409, "Only employer and tasker accounts can be verified.");
    const verification = verificationSnapshot.data();
    const hasRequiredDocuments = [verification.validIdPath, verification.medicalCertificatePath, verification.policeClearancePath]
      .every((path) => typeof path === "string" && path.startsWith(`verification/${userId}/`));
    if (decision === "Verified" && !hasRequiredDocuments) throw new ApiError(409, "A valid ID, medical certificate, and police clearance are required before approval.");
    const identityReview = buildIdentityReview(decision, reviewedAt, adminId);
    const roleProfileRef = db.collection(user.role === "worker" ? "workerProfiles" : "clientProfiles").doc(userId);
    const review = { status: decision, reviewedAt, reviewedBy: adminId, reviewReason: reason, updatedAt: reviewedAt };
    const verificationReview = { verificationStatus: decision, ...identityReview, updatedAt: reviewedAt };
    transaction.update(requestRef, review);
    transaction.update(userRef, verificationReview);
    transaction.set(roleProfileRef, verificationReview, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(userId), { verificationStatus: decision, updatedAt: reviewedAt }, { merge: true });
    transaction.set(db.collection("notifications").doc(), {
      userId, createdBy: adminId, notificationType: "Verification review",
      message: decision === "Verified" ? "Your TaskLink verification was approved." : `Your TaskLink verification needs attention: ${reason}`,
      readStatus: false, createdAt: reviewedAt
    });
    writeAudit(transaction, db, { actorId: adminId, action: "review_worker_verification", targetType: "verification", targetId: userId, reason, metadata: { decision } });
  });
  return { ok: true, status: decision };
}

async function reviewPayment({ request, claims, db }) {
  const adminId = claims.uid;
  const taskId = requiredString(request.body?.taskId, "taskId");
  const decision = requiredString(request.body?.decision, "decision");
  const reason = optionalString(request.body?.reason);
  if (!["Verified", "Rejected"].includes(decision)) throw new ApiError(400, "Unsupported payment decision.");
  if (decision === "Rejected" && !reason) throw new ApiError(400, "A rejection reason is required.");
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const reviewedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new ApiError(404, "Task or payment record was not found.");
    const task = taskSnapshot.data();
    const payment = paymentSnapshot.data();
    if (payment.paymentMethod !== "GCash link" || task.paymentMethod !== "GCash link") throw new ApiError(409, "Cash payments use worker confirmation instead of administrator review.");
    if (payment.paymentStatus !== "Submitted" || task.paymentStatus !== "Submitted") throw new ApiError(409, "Only submitted payment evidence can be reviewed.");
    if (!payment.proofOfPaymentUrl) throw new ApiError(409, "The payment proof file is missing.");
    transaction.update(paymentRef, { paymentStatus: decision, reviewedAt, reviewedBy: adminId, reviewReason: reason, updatedAt: reviewedAt });
    transaction.update(taskRef, { paymentStatus: decision, paymentReviewedAt: reviewedAt, paymentReviewedBy: adminId, paymentReviewReason: reason, updatedAt: reviewedAt });
    [task.clientId, task.workerId].filter(Boolean).forEach((userId) => transaction.set(db.collection("notifications").doc(), {
      userId, taskId, createdBy: adminId, notificationType: "Payment review",
      message: decision === "Verified" ? `Payment for ${task.title ?? "the task"} was verified.` : `Payment evidence for ${task.title ?? "the task"} was rejected: ${reason}`,
      readStatus: false, createdAt: reviewedAt
    }));
    writeAudit(transaction, db, { actorId: adminId, action: "review_payment_evidence", targetType: "payment", targetId: taskId, reason, metadata: { decision } });
  });
  return { ok: true, status: decision };
}

async function changeAccountStatus({ request, claims, db }) {
  const superadminId = claims.uid;
  const userId = requiredString(request.body?.userId, "userId");
  const accountStatus = requiredString(request.body?.accountStatus, "accountStatus");
  const reason = requiredString(request.body?.reason, "reason");
  const evidenceReference = optionalString(request.body?.evidenceReference);
  const violationReportId = optionalString(request.body?.violationReportId);
  const userRef = db.collection("users").doc(userId);
  await db.runTransaction(async (transaction) => {
    const reportRef = violationReportId ? db.collection("violationReports").doc(violationReportId) : null;
    const [userSnapshot, reportSnapshot] = await Promise.all([transaction.get(userRef), reportRef ? transaction.get(reportRef) : Promise.resolve(null)]);
    if (!userSnapshot.exists) throw new ApiError(404, "User account was not found.");
    if (reportRef && (!reportSnapshot?.exists || reportSnapshot.data().targetUserId !== userId)) throw new ApiError(409, "The violation report does not belong to this account.");
    const changedAt = nowIso();
    let change;
    try {
      change = buildAccountStatusChange({ actorId: superadminId, targetId: userId, target: userSnapshot.data(), accountStatus, reason, evidenceReference, violationReportId, changedAt });
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : "Invalid account status change.");
    }
    transaction.update(userRef, change.update);
    if (reportRef && accountStatus === "suspended") transaction.update(reportRef, { status: "Actioned", actionedAt: changedAt, actionedBy: superadminId, updatedAt: changedAt });
    writeAudit(transaction, db, change.audit);
  });
  return { ok: true, accountStatus };
}

async function correctName({ request, claims, db }) {
  const superadminId = claims.uid;
  const userId = requiredString(request.body?.userId, "userId");
  const fullName = requiredString(request.body?.fullName, "fullName");
  const reason = requiredString(request.body?.reason, "reason");
  const evidenceReference = optionalString(request.body?.evidenceReference);
  const userRef = db.collection("users").doc(userId);
  const publicRef = db.collection("publicProfiles").doc(userId);
  await db.runTransaction(async (transaction) => {
    const [userSnapshot, publicSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(publicRef)]);
    if (!userSnapshot.exists || !publicSnapshot.exists) throw new ApiError(404, "The account or its public profile was not found.");
    let change;
    try {
      change = buildLockedNameCorrection({ actorId: superadminId, targetId: userId, target: userSnapshot.data(), fullName, reason, evidenceReference, changedAt: nowIso() });
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : "Invalid name correction.");
    }
    transaction.update(userRef, change.update);
    transaction.update(publicRef, change.update);
    writeAudit(transaction, db, change.audit);
  });
  return { ok: true, fullName: fullName.trim().replace(/\s+/g, " ") };
}

function createServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const origin = request.get("origin");
    const origins = allowOrigins();
    if (origin && origins.has(origin)) {
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
  app.post("/api/admin/analytics", route("admin", async ({ request, db }) => {
    const input = { preset: request.body?.preset ?? "7d", startDate: request.body?.startDate, endDate: request.body?.endDate };
    try {
      const [users, verificationRequests, tasks, payments, taskMatches, notifications] = await Promise.all([
        db.collection("users").where("role", "in", ["client", "worker"]).get(), db.collection("verificationRequests").get(),
        db.collection("tasks").get(), db.collection("payments").get(), db.collection("taskMatches").get(),
        db.collection("notifications").where("notificationType", "==", "Matching task").get()
      ]);
      const report = buildAnalyticsReport({ users: withIds(users), verificationRequests: withIds(verificationRequests), tasks: withIds(tasks), payments: withIds(payments), taskMatches: withIds(taskMatches), notifications: withIds(notifications) }, input, nowIso());
      await db.collection("analyticsSnapshots").doc(report.snapshotId).set(report);
      return report;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : "Unable to generate administrator analytics.";
      if (/^(Custom analytics dates|Analytics end date|Analytics ranges|Unsupported analytics range)/.test(message)) throw new ApiError(400, message);
      throw new ApiError(500, "Unable to generate administrator analytics.");
    }
  }));
  app.get("/api/admin/superadmin/overview", route("superadmin", async ({ db }) => {
    const [users, reports, auditLogs] = await Promise.all([
      db.collection("users").where("role", "in", ["client", "worker"]).get(),
      db.collection("violationReports").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("auditLogs").orderBy("createdAt", "desc").limit(50).get()
    ]);
    return { users: users.docs.map((document) => toModerationUser(document.id, document.data())), reports: withIds(reports), auditLogs: withIds(auditLogs) };
  }));
  app.post("/api/admin/verifications/review", route("admin", reviewVerification));
  app.post("/api/admin/payments/review", route("admin", reviewPayment));
  app.post("/api/admin/accounts/status", route("superadmin", changeAccountStatus));
  app.post("/api/admin/accounts/name", route("superadmin", correctName));
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
