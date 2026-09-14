export const BOOKING_STATUSES = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PAYMENT_REVIEW: "payment_review",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
});

export const BOOKING_PAYMENT_STATUSES = Object.freeze({
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
  CHARGED_BACK: "charged_back",
});

const PAYMENT_MODES = new Set(["full", "deposit", "optional"]);
const TERMINAL_PAYMENT_STATUSES = new Set([
  BOOKING_PAYMENT_STATUSES.REJECTED,
  BOOKING_PAYMENT_STATUSES.CANCELLED,
  BOOKING_PAYMENT_STATUSES.EXPIRED,
  BOOKING_PAYMENT_STATUSES.REFUNDED,
  BOOKING_PAYMENT_STATUSES.CHARGED_BACK,
]);

export function normalizeBookingSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function moneyToCents(value) {
  const amount = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function centsToMoney(value) {
  return Math.max(0, Number(value) || 0) / 100;
}

export function normalizePaymentMode(value) {
  const mode = String(value || "deposit").toLowerCase();
  return PAYMENT_MODES.has(mode) ? mode : "deposit";
}

export function bookingChargeCents(servicePriceCents, settings = {}) {
  const price = Math.max(0, Math.round(Number(servicePriceCents) || 0));
  const mode = normalizePaymentMode(settings.payment_mode);
  if (settings.payment_required === false || mode === "optional") return 0;
  if (mode === "full") return price;
  const percent = Math.min(100, Math.max(1, Number(settings.deposit_percent) || 30));
  return Math.min(price, Math.max(1, Math.round((price * percent) / 100)));
}

export function platformFeeCents(amountCents, options = {}) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  const percent = Math.min(100, Math.max(0, Number(options.percent) || 0));
  const remainingCap = Math.max(0, Math.round(Number(options.remainingCapCents) || 0));
  if (!amount || !percent || !remainingCap) return 0;
  return Math.min(remainingCap, Math.max(1, Math.round((amount * percent) / 100)));
}

export function minutesFromTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function timeFromMinutes(value) {
  const total = Math.max(0, Math.min(24 * 60 - 1, Math.round(Number(value) || 0)));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function slotBucketKeys({ professionalId, date, time, durationMinutes, bucketMinutes = 15 }) {
  const start = minutesFromTime(time);
  const duration = Math.max(bucketMinutes, Math.round(Number(durationMinutes) || 0));
  if (!professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || start === null) return [];
  const end = Math.min(24 * 60, start + duration);
  const keys = [];
  for (let cursor = Math.floor(start / bucketMinutes) * bucketMinutes; cursor < end; cursor += bucketMinutes) {
    keys.push(`${professionalId}_${date}_${String(cursor).padStart(4, "0")}`);
  }
  return keys;
}

function rangesOverlap(start, end, range) {
  const busyStart = minutesFromTime(range.start);
  const busyEnd = minutesFromTime(range.end);
  return busyStart !== null && busyEnd !== null && start < busyEnd && end > busyStart;
}

export function generateAvailabilitySlots({
  schedule,
  durationMinutes,
  intervalMinutes = 15,
  busyRanges = [],
}) {
  if (!schedule?.enabled) return [];
  const start = minutesFromTime(schedule.start);
  const end = minutesFromTime(schedule.end);
  const duration = Math.max(15, Math.round(Number(durationMinutes) || 0));
  const interval = Math.max(5, Math.round(Number(intervalMinutes) || 15));
  if (start === null || end === null || end <= start || duration > end - start) return [];

  const slots = [];
  for (let cursor = start; cursor + duration <= end; cursor += interval) {
    const slotEnd = cursor + duration;
    if (!busyRanges.some((range) => rangesOverlap(cursor, slotEnd, range))) {
      slots.push({ start: timeFromMinutes(cursor), end: timeFromMinutes(slotEnd) });
    }
  }
  return slots;
}

export function paymentStatusFromMercadoPago(payment = {}) {
  const status = String(payment.status || "").toLowerCase();
  if (status === "approved") {
    const paid = Math.max(0, Number(payment.transaction_amount || 0));
    const refunded = Math.max(0, Number(payment.transaction_amount_refunded || 0));
    if (refunded >= paid && paid > 0) return BOOKING_PAYMENT_STATUSES.REFUNDED;
    if (refunded > 0) return BOOKING_PAYMENT_STATUSES.PARTIALLY_REFUNDED;
    return BOOKING_PAYMENT_STATUSES.APPROVED;
  }
  if (["in_process", "pending", "authorized"].includes(status)) return BOOKING_PAYMENT_STATUSES.PENDING;
  if (status === "cancelled") return BOOKING_PAYMENT_STATUSES.CANCELLED;
  if (status === "refunded") return BOOKING_PAYMENT_STATUSES.REFUNDED;
  if (status === "charged_back") return BOOKING_PAYMENT_STATUSES.CHARGED_BACK;
  if (status === "rejected") return BOOKING_PAYMENT_STATUSES.REJECTED;
  return BOOKING_PAYMENT_STATUSES.PENDING;
}

export function bookingStatusForPayment(paymentStatus, currentStatus = BOOKING_STATUSES.PENDING_PAYMENT) {
  if (paymentStatus === BOOKING_PAYMENT_STATUSES.APPROVED) return BOOKING_STATUSES.CONFIRMED;
  if (paymentStatus === BOOKING_PAYMENT_STATUSES.REFUNDED) return BOOKING_STATUSES.CANCELLED;
  if (TERMINAL_PAYMENT_STATUSES.has(paymentStatus)) return BOOKING_STATUSES.EXPIRED;
  return currentStatus;
}

export function isActiveSlotLock(lock = {}, nowMs = Date.now()) {
  if ([BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.COMPLETED].includes(lock.status)) return true;
  const expiresAt = new Date(lock.expires_at || 0).getTime();
  return lock.status === BOOKING_STATUSES.PENDING_PAYMENT && Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export function publicBookingView(booking = {}) {
  return {
    id: String(booking.id || ""),
    studio_id: String(booking.studio_id || ""),
    studio_slug: String(booking.studio_slug || ""),
    studio_name: String(booking.studio_name || ""),
    service_name: String(booking.service_name || ""),
    professional_name: String(booking.professional_name || ""),
    appointment_date: String(booking.appointment_date || ""),
    appointment_time: String(booking.appointment_time || ""),
    amount_cents: Math.max(0, Number(booking.amount_cents) || 0),
    currency: String(booking.currency || "BRL"),
    status: String(booking.status || BOOKING_STATUSES.PENDING_PAYMENT),
    payment_status: String(booking.payment_status || BOOKING_PAYMENT_STATUSES.PENDING),
    expires_at: String(booking.expires_at || ""),
    checkout_url: String(booking.checkout_url || ""),
    updated_at: String(booking.updated_at || ""),
  };
}
