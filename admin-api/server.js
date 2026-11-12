const express = require("express");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { authorityFromClaims, buildAccountStatusChange, hasSuperadminAuthority, toModerationUser } = require("../functions/authority");
const { buildIdentityReview } = require("../functions/identity");

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
  return new Set((process.env.ADMIN_PORTAL_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean));
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
  if (requiredAuthority === "superadmin" ? !hasSuperadminAuthority(claims) : authority === "user") {
    throw new ApiError(403, "This administrator action is not permitted for this account.");
  }
  return claims;
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
      hasStoredVerificationDocument(transaction, db, userId, verification.medicalCertificatePath, "medical-certificate"),
      hasStoredVerificationDocument(transaction, db, userId, verification.policeClearancePath, "police-clearance")
    ])).every(Boolean);
    if (decision === "Verified" && !hasAllRequiredDocuments) {
      throw new ApiError(409, "A valid ID, medical certificate, and police clearance are required before approval.");
    }

    const identityReview = buildIdentityReview(decision, reviewedAt, claims.uid);
    const verificationReview = {
      verificationStatus: decision,
      verificationReviewReason: reason || null,
      ...identityReview,
      updatedAt: reviewedAt
    };
    transaction.update(requestRef, {
      status: decision,
      reviewedAt,
      reviewedBy: claims.uid,
      reviewReason: reason,
      updatedAt: reviewedAt
    });
    transaction.update(userRef, verificationReview);
    transaction.set(db.collection(user.role === "worker" ? "workerProfiles" : "clientProfiles").doc(userId), verificationReview, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(userId), { verificationStatus: decision, updatedAt: reviewedAt }, { merge: true });
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
      metadata: { decision },
      createdAt: reviewedAt
    });
  });
  return { ok: true, status: decision };
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
    if (fullName) profiles[id] = { id, fullName, role: publicData.role || userData.role };
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
  app.post("/api/admin/profiles/lookup", route("admin", profileLookup));
  app.get("/api/admin/verifications/pending", route("admin", async ({ db }) => {
    const snapshot = await db.collection("verificationRequests").where("status", "==", "Pending Verification").limit(100).get();
    return { requests: withIds(snapshot) };
  }));
  app.post("/api/admin/verifications/review", route("admin", reviewVerification));
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
