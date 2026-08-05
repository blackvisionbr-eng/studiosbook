import assert from "node:assert/strict";
import test from "node:test";
import { billingAccessFromRoot, hasBillingAccessNow, shouldForceBillingTab } from "../src/lib/billingAccess.js";

test("fails closed when billing validation is unavailable", () => {
  assert.equal(hasBillingAccessNow(null, null, Date.parse("2026-07-03T12:00:00Z")), false);
});

test("allows a confirmed local trial or paid period", () => {
  const now = Date.parse("2026-07-03T12:00:00Z");
  assert.equal(hasBillingAccessNow({ trial_end_date: "2026-07-04T12:00:00Z" }, null, now), true);
  assert.equal(hasBillingAccessNow({ current_period_end: "2026-08-03T12:00:00Z" }, null, now), true);
});

test("supports an explicit backend admin override", () => {
  const now = Date.parse("2026-07-05T12:00:00Z");
  assert.equal(
    hasBillingAccessNow(null, { allowed: true, reason: "admin_override", expiresAt: "2026-07-09T12:00:00Z" }, now),
    true
  );
});

test("an explicit backend admin override wins over an old refunded payment", () => {
  assert.equal(
    hasBillingAccessNow(
      { status: "refunded", last_payment_status: "refunded" },
      { allowed: true, reason: "admin_override", status: "authorized", expiresAt: "2026-07-09T12:00:00Z" },
      Date.parse("2026-07-05T12:00:00Z")
    ),
    true
  );
});

test("a real-time suspension blocks a previously paid local period", () => {
  const now = Date.parse("2026-07-05T12:00:00Z");
  assert.equal(
    hasBillingAccessNow(
      { status: "suspended", current_period_end: "2026-08-05T12:00:00Z" },
      { allowed: false, reason: "admin_suspended", status: "suspended", expiresAt: "" },
      now
    ),
    false
  );
});

test("maps authoritative Firestore access updates for every master action", () => {
  const now = Date.parse("2026-07-05T12:00:00Z");
  assert.deepEqual(
    billingAccessFromRoot(
      {
        access_allowed: true,
        billing_status: "authorized",
        access_reason: "admin_override",
        access_expires_at: "2026-07-09T12:00:00Z",
      },
      now
    ),
    {
      allowed: true,
      reason: "admin_override",
      status: "authorized",
      expiresAt: "2026-07-09T12:00:00.000Z",
      daysLeft: 4,
    }
  );
  assert.equal(
    billingAccessFromRoot(
      { access_allowed: false, billing_status: "suspended", access_reason: "admin_suspended" },
      now
    ).allowed,
    false
  );
  assert.equal(
    billingAccessFromRoot(
      {
        access_allowed: true,
        billing_status: "active",
        access_reason: "paid_period_active",
        access_expires_at: "2026-08-05T12:00:00Z",
      },
      now
    ).allowed,
    true
  );
});

test("an expired manual override is denied without waiting for a backend refresh", () => {
  const now = Date.parse("2026-07-10T12:00:00Z");
  const access = billingAccessFromRoot(
    {
      access_allowed: true,
      billing_status: "authorized",
      access_reason: "admin_override",
      access_expires_at: "2026-07-09T12:00:00Z",
    },
    now
  );
  assert.equal(access.allowed, false);
  assert.equal(hasBillingAccessNow(null, access, now), false);
});

test("refund revocation wins over a future paid period and stale access response", () => {
  const now = Date.parse("2026-07-03T12:00:00Z");
  assert.equal(
    hasBillingAccessNow(
      {
        current_period_end: "2026-08-03T12:00:00Z",
        last_payment_status: "refunded",
      },
      { allowed: true, reason: "paid_period_active" },
      now
    ),
    false
  );
});

test("does not trust a stale paid access response after the period expires", () => {
  const now = Date.parse("2026-07-03T12:00:00Z");
  assert.equal(
    hasBillingAccessNow(
      { current_period_end: "2026-07-02T12:00:00Z" },
      { allowed: true, reason: "paid_period_active" },
      now
    ),
    false
  );
});

test("does not force billing tab while the free trial is still active", () => {
  const now = Date.parse("2026-07-03T12:00:00Z");
  assert.equal(
    shouldForceBillingTab(
      { status: "trialing", trial_end_date: "2026-07-04T12:00:00Z" },
      { allowed: true, reason: "trial_active", status: "trialing", expiresAt: "2026-07-04T12:00:00Z" },
      now
    ),
    false
  );
});

test("forces billing tab only after trial expiration or payment failure", () => {
  const now = Date.parse("2026-07-10T12:00:00Z");
  assert.equal(
    shouldForceBillingTab(
      { status: "expired", trial_end_date: "2026-07-04T12:00:00Z" },
      { allowed: false, reason: "trial_expired", status: "expired", expiresAt: "" },
      now
    ),
    true
  );
  assert.equal(
    shouldForceBillingTab(
      { status: "payment_failed", last_payment_status: "rejected" },
      { allowed: false, reason: "payment_failed", status: "payment_failed", expiresAt: "" },
      now
    ),
    true
  );
});

test("does not force billing tab before billing state is loaded", () => {
  assert.equal(shouldForceBillingTab(null, null, Date.parse("2026-07-10T12:00:00Z")), false);
});
