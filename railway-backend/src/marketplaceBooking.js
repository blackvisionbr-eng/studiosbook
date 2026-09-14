import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
  bookingChargeCents,
  bookingStatusForPayment,
  centsToMoney,
  generateAvailabilitySlots,
  isActiveSlotLock,
  moneyToCents,
  normalizeBookingSlug,
  normalizePaymentMode,
  paymentStatusFromMercadoPago,
  platformFeeCents,
  publicBookingView,
  slotBucketKeys,
} from "./booking.js";

const DEFAULT_WEEKLY_HOURS = Object.freeze({
  0: { enabled: false, start: "09:00", end: "18:00" },
  1: { enabled: true, start: "09:00", end: "18:00" },
  2: { enabled: true, start: "09:00", end: "18:00" },
  3: { enabled: true, start: "09:00", end: "18:00" },
  4: { enabled: true, start: "09:00", end: "18:00" },
  5: { enabled: true, start: "09:00", end: "18:00" },
  6: { enabled: true, start: "09:00", end: "13:00" },
});

function safeText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeId(value, fallback = "") {
  const normalized = String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
  return normalized || fallback;
}

function safeEmail(value) {
  const email = safeText(value, 180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function safePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function safeDate(value) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

function safeTime(value) {
  const time = String(value || "");
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
}

function parseSignature(value = "") {
  return String(value)
    .split(",")
    .map((entry) => entry.trim().split("="))
    .reduce((result, [key, item]) => {
      if (key && item) result[key] = item;
      return result;
    }, {});
}

function safeHexEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function webhookDataId(req) {
  return safeText(req.query?.["data.id"] || req.query?.id || req.body?.data?.id || req.body?.id, 100);
}

function validateWebhookSignature(req, secret) {
  const signature = parseSignature(req.headers["x-signature"]);
  const dataId = webhookDataId(req);
  const signatureDataId = safeText(req.query?.["data.id"], 100).toLowerCase();
  const requestId = safeText(req.headers["x-request-id"], 180);
  if (!secret || !signature.ts || !signature.v1 || !dataId || !requestId) return { valid: false, dataId };
  const manifest = `${signatureDataId ? `id:${signatureDataId};` : ""}request-id:${requestId};ts:${signature.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return { valid: safeHexEqual(expected, signature.v1), dataId };
}

function encryptionKey() {
  const raw = safeText(process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY, 256);
  if (!raw) return null;
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

function encryptSecret(value) {
  const key = encryptionKey();
  if (!key) throw Object.assign(new Error("Criptografia de marketplace não configurada."), { statusCode: 503 });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value) {
  const key = encryptionKey();
  const [version, iv, tag, encrypted] = String(value || "").split(".");
  if (!key || version !== "v1" || !iv || !tag || !encrypted) {
    throw Object.assign(new Error("Credencial de recebimento indisponível."), { statusCode: 503 });
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function marketplaceEnabled() {
  return String(process.env.BOOKING_PAYMENTS_ENABLED || "false").toLowerCase() === "true";
}

function marketplaceConfig() {
  return {
    clientId: safeText(process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_ID, 120),
    clientSecret: safeText(process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET, 240),
    redirectUri: safeText(process.env.MERCADO_PAGO_MARKETPLACE_REDIRECT_URI, 500),
    webhookSecret: safeText(process.env.MERCADO_PAGO_MARKETPLACE_WEBHOOK_SECRET, 240),
    apiBase: safeText(process.env.MERCADO_PAGO_API_BASE || "https://api.mercadopago.com", 300),
    publicAppUrl: safeText(process.env.PUBLIC_APP_URL || "https://studiosbook.com.br", 300),
    publicApiUrl: safeText(process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app", 300),
    feePercent: Math.max(0, Number(process.env.BOOKING_PLATFORM_FEE_PERCENT || 0.79)),
    monthlyFeeCapCents: moneyToCents(process.env.BOOKING_PLATFORM_FEE_MONTHLY_CAP || 59.9),
    requireLive: String(process.env.BOOKING_MP_REQUIRE_LIVE || "true").toLowerCase() === "true",
  };
}

function marketplaceReady() {
  const config = marketplaceConfig();
  return Boolean(
    marketplaceEnabled() &&
      config.clientId &&
      config.clientSecret &&
      config.redirectUri &&
      config.webhookSecret &&
      encryptionKey()
  );
}

async function mercadoPagoRequest(token, path, options = {}) {
  const config = marketplaceConfig();
  const response = await fetch(`${config.apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "content-type": options.form ? "application/x-www-form-urlencoded" : "application/json" } : {}),
      ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body
      ? options.form
        ? new URLSearchParams(options.body).toString()
        : JSON.stringify(options.body)
      : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "Falha no provedor de pagamentos.");
    error.statusCode = response.status;
    error.providerData = payload;
    throw error;
  }
  return payload;
}

function sanitizeWeeklyHours(value = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_WEEKLY_HOURS).map(([day, defaults]) => {
      const source = value?.[day] || value?.[Number(day)] || defaults;
      return [day, {
        enabled: source.enabled !== false,
        start: safeTime(source.start) || defaults.start,
        end: safeTime(source.end) || defaults.end,
      }];
    })
  );
}

function sanitizeServices(value = []) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 100)
    .map((service, index) => ({
      id: safeId(service.id, `service-${index + 1}`),
      name: safeText(service.name, 100),
      description: safeText(service.description, 300),
      category: safeId(service.category, "other"),
      price_cents: moneyToCents(service.price_cents != null ? Number(service.price_cents) / 100 : service.price),
      duration_minutes: Math.min(480, Math.max(15, Number(service.duration_minutes) || 60)),
      active: service.active !== false,
      payment_required: service.payment_required !== false,
    }))
    .filter((service) => service.name && service.price_cents > 0);
}

function sanitizeProfessionals(value = [], ownerName = "Profissional") {
  const source = Array.isArray(value) && value.length ? value : [{ id: "owner", name: ownerName, active: true }];
  return source
    .slice(0, 30)
    .map((professional, index) => ({
      id: safeId(professional.id, `professional-${index + 1}`),
      name: safeText(professional.name, 100),
      active: professional.active !== false,
      service_ids: Array.isArray(professional.service_ids)
        ? professional.service_ids.map((id) => safeId(id)).filter(Boolean).slice(0, 100)
        : [],
    }))
    .filter((professional) => professional.name);
}

