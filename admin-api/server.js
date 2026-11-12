const express = require("express");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { authorityFromClaims, hasSuperadminAuthority, toModerationUser } = require("../functions/authority");

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
      await authenticate(request, requiredAuthority);
      response.json(await action({ request, db: services().db }));
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
  app.get("/api/admin/payments/submitted", route("admin", async ({ db }) => {
    const snapshot = await db.collection("payments").where("paymentStatus", "==", "Submitted").limit(100).get();
    return { payments: withIds(snapshot) };
  }));
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
