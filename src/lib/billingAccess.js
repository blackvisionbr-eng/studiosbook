export function hasBillingAccessNow(subscription, access, now = Date.now()) {
  const confirmedAccessEnd = new Date(
    access?.expiresAt ||
    (access?.reason === "admin_override" ? subscription?.admin_override_until : 0) ||
    0
  ).getTime();
  const serverConfirmedAccess =
    access?.allowed === true &&
    ["admin_override", "paid_period_active", "trial_active"].includes(access?.reason) &&
    Number.isFinite(confirmedAccessEnd) &&
    confirmedAccessEnd > now;
  if (serverConfirmedAccess) return true;

  const revokedStatuses = new Set(["refunded", "charged_back", "blocked", "revoked", "suspended"]);
  const revoked = [
    subscription?.access_revoked_reason,
    subscription?.last_payment_status,
    subscription?.status,
    access?.reason,
    access?.status,
  ].some((value) => revokedStatuses.has(String(value || "").toLowerCase()));
  if (revoked) return false;

  const periodEnd = new Date(subscription?.current_period_end || 0).getTime();
  if (Number.isFinite(periodEnd) && periodEnd > now) return true;
  const trialEnd = new Date(subscription?.trial_end_date || 0).getTime();
  if (Number.isFinite(trialEnd) && trialEnd > now) return true;
  if (!access) return false;
  return false;
}

export function shouldForceBillingTab(subscription, access, now = Date.now()) {
  if (hasBillingAccessNow(subscription, access, now)) return false;

  const hasBillingState = Boolean(subscription || access);
  if (!hasBillingState) return false;

  const currentTime = Number(now);
  const trialEnd = new Date(subscription?.trial_end_date || access?.expiresAt || 0).getTime();
  if (Number.isFinite(trialEnd) && trialEnd > currentTime) return false;

  const periodEnd = new Date(subscription?.current_period_end || 0).getTime();
  if (Number.isFinite(periodEnd) && periodEnd > currentTime) return false;

  const forceStatuses = new Set([
    "admin_suspended",
    "blocked",
    "cancelled",
    "canceled",
    "charged_back",
    "expired",
    "incomplete",
    "incomplete_expired",
    "past_due",
    "payment_failed",
    "refunded",
    "rejected",
    "revoked",
    "suspended",
    "trial_expired",
    "unpaid",
  ]);
  return [
    access?.reason,
    access?.status,
    subscription?.access_revoked_reason,
    subscription?.last_payment_status,
    subscription?.status,
    subscription?.stripe_subscription_status,
  ].some((value) => forceStatuses.has(String(value || "").toLowerCase()));
}

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(Number(value?._seconds))) return Number(value._seconds) * 1000;
  return new Date(value || 0).getTime();
}

export function billingAccessFromRoot(root = {}, now = Date.now()) {
  const status = String(root.billing_status || "expired").toLowerCase();
  const expiresAtMs = timestampMillis(root.access_expires_at);
  const expiresAt = Number.isFinite(expiresAtMs) && expiresAtMs > 0
    ? new Date(expiresAtMs).toISOString()
    : "";
  const reason = String(
    root.access_reason ||
    (status === "authorized" ? "admin_override" :
      status === "suspended" ? "admin_suspended" :
        status === "active" ? "paid_period_active" :
          status === "trialing" ? "trial_active" : status)
  );
  const allowed = root.access_allowed === true && expiresAtMs > now;

  return {
    allowed,
    reason,
    status,
    expiresAt,
    daysLeft: allowed ? Math.ceil((expiresAtMs - now) / 86400000) : 0,
  };
}
