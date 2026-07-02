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
  const status = String(subscription.status || "not_started").toLowerCase();
  const providerStatus = String(subscription.stripe_subscription_status || "").toLowerCase();
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
    return { allowed: false, reason: "payment_failed", status: "payment_failed", daysLeft: 0 };
  }

  if (paymentStatus === "approved" || providerStatus === "active") {
    return { allowed: true, reason: "approved_payment", status: "active", daysLeft: null };
  }

  if (paymentStatus === "pending" || ["pending", "trialing", "paused"].includes(providerStatus)) {
    return { allowed: false, reason: "payment_pending", status: "pending", daysLeft: 0 };
  }

  return { allowed: false, reason: "trial_expired", status: "expired", daysLeft: 0 };
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
