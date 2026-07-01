import assert from "node:assert/strict";
import test from "node:test";
import {
  billingAccess,
  billingReferenceType,
  cardSubscriptionIdempotencyKey,
  createWebhookSignature,
  isValidCpf,
  isValidCardToken,
  isValidPayerEmail,
  latestSubscriptionInvoice,
  mercadoPagoCardErrorMessage,
  selectBestSubscription,
  subscriptionRecoveryMode,
  subscriptionChargeStart,
  trialFromAccountCreation,
  uidFromExternalReference,
  validateWebhookSignature,
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

test("approved Pix period keeps access active", () => {
  const access = billingAccess(
    { status: "active", current_period_end: "2026-07-20T12:00:00.000Z" },
    new Date("2026-06-20T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.status, "active");
});

test("authorized subscription does not hide a rejected payment", () => {
  const access = billingAccess(
    {
      status: "authorized",
      mercado_pago_subscription_status: "authorized",
      last_payment_status: "rejected",
      trial_end_date: "2026-06-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.status, "payment_failed");
});

test("paid period remains active after a later rejected attempt", () => {
  const access = billingAccess(
    {
      mercado_pago_subscription_status: "authorized",
      last_payment_status: "rejected",
      current_period_end: "2026-07-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, true);
  assert.equal(access.status, "active");
});

test("authorized subscription waits for payment after the trial", () => {
  const access = billingAccess(
    {
      mercado_pago_subscription_status: "authorized",
      trial_end_date: "2026-06-08T12:00:00.000Z",
    },
    new Date("2026-06-09T12:00:00.000Z")
  );
  assert.equal(access.allowed, false);
  assert.equal(access.status, "pending");
});

test("validates CPF checksum", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("529.982.247-24"), false);
});

test("validates Mercado Pago webhook HMAC", () => {
  const secret = "webhook-test-secret";
  const dataId = "123456";
  const requestId = "request-123";
  const timestamp = "1750000000000";
  const signature = createWebhookSignature({ dataId, requestId, timestamp, secret });

  assert.equal(
    validateWebhookSignature({
      xSignature: `ts=${timestamp},v1=${signature}`,
      xRequestId: requestId,
      dataId,
      secret,
    }),
    true
  );
  assert.equal(
    validateWebhookSignature({
      xSignature: `ts=${timestamp},v1=${"0".repeat(64)}`,
      xRequestId: requestId,
      dataId,
      secret,
    }),
    false
  );
});

test("extracts user UID from billing references", () => {
  assert.equal(uidFromExternalReference("studiosbook:pix:user-1:payment-1"), "user-1");
  assert.equal(uidFromExternalReference("studiosbook:user-2:subscription-1"), "user-2");
  assert.equal(uidFromExternalReference("another-product:user-3"), "");
});

test("classifies StudiosBook billing references", () => {
  assert.equal(billingReferenceType("studiosbook:pix:user-1:payment-1"), "pix");
  assert.equal(billingReferenceType("studiosbook:subscription:user-2:checkout-1"), "subscription");
  assert.equal(billingReferenceType("studiosbook:user-3:legacy"), "");
  assert.equal(billingReferenceType("another-product:pix:user-4"), "");
});

test("validates Mercado Pago card tokens without accepting arbitrary input", () => {
  assert.equal(isValidCardToken("e3ed6f098462036dd2cbabe314b9de2a"), true);
  assert.equal(isValidCardToken("short"), false);
  assert.equal(isValidCardToken("token with spaces and card data"), false);
});

test("validates the payer email independently from the authenticated account", () => {
  assert.equal(isValidPayerEmail("cliente@example.com"), true);
  assert.equal(isValidPayerEmail("cliente sem email"), false);
  assert.equal(isValidPayerEmail("@example.com"), false);
});

test("keeps the Mercado Pago idempotency key stable for the same card attempt", () => {
  const first = cardSubscriptionIdempotencyKey("user-1", "attempt-1");
  const retry = cardSubscriptionIdempotencyKey("user-1", "attempt-1");
  const nextAttempt = cardSubscriptionIdempotencyKey("user-1", "attempt-2");
  assert.equal(first, retry);
  assert.notEqual(first, nextAttempt);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("translates Mercado Pago card rejection reasons", () => {
  assert.match(
    mercadoPagoCardErrorMessage("cc_rejected_bad_filled_security_code"),
    /código de segurança/i
  );
  assert.match(
    mercadoPagoCardErrorMessage("Card token was used, please generate new"),
    /tentativa anterior expirou/i
  );
  assert.match(mercadoPagoCardErrorMessage("cc_rejected_high_risk"), /segurança/i);
});

test("schedules recurring charge at trial end or five minutes from now", () => {
  const now = new Date("2026-06-29T20:00:00.000Z");
  assert.equal(
    subscriptionChargeStart("2026-07-02T20:00:00.000Z", now).toISOString(),
    "2026-07-02T20:00:00.000Z"
  );
  assert.equal(
    subscriptionChargeStart("2026-06-20T20:00:00.000Z", now).toISOString(),
    "2026-06-29T20:05:00.000Z"
  );
});

test("recovers a previous Mercado Pago subscription without creating duplicates", () => {
  assert.equal(subscriptionRecoveryMode("authorized"), "reuse");
  assert.equal(subscriptionRecoveryMode("pending"), "replace");
  assert.equal(subscriptionRecoveryMode("paused"), "replace");
  assert.equal(subscriptionRecoveryMode("canceled"), "create");
  assert.equal(subscriptionRecoveryMode(""), "create");
  assert.equal(subscriptionRecoveryMode("unknown_provider_state"), "block");
});

test("selects the latest subscription invoice for reconciliation", () => {
  const latest = latestSubscriptionInvoice([
    { id: "older", last_modified: "2026-06-29T20:00:00.000Z" },
    { id: "newer", last_modified: "2026-06-29T21:00:00.000Z" },
  ]);
  assert.equal(latest.id, "newer");
  assert.equal(latestSubscriptionInvoice([]), null);
});

test("prefers an authorized subscription over newer orphan pending attempts", () => {
  const selected = selectBestSubscription([
    { id: "pending-new", status: "pending", last_modified: "2026-06-30T12:00:00.000Z" },
    { id: "authorized-old", status: "authorized", last_modified: "2026-06-29T12:00:00.000Z" },
  ]);
  assert.equal(selected.id, "authorized-old");
});
