import assert from "node:assert/strict";
import test from "node:test";
import {
  billingAccess,
  mercadoPagoPaymentStatus,
  mercadoPagoPaymentUid,
  stripeChargeRefundState,
  stripeInvoicePaymentIntentId,
  stripeInvoicePaymentStatus,
  stripeInvoiceSubscriptionId,
  stripeKeyMode,
  stripeObjectUid,
  stripeSubscriptionPeriod,
  stripeTimestampToIso,
  trialFromAccountCreation,
  validateMercadoPagoPixPayment,
  validatePixPayment,
} from "../src/billing.js";

test("trial starts at Firebase account creation", () => {
  const trial = trialFromAccountCreation("2026-06-01T12:00:00.000Z", new Date("2026-06-05T12:00:00.000Z"));
  assert.equal(trial.start.toISOString(), "2026-06-01T12:00:00.000Z");
  assert.equal(trial.end.toISOString(), "2026-06-08T12:00:00.000Z");
  assert.equal(trial.daysLeft, 3);
  assert.equal(trial.active, true);
});

test("expired trial blocks access", () => {
  const access = billingAccess(
    { status: "trialing", trial_end_date: "2026-06-08T12:00:00.000Z" },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.status, "expired");
});

test("active Stripe subscription grants access only during a confirmed paid period", () => {
  const access = billingAccess(
    {
      stripe_subscription_status: "active",
      trial_end_date: "2026-06-08T12:00:00.000Z",
      current_period_end: "2026-07-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.status, "active");
});

test("stale approved status does not grant access after the paid period", () => {
  const access = billingAccess(
    {
      stripe_subscription_status: "active",
      last_payment_status: "approved",
      current_period_end: "2026-06-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.status, "expired");
});

test("past due Stripe subscription blocks access", () => {
  const access = billingAccess(
    { stripe_subscription_status: "past_due", last_payment_status: "rejected" },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.status, "payment_failed");
});

test("paid period remains active during a later failed attempt", () => {
  const access = billingAccess(
    {
      stripe_subscription_status: "past_due",
      last_payment_status: "rejected",
      current_period_end: "2026-07-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.status, "active");
});

test("full refund revokes access even when the stored paid period is still in the future", () => {
  const access = billingAccess(
    {
      stripe_subscription_status: "active",
      last_payment_status: "refunded",
      current_period_end: "2026-07-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.status, "refunded");
});

test("persistent refund revocation cannot be overwritten by a stale approved invoice", () => {
  const access = billingAccess(
    {
      access_revoked_reason: "refunded",
      last_payment_status: "approved",
      current_period_end: "2026-07-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "refunded");
});

test("a current master admin override grants time-limited access", () => {
  const access = billingAccess(
    {
      admin_access_override: "active",
      admin_override_until: "2026-07-09T12:00:00.000Z",
      admin_override_updated_at: "2026-07-01T12:00:00.000Z",
      status: "expired",
    },
    new Date("2026-07-05T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "admin_override");
  assert.equal(access.daysLeft, 4);
});

test("a master admin suspension blocks an otherwise paid subscription", () => {
  const access = billingAccess(
    {
      admin_access_override: "suspended",
      stripe_subscription_status: "active",
      current_period_end: "2026-08-05T12:00:00.000Z",
    },
    new Date("2026-07-05T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "admin_suspended");
  assert.equal(access.status, "suspended");
});

test("a time-limited master grant remains authoritative after a refund", () => {
  const access = billingAccess(
    {
      admin_access_override: "active",
      admin_override_until: "2026-08-05T12:00:00.000Z",
      admin_override_updated_at: "2026-07-01T12:00:00.000Z",
      access_revoked_at: "2026-07-03T12:00:00.000Z",
      access_revoked_reason: "refunded",
    },
    new Date("2026-07-05T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "admin_override");
});

test("a new explicit master grant can restore access after a refund", () => {
  const access = billingAccess(
    {
      admin_access_override: "active",
      admin_override_until: "2026-08-05T12:00:00.000Z",
      admin_override_updated_at: "2026-07-04T12:00:00.000Z",
      access_revoked_at: "2026-07-03T12:00:00.000Z",
      access_revoked_reason: "refunded",
    },
    new Date("2026-07-05T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "admin_override");
});

test("maps Stripe invoice states to local payment states", () => {
  assert.equal(stripeInvoicePaymentStatus({ status: "paid" }), "approved");
  assert.equal(stripeInvoicePaymentStatus({ status: "open" }), "pending");
  assert.equal(stripeInvoicePaymentStatus({ status: "uncollectible" }), "rejected");
});

test("reads subscription periods from Stripe items", () => {
  const period = stripeSubscriptionPeriod({
    items: {
      data: [
        { current_period_start: 1782864000, current_period_end: 1785542400 },
        { current_period_start: 1782867600, current_period_end: 1785628800 },
      ],
    },
  });
  assert.equal(period.start, stripeTimestampToIso(1782864000));
  assert.equal(period.end, stripeTimestampToIso(1785628800));
});

test("extracts the StudiosBook UID from Stripe metadata", () => {
  assert.equal(stripeObjectUid({ metadata: { studiosbook_uid: "user-1" } }), "user-1");
  assert.equal(
    stripeObjectUid({ parent: { subscription_details: { metadata: { studiosbook_uid: "user-2" } } } }),
    "user-2"
  );
  assert.equal(stripeObjectUid({ client_reference_id: "user-3" }), "user-3");
});

test("reads subscription and payment intent from current Stripe invoice fields", () => {
  const invoice = {
    parent: { subscription_details: { subscription: "sub_current" } },
    payments: {
      data: [
        {
          status: "paid",
          is_default: true,
          payment: { type: "payment_intent", payment_intent: "pi_current" },
        },
      ],
    },
  };
  assert.equal(stripeInvoiceSubscriptionId(invoice), "sub_current");
  assert.equal(stripeInvoicePaymentIntentId(invoice), "pi_current");
});

test("recognizes standard and restricted Stripe key modes", () => {
  assert.equal(stripeKeyMode("sk_live_example"), "live");
  assert.equal(stripeKeyMode("rk_live_example"), "live");
  assert.equal(stripeKeyMode("sk_test_example"), "test");
  assert.equal(stripeKeyMode("rk_test_example"), "test");
  assert.equal(stripeKeyMode(""), "unconfigured");
});

test("accepts only a succeeded Pix with the expected product, currency and amount", () => {
  const validPayment = {
    status: "succeeded",
    amount: 2690,
    amount_received: 2690,
    currency: "brl",
    livemode: true,
    metadata: { product: "StudiosBook" },
  };
  const options = {
    expectedAmountCents: 2690,
    currency: "brl",
    productName: "StudiosBook",
    requireLiveMode: true,
  };
  assert.deepEqual(validatePixPayment(validPayment, options), { valid: true, reason: "verified" });
  assert.equal(validatePixPayment({ ...validPayment, amount_received: 100 }, options).reason, "amount_mismatch");
  assert.equal(validatePixPayment({ ...validPayment, currency: "usd" }, options).reason, "currency_mismatch");
  assert.equal(validatePixPayment({ ...validPayment, livemode: false }, options).reason, "live_mode_required");
  assert.equal(validatePixPayment({ ...validPayment, metadata: { product: "Outro" } }, options).reason, "product_mismatch");
});

test("maps Mercado Pago statuses to local payment states", () => {
  assert.equal(mercadoPagoPaymentStatus({ status: "approved" }), "approved");
  assert.equal(mercadoPagoPaymentStatus({ status: "in_process" }), "pending");
  assert.equal(mercadoPagoPaymentStatus({ status: "cancelled" }), "cancelled");
  assert.equal(mercadoPagoPaymentStatus({ status: "charged_back" }), "charged_back");
  assert.equal(mercadoPagoPaymentStatus({ status: "expired" }), "rejected");
});

test("extracts StudiosBook UID from Mercado Pago metadata and external reference", () => {
  assert.equal(mercadoPagoPaymentUid({ metadata: { studiosbook_uid: "user-1" } }), "user-1");
  assert.equal(mercadoPagoPaymentUid({ external_reference: "studiosbook:user-2:attempt-1" }), "user-2");
});

test("validates Mercado Pago Pix payment before granting access", () => {
  const validPayment = {
    status: "approved",
    transaction_amount: 26.9,
    currency_id: "BRL",
    payment_method_id: "pix",
    payment_type_id: "bank_transfer",
    live_mode: true,
    metadata: { product: "StudiosBook" },
  };
  const options = {
    expectedAmount: 26.9,
    currency: "BRL",
    productName: "StudiosBook",
    requireLiveMode: true,
  };
  assert.deepEqual(validateMercadoPagoPixPayment(validPayment, options), { valid: true, reason: "verified" });
  assert.deepEqual(
    validateMercadoPagoPixPayment({ ...validPayment, metadata: {}, external_reference: "studiosbook:user-1:attempt-1" }, options),
    { valid: true, reason: "verified" }
  );
  assert.equal(validateMercadoPagoPixPayment({ ...validPayment, transaction_amount: 10 }, options).reason, "amount_mismatch");
  assert.equal(validateMercadoPagoPixPayment({ ...validPayment, currency_id: "USD" }, options).reason, "currency_mismatch");
  assert.equal(validateMercadoPagoPixPayment({ ...validPayment, metadata: {} }, options).reason, "product_mismatch");
  assert.equal(validateMercadoPagoPixPayment({ ...validPayment, payment_method_id: "visa", payment_type_id: "credit_card" }, options).reason, "payment_method_mismatch");
  assert.equal(validateMercadoPagoPixPayment({ ...validPayment, live_mode: false }, options).reason, "live_mode_required");
});

test("classifies Stripe charge refunds without revoking on a partial refund", () => {
  assert.deepEqual(stripeChargeRefundState({ amount: 2690, amount_refunded: 0 }), {
    status: "none",
    full: false,
    amount: 2690,
    amountRefunded: 0,
    netAmount: 2690,
  });
  assert.deepEqual(stripeChargeRefundState({ amount: 2690, amount_refunded: 1000 }), {
    status: "partially_refunded",
    full: false,
    amount: 2690,
    amountRefunded: 1000,
    netAmount: 1690,
  });
  assert.deepEqual(stripeChargeRefundState({ amount: 2690, amount_refunded: 2690, refunded: true }), {
    status: "refunded",
    full: true,
    amount: 2690,
    amountRefunded: 2690,
    netAmount: 0,
  });
});
