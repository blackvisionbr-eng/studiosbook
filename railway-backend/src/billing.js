import { createHmac, timingSafeEqual } from "node:crypto";

export const TRIAL_DAYS = 7;
export const PIX_ACCESS_DAYS = 30;

export function isValidCardToken(value) {
  return /^[A-Za-z0-9_-]{16,256}$/.test(String(value || "").trim());
}

export function isValidPayerEmail(value) {
  const email = String(value || "").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function subscriptionChargeStart(trialEnd, now = new Date()) {
  const current = new Date(now);
  const minimumStart = new Date(current.getTime() + 5 * 60 * 1000);
  const parsedTrialEnd = new Date(trialEnd || 0);
  return Number.isFinite(parsedTrialEnd.getTime()) && parsedTrialEnd > minimumStart ? parsedTrialEnd : minimumStart;
}

export function subscriptionRecoveryMode(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "authorized" || normalized === "active") return "reuse";
  if (normalized === "pending" || normalized === "paused") return "replace";
  if (["canceled", "cancelled", "rejected", "expired"].includes(normalized)) return "create";
  return normalized ? "block" : "create";
}

export function latestSubscriptionInvoice(invoices = []) {
  return [...invoices].sort((left, right) => {
    const leftDate = new Date(left?.last_modified || left?.date_created || 0).getTime();
    const rightDate = new Date(right?.last_modified || right?.date_created || 0).getTime();
    return rightDate - leftDate;
  })[0] || null;
}

export function selectBestSubscription(subscriptions = []) {
  const statusScore = {
    active: 5,
    authorized: 5,
    paused: 4,
    pending: 3,
    cancelled: 1,
    canceled: 1,
  };
  return [...subscriptions].sort((left, right) => {
    const leftStatus = statusScore[String(left?.status || "").toLowerCase()] || 0;
    const rightStatus = statusScore[String(right?.status || "").toLowerCase()] || 0;
    if (leftStatus !== rightStatus) return rightStatus - leftStatus;
    const leftDate = new Date(left?.last_modified || left?.date_created || 0).getTime();
    const rightDate = new Date(right?.last_modified || right?.date_created || 0).getTime();
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  })[0] || null;
}

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
  const providerStatus = String(
    subscription.mercado_pago_subscription_status ||
      (["authorized", "active", "paused", "pending", "cancelled", "canceled"].includes(status)
        ? status
        : "")
  ).toLowerCase();
  const paymentStatus = String(subscription.last_payment_status || "").toLowerCase();
  const trialEnd = new Date(subscription.trial_end_date || 0).getTime();
  const periodEnd = new Date(subscription.current_period_end || 0).getTime();
  const trialActive = Number.isFinite(trialEnd) && trialEnd > currentTime;
  const paidPeriodActive = Number.isFinite(periodEnd) && periodEnd > currentTime;

  if (paidPeriodActive) {
    return {
      allowed: true,
      reason: "paid_period_active",
      status: "active",
      daysLeft: Math.ceil((periodEnd - currentTime) / 86400000),
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
  if (failedStatuses.has(paymentStatus) || failedStatuses.has(status)) {
    return { allowed: false, reason: "payment_failed", status: "payment_failed", daysLeft: 0 };
  }

  if (paymentStatus === "approved" && ["authorized", "active"].includes(providerStatus)) {
    return { allowed: true, reason: "approved_payment", status: "active", daysLeft: null };
  }

  if (
    paymentStatus === "pending" ||
    ["pending", "authorized", "active", "paused"].includes(providerStatus)
  ) {
    return { allowed: false, reason: "payment_pending", status: "pending", daysLeft: 0 };
  }

  return {
    allowed: false,
    reason: "trial_expired",
    status: "expired",
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

export function billingReferenceType(value) {
  const parts = String(value || "").split(":");
  if (parts[0] !== "studiosbook") return "";
  return parts[1] === "pix" || parts[1] === "subscription" ? parts[1] : "";
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
