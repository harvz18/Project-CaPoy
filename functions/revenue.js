const DEFAULT_RATE_BASIS_POINTS = 500; // 5.00%; 100 basis points = 1%

function pesosToCentavos(value) {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("A PHP amount is required.");
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Amount must be a valid PHP value.");
  const [whole, fraction = ""] = normalized.split(".");
  const centavos = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(centavos) || centavos <= 0) throw new Error("Amount must be greater than zero.");
  return centavos;
}

function calculateServiceFee(workerWageCentavos, rateBasisPoints = DEFAULT_RATE_BASIS_POINTS) {
  if (!Number.isSafeInteger(workerWageCentavos) || workerWageCentavos <= 0) throw new Error("Worker wage must be a positive centavo amount.");
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10_000) throw new Error("Service fee rate is invalid.");
  // Half-up rounding makes the result deterministic and avoids floating point.
  return Math.floor((workerWageCentavos * rateBasisPoints + 5_000) / 10_000);
}

function toPhp(centavos) {
  if (!Number.isSafeInteger(centavos) || centavos < 0) throw new Error("Centavo value is invalid.");
  return (centavos / 100).toFixed(2);
}

function buildFeeSnapshot({ task, config, now }) {
  const workerWageCentavos = pesosToCentavos(task.agreedAmount);
  const rateBasisPoints = Number.isInteger(config?.rateBasisPoints) ? config.rateBasisPoints : DEFAULT_RATE_BASIS_POINTS;
  const feeCentavos = calculateServiceFee(workerWageCentavos, rateBasisPoints);
  return {
    taskId: task.id,
    employerId: task.clientId,
    workerId: task.workerId,
    taskTitle: task.title || "TaskLink task",
    taskCategory: task.category || "Uncategorized",
    currency: "PHP",
    workerWageCentavos,
    workerWage: toPhp(workerWageCentavos),
    rateBasisPoints,
    feeCentavos,
    feeAmount: toPhp(feeCentavos),
    totalEmployerObligationCentavos: workerWageCentavos + feeCentavos,
    totalEmployerObligation: toPhp(workerWageCentavos + feeCentavos),
    status: "pending_payment",
    destination: {
      gcashAccountName: config.gcashAccountName,
      gcashNumber: config.gcashNumber,
      instructions: config.instructions || "Send the exact TASKLINK service fee, then upload the GCash receipt for review."
    },
    createdAt: now,
    updatedAt: now,
    dueAt: null
  };
}

module.exports = { DEFAULT_RATE_BASIS_POINTS, pesosToCentavos, calculateServiceFee, toPhp, buildFeeSnapshot };
