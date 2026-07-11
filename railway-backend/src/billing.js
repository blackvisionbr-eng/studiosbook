export const TRIAL_DAYS = 7;
export const PIX_ACCESS_DAYS = 30;

export function stripeKeyMode(value) {
  const key = String(value || "");
  if (/^[sr]k_live_/.test(key)) return "live";
  if (/^[sr]k_test_/.test(key)) return "test";
  return "unconfigured";
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
  const adminOverride = String(subscription.admin_access_override || "").toLowerCase();
  const adminOverrideUntil = new Date(subscription.admin_override_until || 0).getTime();
  const status = String(subscription.status || "not_started").toLowerCase();
  const providerStatus = String(subscription.stripe_subscription_status || "").toLowerCase();
  const paymentStatus = String(subscription.last_payment_status || "").toLowerCase();
  const trialEnd = new Date(subscription.trial_end_date || 0).getTime();
  const periodEnd = new Date(subscription.current_period_end || 0).getTime();
  const trialActive = Number.isFinite(trialEnd) && trialEnd > currentTime;
  const paidPeriodActive = Number.isFinite(periodEnd) && periodEnd > currentTime;

  if (adminOverride === "suspended") {
    return { allowed: false, reason: "admin_suspended", status: "suspended", daysLeft: 0, expiresAt: "" };
  }

  const adminOverrideIsCurrent =
    adminOverride === "active" &&
    Number.isFinite(adminOverrideUntil) &&
    adminOverrideUntil > currentTime;
  if (adminOverrideIsCurrent) {
    return {
      allowed: true,
      reason: "admin_override",
      status: "authorized",
      daysLeft: Math.ceil((adminOverrideUntil - currentTime) / 86400000),
      expiresAt: new Date(adminOverrideUntil).toISOString(),
    };
  }

  const revokedStatuses = new Set(["refunded", "charged_back", "blocked", "revoked"]);
  const revokedStatus = [
    subscription.access_revoked_reason,
    paymentStatus,
    status,
    providerStatus,
  ].find((value) => revokedStatuses.has(String(value || "").toLowerCase()));
  if (revokedStatus) {
    const normalized = String(revokedStatus).toLowerCase();
    return { allowed: false, reason: normalized, status: normalized, daysLeft: 0, expiresAt: "" };
  }

  if (paidPeriodActive) {
    return {
      allowed: true,
      reason: "paid_period_active",
      status: "active",
      daysLeft: Math.ceil((periodEnd - currentTime) / 86400000),
      expiresAt: new Date(periodEnd).toISOString(),
    };
  }

  if (trialActive) {
    return {
      allowed: true,
      reason: "trial_active",
      status: "trialing",
      daysLeft: Math.ceil((trialEnd - currentTime) / 86400000),
      expiresAt: new Date(trialEnd).toISOString(),
    };
  }

  const failedStatuses = new Set([
    "rejected",
    "payment_failed",
    "charged_back",
    "refunded",
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
  ]);
  if (failedStatuses.has(paymentStatus) || failedStatuses.has(status) || failedStatuses.has(providerStatus)) {
    return { allowed: false, reason: "payment_failed", status: "payment_failed", daysLeft: 0, expiresAt: "" };
  }

  if (paymentStatus === "pending" || ["pending", "trialing", "paused"].includes(providerStatus)) {
    return { allowed: false, reason: "payment_pending", status: "pending", daysLeft: 0, expiresAt: "" };
  }

  return { allowed: false, reason: "trial_expired", status: "expired", daysLeft: 0, expiresAt: "" };
}

export function stripeTimestampToIso(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : "";
}

export function stripeSubscriptionPeriod(subscription = {}) {
  const items = subscription?.items?.data || [];
  const starts = [subscription.current_period_start, ...items.map((item) => item?.current_period_start)]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const ends = [subscription.current_period_end, ...items.map((item) => item?.current_period_end)]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return {
    start: starts.length ? stripeTimestampToIso(Math.min(...starts)) : "",
    end: ends.length ? stripeTimestampToIso(Math.max(...ends)) : "",
  };
}

export function stripeInvoicePaymentStatus(invoice = {}) {
  if (invoice.status === "paid" || invoice.paid === true) return "approved";
  if (["open", "draft"].includes(invoice.status)) return "pending";
  if (["void", "uncollectible"].includes(invoice.status)) return "rejected";
  return String(invoice.status || "pending").toLowerCase();
}

export function stripeObjectUid(object = {}) {
  return String(
    object?.metadata?.studiosbook_uid ||
      object?.subscription_details?.metadata?.studiosbook_uid ||
      object?.parent?.subscription_details?.metadata?.studiosbook_uid ||
      object?.client_reference_id ||
      ""
  ).trim();
}

