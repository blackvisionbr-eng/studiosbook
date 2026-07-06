import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeFirestorePayload } from "../src/lib/firestorePayload.js";

test("removes undefined fields before writing to Firestore", () => {
  assert.deepEqual(
    sanitizeFirestorePayload({
      client_id: "client-1",
      retention_percent: undefined,
      details: { technique: "Volume", optional: undefined },
    }),
    {
      client_id: "client-1",
      details: { technique: "Volume" },
    }
  );
});

test("preserves valid falsy values and normalizes undefined array entries", () => {
  const date = new Date("2026-07-05T12:00:00.000Z");
  const result = sanitizeFirestorePayload({
    retention_percent: 0,
    amount: 0,
    notes: "",
    active: false,
    tags: ["premium", undefined],
    procedure_date: date,
  });

  assert.deepEqual(result, {
    retention_percent: 0,
    amount: 0,
    notes: "",
    active: false,
    tags: ["premium", null],
    procedure_date: date,
  });
});