function publicStudioPayload(studio = {}) {
  return {
    studio_id: studio.id || studio.studio_id || "",
    slug: studio.slug,
    business_name: studio.business_name,
    description: studio.description || "",
    city: studio.city || "",
    whatsapp: studio.whatsapp || "",
    timezone: studio.timezone || "America/Sao_Paulo",
    payment_mode: studio.payment_mode || "deposit",
    payment_required: studio.payment_required !== false,
    deposit_percent: Number(studio.deposit_percent || 30),
    hold_minutes: Number(studio.hold_minutes || 10),
    cancellation_policy: studio.cancellation_policy || "",
    services: (studio.services || []).filter((item) => item.active !== false),
    professionals: (studio.professionals || []).filter((item) => item.active !== false),
    payment_ready: studio.payment_ready === true,
  };
}

function ownerStudioPayload(studio = {}) {
  return {
    ...publicStudioPayload(studio),
    booking_enabled: studio.booking_enabled === true,
    payment_required: studio.payment_required !== false,
    slot_interval_minutes: Number(studio.slot_interval_minutes || 15),
    utc_offset: studio.utc_offset || "-03:00",
    weekly_hours: sanitizeWeeklyHours(studio.weekly_hours),
  };
}

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function publicTokenHash(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

async function accountHasReceivables(db, user) {
  if (user?.platformAdmin) return true;
  const snapshot = await db.collection("users").doc(user.uid).get();
  const data = snapshot.data() || {};
  if (data.receivables_access_allowed !== true) return false;
  const expiresAt = new Date(data.receivables_access_expires_at || "2999-12-31").getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function loadStudioBySlug(db, slug) {
  if (!marketplaceEnabled()) return null;
  const slugSnapshot = await db.collection("PublicBookingSlug").doc(slug).get();
  if (!slugSnapshot.exists || slugSnapshot.data()?.active !== true) return null;
  const studioId = slugSnapshot.data().studio_id;
  const studioSnapshot = await db.collection("PublicBookingStudio").doc(studioId).get();
  if (!studioSnapshot.exists || studioSnapshot.data()?.booking_enabled !== true) return null;
  return { id: studioId, ...studioSnapshot.data() };
}

async function loadPaymentConnection(db, studioId) {
  const snapshot = await db
    .collection("PublicBookingStudio")
    .doc(studioId)
    .collection("Private")
    .doc("MercadoPagoConnection")
    .get();
  return snapshot.exists ? snapshot.data() : null;
}

async function resolveWebhookStudio(db, req) {
  const requestedStudioId = safeId(req.query.studio_id);
  const mercadoPagoUserId = safeId(req.body?.user_id || req.query.user_id);
  let mappedStudioId = "";

  if (mercadoPagoUserId) {
    const sellerSnapshot = await db.collection("MarketplaceSeller").doc(mercadoPagoUserId).get();
    const seller = sellerSnapshot.data() || {};
    if (sellerSnapshot.exists && seller.active === true) mappedStudioId = safeId(seller.studio_id);
  }

  if (requestedStudioId && mappedStudioId && requestedStudioId !== mappedStudioId) {
    throw Object.assign(new Error("Notificação vinculada a outro studio."), { statusCode: 403 });
  }

  const studioId = mappedStudioId || requestedStudioId;
  if (!studioId) {
    throw Object.assign(new Error("Studio não identificado."), {
      statusCode: 400,
      code: "WEBHOOK_STUDIO_UNMAPPED",
    });
  }
  return { studioId, mercadoPagoUserId };
}

async function paymentAccessToken(db, studioId, connectionValue) {
  const connection = connectionValue || await loadPaymentConnection(db, studioId);
  if (!connection?.encrypted_access_token || connection.status !== "connected") {
    throw Object.assign(new Error("Conta recebedora não conectada."), { statusCode: 409 });
  }
  const expiresAt = new Date(connection.token_expires_at || "2999-12-31").getTime();
  if (expiresAt > Date.now() + 24 * 60 * 60 * 1000) return decryptSecret(connection.encrypted_access_token);
  if (!connection.encrypted_refresh_token) {
    throw Object.assign(new Error("A autorização do Mercado Pago precisa ser renovada."), { statusCode: 409 });
  }
  const config = marketplaceConfig();
  const token = await mercadoPagoRequest("", "/oauth/token", {
    method: "POST",
    form: true,
    body: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptSecret(connection.encrypted_refresh_token),
    },
  });
  const update = {
    encrypted_access_token: encryptSecret(token.access_token),
    encrypted_refresh_token: token.refresh_token
      ? encryptSecret(token.refresh_token)
      : connection.encrypted_refresh_token,
    token_expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : "",
    updated_at: FieldValue.serverTimestamp(),
  };
  await db.collection("PublicBookingStudio").doc(studioId).collection("Private").doc("MercadoPagoConnection").set(update, { merge: true });
  return token.access_token;
}

function dateWithOffset(date, time, offset = "-03:00") {
  return new Date(`${date}T${time}:00${/^[-+]\d{2}:\d{2}$/.test(offset) ? offset : "-03:00"}`);
}

async function busyRangesForDate(db, studio, professionalId, date) {
  const [appointmentsSnapshot, locksSnapshot, legacySnapshot] = await Promise.all([
    db.collection("PublicBookingStudio").doc(studio.id).collection("Appointments").where("appointment_date", "==", date).get(),
    db.collection("PublicBookingStudio").doc(studio.id).collection("SlotLocks").where("appointment_date", "==", date).get(),
    db.collection("users").doc(studio.owner_uid).collection("Appointment").where("appointment_date", "==", date).get(),
  ]);
  const ranges = [];
  appointmentsSnapshot.docs.forEach((item) => {
    const appointment = item.data();
    if (appointment.professional_id === professionalId && !["cancelled", "expired"].includes(appointment.status)) {
      ranges.push({ start: appointment.appointment_time, end: appointment.appointment_end_time });
    }
  });
  locksSnapshot.docs.forEach((item) => {
    const lock = item.data();
    if (lock.professional_id === professionalId && isActiveSlotLock(lock)) {
      ranges.push({ start: lock.start_time, end: lock.end_time });
    }
  });
  legacySnapshot.docs.forEach((item) => {
    const appointment = item.data();
    if (!["cancelled", "canceled"].includes(String(appointment.status || "").toLowerCase())) {
      const start = safeTime(appointment.appointment_time);
      if (start) {
        const [hours, minutes] = start.split(":").map(Number);
        const duration = Math.max(15, Number(appointment.duration_minutes) || 60);
        const endTotal = Math.min(1439, hours * 60 + minutes + duration);
        ranges.push({ start, end: `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}` });
      }
    }
  });
  return ranges;
}

function releaseFeeReservation(transaction, studioRef, booking) {
  if (booking.fee_state !== "reserved" || !booking.platform_fee_cents) return;
  const ledgerRef = studioRef.collection("CommissionMonths").doc(booking.commission_month);
  transaction.set(ledgerRef, {
    reserved_cents: FieldValue.increment(-booking.platform_fee_cents),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function applyMarketplacePayment(db, studioId, payment) {
  const externalReference = safeText(payment.external_reference, 240);
  const match = /^studiosbook-booking:([^:]+):([^:]+)$/.exec(externalReference);
  if (!match || match[1] !== studioId) throw new Error("Pagamento sem vínculo válido com o agendamento.");
  const bookingId = match[2];
  const studioRef = db.collection("PublicBookingStudio").doc(studioId);
  const bookingRef = studioRef.collection("Appointments").doc(bookingId);
  const paymentRef = studioRef.collection("Payments").doc(`mp_${safeId(payment.id)}`);
  const paymentStatus = paymentStatusFromMercadoPago(payment);

  return db.runTransaction(async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists) throw new Error("Agendamento não localizado.");
    const booking = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
    const lockRefs = (booking.slot_lock_ids || []).map((lockId) => studioRef.collection("SlotLocks").doc(lockId));
    const lockSnapshots = await Promise.all(lockRefs.map((lockRef) => transaction.get(lockRef)));
    const paidCents = moneyToCents(payment.transaction_amount);
    const currency = safeText(payment.currency_id || "BRL", 3).toUpperCase();
    const validAmount = paidCents === Number(booking.amount_cents);
    const validCurrency = currency === "BRL";
    const validCollector = !booking.mercado_pago_collector_id || String(payment.collector_id || "") === String(booking.mercado_pago_collector_id);
    const validLiveMode = !marketplaceConfig().requireLive || payment.live_mode === true;
    const verifiedStatus = validAmount && validCurrency && validCollector && validLiveMode
      ? paymentStatus
      : BOOKING_PAYMENT_STATUSES.REJECTED;
    const previousStatus = booking.payment_status;
    const lockConflict = verifiedStatus === BOOKING_PAYMENT_STATUSES.APPROVED && lockSnapshots.some((snapshot) => {
      const lock = snapshot.data() || {};
      return snapshot.exists && isActiveSlotLock(lock) && lock.booking_id !== bookingId;
    });
    const nextBookingStatus = lockConflict
      ? BOOKING_STATUSES.PAYMENT_REVIEW
      : bookingStatusForPayment(verifiedStatus, booking.status);
    const totalFeeCents = Math.max(0, Number(booking.platform_fee_cents || 0));
    const refundedCents = Math.min(paidCents, moneyToCents(payment.transaction_amount_refunded));
    const targetReversedFeeCents = paidCents > 0
      ? Math.min(totalFeeCents, Math.round((totalFeeCents * refundedCents) / paidCents))
      : 0;
    const previousReversedFeeCents = Math.max(0, Number(booking.platform_fee_reversed_cents || 0));
    const reversalDeltaCents = Math.max(0, targetReversedFeeCents - previousReversedFeeCents);

    if (booking.commission_month && totalFeeCents > 0) {
      const ledgerRef = studioRef.collection("CommissionMonths").doc(booking.commission_month);
      if (booking.fee_state === "reserved" && previousStatus !== verifiedStatus) {
        const approvedFeeCents = [BOOKING_PAYMENT_STATUSES.APPROVED, BOOKING_PAYMENT_STATUSES.PARTIALLY_REFUNDED].includes(verifiedStatus)
          ? Math.max(0, totalFeeCents - targetReversedFeeCents)
          : 0;
        transaction.set(ledgerRef, {
          reserved_cents: FieldValue.increment(-totalFeeCents),
          approved_cents: FieldValue.increment(approvedFeeCents),
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      } else if (booking.fee_state === "approved" && reversalDeltaCents > 0) {
        transaction.set(ledgerRef, {
          approved_cents: FieldValue.increment(-reversalDeltaCents),
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    const releaseLocks = [BOOKING_STATUSES.CANCELLED, BOOKING_STATUSES.EXPIRED].includes(nextBookingStatus);
    for (let index = 0; index < lockRefs.length; index += 1) {
      const lockRef = lockRefs[index];
      const lock = lockSnapshots[index]?.data() || {};
      if (lock.booking_id && lock.booking_id !== bookingId) continue;
      if (releaseLocks) transaction.delete(lockRef);
      else if (nextBookingStatus === BOOKING_STATUSES.CONFIRMED) {
        transaction.set(lockRef, { status: BOOKING_STATUSES.CONFIRMED, expires_at: "", updated_at: FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    transaction.set(paymentRef, {
      provider: "mercado_pago",
      provider_payment_id: String(payment.id),
      booking_id: bookingId,
      studio_id: studioId,
      status: verifiedStatus,
      status_detail: safeText(payment.status_detail, 120),
      amount_cents: paidCents,
      currency,
      payment_method_id: safeText(payment.payment_method_id, 60),
      payment_type_id: safeText(payment.payment_type_id, 60),
      refunded_cents: refundedCents,
      live_mode: payment.live_mode === true,
      date_approved: safeText(payment.date_approved, 80),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(bookingRef, {
      status: nextBookingStatus,
      payment_status: verifiedStatus,
      provider_payment_id: String(payment.id),
      platform_fee_reversed_cents: targetReversedFeeCents,
      fee_state: verifiedStatus === BOOKING_PAYMENT_STATUSES.APPROVED
        ? "approved"
        : verifiedStatus === BOOKING_PAYMENT_STATUSES.PARTIALLY_REFUNDED
          ? "approved"
        : [BOOKING_PAYMENT_STATUSES.REFUNDED, BOOKING_PAYMENT_STATUSES.CHARGED_BACK].includes(verifiedStatus)
          ? "reversed"
          : booking.fee_state === "reserved" ? "released" : booking.fee_state,
      payment_verification: { valid_amount: validAmount, valid_currency: validCurrency, valid_collector: validCollector, valid_live_mode: validLiveMode, lock_conflict: lockConflict },
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ...booking, status: nextBookingStatus, payment_status: verifiedStatus };
  });
}

async function reconcileMarketplaceBooking(db, booking) {
  if (!booking?.checkout_url) return null;
  const lastSyncAt = new Date(booking.last_provider_sync_at || 0).getTime();
  if (lastSyncAt > Date.now() - 10_000) return null;
  await booking.ref.set({ last_provider_sync_at: new Date().toISOString(), updated_at: FieldValue.serverTimestamp() }, { merge: true });
  const token = await paymentAccessToken(db, booking.studio_id);
  let payment;
  if (booking.provider_payment_id) {
    payment = await mercadoPagoRequest(token, `/v1/payments/${encodeURIComponent(booking.provider_payment_id)}`);
  } else {
    const query = new URLSearchParams({
      external_reference: `studiosbook-booking:${booking.studio_id}:${booking.id}`,
      sort: "date_created",
      criteria: "desc",
      limit: "5",
    });
    const search = await mercadoPagoRequest(token, `/v1/payments/search?${query}`);
    payment = search.results?.[0];
  }
  return payment ? applyMarketplacePayment(db, booking.studio_id, payment) : null;
}

export function createMarketplaceBookingRouter({ getDb, requireFirebaseUser, requireMasterAdmin, requireRecentAdminAuth }) {
  const router = express.Router();
  const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false });
  const holdLimiter = rateLimit({ windowMs: 30 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
  const ownerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, keyGenerator: (req) => req.user.uid });

  function dbOr503(res) {
    const db = getDb();
    if (!db) res.status(503).json({ error: "Agendamento on-line temporariamente indisponível." });
    return db;
  }

  router.get("/public/booking/studios/:slug", publicLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      const slug = normalizeBookingSlug(req.params.slug);
      const studio = slug ? await loadStudioBySlug(db, slug) : null;
      if (!studio) return res.status(404).json({ error: "Página de agendamento não encontrada." });
      return res.json({ success: true, studio: publicStudioPayload(studio) });
    } catch (error) {
      console.error("Public studio load failed", { requestId: req.requestId, message: error?.message });
      return res.status(500).json({ error: "Não foi possível carregar esta agenda." });
    }
  });

  router.get("/public/booking/studios/:slug/availability", publicLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      const studio = await loadStudioBySlug(db, normalizeBookingSlug(req.params.slug));
      if (!studio) return res.status(404).json({ error: "Página de agendamento não encontrada." });
      const date = safeDate(req.query.date);
      const service = (studio.services || []).find((item) => item.id === safeId(req.query.service_id) && item.active !== false);
      const professional = (studio.professionals || []).find((item) => item.id === safeId(req.query.professional_id) && item.active !== false);
      if (!date || !service || !professional) return res.status(400).json({ error: "Serviço, profissional ou data inválidos." });
      if (professional.service_ids?.length && !professional.service_ids.includes(service.id)) return res.status(400).json({ error: "Este profissional não atende o serviço selecionado." });
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const busyRanges = await busyRangesForDate(db, studio, professional.id, date);
      let slots = generateAvailabilitySlots({
        schedule: studio.weekly_hours?.[weekday] || DEFAULT_WEEKLY_HOURS[weekday],
        durationMinutes: service.duration_minutes,
        intervalMinutes: studio.slot_interval_minutes || 15,
        busyRanges,
      });
      const now = Date.now();
      slots = slots.filter((slot) => dateWithOffset(date, slot.start, studio.utc_offset).getTime() > now + 5 * 60 * 1000);
      return res.json({ success: true, date, slots });
    } catch (error) {
      console.error("Availability load failed", { requestId: req.requestId, message: error?.message });
      return res.status(500).json({ error: "Não foi possível consultar os horários." });
    }
  });

  router.post("/public/booking/studios/:slug/holds", holdLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      const studio = await loadStudioBySlug(db, normalizeBookingSlug(req.params.slug));
      if (!studio) return res.status(404).json({ error: "Página de agendamento não encontrada." });
      const date = safeDate(req.body?.appointment_date);
      const time = safeTime(req.body?.appointment_time);
      const service = (studio.services || []).find((item) => item.id === safeId(req.body?.service_id) && item.active !== false);
      const professional = (studio.professionals || []).find((item) => item.id === safeId(req.body?.professional_id) && item.active !== false);
      const customerName = safeText(req.body?.customer?.name, 100);
      const customerEmail = safeEmail(req.body?.customer?.email);
      const customerPhone = safePhone(req.body?.customer?.phone);
      if (!date || !time || !service || !professional || !customerName || (!customerEmail && !customerPhone)) {
        return res.status(400).json({ error: "Preencha serviço, profissional, horário e contato corretamente." });
      }
      if (professional.service_ids?.length && !professional.service_ids.includes(service.id)) {
        return res.status(400).json({ error: "Este profissional não atende o serviço selecionado." });
      }
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const busyRanges = await busyRangesForDate(db, studio, professional.id, date);
      const available = generateAvailabilitySlots({
        schedule: studio.weekly_hours?.[weekday] || DEFAULT_WEEKLY_HOURS[weekday],
        durationMinutes: service.duration_minutes,
        intervalMinutes: studio.slot_interval_minutes || 15,
        busyRanges,
      }).some((slot) => slot.start === time);
      if (!available) return res.status(409).json({ error: "Este horário não está mais disponível." });

      const token = randomBytes(24).toString("base64url");
      const bookingId = randomUUID();
      const holdMinutes = [5, 10, 15].includes(Number(studio.hold_minutes)) ? Number(studio.hold_minutes) : 10;
      const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
      const lockExpiresAt = new Date(expiresAt.getTime() + 2 * 60 * 1000);
      const amountCents = service.payment_required === false
        ? 0
        : bookingChargeCents(service.price_cents, studio);
      if (dateWithOffset(date, time, studio.utc_offset).getTime() <= Date.now() + 5 * 60 * 1000) {
        return res.status(409).json({ error: "Este horário não está mais disponível." });
      }
      if (amountCents > 0 && studio.payment_ready !== true) {
        return res.status(409).json({ error: "O studio ainda não habilitou o recebimento on-line." });
      }
      const slotIds = slotBucketKeys({
        professionalId: professional.id,
        date,
        time,
        durationMinutes: service.duration_minutes,
      });
      const studioRef = db.collection("PublicBookingStudio").doc(studio.id);
      const bookingRef = studioRef.collection("Appointments").doc(bookingId);
      const [startHours, startMinutes] = time.split(":").map(Number);
      const endTotal = Math.min(1439, startHours * 60 + startMinutes + service.duration_minutes);
      const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;

      await db.runTransaction(async (transaction) => {
        const lockRefs = slotIds.map((id) => studioRef.collection("SlotLocks").doc(id));
        const lockSnapshots = await Promise.all(lockRefs.map((ref) => transaction.get(ref)));
        if (lockSnapshots.some((snapshot) => snapshot.exists && isActiveSlotLock(snapshot.data()))) {
          throw Object.assign(new Error("Este horário acabou de ser reservado."), { statusCode: 409 });
        }
        const status = amountCents > 0 ? BOOKING_STATUSES.PENDING_PAYMENT : BOOKING_STATUSES.CONFIRMED;
        const paymentStatus = amountCents > 0 ? BOOKING_PAYMENT_STATUSES.PENDING : BOOKING_PAYMENT_STATUSES.NOT_REQUIRED;
        transaction.create(bookingRef, {
          studio_id: studio.id,
          studio_slug: studio.slug,
          studio_name: studio.business_name,
          owner_uid: studio.owner_uid,
          service_id: service.id,
          service_name: service.name,
          service_price_cents: service.price_cents,
          professional_id: professional.id,
          professional_name: professional.name,
          customer: { name: customerName, email: customerEmail, phone: customerPhone },
          appointment_date: date,
          appointment_time: time,
          appointment_end_time: endTime,
          duration_minutes: service.duration_minutes,
          amount_cents: amountCents,
          currency: "BRL",
          status,
          payment_status: paymentStatus,
          public_token_hash: publicTokenHash(token),
          slot_lock_ids: slotIds,
          expires_at: amountCents > 0 ? expiresAt.toISOString() : "",
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        lockRefs.forEach((ref) => transaction.set(ref, {
          booking_id: bookingId,
          studio_id: studio.id,
          professional_id: professional.id,
          appointment_date: date,
          start_time: time,
          end_time: endTime,
          status,
          expires_at: amountCents > 0 ? lockExpiresAt.toISOString() : "",
          updated_at: FieldValue.serverTimestamp(),
        }));
      });

      const created = await bookingRef.get();
      return res.status(201).json({ success: true, token, booking: publicBookingView({ id: bookingId, ...created.data() }) });
    } catch (error) {
      console.error("Booking hold failed", { requestId: req.requestId, message: error?.message });
      return res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : "Não foi possível reservar este horário." });
    }
  });

  async function loadAuthorizedBooking(db, studioId, bookingId, token) {
    if (!studioId || !bookingId || !token) return null;
    const ref = db.collection("PublicBookingStudio").doc(studioId).collection("Appointments").doc(bookingId);
    const snapshot = await ref.get();
    if (!snapshot.exists || !safeHexEqual(snapshot.data()?.public_token_hash, publicTokenHash(token))) return null;
    return { ref, id: snapshot.id, ...snapshot.data() };
  }

  router.get("/public/booking/bookings/:bookingId/status", publicLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      let booking = await loadAuthorizedBooking(db, safeId(req.query.studio_id), safeId(req.params.bookingId), safeText(req.query.token, 100));
      if (!booking) return res.status(404).json({ error: "Agendamento não encontrado." });
      if (booking.status === BOOKING_STATUSES.PENDING_PAYMENT && booking.checkout_url) {
        try {
          await reconcileMarketplaceBooking(db, booking);
          booking = await loadAuthorizedBooking(db, booking.studio_id, booking.id, safeText(req.query.token, 100)) || booking;
        } catch (syncError) {
          console.error("Booking provider reconciliation failed", { requestId: req.requestId, bookingId: booking.id, message: syncError?.message });
          if (new Date(booking.expires_at).getTime() <= Date.now() && Date.now() < new Date(booking.expires_at).getTime() + 2 * 60 * 1000) {
            return res.json({ success: true, booking: publicBookingView(booking), reconciliation_pending: true });
          }
        }
      }
      const bookingExpiresAt = new Date(booking.expires_at).getTime();
      if (
        booking.status === BOOKING_STATUSES.PENDING_PAYMENT &&
        bookingExpiresAt <= Date.now() &&
        Date.now() < bookingExpiresAt + 2 * 60 * 1000
      ) {
        return res.json({ success: true, booking: publicBookingView(booking), reconciliation_pending: true });
      }
      if (booking.status === BOOKING_STATUSES.PENDING_PAYMENT && bookingExpiresAt + 2 * 60 * 1000 <= Date.now()) {
        const studioRef = booking.ref.parent.parent;
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(booking.ref);
          const current = snapshot.data() || {};
          if (current.status !== BOOKING_STATUSES.PENDING_PAYMENT || new Date(current.expires_at).getTime() + 2 * 60 * 1000 > Date.now()) return;
          releaseFeeReservation(transaction, studioRef, current);
          transaction.set(booking.ref, {
            status: BOOKING_STATUSES.EXPIRED,
            payment_status: BOOKING_PAYMENT_STATUSES.EXPIRED,
            fee_state: current.fee_state === "reserved" ? "released" : current.fee_state || "",
            updated_at: FieldValue.serverTimestamp(),
          }, { merge: true });
          for (const lockId of current.slot_lock_ids || []) transaction.delete(studioRef.collection("SlotLocks").doc(lockId));
        });
        booking.status = BOOKING_STATUSES.EXPIRED;
        booking.payment_status = BOOKING_PAYMENT_STATUSES.EXPIRED;
      }
      return res.json({ success: true, booking: publicBookingView(booking) });
    } catch (error) {
      console.error("Booking status failed", { requestId: req.requestId, message: error?.message });
      return res.status(500).json({ error: "Não foi possível consultar o agendamento." });
    }
  });

  router.post("/public/booking/bookings/:bookingId/checkout", holdLimiter, async (req, res) => {
    let booking;
    let reservedFeeCents = 0;
    try {
      const db = dbOr503(res);
      if (!db) return;
      if (!marketplaceReady()) return res.status(503).json({ error: "Recebimentos on-line ainda não estão disponíveis." });
      booking = await loadAuthorizedBooking(db, safeId(req.body?.studio_id), safeId(req.params.bookingId), safeText(req.body?.token, 100));
      if (!booking) return res.status(404).json({ error: "Agendamento não encontrado." });
      if (booking.amount_cents <= 0) return res.json({ success: true, booking: publicBookingView(booking) });
      if (booking.status !== BOOKING_STATUSES.PENDING_PAYMENT || new Date(booking.expires_at).getTime() <= Date.now()) {
        return res.status(409).json({ error: "A reserva expirou. Escolha o horário novamente." });
      }
      if (booking.checkout_url) return res.json({ success: true, checkout_url: booking.checkout_url, booking: publicBookingView(booking) });
      const studioRef = booking.ref.parent.parent;
      const connection = await loadPaymentConnection(db, booking.studio_id);
      if (!connection?.encrypted_access_token || connection.status !== "connected") {
        return res.status(409).json({ error: "O studio ainda não concluiu a configuração de recebimentos." });
      }
      const config = marketplaceConfig();
      const commissionMonth = monthKey();
      const ledgerRef = studioRef.collection("CommissionMonths").doc(commissionMonth);
      const checkoutReservation = await db.runTransaction(async (transaction) => {
        const [bookingSnapshot, ledgerSnapshot] = await Promise.all([transaction.get(booking.ref), transaction.get(ledgerRef)]);
        const current = bookingSnapshot.data() || {};
        if (current.checkout_url) return { checkoutUrl: current.checkout_url, current };
        const checkoutStartedAt = new Date(current.checkout_started_at || 0).getTime();
        if (current.checkout_state === "creating" && checkoutStartedAt > Date.now() - 60_000) {
          return { inProgress: true, current };
        }
        const ledger = ledgerSnapshot.data() || {};
        const used = Math.max(0, Number(ledger.approved_cents || 0) + Number(ledger.reserved_cents || 0));
        reservedFeeCents = current.fee_state === "reserved"
          ? Math.max(0, Number(current.platform_fee_cents || 0))
          : platformFeeCents(current.amount_cents, {
              percent: config.feePercent,
              remainingCapCents: Math.max(0, config.monthlyFeeCapCents - used),
            });
        if (current.fee_state !== "reserved") {
          transaction.set(ledgerRef, {
            studio_id: booking.studio_id,
            month: commissionMonth,
            reserved_cents: FieldValue.increment(reservedFeeCents),
            cap_cents: config.monthlyFeeCapCents,
            updated_at: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        transaction.set(booking.ref, {
          platform_fee_cents: reservedFeeCents,
          fee_state: "reserved",
          commission_month: commissionMonth,
          mercado_pago_collector_id: String(connection.mercado_pago_user_id || ""),
          checkout_state: "creating",
          checkout_started_at: new Date().toISOString(),
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { current: { ...current, platform_fee_cents: reservedFeeCents, commission_month: commissionMonth } };
      });
      if (checkoutReservation.checkoutUrl) {
        return res.json({
          success: true,
          checkout_url: checkoutReservation.checkoutUrl,
          booking: publicBookingView({ id: booking.id, ...checkoutReservation.current }),
        });
      }
      if (checkoutReservation.inProgress) {
        return res.status(409).json({ error: "O pagamento está sendo preparado. Aguarde alguns segundos e tente novamente." });
      }
      booking = { ...booking, ...checkoutReservation.current };

      const token = await paymentAccessToken(db, booking.studio_id, connection);
      const returnToken = safeText(req.body?.token, 100);
      const returnUrl = `${config.publicAppUrl}/agendar/${encodeURIComponent(booking.studio_slug || booking.studio_id)}?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(returnToken)}`;
      const preference = await mercadoPagoRequest(token, "/checkout/preferences", {
        method: "POST",
        idempotencyKey: `studiosbook-booking-${booking.id}`,
        body: {
          items: [{
            id: booking.service_id,
            title: booking.service_name,
            description: `Agendamento com ${booking.professional_name}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: centsToMoney(booking.amount_cents),
          }],
          payer: { name: booking.customer?.name || "Cliente", email: booking.customer?.email || undefined },
          external_reference: `studiosbook-booking:${booking.studio_id}:${booking.id}`,
          marketplace_fee: centsToMoney(reservedFeeCents),
          notification_url: `${config.publicApiUrl}/functions/booking-marketplace-webhook?studio_id=${encodeURIComponent(booking.studio_id)}`,
          expires: true,
          expiration_date_from: new Date().toISOString(),
          expiration_date_to: booking.expires_at,
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
          auto_return: "approved",
          metadata: { studiosbook_studio_id: booking.studio_id, studiosbook_booking_id: booking.id },
        },
      });
      const checkoutUrl = config.requireLive ? preference.init_point : preference.sandbox_init_point || preference.init_point;
      await booking.ref.set({
        studio_slug: booking.studio_slug || "",
        provider_preference_id: String(preference.id || ""),
        checkout_url: checkoutUrl || "",
        checkout_state: "ready",
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.json({ success: true, checkout_url: checkoutUrl, booking: publicBookingView({ ...booking, checkout_url: checkoutUrl }) });
    } catch (error) {
      if (booking?.ref && reservedFeeCents > 0) {
        const db = getDb();
        await db?.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(booking.ref);
          const current = snapshot.data() || {};
          if (current.fee_state !== "reserved" || current.checkout_url) return;
          releaseFeeReservation(transaction, booking.ref.parent.parent, current);
          transaction.set(booking.ref, { fee_state: "released", checkout_state: "failed", updated_at: FieldValue.serverTimestamp() }, { merge: true });
        }).catch(() => {});
      }
      console.error("Booking checkout failed", { requestId: req.requestId, message: error?.message });
      return res.status(error?.statusCode && error.statusCode < 500 ? 422 : error?.statusCode || 500).json({
        error: "Não foi possível abrir o pagamento. Tente novamente.",
        request_id: req.requestId,
      });
    }
  });

  router.post("/functions/booking-settings-status", requireFirebaseUser, ownerLimiter, async (req, res) => {
    const db = dbOr503(res);
    if (!db) return;
    const entitled = await accountHasReceivables(db, req.user);
    const snapshot = await db.collection("PublicBookingStudio").doc(req.user.uid).get();
    const connection = await loadPaymentConnection(db, req.user.uid);
    return res.json({
      success: true,
      entitled,
      marketplace_ready: marketplaceReady(),
      settings: snapshot.exists ? ownerStudioPayload({ id: snapshot.id, ...snapshot.data() }) : null,
      payment_connection: connection ? { status: connection.status, mercado_pago_user_id: connection.mercado_pago_user_id || "" } : null,
    });
  });

  router.post("/functions/booking-dashboard", requireFirebaseUser, ownerLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      if (!(await accountHasReceivables(db, req.user))) {
        return res.status(402).json({ error: "O plano StudiosBook Recebimentos não está ativo nesta conta." });
      }
      const studioRef = db.collection("PublicBookingStudio").doc(req.user.uid);
      const [appointmentsSnapshot, commissionSnapshot] = await Promise.all([
        studioRef.collection("Appointments").orderBy("created_at", "desc").limit(100).get(),
        studioRef.collection("CommissionMonths").doc(monthKey()).get(),
      ]);
      const appointments = appointmentsSnapshot.docs.map((snapshot) => {
        const item = snapshot.data() || {};
        return {
          id: snapshot.id,
          customer_name: safeText(item.customer?.name, 100),
          customer_phone: safePhone(item.customer?.phone),
          service_name: safeText(item.service_name, 100),
          professional_name: safeText(item.professional_name, 100),
          appointment_date: safeDate(item.appointment_date),
          appointment_time: safeTime(item.appointment_time),
          amount_cents: Math.max(0, Number(item.amount_cents || 0)),
          status: safeId(item.status),
          payment_status: safeId(item.payment_status),
          provider_payment_id: safeText(item.provider_payment_id, 100),
        };
      });
      const metrics = appointments.reduce((result, item) => {
        result.total += 1;
        result[item.status] = (result[item.status] || 0) + 1;
        if ([BOOKING_PAYMENT_STATUSES.APPROVED, BOOKING_PAYMENT_STATUSES.PARTIALLY_REFUNDED].includes(item.payment_status)) {
          result.approved_amount_cents += item.amount_cents;
        }
        return result;
      }, { total: 0, approved_amount_cents: 0 });
      const commission = commissionSnapshot.data() || {};
      return res.json({
        success: true,
        appointments,
        metrics,
        commission: {
          month: monthKey(),
          approved_cents: Math.max(0, Number(commission.approved_cents || 0)),
          reserved_cents: Math.max(0, Number(commission.reserved_cents || 0)),
          cap_cents: marketplaceConfig().monthlyFeeCapCents,
        },
      });
    } catch (error) {
      console.error("Booking dashboard failed", { requestId: req.requestId, message: error?.message });
      return res.status(500).json({ error: "Não foi possível carregar os recebimentos." });
    }
  });

  router.post("/functions/save-booking-settings", requireFirebaseUser, ownerLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      if (!(await accountHasReceivables(db, req.user))) return res.status(402).json({ error: "O plano StudiosBook Recebimentos não está ativo nesta conta." });
      const currentRef = db.collection("PublicBookingStudio").doc(req.user.uid);
      const currentSnapshot = await currentRef.get();
      const current = currentSnapshot.data() || {};
      const businessName = safeText(req.body?.business_name || current.business_name || req.user.name, 100);
      const slug = normalizeBookingSlug(req.body?.slug || businessName);
      const services = sanitizeServices(req.body?.services);
      const professionals = sanitizeProfessionals(req.body?.professionals, req.user.name);
      if (slug.length < 3 || !businessName || !services.length || !professionals.length) {
        return res.status(400).json({ error: "Revise nome, endereço público, serviços e profissionais." });
      }
      const connection = await loadPaymentConnection(db, req.user.uid);
      const payload = {
        owner_uid: req.user.uid,
        owner_email: req.user.email || "",
        slug,
        business_name: businessName,
        description: safeText(req.body?.description, 300),
        city: safeText(req.body?.city, 100),
        whatsapp: safePhone(req.body?.whatsapp),
        booking_enabled: req.body?.booking_enabled === true,
        payment_required: req.body?.payment_required !== false,
        payment_mode: normalizePaymentMode(req.body?.payment_mode),
        deposit_percent: Math.min(100, Math.max(1, Number(req.body?.deposit_percent) || 30)),
        hold_minutes: [5, 10, 15].includes(Number(req.body?.hold_minutes)) ? Number(req.body.hold_minutes) : 10,
        slot_interval_minutes: [5, 10, 15, 30].includes(Number(req.body?.slot_interval_minutes)) ? Number(req.body.slot_interval_minutes) : 15,
        timezone: "America/Sao_Paulo",
        utc_offset: safeText(req.body?.utc_offset || "-03:00", 6),
        cancellation_policy: safeText(req.body?.cancellation_policy, 1000),
        weekly_hours: sanitizeWeeklyHours(req.body?.weekly_hours),
        services,
        professionals,
        payment_ready: connection?.status === "connected",
        updated_at: FieldValue.serverTimestamp(),
      };
      const oldSlug = current.slug;
      await db.runTransaction(async (transaction) => {
        const slugRef = db.collection("PublicBookingSlug").doc(slug);
        const slugSnapshot = await transaction.get(slugRef);
        if (slugSnapshot.exists && slugSnapshot.data()?.studio_id !== req.user.uid) {
          throw Object.assign(new Error("Este endereço público já está em uso."), { statusCode: 409 });
        }
        transaction.set(currentRef, payload, { merge: true });
        transaction.set(slugRef, { studio_id: req.user.uid, active: payload.booking_enabled, updated_at: FieldValue.serverTimestamp() }, { merge: true });
        if (oldSlug && oldSlug !== slug) transaction.set(db.collection("PublicBookingSlug").doc(oldSlug), { active: false, updated_at: FieldValue.serverTimestamp() }, { merge: true });
      });
      return res.json({ success: true, settings: ownerStudioPayload({ id: req.user.uid, ...payload }), public_url: `${marketplaceConfig().publicAppUrl}/agendar/${slug}` });
    } catch (error) {
      console.error("Booking settings failed", { requestId: req.requestId, message: error?.message });
      return res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : "Não foi possível salvar o agendamento on-line." });
    }
  });

  router.post("/functions/booking-payment-connect", requireFirebaseUser, ownerLimiter, async (req, res) => {
    try {
      const db = dbOr503(res);
      if (!db) return;
      if (!(await accountHasReceivables(db, req.user))) return res.status(402).json({ error: "O plano StudiosBook Recebimentos não está ativo nesta conta." });
      const config = marketplaceConfig();
      if (!marketplaceReady()) return res.status(503).json({ error: "A conexão de recebimentos ainda não está disponível." });
      const state = randomBytes(32).toString("base64url");
      await db.collection("BookingOAuthState").doc(publicTokenHash(state)).set({
        owner_uid: req.user.uid,
        owner_email: req.user.email || "",
        expires_at: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
        used: false,
        created_at: FieldValue.serverTimestamp(),
      });
      const params = new URLSearchParams({ client_id: config.clientId, response_type: "code", platform_id: "mp", state, redirect_uri: config.redirectUri });
      return res.json({ success: true, url: `https://auth.mercadopago.com.br/authorization?${params}` });
    } catch (error) {
      console.error("Marketplace OAuth start failed", { requestId: req.requestId, message: error?.message });
      return res.status(500).json({ error: "Não foi possível iniciar a conexão com o Mercado Pago." });
    }
  });

  router.get("/functions/booking-payment-oauth/callback", async (req, res) => {
    const config = marketplaceConfig();
    try {
      const db = dbOr503(res);
      if (!db) return;
      const code = safeText(req.query.code, 500);
      const state = safeText(req.query.state, 200);
      if (!code || !state || !marketplaceReady()) throw new Error("Autorização incompleta.");
      const stateRef = db.collection("BookingOAuthState").doc(publicTokenHash(state));
      const ownerUid = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(stateRef);
        const data = snapshot.data() || {};
        if (!snapshot.exists || data.used || data.expires_at?.toMillis?.() <= Date.now()) throw new Error("Autorização expirada ou inválida.");
        transaction.set(stateRef, { used: true, used_at: FieldValue.serverTimestamp() }, { merge: true });
        return data.owner_uid;
      });
      const token = await mercadoPagoRequest("", "/oauth/token", {
        method: "POST",
        form: true,
        body: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: config.redirectUri,
          state,
        },
      });
      const mercadoPagoUserId = safeId(token.user_id);
      if (!mercadoPagoUserId || !token.access_token) throw new Error("Credenciais incompletas retornadas pelo Mercado Pago.");
      const studioRef = db.collection("PublicBookingStudio").doc(ownerUid);
      const connectionRef = studioRef.collection("Private").doc("MercadoPagoConnection");
      const previousConnection = await loadPaymentConnection(db, ownerUid);
      const batch = db.batch();
      batch.set(connectionRef, {
        provider: "mercado_pago",
        status: "connected",
        mercado_pago_user_id: mercadoPagoUserId,
        public_key: safeText(token.public_key, 200),
        encrypted_access_token: encryptSecret(token.access_token),
        encrypted_refresh_token: token.refresh_token ? encryptSecret(token.refresh_token) : "",
        token_expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : "",
        connected_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(db.collection("MarketplaceSeller").doc(mercadoPagoUserId), {
        studio_id: ownerUid,
        mercado_pago_user_id: mercadoPagoUserId,
        active: true,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      const previousUserId = safeId(previousConnection?.mercado_pago_user_id);
      if (previousUserId && previousUserId !== mercadoPagoUserId) {
        batch.set(db.collection("MarketplaceSeller").doc(previousUserId), {
          active: false,
          replaced_by: mercadoPagoUserId,
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      batch.set(studioRef, { payment_ready: true, updated_at: FieldValue.serverTimestamp() }, { merge: true });
      await batch.commit();
      return res.redirect(302, `${config.publicAppUrl}/recebimentos?connection=success`);
    } catch (error) {
      console.error("Marketplace OAuth callback failed", { requestId: req.requestId, message: error?.message });
      return res.redirect(302, `${config.publicAppUrl}/recebimentos?connection=error`);
    }
  });

  router.post("/functions/booking-marketplace-webhook", async (req, res) => {
    const db = dbOr503(res);
    if (!db) return;
    const config = marketplaceConfig();
    const validation = validateWebhookSignature(req, config.webhookSecret);
    if (!validation.valid) return res.status(401).json({ error: "Assinatura do webhook inválida." });
    let studioId = "";
    let eventRef;
    try {
      const resolved = await resolveWebhookStudio(db, req);
      studioId = resolved.studioId;
      const eventId = `booking_mp_${safeId(req.body?.id || req.headers["x-request-id"] || randomUUID())}_${safeId(validation.dataId)}`;
      eventRef = db.collection("BookingPaymentWebhookEvent").doc(eventId.slice(0, 180));
      const claimed = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(eventRef);
        if (snapshot.data()?.status === "processed") return false;
        transaction.set(eventRef, { status: "processing", studio_id: studioId, payment_id: validation.dataId, updated_at: FieldValue.serverTimestamp() }, { merge: true });
        return true;
      });
      if (!claimed) return res.json({ received: true, duplicate: true });
      const connection = await loadPaymentConnection(db, studioId);
      if (!connection?.encrypted_access_token) throw new Error("Conta recebedora não conectada.");
      if (resolved.mercadoPagoUserId && safeId(connection.mercado_pago_user_id) !== resolved.mercadoPagoUserId) {
        throw Object.assign(new Error("Conta recebedora divergente da notificação."), { statusCode: 403 });
      }
      const payment = await mercadoPagoRequest(await paymentAccessToken(db, studioId, connection), `/v1/payments/${encodeURIComponent(validation.dataId)}`);
      await applyMarketplacePayment(db, studioId, payment);
      await eventRef.set({ status: "processed", updated_at: FieldValue.serverTimestamp() }, { merge: true });
      return res.json({ received: true });
    } catch (error) {
      if (error?.code === "WEBHOOK_STUDIO_UNMAPPED") {
        console.warn("Booking payment webhook ignored", {
          requestId: req.requestId,
          paymentId: validation.dataId,
          reason: error.code,
        });
        return res.json({ received: true, ignored: true });
      }
      console.error("Booking payment webhook failed", { requestId: req.requestId, studioId, paymentId: validation.dataId, message: error?.message });
      if (eventRef) await eventRef.set({ status: "failed", error: safeText(error?.message, 240), updated_at: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      return res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : "Falha ao processar o pagamento." });
    }
  });

  router.post(
    "/functions/admin-set-receivables-plan",
    requireMasterAdmin,
    requireRecentAdminAuth,
    ownerLimiter,
    async (req, res) => {
      const db = dbOr503(res);
      if (!db) return;
      const uid = safeText(req.body?.uid, 128);
      if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) return res.status(400).json({ error: "UID inválido." });
      const enabled = req.body?.enabled === true;
      const expiresAt = safeText(req.body?.expires_at, 80);
      await db.collection("users").doc(uid).set({
        receivables_access_allowed: enabled,
        receivables_access_expires_at: enabled && expiresAt ? expiresAt : enabled ? "2999-12-31T23:59:59.999Z" : "",
        receivables_plan_code: enabled ? "studiosbook_receivables" : "studiosbook_agenda",
        receivables_updated_by: req.user.email || req.user.uid,
        receivables_updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.json({ success: true, uid, enabled });
    }
  );

  return router;
}

export const marketplaceBookingInternals = {
  encryptSecret,
  decryptSecret,
  marketplaceReady,
  publicStudioPayload,
  sanitizeProfessionals,
  sanitizeServices,
  sanitizeWeeklyHours,
  validateWebhookSignature,
  resolveWebhookStudio,
};
