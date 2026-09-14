import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_CODES, PLAN_DETAILS, planDetails } from "../src/lib/plans.js";

test("exposes the Recebimentos plan as the recommended complete offer", () => {
  const plan = PLAN_DETAILS[PLAN_CODES.RECEIVABLES];
  assert.equal(plan.recommended, true);
  assert.equal(plan.amount, 59.9);
  assert.match(plan.features.join(" "), /agendamento on-line/i);
  assert.match(plan.features.join(" "), /Pix e cartão/i);
});

test("falls back to Agenda for unknown display values", () => {
  assert.equal(planDetails("unknown").code, PLAN_CODES.AGENDA);
});