export function validatePixPayment(paymentIntent = {}, options = {}) {
  const expectedAmount = Number(options.expectedAmountCents || 0);
  const amount = Number(paymentIntent.amount || 0);
  const amountReceived = Number(paymentIntent.amount_received || 0);
  const currency = String(paymentIntent.currency || "").toLowerCase();
  const product = String(paymentIntent.metadata?.product || "");

  if (paymentIntent.status !== "succeeded") return { valid: false, reason: "payment_not_succeeded" };
  if (!Number.isInteger(expectedAmount) || expectedAmount <= 0) return { valid: false, reason: "invalid_expected_amount" };
  if (amount !== expectedAmount || amountReceived !== expectedAmount) return { valid: false, reason: "amount_mismatch" };
  if (currency !== String(options.currency || "brl").toLowerCase()) return { valid: false, reason: "currency_mismatch" };
  if (options.productName && product !== options.productName) return { valid: false, reason: "product_mismatch" };
  if (options.requireLiveMode === true && paymentIntent.livemode !== true) return { valid: false, reason: "live_mode_required" };
  return { valid: true, reason: "verified" };
}

export function mercadoPagoPaymentStatus(payment = {}) {
  const status = String(payment.status || "").toLowerCase();
  if (status === "approved") return "approved";
  if (["pending", "in_process", "in_mediation", "authorized"].includes(status)) return "pending";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  if (status === "refunded") return "refunded";
  if (status === "charged_back") return "charged_back";
  if (["rejected", "expired"].includes(status)) return "rejected";
  return status || "pending";
}

export function mercadoPagoPaymentUid(payment = {}) {
  const metadataUid = String(
    payment?.metadata?.studiosbook_uid ||
      payment?.metadata?.user_uid ||
      payment?.additional_info?.items?.[0]?.id ||
      ""
  ).trim();
  if (metadataUid) return metadataUid;

  const externalReference = String(payment.external_reference || "").trim();
  const colonMatch = externalReference.match(/^studiosbook:([^:]+):/);
  if (colonMatch?.[1]) return colonMatch[1];
  const dashMatch = externalReference.match(/^studiosbook-([A-Za-z0-9_-]+)-/);
  return dashMatch?.[1] || "";
}

export function validateMercadoPagoPixPayment(payment = {}, options = {}) {
  const expectedAmount = Number(options.expectedAmount || 0);
  const amount = Number(payment.transaction_amount || 0);
  const currency = String(payment.currency_id || "").toUpperCase();
  const product = String(payment.metadata?.product || "");
  const externalReference = String(payment.external_reference || "");
  const methodId = String(payment.payment_method_id || payment.payment_method?.id || "").toLowerCase();
  const methodType = String(payment.payment_type_id || payment.payment_method?.type || "").toLowerCase();

  if (methodId !== "pix" && methodType !== "bank_transfer") return { valid: false, reason: "payment_method_mismatch" };
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return { valid: false, reason: "invalid_expected_amount" };
  if (Math.abs(amount - expectedAmount) > 0.001) return { valid: false, reason: "amount_mismatch" };
  if (currency && currency !== String(options.currency || "BRL").toUpperCase()) return { valid: false, reason: "currency_mismatch" };
  if (options.productName && product !== options.productName && !externalReference.startsWith("studiosbook:")) {
    return { valid: false, reason: "product_mismatch" };
  }
  if (options.requireLiveMode === true && payment.live_mode !== true) return { valid: false, reason: "live_mode_required" };
  return { valid: true, reason: "verified" };
}

function stripeResourceId(value) {
  return typeof value === "string" ? value : value?.id || "";
}

export function stripeInvoiceSubscriptionId(invoice = {}) {
  return (
    stripeResourceId(invoice.subscription) ||
    stripeResourceId(invoice.parent?.subscription_details?.subscription) ||
    stripeResourceId(invoice.subscription_details?.subscription) ||
    ""
  );
}

export function stripeInvoicePaymentIntentId(invoice = {}) {
  const payments = invoice.payments?.data || [];
  const invoicePayment =
    payments.find((payment) => payment?.status === "paid" && payment?.payment?.payment_intent) ||
    payments.find((payment) => payment?.is_default && payment?.payment?.payment_intent) ||
    payments.find((payment) => payment?.payment?.payment_intent);
  return stripeResourceId(invoicePayment?.payment?.payment_intent) || stripeResourceId(invoice.payment_intent);
}

export function stripeChargeRefundState(charge = {}) {
  const amount = Math.max(0, Number(charge.amount || 0));
  const amountRefunded = Math.max(0, Number(charge.amount_refunded || 0));
  if (amountRefunded <= 0) {
    return { status: "none", full: false, amount, amountRefunded, netAmount: amount };
  }

  const full = charge.refunded === true || (amount > 0 && amountRefunded >= amount);
  return {
    status: full ? "refunded" : "partially_refunded",
    full,
    amount,
    amountRefunded,
    netAmount: Math.max(0, amount - amountRefunded),
  };
}
