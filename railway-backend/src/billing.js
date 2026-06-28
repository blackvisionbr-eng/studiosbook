import { createHmac, timingSafeEqual } from "node:crypto";

export const TRIAL_DAYS = 7;
export const PIX_ACCESS_DAYS = 30;

export function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function trialFromAccountCreation(creationTime, now = new Date()) {
  const parsedCreation = new Date(creationTime || now);
  const start = Number.isNaN(parsedCreation.getTime()) ? new Date(now) : parsedCreation;
  const end = addDays(start, TRIAL_DAYS);
  const remainingMs = Math.max(0, end.getTime() - new Date(now).getTime());

  return {
    start,
    end,
    active: remainingMs > 0,
    daysLeft: Math.ceil(remainingMs / 86400000),
  };
}

export function billingAccess(subscription = {}, now = new Date()) {
  const currentTime = new Date(now).getTime();
  const status = String(subscription.status || "not_started").toLowerCase();
  const trialEnd = new Date(subscription.trial_end_date || 0).getTime();
  const periodEnd = new Date(subscription.current_period_end || 0).getTime();
  const trialActive = Number.isFinite(trialEnd) && trialEnd > currentTime;
  const paidPeriodActive = Number.isFinite(periodEnd) && periodEnd > currentTime;
  const recurringActive = status === "authorized" || status === "active";

  if (recurringActive || paidPeriodActive) {
    return {
      allowed: true,
      reason: recurringActive ? "subscription_active" : "paid_period_active",
      status: recurringActive ? status : "active",
      daysLeft: paidPeriodActive ? Math.ceil((periodEnd - currentTime) / 86400000) : null,
    };
  }

  if (trialActive) {
    return {
      allowed: true,
      reason: "trial_active",
      status: "trialing",
      daysLeft: Math.ceil((trialEnd - currentTime) / 86400000),
    };
  }

  const failedStatuses = new Set(["rejected", "payment_failed", "charged_back", "refunded"]);
  return {
    allowed: false,
    reason: failedStatuses.has(status) ? "payment_failed" : "trial_expired",
    status: failedStatuses.has(status) ? "payment_failed" : status === "pending" ? "pending" : "expired",
    daysLeft: 0,
  };
}

export function normalizeCpf(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (factor) => {
    let total = 0;
    for (let index = 0; index < factor - 1; index += 1) {
      total += Number(cpf[index]) * (factor - index);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(10) === Number(cpf[9]) && digit(11) === Number(cpf[10]);
}

export function parseWebhookSignature(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().split("=", 2))
    .reduce((result, [key, item]) => {
      if (key && item) result[key] = item;
      return result;
    }, {});
}

export function webhookManifest({ dataId, requestId, timestamp }) {
  return `id:${dataId};request-id:${requestId};ts:${timestamp};`;
}

export function createWebhookSignature({ dataId, requestId, timestamp, secret }) {
  const manifest = webhookManifest({ dataId, requestId, timestamp });
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

export function validateWebhookSignature({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;
  const { ts, v1 } = parseWebhookSignature(xSignature);
  if (!ts || !v1) return false;

  const expected = createWebhookSignature({
    dataId: String(dataId).toLowerCase(),
    requestId: xRequestId,
    timestamp: ts,
    secret,
  });
  const receivedBuffer = Buffer.from(v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (!receivedBuffer.length || receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function uidFromExternalReference(value) {
  const parts = String(value || "").split(":");
  if (parts[0] !== "studiosbook") return "";
  if (parts[1] === "pix" || parts[1] === "subscription") return parts[2] || "";
  return parts[1] || "";
}

export function localPaymentStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "pending" || normalized === "in_process") return "pending";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "refunded") return "refunded";
  if (normalized === "charged_back") return "charged_back";
  return normalized || "pending";
}
