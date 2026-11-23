const express = require("express");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { authorityFromClaims, buildAccountStatusChange, hasSuperadminAuthority, isIdentityLocked, toModerationUser } = require("../functions/authority");
const { buildIdentityReview } = require("../functions/identity");
const {
  DEFAULT_RATE_BASIS_POINTS,
  buildFeeAuditEntry,
  buildFeeSnapshot,
  isPostingBlockedByPlatformFee,
  normalizeOptionalHttpsUrl,
  shouldCreatePlatformFeeForSelection
} = require("../functions/revenue");
const { DOCUMENT_KINDS, calculateVerificationProgress, documentReviewsForSubmission, requestFieldByKind } = require("../functions/verificationProgress");
const { buildVerifiedPhoneUpdate, hasMatchingVerifiedPhone, normalizePhilippineMobileNumber, normalizeStoredPhilippineMobileNumber } = require("./phoneAuth");
const { findConflictingAssignment, validSchedule } = require("../functions/marketplace");
const { buildAnalyticsReport } = require("../functions/analytics");
const {
  CASH_PIN_MAX_ATTEMPTS,
  CASH_PIN_MAX_GENERATIONS,
  CASH_PIN_RETRY_COOLDOWN_MS,
  decryptCashPin,
  generateCashPinRecord,
  hasActiveCashPin,
  requireCashPinSecret,
  verifyCashPin
} = require("../functions/cashPin");

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

async function buildPortalAnalytics(db, rangeInput) {
  const [usersSnapshot, verificationSnapshot, tasksSnapshot, paymentsSnapshot, platformFeesSnapshot, matchesSnapshot, notificationsSnapshot] = await Promise.all([
    db.collection("users").where("role", "in", ["client", "worker"]).get(),
    db.collection("verificationRequests").get(),
    db.collection("tasks").get(),
    db.collection("payments").get(),
    db.collection("platformFees").get(),
    db.collection("taskMatches").get(),
    db.collection("notifications").where("notificationType", "in", ["Matching task", "Smart Match"]).get()
  ]);
  return buildAnalyticsReport({
    users: withIds(usersSnapshot),
    verificationRequests: withIds(verificationSnapshot),
    tasks: withIds(tasksSnapshot),
    payments: withIds(paymentsSnapshot),
    platformFees: withIds(platformFeesSnapshot),
    taskMatches: withIds(matchesSnapshot),
    notifications: withIds(notificationsSnapshot)
  }, rangeInput, nowIso());
}

