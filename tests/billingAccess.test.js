import assert from "node:assert/strict";
import test from "node:test";
import { hasBillingAccessNow } from "../src/lib/billingAccess.js";

test("fails closed when billing validation is unavailable", () => {
  assert.equal(hasBillingAccessNow(null, null, Date.parse("2026-07-03T12:00:00Z")), false);
});

test("allows a confirmed local trial or paid period", () => {
  const now = Date.parse("2026-07-03T12:00:00Z");
  assert.equal(hasBillingAccessNow({ trial_end_date: "2026-07-04T12:00:00Z" }, null, now), true);
  assert.equal(hasBillingAccessNow({ current_period_end: "2026-08-03T12:00:00Z" }, null, now), true);
});

test("supports an explicit backend admin override", () => {
  assert.equal(hasBillingAccessNow(null, { allowed: true, reason: "admin_override" }, Date.now()), true);
});

test("an explicit backend admin override wins over an old refunded payment", () => {
  assert.equal(
    hasBillingAccessNow(
      { status: "refunded", last_payment_status: "refunded" },
      { allowed: true, reason: "admin_override", status: "authorized" },
      Date.now()
    ),
    true
  );
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
