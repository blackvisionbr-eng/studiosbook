import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_CODES,
  normalizePlanCode,
  planFromStripePrice,
  planGrantsReceivables,
  validateStripePriceForPlan,
} from "../src/plans.js";

const env = {
  STRIPE_PRICE_ID: "price_agenda",
  STRIPE_RECEIVABLES_PRICE_ID: "price_receivables",
};

test("normalizes unknown plans to Agenda without granting premium access", () => {
  assert.equal(normalizePlanCode("unknown"), PLAN_CODES.AGENDA);
  assert.equal(planGrantsReceivables("unknown"), false);
  assert.equal(planGrantsReceivables(PLAN_CODES.RECEIVABLES), true);
});

test("maps only configured Stripe prices or the controlled lookup key", () => {
  assert.equal(planFromStripePrice({ id: "price_agenda" }, env)?.code, PLAN_CODES.AGENDA);
  assert.equal(planFromStripePrice({ id: "price_receivables" }, env)?.code, PLAN_CODES.RECEIVABLES);
  assert.equal(
    planFromStripePrice({ id: "price_other", lookup_key: "studiosbook_receivables_monthly_brl" }, {})?.code,
    PLAN_CODES.RECEIVABLES
  );
  assert.equal(planFromStripePrice({ id: "price_other", lookup_key: "forged" }, env), null);
});

test("validates amount, currency and monthly recurrence before accepting Recebimentos", () => {
  const price = {
    id: "price_receivables",
    lookup_key: "studiosbook_receivables_monthly_brl",
    active: true,
    currency: "brl",
    unit_amount: 5990,
    type: "recurring",
    recurring: { interval: "month", interval_count: 1 },
  };
  assert.equal(validateStripePriceForPlan(price, PLAN_CODES.RECEIVABLES).valid, true);
  assert.equal(validateStripePriceForPlan({ ...price, unit_amount: 2690 }, PLAN_CODES.RECEIVABLES).reason, "amount_mismatch");
  assert.equal(validateStripePriceForPlan({ ...price, currency: "usd" }, PLAN_CODES.RECEIVABLES).reason, "currency_mismatch");
  assert.equal(validateStripePriceForPlan({ ...price, recurring: { interval: "year", interval_count: 1 } }, PLAN_CODES.RECEIVABLES).reason, "billing_interval_mismatch");
});
