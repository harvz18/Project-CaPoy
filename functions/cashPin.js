const { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, randomInt, timingSafeEqual } = require("node:crypto");

const CASH_PIN_TTL_MS = 5 * 60 * 1000;
const CASH_PIN_MAX_ATTEMPTS = 3;
const CASH_PIN_MAX_GENERATIONS = 3;
const CASH_PIN_RETRY_COOLDOWN_MS = 60 * 1000;

function requireCashPinSecret(value = process.env.CASH_PAYMENT_PIN_SECRET) {
  if (typeof value !== "string" || value.trim().length < 32) {
    throw new Error("Cash payment confirmation is not configured. Please contact TaskLink support.");
  }
  return value.trim();
}

function cashPinPayload({ taskId, clientId, workerId, agreedAmount, issuedAt, pin }) {
  return [taskId, clientId, workerId, agreedAmount, issuedAt, pin].join("|");
}

function encryptionKey(secret) {
  return createHash("sha256").update(`tasklink-cash-pin-encryption|${secret}`).digest();
}

function hashCashPin(payload, secret) {
  return createHmac("sha256", secret).update(cashPinPayload(payload)).digest("base64");
}

function encryptCashPin(pin, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64")
  };
}

function decryptCashPin(record, secret) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(record.cashPinIv, "base64"));
  decipher.setAuthTag(Buffer.from(record.cashPinTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.cashPinCiphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function generateCashPinRecord({ taskId, clientId, workerId, agreedAmount, now = new Date(), generationCount = 1, secret, random = randomInt }) {
  const configuredSecret = requireCashPinSecret(secret);
  const pin = random(0, 10_000).toString().padStart(4, "0");
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CASH_PIN_TTL_MS).toISOString();
  const encrypted = encryptCashPin(pin, configuredSecret);
  return {
    pin,
    record: {
      cashPinHash: hashCashPin({ taskId, clientId, workerId, agreedAmount, issuedAt, pin }, configuredSecret),
      cashPinCiphertext: encrypted.ciphertext,
      cashPinIv: encrypted.iv,
      cashPinTag: encrypted.tag,
      cashPinIssuedAt: issuedAt,
      cashPinExpiresAt: expiresAt,
      cashPinAttempts: 0,
      cashPinGenerationCount: generationCount,
      cashPinEmployerId: clientId,
      cashPinWorkerId: workerId,
      cashPinAgreedAmount: agreedAmount
    }
  };
}

function hasActiveCashPin(record, now = new Date()) {
  return Boolean(
    record?.cashPinHash
      && record?.cashPinCiphertext
      && record?.cashPinIv
      && record?.cashPinTag
      && typeof record.cashPinExpiresAt === "string"
      && new Date(record.cashPinExpiresAt).getTime() > now.getTime()
      && !record.cashPinUsedAt
      && !record.cashPinLockedAt
      && !record.cashPinInvalidatedAt
  );
}

function verifyCashPin({ record, taskId, clientId, workerId, agreedAmount, pin, secret }) {
  if (!/^\d{4}$/.test(pin)) return false;
  const configuredSecret = requireCashPinSecret(secret);
  const expected = hashCashPin({
    taskId,
    clientId,
    workerId,
    agreedAmount,
    issuedAt: record.cashPinIssuedAt,
    pin
  }, configuredSecret);
  const actual = typeof record.cashPinHash === "string" ? record.cashPinHash : "";
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

module.exports = {
  CASH_PIN_MAX_ATTEMPTS,
  CASH_PIN_MAX_GENERATIONS,
  CASH_PIN_RETRY_COOLDOWN_MS,
  CASH_PIN_TTL_MS,
  decryptCashPin,
  generateCashPinRecord,
  hasActiveCashPin,
  requireCashPinSecret,
  verifyCashPin
};