function allowedOrigins() {
  return new Set([
    "https://tasklink-fb027.web.app",
    "https://tasklink-web-oeoo.onrender.com",
    "https://tasklink-web-ixue.onrender.com",
    // Local Expo web sessions use the same authenticated API during final
    // defense testing. These exact loopback origins do not broaden access to
    // arbitrary websites.
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
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

function feeProgressionMessage(status) {
  if (status === "pending_payment") return "The employer must pay the TASKLINK service fee before active work can begin.";
  if (status === "submitted_for_review") return "The TASKLINK service-fee payment is awaiting administrator verification.";
  if (status === "rejected") return "The employer must resubmit the TASKLINK service-fee payment before work can continue.";
  return "The TASKLINK service fee must be verified before this task can continue.";
}

async function reconcileEmployerPostingEligibility(db, employerId) {
  const feeSnapshot = await db.collection("platformFees").where("employerId", "==", employerId).get();
  const outstanding = feeSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((fee) => isPostingBlockedByPlatformFee(fee.status));
  await db.collection("users").doc(employerId).set({ unsettledPlatformFeeCount: outstanding.length }, { merge: true });
  const fee = outstanding[0];
  return {
    allowed: !fee,
    message: fee ? "You have an unsettled TASKLINK service fee. Please complete your payment before posting another task." : "You can post a new task.",
    outstandingFee: fee ? { taskId: fee.taskId || fee.id, taskTitle: fee.taskTitle || "TASKLINK service fee", status: fee.status, feeAmount: fee.feeAmount || "" } : null
  };
}

async function getTaskPostingEligibility({ db, claims }) {
  return reconcileEmployerPostingEligibility(db, claims.uid);
}

async function getTaskFeeProgressionEligibility({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const [taskSnapshot, feeSnapshot] = await Promise.all([
    db.collection("tasks").doc(taskId).get(),
    db.collection("platformFees").doc(taskId).get()
  ]);
  if (!taskSnapshot.exists) throw new ApiError(404, "Task not found.");
  const task = taskSnapshot.data();
  if (claims.uid !== task.clientId && claims.uid !== task.workerId) {
    throw new ApiError(403, "Only task participants can check this task's payment requirement.");
  }
  if (!feeSnapshot.exists) return { allowed: true, message: "No TASKLINK service fee is required for this task." };
  const fee = feeSnapshot.data();
  return fee.status === "verified"
    ? { allowed: true, message: "TASKLINK service fee verified." }
    : { allowed: false, message: feeProgressionMessage(fee.status), status: fee.status };
}

function cashPinSecret() {
  try {
    return requireCashPinSecret();
  } catch (error) {
    throw new ApiError(503, error instanceof Error ? error.message : "Cash payment confirmation is not configured.");
  }
}

function cashPaymentAmount(task, payment) {
  const taskAmount = typeof task.agreedAmount === "string" ? task.agreedAmount.trim() : "";
  const paymentAmount = typeof payment.agreedAmount === "string" ? payment.agreedAmount.trim() : "";
  if (!taskAmount || !paymentAmount || taskAmount !== paymentAmount) {
    throw new ApiError(409, "The agreed task payment amount is missing or no longer matches its payment record.");
  }
  return paymentAmount;
}

function clearCashPinFields() {
  return {
    cashPinHash: FieldValue.delete(),
    cashPinCiphertext: FieldValue.delete(),
    cashPinIv: FieldValue.delete(),
    cashPinTag: FieldValue.delete()
  };
}

function assertCashPaymentParticipants(task, payment, claims, actor) {
  if (task.status !== "Pending Approval" || task.paymentMethod !== "COD" || payment.paymentMethod !== "COD") {
    throw new ApiError(409, "Cash confirmation is available after completed work is awaiting employer approval.");
  }
  if (actor === "client" && (task.clientId !== claims.uid || payment.clientId !== claims.uid)) {
    throw new ApiError(403, "Only the employer who posted this task can confirm paying cash.");
  }
  if (actor === "worker" && (task.workerId !== claims.uid || payment.workerId !== claims.uid)) {
    throw new ApiError(403, "Only the assigned tasker can confirm receiving cash.");
  }
  if (!task.workerId || !payment.workerId || task.workerId !== payment.workerId) {
    throw new ApiError(409, "This task does not have a valid assigned tasker payment record.");
  }
}

async function markCashPaymentPaid({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const now = nowIso();
  let alreadyMarked = false;
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new ApiError(404, "Task payment record not found.");
    const task = taskSnapshot.data();
    const payment = paymentSnapshot.data();
    assertCashPaymentParticipants(task, payment, claims, "client");
    cashPaymentAmount(task, payment);
    if (task.paymentStatus === "Awaiting Worker Confirmation" && payment.paymentStatus === "Awaiting Worker Confirmation") {
      alreadyMarked = true;
      return;
    }
    if (task.paymentStatus !== "Pending" || payment.paymentStatus !== "Pending") {
      throw new ApiError(409, "This cash payment is already being confirmed or has already been completed.");
    }
    transaction.update(taskRef, { paymentStatus: "Awaiting Worker Confirmation", clientConfirmedAt: now, updatedAt: now });
    transaction.update(paymentRef, {
      paymentStatus: "Awaiting Worker Confirmation",
      clientConfirmedAt: now,
      cashPaymentMarkedPaidAt: now,
      updatedAt: now
    });
    transaction.set(db.collection("notifications").doc(`${taskId}_cash-awaiting_${task.workerId}`), {
      userId: task.workerId,
      taskId,
      createdBy: claims.uid,
      notificationType: "Cash payment awaiting confirmation",
      message: `The employer marked the cash payment for ${task.title || "this task"} as paid. Confirm only after you have received and counted the full amount.`,
      readStatus: false,
      createdAt: now
    }, { merge: true });
    writeAudit(transaction, db, {
      actorId: claims.uid,
      action: "cash_payment_marked_paid",
      targetType: "payment",
      targetId: taskId,
      metadata: { paymentMethod: "COD", agreedAmount: payment.agreedAmount }
    });
  });
  return { ok: true, status: "Awaiting Worker Confirmation", alreadyMarked };
}

async function acknowledgeCashPaymentReceived({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const secret = cashPinSecret();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const now = new Date();
  let response;
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new ApiError(404, "Task payment record not found.");
    const task = taskSnapshot.data();
    const payment = paymentSnapshot.data();
    assertCashPaymentParticipants(task, payment, claims, "worker");
    const agreedAmount = cashPaymentAmount(task, payment);
    if (task.paymentStatus !== "Awaiting Worker Confirmation" || payment.paymentStatus !== "Awaiting Worker Confirmation") {
      throw new ApiError(409, "Wait for the employer to mark the cash payment as paid.");
    }
    if (hasActiveCashPin(payment, now)) {
      if (payment.cashPinEmployerId !== task.clientId || payment.cashPinWorkerId !== task.workerId || payment.cashPinAgreedAmount !== agreedAmount) {
        throw new ApiError(409, "The cash confirmation session no longer matches this task.");
      }
      response = { ok: true, pin: decryptCashPin(payment, secret), expiresAt: payment.cashPinExpiresAt, reused: true };
      return;
    }
    const previousGenerations = Number.isInteger(payment.cashPinGenerationCount) ? payment.cashPinGenerationCount : 0;
    const retryAt = Date.parse(payment.cashPinRetryAvailableAt || "");
    if (previousGenerations > 0 && Number.isFinite(retryAt) && now.getTime() < retryAt) {
      throw new ApiError(429, "Wait briefly before requesting another cash confirmation PIN.");
    }
    if (previousGenerations >= CASH_PIN_MAX_GENERATIONS) {
      throw new ApiError(429, "The cash confirmation PIN limit has been reached. Please contact TaskLink support.");
    }
    const generated = generateCashPinRecord({
      taskId,
      clientId: task.clientId,
      workerId: task.workerId,
      agreedAmount,
      now,
      generationCount: previousGenerations + 1,
      secret
    });
    const retryAvailableAt = new Date(Date.parse(generated.record.cashPinExpiresAt) + CASH_PIN_RETRY_COOLDOWN_MS).toISOString();
    transaction.update(paymentRef, {
      ...generated.record,
      cashPinRetryAvailableAt: retryAvailableAt,
      cashPinLockedAt: FieldValue.delete(),
      cashPinInvalidatedAt: FieldValue.delete(),
      cashPinInvalidationReason: FieldValue.delete(),
      updatedAt: now.toISOString()
    });
    transaction.set(db.collection("notifications").doc(`${taskId}_cash-pin-ready_${task.clientId}`), {
      userId: task.clientId,
      taskId,
      createdBy: claims.uid,
      notificationType: "Cash confirmation PIN ready",
      message: `The tasker is ready to confirm the cash payment for ${task.title || "this task"}. Ask them for the 4-digit confirmation PIN.`,
      readStatus: false,
      createdAt: now.toISOString()
    }, { merge: true });
    writeAudit(transaction, db, {
      actorId: claims.uid,
      action: "cash_payment_pin_issued",
      targetType: "payment",
      targetId: taskId,
      metadata: { paymentMethod: "COD", generation: previousGenerations + 1, agreedAmount }
    });
    response = { ok: true, pin: generated.pin, expiresAt: generated.record.cashPinExpiresAt, reused: false };
  });
  return response;
}

async function verifyCashPaymentPin({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const pin = requiredBodyString(request, "pin");
  if (!/^\d{4}$/.test(pin)) throw new ApiError(400, "Enter the four-digit confirmation PIN from the tasker.");
  const secret = cashPinSecret();
  const taskRef = db.collection("tasks").doc(taskId);
  const paymentRef = db.collection("payments").doc(taskId);
  const now = new Date();
  let failureMessage = "";
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(paymentRef)]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new ApiError(404, "Task payment record not found.");
    const task = taskSnapshot.data();
    const payment = paymentSnapshot.data();
    assertCashPaymentParticipants(task, payment, claims, "client");
    const agreedAmount = cashPaymentAmount(task, payment);
    if (task.paymentStatus !== "Awaiting Worker Confirmation" || payment.paymentStatus !== "Awaiting Worker Confirmation") {
      throw new ApiError(409, "This cash payment is not awaiting PIN confirmation.");
    }
    if (!hasActiveCashPin(payment, now)) {
      transaction.update(paymentRef, {
        ...clearCashPinFields(),
        cashPinInvalidatedAt: now.toISOString(),
        cashPinInvalidationReason: payment.cashPinLockedAt ? "attempt_limit" : "expired",
        updatedAt: now.toISOString()
      });
      failureMessage = payment.cashPinLockedAt
        ? "This cash confirmation PIN has been locked after too many attempts."
        : "This cash confirmation PIN has expired. Ask the tasker to generate a new one.";
      return;
    }
    const matches = payment.cashPinEmployerId === task.clientId
      && payment.cashPinWorkerId === task.workerId
      && payment.cashPinAgreedAmount === agreedAmount
      && verifyCashPin({ record: payment, taskId, clientId: task.clientId, workerId: task.workerId, agreedAmount, pin, secret });
    if (!matches) {
      const attempts = (Number.isInteger(payment.cashPinAttempts) ? payment.cashPinAttempts : 0) + 1;
      const locked = attempts >= CASH_PIN_MAX_ATTEMPTS;
      transaction.update(paymentRef, {
        cashPinAttempts: attempts,
        ...(locked ? { ...clearCashPinFields(), cashPinLockedAt: now.toISOString(), cashPinInvalidatedAt: now.toISOString(), cashPinInvalidationReason: "attempt_limit" } : {}),
        updatedAt: now.toISOString()
      });
      writeAudit(transaction, db, {
        actorId: claims.uid,
        action: "cash_payment_pin_failed",
        targetType: "payment",
        targetId: taskId,
        metadata: { paymentMethod: "COD", attempts, locked }
      });
      failureMessage = locked
        ? "This cash confirmation PIN has been locked after three incorrect attempts."
        : "The cash confirmation PIN is incorrect. Please try again.";
      return;
    }
    const confirmedAt = now.toISOString();
    transaction.update(taskRef, { paymentStatus: "Verified", workerConfirmedAt: confirmedAt, updatedAt: confirmedAt });
    transaction.update(paymentRef, {
      ...clearCashPinFields(),
      paymentStatus: "Verified",
      workerConfirmedAt: confirmedAt,
      cashPinConfirmedAt: confirmedAt,
      cashPinUsedAt: confirmedAt,
      updatedAt: confirmedAt
    });
    transaction.set(db.collection("notifications").doc(`${taskId}_cash-confirmed_${task.workerId}`), {
      userId: task.workerId,
      taskId,
      createdBy: claims.uid,
      notificationType: "Cash payment confirmed",
      message: `Cash payment for ${task.title || "this task"} was mutually confirmed.`,
      readStatus: false,
      createdAt: confirmedAt
    }, { merge: true });
    writeAudit(transaction, db, {
      actorId: claims.uid,
      action: "cash_payment_pin_verified",
      targetType: "payment",
      targetId: taskId,
      metadata: { paymentMethod: "COD", agreedAmount }
    });
  });
  if (failureMessage) throw new ApiError(400, failureMessage);
  return { ok: true, status: "Verified" };
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

const phoneLoginAttemptWindowMs = 10 * 60 * 1000;
const phoneLoginAttemptLimit = 5;
const phoneLoginAttempts = new Map();

function allowPhoneLoginAttempt(request) {
  const now = Date.now();
  const key = request.ip || "unknown";
  const attempts = (phoneLoginAttempts.get(key) || []).filter((timestamp) => now - timestamp < phoneLoginAttemptWindowMs);
  if (attempts.length >= phoneLoginAttemptLimit) {
    throw new ApiError(429, "Too many verification-code requests. Please wait before trying again.");
  }
  attempts.push(now);
  phoneLoginAttempts.set(key, attempts);
}

/**
 * This anonymous endpoint intentionally returns no account/profile data. A
 * valid response merely permits Firebase to authenticate a phone provider that
 * is already attached to an existing TaskLink UID.
 */
async function assertPhoneLoginEligible({ request, db }) {
  allowPhoneLoginAttempt(request);
  const phoneNumber = normalizePhilippineMobileNumber(requiredBodyString(request, "phoneNumber"));
  if (!phoneNumber) throw new ApiError(400, "Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.");

  try {
    const authUser = await services().auth.getUserByPhoneNumber(phoneNumber);
    const profile = await db.collection("users").doc(authUser.uid).get();
    if (!profile.exists || !hasMatchingVerifiedPhone(profile.data().mobileNumber, authUser.phoneNumber)) {
      throw new Error("not eligible");
    }
  } catch {
    // Unknown and unlinked numbers intentionally receive the same response.
    // Do not turn this into an account-discovery endpoint.
    throw new ApiError(403, "Verification-code login is not available for this number. Use Password Login first, then verify the number from your profile.");
  }

  return { ok: true };
}

/** Exchanges a Firebase Phone Auth token for the app's normal JS Auth session. */
async function createPhoneLoginSession({ request, db }) {
  const idToken = requiredBodyString(request, "idToken");
  let claims;
  try {
    claims = await services().auth.verifyIdToken(idToken);
    const [authUser, profile] = await Promise.all([
      services().auth.getUser(claims.uid),
      db.collection("users").doc(claims.uid).get()
    ]);
    if (!profile.exists || !hasMatchingVerifiedPhone(profile.data().mobileNumber, authUser.phoneNumber)) {
      throw new Error("not eligible");
    }
  } catch {
    throw new ApiError(403, "Verification-code login could not be completed. Use Password Login and verify this number from your profile.");
  }
  return { customToken: await services().auth.createCustomToken(claims.uid) };
}

// Vonage Verify is used only by this server. The browser and mobile apps never
// receive the provider credentials, nor a Firebase credential for a different
// account. A verified code is exchanged for a Firebase custom token for the
// existing TaskLink UID.
const phoneOtpSessionLifetimeMs = 10 * 60 * 1000;
const phoneOtpSessionCollection = "phoneOtpSessions";

function vonageConfiguration() {
  const apiKey = process.env.VONAGE_API_KEY?.trim();
  const apiSecret = process.env.VONAGE_API_SECRET?.trim();
  const brand = (process.env.VONAGE_VERIFY_BRAND || "TaskLink").trim();
  if (!apiKey || !apiSecret) throw new ApiError(503, "SMS verification is not configured. Please try again later.");
  return { apiKey, apiSecret, brand: brand.slice(0, 20) || "TaskLink" };
}

async function vonageVerifyRequest(path, payload) {
  const { apiKey, apiSecret } = vonageConfiguration();
  let response;
  try {
    response = await fetch(`https://api.nexmo.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new ApiError(503, "SMS verification is temporarily unavailable. Please try again.");
  }
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function startVonageVerification(phoneNumber) {
  const { brand } = vonageConfiguration();
  const { response, body } = await vonageVerifyRequest("/v2/verify", {
    brand,
    code_length: 6,
    workflow: [{ channel: "sms", to: phoneNumber }]
  });
  if (!response.ok || typeof body.request_id !== "string" || !body.request_id) {
    // The app receives a useful, safe category rather than a provider payload.
    // The server log has just the HTTP status and error code, never credentials.
    const providerCode = typeof body?.type === "string" ? body.type : typeof body?.error_code === "string" ? body.error_code : "unknown";
    console.warn("Vonage Verify start rejected", { status: response.status, providerCode });
    if (response.status === 401) throw new ApiError(503, "SMS provider authentication failed. Please contact TaskLink support.");
    if (response.status === 402) throw new ApiError(503, "SMS provider credit is unavailable. Please contact TaskLink support.");
    if (response.status === 403) throw new ApiError(503, "SMS provider access is not enabled for this account. Please contact TaskLink support.");
    if (response.status === 429) throw new ApiError(429, "SMS provider request limit reached. Please wait before requesting another code.");
    throw new ApiError(503, "Unable to send a verification code right now. Please try again shortly.");
  }
  return body.request_id;
}

async function checkVonageVerification(requestId, code) {
  const { response, body } = await vonageVerifyRequest(`/v2/verify/${encodeURIComponent(requestId)}`, { code });
  if (!response.ok || (typeof body.status === "string" && body.status !== "completed")) {
    throw new ApiError(400, "That verification code is invalid or expired. Request a new code and try again.");
  }
}

function phoneStorageVariants(phoneNumber) {
  return [phoneNumber, `0${phoneNumber.slice(3)}`, phoneNumber.slice(3)];
}

async function profilesForPhoneNumber(db, phoneNumber) {
  const snapshot = await db.collection("users")
    .where("mobileNumber", "in", phoneStorageVariants(phoneNumber))
    .limit(10)
    .get();
  return snapshot.docs.filter((document) => normalizeStoredPhilippineMobileNumber(document.data().mobileNumber) === phoneNumber);
}

function hasDisabledAccount(profile) {
  return ["suspended", "restricted", "deleted"].includes(String(profile.accountStatus || "active").toLowerCase());
}

async function eligiblePhoneLoginProfile(db, phoneNumber) {
  const matches = await profilesForPhoneNumber(db, phoneNumber);
  if (matches.length !== 1) return undefined;
  const profile = matches[0].data();
  return profile.phoneVerified
    && hasMatchingVerifiedPhone(profile.mobileNumber, profile.verifiedPhoneNumber)
    && !hasDisabledAccount(profile)
    ? { id: matches[0].id, profile }
    : undefined;
}

async function writePhoneOtpSession(db, { requestId, kind, userId, phoneNumber }) {
  const session = {
    kind,
    phoneNumber,
    status: "pending",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + phoneOtpSessionLifetimeMs).toISOString()
  };
  if (userId) session.userId = userId;
  await db.collection(phoneOtpSessionCollection).doc(requestId).set(session);
}

async function pendingPhoneOtpSession(db, requestId, kind, userId) {
  const snapshot = await db.collection(phoneOtpSessionCollection).doc(requestId).get();
  const session = snapshot.data();
  if (!snapshot.exists || session.kind !== kind || (userId && session.userId !== userId)
    || session.status !== "pending" || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "This verification request has expired. Request a new code and try again.");
  }
  return { snapshot, session };
}

/** Starts an anonymous code request without exposing whether a number has an account. */
async function startVonagePhoneLogin({ request, db }) {
  allowPhoneLoginAttempt(request);
  const phoneNumber = normalizePhilippineMobileNumber(requiredBodyString(request, "phoneNumber"));
  if (!phoneNumber) throw new ApiError(400, "Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.");
  const profile = await eligiblePhoneLoginProfile(db, phoneNumber);
  if (!profile) {
    throw new ApiError(403, "Verification-code login is not available for this number. Use Password Login first, then verify the number from your profile.");
  }
  const requestId = await startVonageVerification(phoneNumber);
  await writePhoneOtpSession(db, { requestId, kind: "login", userId: profile.id, phoneNumber });
  return { requestId };
}

async function completeVonagePhoneLogin({ request, db }) {
  const requestId = requiredBodyString(request, "requestId");
  const code = requiredBodyString(request, "code");
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "Enter the complete six-digit verification code.");
  const { snapshot, session } = await pendingPhoneOtpSession(db, requestId, "login");
  const profile = await eligiblePhoneLoginProfile(db, session.phoneNumber);
  if (!profile || profile.id !== session.userId) {
    throw new ApiError(403, "Verification-code login could not be completed. Use Password Login and verify this number from your profile.");
  }
  await checkVonageVerification(requestId, code);
  await snapshot.ref.update({ status: "completed", completedAt: nowIso() });
  return { customToken: await services().auth.createCustomToken(session.userId) };
}

async function startVonageProfilePhoneVerification({ request, db, claims }) {
  allowPhoneLoginAttempt(request);
  const phoneNumber = normalizePhilippineMobileNumber(requiredBodyString(request, "phoneNumber"));
  if (!phoneNumber) throw new ApiError(400, "Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.");
  const userSnapshot = await db.collection("users").doc(claims.uid).get();
  if (!userSnapshot.exists) throw new ApiError(404, "User profile not found.");
  if (normalizeStoredPhilippineMobileNumber(userSnapshot.data().mobileNumber) !== phoneNumber) {
    throw new ApiError(409, "Verify the same mobile number that is saved on this TaskLink profile.");
  }
  const matches = await profilesForPhoneNumber(db, phoneNumber);
  if (matches.some((document) => document.id !== claims.uid)) {
    throw new ApiError(409, "This mobile number is already assigned to another TaskLink account.");
  }
  const requestId = await startVonageVerification(phoneNumber);
  await writePhoneOtpSession(db, { requestId, kind: "profile", userId: claims.uid, phoneNumber });
  return { requestId };
}

async function completeVonageProfilePhoneVerification({ request, db, claims }) {
  const requestId = requiredBodyString(request, "requestId");
  const code = requiredBodyString(request, "code");
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "Enter the complete six-digit verification code.");
  const { snapshot, session } = await pendingPhoneOtpSession(db, requestId, "profile", claims.uid);
  const userRef = db.collection("users").doc(claims.uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists || normalizeStoredPhilippineMobileNumber(userSnapshot.data().mobileNumber) !== session.phoneNumber) {
    throw new ApiError(409, "Verify the same mobile number that is saved on this TaskLink profile.");
  }
  await checkVonageVerification(requestId, code);
  const verifiedAt = nowIso();
  await Promise.all([
    snapshot.ref.update({ status: "completed", completedAt: verifiedAt }),
    userRef.update({
      mobileNumber: session.phoneNumber,
      phoneVerified: true,
      verifiedPhoneNumber: session.phoneNumber,
      phoneVerifiedAt: verifiedAt,
      updatedAt: verifiedAt
    })
  ]);
  return { phoneNumber: session.phoneNumber };
}

function mobileAliasForPhoneNumber(phoneNumber) {
  return `${phoneNumber.slice(1)}@tasklink.local`;
}

async function assertPhoneNumberAvailableForRegistration(db, phoneNumber) {
  const existingProfiles = await profilesForPhoneNumber(db, phoneNumber);
  if (existingProfiles.length) throw new ApiError(409, "This mobile number is already registered. Please log in instead.");
  try {
    await services().auth.getUserByEmail(mobileAliasForPhoneNumber(phoneNumber));
    throw new ApiError(409, "This mobile number is already registered. Please log in instead.");
  } catch (error) {
    if (error instanceof ApiError || error?.code !== "auth/user-not-found") throw error;
  }
}

/** Verifies a new number before Firebase creates the mobile-password account. */
async function startVonageRegistrationVerification({ request, db }) {
  allowPhoneLoginAttempt(request);
  const phoneNumber = normalizePhilippineMobileNumber(requiredBodyString(request, "phoneNumber"));
  if (!phoneNumber) throw new ApiError(400, "Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.");
  await assertPhoneNumberAvailableForRegistration(db, phoneNumber);
  const requestId = await startVonageVerification(phoneNumber);
  await writePhoneOtpSession(db, { requestId, kind: "registration", phoneNumber });
  return { requestId };
}

async function completeVonageRegistrationVerification({ request, db }) {
  const requestId = requiredBodyString(request, "requestId");
  const code = requiredBodyString(request, "code");
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "Enter the complete six-digit verification code.");
  const { snapshot, session } = await pendingPhoneOtpSession(db, requestId, "registration");
  await checkVonageVerification(requestId, code);
  await snapshot.ref.update({ status: "verified", verifiedAt: nowIso() });
  return { requestId, phoneNumber: session.phoneNumber };
}

/** Claims the already-verified registration request after the account profile exists. */
async function claimVonageRegistrationVerification({ request, db, claims }) {
  const requestId = requiredBodyString(request, "requestId");
  const sessionRef = db.collection(phoneOtpSessionCollection).doc(requestId);
  const userRef = db.collection("users").doc(claims.uid);
  const verifiedAt = nowIso();
  let phoneNumber;
  await db.runTransaction(async (transaction) => {
    const [sessionSnapshot, userSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(userRef)]);
    const session = sessionSnapshot.data();
    if (!sessionSnapshot.exists || session.kind !== "registration" || session.status !== "verified"
      || new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new ApiError(409, "Verify this mobile number before creating your account.");
    }
    if (!userSnapshot.exists || normalizeStoredPhilippineMobileNumber(userSnapshot.data().mobileNumber) !== session.phoneNumber) {
      throw new ApiError(409, "The verified number does not match this TaskLink account.");
    }
    transaction.update(sessionRef, { status: "claimed", userId: claims.uid, claimedAt: verifiedAt });
    transaction.update(userRef, {
      mobileNumber: session.phoneNumber,
      phoneVerified: true,
      verifiedPhoneNumber: session.phoneNumber,
      phoneVerifiedAt: verifiedAt,
      updatedAt: verifiedAt
    });
    phoneNumber = session.phoneNumber;
  });
  return { phoneNumber };
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

const CONFIRMED_ASSIGNMENT_STATUSES = new Set(["Accepted", "In Progress", "Pending Approval"]);

function activeAssignmentAt(assignments, at = Date.now()) {
  return assignments.find((assignment) => {
    if (!CONFIRMED_ASSIGNMENT_STATUSES.has(assignment.status)) return false;
    if (assignment.status === "In Progress") return true;
    const schedule = validSchedule(assignment);
    return Boolean(schedule && at >= schedule.start && at < schedule.end);
  });
}

function availabilityUpdateForAssignments(assignments, at = Date.now()) {
  const active = activeAssignmentAt(assignments, at);
  return active
    ? { availabilityStatus: "Busy", availability: "Busy", activeTaskId: active.id }
    : { availabilityStatus: "Available", availability: "Available", activeTaskId: FieldValue.delete() };
}

function assertAcceptableApplication({ clientId, client, match, task, worker, workerId }) {
  if (!client || client.role !== "client" || task.clientId !== clientId) {
    throw new ApiError(403, "Only the employer who posted this task can accept an applicant.");
  }
  if (!worker || worker.role !== "worker") throw new ApiError(404, "Tasker profile not found.");
  if (task.status !== "Applied" || task.workerId || !task.applicantIds?.includes(workerId)
    || !match || match.workerId !== workerId || match.acceptanceStatus !== "Applied") {
    throw new ApiError(409, "This application is no longer available for acceptance.");
  }
}

async function getTaskerScheduleAvailability({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const workerId = requiredBodyString(request, "workerId");
  const [taskSnapshot, matchSnapshot, clientSnapshot, workerSnapshot, assignmentsSnapshot] = await Promise.all([
    db.collection("tasks").doc(taskId).get(),
    db.collection("taskMatches").doc(`${taskId}_${workerId}`).get(),
    db.collection("users").doc(claims.uid).get(),
    db.collection("users").doc(workerId).get(),
    db.collection("tasks").where("workerId", "==", workerId).get()
  ]);
  if (!taskSnapshot.exists) throw new ApiError(404, "Task not found.");
  const task = { id: taskSnapshot.id, ...taskSnapshot.data() };
  const match = matchSnapshot.exists ? matchSnapshot.data() : undefined;
  const client = clientSnapshot.exists ? clientSnapshot.data() : undefined;
  const worker = workerSnapshot.exists ? workerSnapshot.data() : undefined;
  assertAcceptableApplication({ clientId: claims.uid, client, match, task, worker, workerId });
  const conflict = findConflictingAssignment(
    assignmentsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })), task, taskId
  );
  return conflict
    ? { eligible: false, message: "This tasker's confirmed schedule overlaps this task." }
    : { eligible: true, message: "Available for this task's schedule." };
}

async function acceptTaskApplication({ request, db, claims }) {
  const taskId = requiredBodyString(request, "taskId");
  const workerId = requiredBodyString(request, "workerId");
  if (workerId === claims.uid) throw new ApiError(409, "Employers cannot accept themselves for their own task.");
  const acceptedAt = nowIso();

  await db.runTransaction(async (transaction) => {
    const taskRef = db.collection("tasks").doc(taskId);
    const matchRef = db.collection("taskMatches").doc(`${taskId}_${workerId}`);
    const paymentRef = db.collection("payments").doc(taskId);
    const feeRef = db.collection("platformFees").doc(taskId);
    const revenueConfigRef = db.collection("platformRevenue").doc("config");
    const workerRef = db.collection("users").doc(workerId);
    const assignmentsQuery = db.collection("tasks").where("workerId", "==", workerId);
    const [taskSnapshot, matchSnapshot, paymentSnapshot, feeSnapshot, revenueConfigSnapshot, clientSnapshot, workerSnapshot, assignmentsSnapshot, allMatchesSnapshot] = await Promise.all([
      transaction.get(taskRef), transaction.get(matchRef), transaction.get(paymentRef),
      transaction.get(feeRef), transaction.get(revenueConfigRef),
      transaction.get(db.collection("users").doc(claims.uid)), transaction.get(workerRef),
      transaction.get(assignmentsQuery), transaction.get(db.collection("taskMatches").where("taskId", "==", taskId))
    ]);
    if (!taskSnapshot.exists || !paymentSnapshot.exists) throw new ApiError(404, "Task or payment record was not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() };
    const match = matchSnapshot.exists ? matchSnapshot.data() : undefined;
    const client = clientSnapshot.exists ? clientSnapshot.data() : undefined;
    const worker = workerSnapshot.exists ? workerSnapshot.data() : undefined;
    assertAcceptableApplication({ clientId: claims.uid, client, match, task, worker, workerId });
    const assignments = assignmentsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    if (findConflictingAssignment(assignments, task, taskId)) {
      throw new ApiError(409, "This tasker's confirmed schedule overlaps this task.");
    }
    const agreedAmount = String(task.pricingMode === "bidding" ? match.proposedAmount : task.wage || "").trim();
    if (!agreedAmount || !Number.isFinite(Number(agreedAmount)) || Number(agreedAmount) <= 0) {
      throw new ApiError(409, "The selected application does not have a valid agreed amount.");
    }
    transaction.update(taskRef, {
      status: "Accepted", workerId, applicantIds: [workerId], selectedMatchId: matchRef.id,
      agreedAmount, acceptedAt, updatedAt: acceptedAt
    });
    transaction.update(paymentRef, { workerId, agreedAmount, updatedAt: acceptedAt });
    const revenueConfig = revenueConfigSnapshot.exists ? revenueConfigSnapshot.data() : undefined;
    if (shouldCreatePlatformFeeForSelection({ task, config: revenueConfig, hasExistingFee: feeSnapshot.exists })) {
      let fee;
      try {
        fee = buildFeeSnapshot({ task: { ...task, id: taskId, workerId, agreedAmount }, config: revenueConfig, now: acceptedAt });
      } catch (error) {
        throw new ApiError(409, error instanceof Error ? error.message : "The agreed worker wage cannot create a service fee.");
      }
      transaction.create(feeRef, fee);
      transaction.update(db.collection("users").doc(claims.uid), {
        unsettledPlatformFeeCount: FieldValue.increment(1)
      });
      transaction.set(db.collection("notifications").doc(`${taskId}_platform-fee-payable_${claims.uid}`), {
        userId: claims.uid,
        taskId,
        createdBy: claims.uid,
        notificationType: "TASKLINK service fee payable",
        message: `A TASKLINK service fee is now payable for ${task.title || "this task"}. New task posts stay restricted until the fee is verified.`,
        readStatus: false,
        createdAt: acceptedAt
      }, { merge: true });
      writeAudit(transaction, db, {
        actorId: claims.uid,
        action: "create_platform_fee_obligation",
        targetType: "payment",
        targetId: taskId,
        metadata: { feeCentavos: fee.feeCentavos, workerWageCentavos: fee.workerWageCentavos, rateBasisPoints: fee.rateBasisPoints }
      });
    }
    transaction.update(matchRef, { acceptanceStatus: "Accepted", hiredAt: acceptedAt, updatedAt: acceptedAt });
    allMatchesSnapshot.docs.forEach((document) => {
      const candidate = document.data();
      if (candidate.workerId === workerId || candidate.acceptanceStatus !== "Applied") return;
      transaction.update(document.ref, { acceptanceStatus: "Rejected", rejectedAt: acceptedAt, updatedAt: acceptedAt });
      transaction.set(db.collection("notifications").doc(`${taskId}_rejected_${candidate.workerId}`), {
        userId: candidate.workerId, taskId, createdBy: claims.uid, notificationType: "Application update",
        message: `Another tasker was selected for ${task.title}.`, readStatus: false, createdAt: acceptedAt
      });
    });
    transaction.set(db.collection("notifications").doc(`${taskId}_accepted_${workerId}`), {
      userId: workerId, taskId, createdBy: claims.uid, notificationType: "Application accepted",
      message: `Your application for ${task.title} was accepted.`, readStatus: false, createdAt: acceptedAt
    });
    const availability = { ...availabilityUpdateForAssignments([...assignments, { ...task, workerId, status: "Accepted" }]), updatedAt: acceptedAt };
    transaction.update(workerRef, availability);
    transaction.set(db.collection("workerProfiles").doc(workerId), {
      availabilityStatus: availability.availabilityStatus, availability: availability.availability, updatedAt: acceptedAt
    }, { merge: true });
    transaction.set(db.collection("publicProfiles").doc(workerId), {
      availabilityStatus: availability.availabilityStatus, availability: availability.availability, updatedAt: acceptedAt
    }, { merge: true });
    writeAudit(transaction, db, { actorId: claims.uid, action: "accept_task_application", targetType: "task", targetId: taskId, metadata: { workerId } });
  });
  return { ok: true, status: "Accepted" };
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

/** Creates a short-lived native Auth session for the already verified caller's UID. */
async function createPhoneVerificationNativeSession({ claims }) {
  const auth = services().auth;
  const user = await auth.getUser(claims.uid);
  if (user.disabled) throw new ApiError(403, "This account is disabled.");
  return { customToken: await auth.createCustomToken(claims.uid) };
}

/** Derives the profile flag from Firebase Admin Auth, never client input. */
async function syncPhoneVerification({ db, claims }) {
  const [authUser, userSnapshot] = await Promise.all([
    services().auth.getUser(claims.uid),
    db.collection("users").doc(claims.uid).get()
  ]);
  if (!userSnapshot.exists) throw new ApiError(404, "User profile not found.");

  let update;
  try {
    update = buildVerifiedPhoneUpdate(userSnapshot.data().mobileNumber, authUser.phoneNumber, nowIso());
  } catch (error) {
    throw new ApiError(409, error instanceof Error ? error.message : "Unable to confirm this phone number.");
  }
  // Firebase's confirmed provider match is the safe point to migrate a legacy
  // prefix-less stored number to its canonical E.164 value.
  await userSnapshot.ref.update({ ...update, mobileNumber: update.verifiedPhoneNumber });
  return { phoneNumber: update.verifiedPhoneNumber };
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
  await db.runTransaction(async (transaction) => {
    const [existing, taskSnapshot] = await Promise.all([
      transaction.get(feeRef), transaction.get(taskRef)
    ]);
    if (existing.exists) return;
    if (!taskSnapshot.exists) throw new ApiError(404, "Task not found.");
    const task = taskSnapshot.data();
    if (task.clientId !== claims.uid) throw new ApiError(403, "Only the employer can prepare this service fee.");
    throw new ApiError(409, "A TASKLINK service fee is created only when a worker is selected. Historical tasks are not charged retroactively.");
  });
  return { ok: true, created: false };
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
    transaction.update(feeRef, {
      status: "submitted_for_review",
      receiptPath,
      transactionReference,
      submittedAt: now,
      updatedAt: now,
      rejectionReason: null,
      auditHistory: FieldValue.arrayUnion(buildFeeAuditEntry({
        action: "payment_submitted",
        status: "submitted_for_review",
        at: now,
        actorId: claims.uid
      }))
    });
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
    const employerRef = decision === "verified" ? db.collection("users").doc(fee.employerId) : undefined;
    const employerSnapshot = employerRef ? await transaction.get(employerRef) : undefined;
    const currentCount = employerSnapshot?.exists && Number.isInteger(employerSnapshot.data().unsettledPlatformFeeCount)
      ? employerSnapshot.data().unsettledPlatformFeeCount
      : 0;
    const update = decision === "verified"
      ? { status: "verified", verifiedAt: now, reviewedAt: now, reviewedBy: claims.uid, verifiedCollectedCentavos: fee.feeCentavos, updatedAt: now }
      : { status: "rejected", reviewedAt: now, reviewedBy: claims.uid, rejectionReason: reason, updatedAt: now };
    update.auditHistory = FieldValue.arrayUnion(buildFeeAuditEntry({
      action: decision === "verified" ? "payment_verified" : "payment_rejected",
      status: decision,
      at: now,
      actorId: claims.uid,
      reason: reason || null
    }));
    transaction.update(feeRef, update);
    if (decision === "verified" && employerRef) {
      transaction.set(employerRef, { unsettledPlatformFeeCount: Math.max(0, currentCount - 1) }, { merge: true });
    }
    transaction.set(db.collection("notifications").doc(), { userId: fee.employerId, taskId, createdBy: claims.uid, notificationType: "TASKLINK fee review", message: decision === "verified" ? `Your TASKLINK service fee for ${fee.taskTitle} was verified. Your posting restriction has been removed.` : `Your TASKLINK service fee was rejected: ${reason}`, readStatus: false, createdAt: now });
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
  // Render terminates TLS at one trusted proxy. This preserves a per-client
  // request limit instead of rate-limiting every visitor as the proxy itself.
  app.set("trust proxy", 1);
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
    let gcashQrImageUrl;
    try {
      gcashQrImageUrl = normalizeOptionalHttpsUrl(request.body?.gcashQrImageUrl);
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : "GCash QR image URL is invalid.");
    }
    const now = nowIso();
    await db.runTransaction(async (transaction) => {
      const ref = db.collection("platformRevenue").doc("config");
      const existing = await transaction.get(ref);
      transaction.set(ref, { enabled: true, gcashAccountName, gcashNumber, gcashQrImageUrl, rateBasisPoints: value, instructions, activatedAt: existing.data()?.activatedAt || now, updatedAt: now, updatedBy: claims.uid }, { merge: true });
      writeAudit(transaction, db, { actorId: claims.uid, action: "update_platform_revenue_config", targetType: "payment", targetId: "platformRevenue/config", metadata: { rateBasisPoints: value } });
    });
    return { ok: true, rateBasisPoints: value };
  }));
  app.post("/api/revenue/fees/ensure", route("user", ensurePlatformFee));
  app.post("/api/revenue/fees/posting-eligibility", route("user", getTaskPostingEligibility));
  app.post("/api/revenue/fees/progression-eligibility", route("user", getTaskFeeProgressionEligibility));
  app.post("/api/revenue/fees/submit", route("user", submitPlatformFee));
  // Review routes intentionally require Superadmin. Admin is analytics-only.
  app.post("/api/revenue/fees/review", route("superadmin", reviewPlatformFee));
  app.get("/api/revenue/overview", route("superadmin", platformRevenueOverview));
  app.post("/api/payments/cash/mark-paid", route("user", markCashPaymentPaid));
  app.post("/api/payments/cash/acknowledge-receipt", route("user", acknowledgeCashPaymentReceived));
  app.post("/api/payments/cash/verify-pin", route("user", verifyCashPaymentPin));
  app.post("/api/tasks/acceptance-eligibility", route("user", getTaskerScheduleAvailability));
  app.post("/api/tasks/accept-application", route("user", acceptTaskApplication));
  app.post("/api/verification/submit", route("user", submitVerificationRequest));
  app.post("/api/verification/progress/refresh", route("user", refreshVerificationProgress));
  app.post("/api/verification/complete-missing", route("user", submitMissingVerificationDocuments));
  app.post("/api/phone-login/eligible", async (request, response, next) => {
    try {
      response.json(await assertPhoneLoginEligible({ request, db: services().db }));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/phone-login/session", async (request, response, next) => {
    try {
      response.json(await createPhoneLoginSession({ request, db: services().db }));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/vonage-otp/login/start", async (request, response, next) => {
    try {
      response.json(await startVonagePhoneLogin({ request, db: services().db }));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/vonage-otp/login/check", async (request, response, next) => {
    try {
      response.json(await completeVonagePhoneLogin({ request, db: services().db }));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/vonage-otp/registration/start", async (request, response, next) => {
    try {
      response.json(await startVonageRegistrationVerification({ request, db: services().db }));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/vonage-otp/registration/check", async (request, response, next) => {
    try {
      response.json(await completeVonageRegistrationVerification({ request, db: services().db }));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/vonage-otp/registration/claim", route("user", claimVonageRegistrationVerification));
  app.post("/api/vonage-otp/profile/start", route("user", startVonageProfilePhoneVerification));
  app.post("/api/vonage-otp/profile/check", route("user", completeVonageProfilePhoneVerification));
  app.post("/api/phone-verification/native-session", route("user", createPhoneVerificationNativeSession));
  app.post("/api/phone-verification/sync", route("user", syncPhoneVerification));
  // Analytics remains on the Render Admin API. This keeps the portal usable on
  // Firebase Spark: Firestore is read through the existing trusted Admin SDK,
  // not a separately deployed Cloud Function.
  app.get("/api/admin/analytics", route("admin", async ({ request, db }) => {
    const preset = typeof request.query.preset === "string" ? request.query.preset : "7d";
    try {
      return await buildPortalAnalytics(db, { preset });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : "Unable to generate analytics.";
      if (/^(Custom analytics dates|Analytics end date|Analytics ranges|Unsupported analytics range)/.test(message)) throw new ApiError(400, message);
      console.error("TaskLink Render analytics failed", { message, preset });
      throw new ApiError(500, "Unable to generate live analytics right now.");
    }
  }));
  app.post("/api/admin/profiles/lookup", route("superadmin", profileLookup));
  app.get("/api/admin/verifications/pending", route("superadmin", async ({ db }) => {
    const snapshot = await db.collection("verificationRequests").where("status", "==", "Pending Verification").limit(100).get();
    return { requests: withIds(snapshot) };
  }));
  app.post("/api/admin/verifications/review", route("superadmin", reviewVerification));
  app.post("/api/admin/verifications/document-review", route("superadmin", reviewVerificationDocument));
  app.get("/api/admin/payments/submitted", route("superadmin", async ({ db }) => {
    const snapshot = await db.collection("payments").where("paymentStatus", "==", "Submitted").limit(100).get();
    return { payments: withIds(snapshot) };
  }));
  app.get("/api/admin/moderation/users", route("superadmin", async ({ db }) => {
    const users = await db.collection("users").where("role", "in", ["client", "worker"]).get();
    return { users: users.docs.map((document) => toModerationUser(document.id, document.data())) };
  }));
  app.post("/api/admin/moderation/account-status", route("superadmin", changeAccountStatus));
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

module.exports = { ApiError, allowedOrigins, createServer, firebaseOptions };
