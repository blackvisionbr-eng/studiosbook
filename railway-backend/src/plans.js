export const PLAN_CODES = Object.freeze({
  AGENDA: "studiosbook_agenda",
  RECEIVABLES: "studiosbook_receivables",
});

export const PLAN_CATALOG = Object.freeze({
  [PLAN_CODES.AGENDA]: Object.freeze({
    code: PLAN_CODES.AGENDA,
    name: "StudiosBook Agenda",
    amount: 26.9,
    amountCents: 2690,
    lookupKey: "studiosbook_agenda_monthly_brl",
    recommended: false,
  }),
  [PLAN_CODES.RECEIVABLES]: Object.freeze({
    code: PLAN_CODES.RECEIVABLES,
    name: "StudiosBook Recebimentos",
    amount: 59.9,
    amountCents: 5990,
    lookupKey: "studiosbook_receivables_monthly_brl",
    recommended: true,
  }),
});

export function normalizePlanCode(value) {
  const code = String(value || "").trim().toLowerCase();
  return PLAN_CATALOG[code] ? code : PLAN_CODES.AGENDA;
}

export function planDefinition(value) {
  return PLAN_CATALOG[normalizePlanCode(value)];
}

export function planFromStripePrice(price = {}, env = process.env) {
  const priceId = typeof price === "string" ? price : String(price?.id || "");
  const lookupKey = typeof price === "object" ? String(price?.lookup_key || "") : "";
  if (
    priceId &&
    (priceId === String(env.STRIPE_RECEIVABLES_PRICE_ID || "") ||
      lookupKey === PLAN_CATALOG[PLAN_CODES.RECEIVABLES].lookupKey)
  ) {
    return PLAN_CATALOG[PLAN_CODES.RECEIVABLES];
  }
  if (
    priceId &&
    (priceId === String(env.STRIPE_PRICE_ID || "") ||
      lookupKey === PLAN_CATALOG[PLAN_CODES.AGENDA].lookupKey)
  ) {
    return PLAN_CATALOG[PLAN_CODES.AGENDA];
  }
  return null;
}

export function planGrantsReceivables(planCode) {
  return normalizePlanCode(planCode) === PLAN_CODES.RECEIVABLES;
}

export function validateStripePriceForPlan(price = {}, requestedPlanCode) {
  const plan = planDefinition(requestedPlanCode);
  if (price?.active !== true) return { valid: false, reason: "inactive_price" };
  if (String(price?.currency || "").toLowerCase() !== "brl") return { valid: false, reason: "currency_mismatch" };
  if (Number(price?.unit_amount || 0) !== plan.amountCents) return { valid: false, reason: "amount_mismatch" };
  if (price?.type !== "recurring" || price?.recurring?.interval !== "month" || Number(price?.recurring?.interval_count || 1) !== 1) {
    return { valid: false, reason: "billing_interval_mismatch" };
  }
  const detected = planFromStripePrice(price);
  if (!detected || detected.code !== plan.code) return { valid: false, reason: "plan_mismatch" };
  return { valid: true, reason: "verified", plan };
}
