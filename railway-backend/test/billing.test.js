import assert from "node:assert/strict";
import test from "node:test";
import {
  billingAccess,
  stripeInvoicePaymentIntentId,
  stripeInvoicePaymentStatus,
  stripeInvoiceSubscriptionId,
  stripeKeyMode,
  stripeObjectUid,
  stripeSubscriptionPeriod,
  stripeTimestampToIso,
  trialFromAccountCreation,
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

test("active Stripe subscription grants access after trial", () => {
  const access = billingAccess(
    { stripe_subscription_status: "active", trial_end_date: "2026-06-08T12:00:00.000Z" },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.status, "active");
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
