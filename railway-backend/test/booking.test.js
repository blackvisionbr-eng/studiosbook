import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import {
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
  bookingChargeCents,
  bookingStatusForPayment,
  generateAvailabilitySlots,
  isActiveSlotLock,
  normalizeBookingSlug,
  paymentStatusFromMercadoPago,
  platformFeeCents,
  slotBucketKeys,
} from "../src/booking.js";
import { marketplaceBookingInternals } from "../src/marketplaceBooking.js";

test("normalizes a public booking slug", () => {
  assert.equal(normalizeBookingSlug("Studio Bia Rocha - Itacaré"), "studio-bia-rocha-itacare");
});

test("calculates full, deposit and optional charges", () => {
  assert.equal(bookingChargeCents(12000, { payment_mode: "full" }), 12000);
  assert.equal(bookingChargeCents(12000, { payment_mode: "deposit", deposit_percent: 30 }), 3600);
  assert.equal(bookingChargeCents(12000, { payment_mode: "optional" }), 0);
});

test("caps the StudiosBook transaction fee", () => {
  assert.equal(platformFeeCents(10000, { percent: 0.79, remainingCapCents: 5990 }), 79);
  assert.equal(platformFeeCents(10000, { percent: 0.79, remainingCapCents: 20 }), 20);
});

test("creates deterministic fifteen-minute locks for the full service duration", () => {
  assert.deepEqual(
    slotBucketKeys({ professionalId: "pro-1", date: "2026-09-15", time: "09:30", durationMinutes: 60 }),
    [
      "pro-1_2026-09-15_0570",
      "pro-1_2026-09-15_0585",
      "pro-1_2026-09-15_0600",
      "pro-1_2026-09-15_0615",
    ]
  );
});

test("removes times that overlap existing appointments", () => {
  const slots = generateAvailabilitySlots({
    schedule: { enabled: true, start: "09:00", end: "12:00" },
    durationMinutes: 60,
    intervalMinutes: 30,
    busyRanges: [{ start: "10:00", end: "11:00" }],
  });
  assert.deepEqual(slots, [
    { start: "09:00", end: "10:00" },
    { start: "11:00", end: "12:00" },
  ]);
});

test("maps provider events without trusting the browser", () => {
  assert.equal(paymentStatusFromMercadoPago({ status: "approved", transaction_amount: 30 }), "approved");
  assert.equal(paymentStatusFromMercadoPago({ status: "rejected" }), "rejected");
  assert.equal(
    paymentStatusFromMercadoPago({ status: "approved", transaction_amount: 30, transaction_amount_refunded: 30 }),
    "refunded"
  );
  assert.equal(bookingStatusForPayment(BOOKING_PAYMENT_STATUSES.APPROVED), BOOKING_STATUSES.CONFIRMED);
  assert.equal(bookingStatusForPayment(BOOKING_PAYMENT_STATUSES.REFUNDED), BOOKING_STATUSES.CANCELLED);
});

test("expired pending locks stop blocking while confirmed locks remain active", () => {
  const now = new Date("2026-09-15T12:00:00.000Z").getTime();
  assert.equal(isActiveSlotLock({ status: "pending_payment", expires_at: "2026-09-15T11:59:00.000Z" }, now), false);
  assert.equal(isActiveSlotLock({ status: "pending_payment", expires_at: "2026-09-15T12:01:00.000Z" }, now), true);
  assert.equal(isActiveSlotLock({ status: "confirmed", expires_at: "2026-09-15T11:00:00.000Z" }, now), true);
});

test("verifies Mercado Pago webhook signatures with constant-time comparison", () => {
  const secret = "webhook-secret";
  const dataId = "123456";
  const requestId = "request-abc";
  const timestamp = "1789351200";
  const signature = createHmac("sha256", secret)
    .update(`id:${dataId};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");
  const request = {
    query: { "data.id": dataId },
    body: {},
    headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
  };
  assert.equal(marketplaceBookingInternals.validateWebhookSignature(request, secret).valid, true);
  assert.equal(marketplaceBookingInternals.validateWebhookSignature(request, "wrong-secret").valid, false);
});

test("verifies Mercado Pago simulator signatures when data.id exists only in the body", () => {
  const secret = "webhook-secret";
  const requestId = "request-simulator";
  const timestamp = "1789351200";
  const signature = createHmac("sha256", secret)
    .update(`request-id:${requestId};ts:${timestamp};`)
    .digest("hex");
  const request = {
    query: {},
    body: { data: { id: "123456" } },
    headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
  };
  const validation = marketplaceBookingInternals.validateWebhookSignature(request, secret);
  assert.equal(validation.valid, true);
  assert.equal(validation.dataId, "123456");
});

test("normalizes alphanumeric query IDs before validating Mercado Pago signatures", () => {
  const secret = "webhook-secret";
  const requestId = "request-order";
  const timestamp = "1789351200";
  const dataId = "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3";
  const signature = createHmac("sha256", secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");
  const request = {
    query: { "data.id": dataId },
    body: {},
    headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
  };
  assert.equal(marketplaceBookingInternals.validateWebhookSignature(request, secret).valid, true);
});

test("resolves a global Mercado Pago webhook to the connected studio", async () => {
  const db = {
    collection(name) {
      assert.equal(name, "MarketplaceSeller");
      return {
        doc(id) {
          assert.equal(id, "188818353");
          return {
            async get() {
              return {
                exists: true,
                data: () => ({ active: true, studio_id: "studio-owner-1" }),
              };
            },
          };
        },
      };
    },
  };
  const resolved = await marketplaceBookingInternals.resolveWebhookStudio(db, {
    query: {},
    body: { user_id: 188818353 },
  });
  assert.deepEqual(resolved, { studioId: "studio-owner-1", mercadoPagoUserId: "188818353" });
});

test("rejects a webhook that tries to cross connected studios", async () => {
  const db = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return {
                exists: true,
                data: () => ({ active: true, studio_id: "studio-owner-1" }),
              };
            },
          };
        },
      };
    },
  };
  await assert.rejects(
    marketplaceBookingInternals.resolveWebhookStudio(db, {
      query: { studio_id: "studio-owner-2" },
      body: { user_id: 188818353 },
    }),
    /outro studio/
  );
});

test("marks a signed webhook from an unmapped seller as safe to acknowledge", async () => {
  const db = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return { exists: false, data: () => undefined };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    marketplaceBookingInternals.resolveWebhookStudio(db, {
      query: {},
      body: { user_id: 188818353 },
    }),
    (error) => error?.code === "WEBHOOK_STUDIO_UNMAPPED" && error?.statusCode === 400
  );
});

test("encrypts marketplace credentials before persistence", () => {
  const previous = process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY;
  process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    const encrypted = marketplaceBookingInternals.encryptSecret("seller-access-token");
    assert.notEqual(encrypted, "seller-access-token");
    assert.equal(marketplaceBookingInternals.decryptSecret(encrypted), "seller-access-token");
  } finally {
    if (previous === undefined) delete process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY;
    else process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY = previous;
  }
});
