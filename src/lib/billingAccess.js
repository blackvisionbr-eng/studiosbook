export function hasBillingAccessNow(subscription, access, now = Date.now()) {
  if (access?.allowed === true && access?.reason === "admin_override") return true;

  const revokedStatuses = new Set(["refunded", "charged_back", "blocked", "revoked"]);
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
