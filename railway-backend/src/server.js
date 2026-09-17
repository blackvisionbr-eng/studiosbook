import "dotenv/config";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import Stripe from "stripe";
import {
  PIX_ACCESS_DAYS,
  TRIAL_DAYS,
  addDays,
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
} from "./billing.js";
import { createMarketplaceBookingRouter } from "./marketplaceBooking.js";
import {
  PLAN_CATALOG,
  PLAN_CODES,
  normalizePlanCode,
  planDefinition,
  planFromStripePrice,
  planGrantsReceivables,
  validateStripePriceForPlan,
} from "./plans.js";

const app = express();
const PRODUCT_NAME = "StudiosBook";
const AGENDA_PLAN = PLAN_CATALOG[PLAN_CODES.AGENDA];
const RECEIVABLES_PLAN = PLAN_CATALOG[PLAN_CODES.RECEIVABLES];
const MONTHLY_AMOUNT = AGENDA_PLAN.amount;
const MASTER_ADMIN_EMAIL = String(process.env.MASTER_ADMIN_EMAIL || "getblackvision.br@gmail.com")
  .trim()
  .toLowerCase();
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs";
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://studiosbook.com.br";
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app";
const STRIPE_WEBHOOK_URL =
  process.env.STRIPE_WEBHOOK_URL || `${PUBLIC_API_URL}/functions/stripe-webhook`;
const MERCADO_PAGO_API_BASE = process.env.MERCADO_PAGO_API_BASE || "https://api.mercadopago.com";
const MERCADO_PAGO_WEBHOOK_URL =
  process.env.MERCADO_PAGO_WEBHOOK_URL || `${PUBLIC_API_URL}/functions/mercado-pago-webhook`;
const META_GRAPH_API_VERSION = String(process.env.META_GRAPH_API_VERSION || "v23.0").trim();
const EXTRA_FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  [
    PUBLIC_APP_URL,
    "https://studiosbook.com.br",
    "https://www.studiosbook.com.br",
    "https://studiosbook.web.app",
    "https://blackvision-27f1c.web.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4177",
    "http://127.0.0.1:4177",
    ...EXTRA_FRONTEND_ORIGINS,
  ].filter(Boolean)
);

let adminAuth = null;
let adminDb = null;
let firebaseAdminReady = false;

function parseServiceAccountJson(value) {
  if (!value) return null;
  const source = String(value).trim();
  const json = source.startsWith("{") ? source : Buffer.from(source, "base64").toString("utf8");
  return JSON.parse(json);
}

function serviceAccountFromEnv() {
  const jsonAccount = parseServiceAccountJson(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
  if (jsonAccount) return jsonAccount;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;

  return {
    projectId: FIREBASE_PROJECT_ID,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function normalizePrivateKey(value) {
  const endMarker = "-----END PRIVATE KEY-----";
  let key = String(value || "")
    .trim()
    .replace(/^['"]/, "")
    .replace(/['"]$/, "")
    .replace(/\\"/g, '"')
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");

  const beginIndex = key.indexOf("-----BEGIN PRIVATE KEY-----");
  const endIndex = key.indexOf(endMarker);
  if (beginIndex >= 0 && endIndex >= 0) {
    key = `${key.slice(beginIndex, endIndex + endMarker.length)}\n`;
  }
  return key;
}

function initializeFirebaseAdmin() {
  try {
    if (!getApps().length) {
      const serviceAccount = serviceAccountFromEnv();
      if (!serviceAccount) {
        return;
      }
      initializeApp({
        credential: cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID,
      });
    }
    adminAuth = getAuth();
    adminDb = getFirestore();
    firebaseAdminReady = true;
  } catch (error) {
    console.error("Firebase Admin init error", error);
  }
}

initializeFirebaseAdmin();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);
app.use((req, res, next) => {
  const suppliedRequestId = String(req.headers["x-request-id"] || "")
    .replace(/[^A-Za-z0-9._:-]/g, "")
    .slice(0, 64);
  req.requestId = suppliedRequestId || randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      const error = new Error("Origem não autorizada pelo CORS.");
      error.code = "CORS_ORIGIN_DENIED";
      return callback(error);
    },
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => [
      "/functions/stripe-webhook",
      "/functions/mercado-pago-webhook",
      "/functions/booking-marketplace-webhook",
    ].includes(req.path),
    message: { error: "Muitas solicitações. Aguarde alguns minutos." },
  })
);
app.post(
  "/functions/stripe-webhook",
  express.raw({ type: "application/json", limit: "256kb" }),
  stripeWebhookHandler
);
app.use(express.json({ limit: "256kb" }));

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user.uid,
  message: { error: "Limite administrativo temporariamente atingido." },
});
const billingPaymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user.uid,
  message: { error: "Muitas tentativas de pagamento. Aguarde alguns minutos." },
});
const billingSyncRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user.uid,
  message: { error: "Muitas sincronizações. Aguarde alguns minutos." },
});

function safeOrigin(value) {
  try {
    const parsed = new URL(value || PUBLIC_APP_URL);
    const origin = `${parsed.protocol}//${parsed.host}`;
    return allowedOrigins.has(origin) ? origin : PUBLIC_APP_URL;
  } catch {
    return PUBLIC_APP_URL;
  }
}

function safeMarketingString(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function sha256MarketingValue(value) {
  const normalized = safeMarketingString(value, 320).trim().toLowerCase();
  return normalized ? createHash("sha256").update(normalized).digest("hex") : "";
}

function alphabeticIdentifierSuffix(value) {
  return [...createHash("sha256").update(String(value)).digest().subarray(0, 8)]
    .map((byte) => String.fromCharCode(97 + (byte % 26)))
    .join("");
}

function normalizeMarketingContext(value = {}) {
  if (!value || value.consent !== true) return null;
  const attributionKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
  ];
  const attribution = attributionKeys.reduce((result, key) => {
    const current = safeMarketingString(value.attribution?.[key], 180);
    if (current) result[key] = current;
    return result;
  }, {});
  return {
    consent: true,
    checkout_event_id: safeMarketingString(value.checkout_event_id, 180),
    client_id: safeMarketingString(value.client_id, 80),
    client_user_agent: safeMarketingString(value.client_user_agent, 300),
    landing_page: safeMarketingString(value.landing_page, 500),
    referrer: safeMarketingString(value.referrer, 500),
    fbp: safeMarketingString(value.fbp, 180),
    fbc: safeMarketingString(value.fbc, 220),
    attribution,
    captured_at: new Date().toISOString(),
  };
}

function marketingConfiguration() {
  return {
    meta_capi: Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN),
    ga4_measurement_protocol: Boolean(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET),
  };
}

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || "";
}

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}

function stripePriceId() {
  return process.env.STRIPE_PRICE_ID || "";
}

function safeReturnPath(value) {
  const path = String(value || "/").trim();
  return ["/", "/recebimentos"].includes(path) ? path : "/";
}

function stripeReceivablesPriceId() {
  return process.env.STRIPE_RECEIVABLES_PRICE_ID || "";
}

function stripePortalConfigurationId() {
  return process.env.STRIPE_PORTAL_CONFIGURATION_ID || "";
}

function mercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
}

function mercadoPagoWebhookSecret() {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
}

function stripeMode() {
  return stripeKeyMode(stripeSecretKey());
}

let stripeInstance = null;
let stripeCapabilitiesCache = { expiresAt: 0, value: null };
const stripePlanPriceCache = new Map();
function stripeClient() {
  const secret = stripeSecretKey();
  if (!secret) {
    const error = new Error("Stripe não configurada.");
    error.missingSecret = "STRIPE_SECRET_KEY";
    throw error;
  }
  if (!stripeInstance) stripeInstance = new Stripe(secret, { maxNetworkRetries: 2, timeout: 12000 });
  return stripeInstance;
}

async function resolveStripePlanPrice(planCode) {
  const plan = planDefinition(planCode);
  const cached = stripePlanPriceCache.get(plan.code);
  if (cached?.expiresAt > Date.now()) return cached.price;

  const configuredId = plan.code === PLAN_CODES.RECEIVABLES
    ? stripeReceivablesPriceId()
    : stripePriceId();
  let price = configuredId
    ? await stripeClient().prices.retrieve(configuredId)
    : null;
  if (!price && plan.lookupKey) {
    const listed = await stripeClient().prices.list({
      active: true,
      lookup_keys: [plan.lookupKey],
      limit: 1,
    });
    price = listed.data[0] || null;
  }
  if (!price) throw Object.assign(new Error(`Preço do plano ${plan.name} não configurado.`), { statusCode: 503 });

  const validation = validateStripePriceForPlan(price, plan.code);
  if (!validation.valid) {
    throw Object.assign(new Error(`Preço Stripe inválido para ${plan.name}: ${validation.reason}.`), { statusCode: 503 });
  }
  stripePlanPriceCache.set(plan.code, { price, expiresAt: Date.now() + 5 * 60 * 1000 });
  return price;
}

async function resolveStripePlanPriceId(planCode) {
  return (await resolveStripePlanPrice(planCode)).id;
}

async function stripePlanFromSubscription(subscription = {}) {
  const firstPrice = subscription?.items?.data?.[0]?.price;
  let plan = planFromStripePrice(firstPrice);
  if (plan || !stripeResourceId(firstPrice)) return plan;
  const price = await stripeClient().prices.retrieve(stripeResourceId(firstPrice));
  return planFromStripePrice(price);
}

async function stripePaymentCapabilities(force = false) {
  if (!force && stripeCapabilitiesCache.value && stripeCapabilitiesCache.expiresAt > Date.now()) {
    return stripeCapabilitiesCache.value;
  }
  const value = {
    card_recurring: Boolean(stripeSecretKey() && stripePriceId()),
    receivables_recurring: Boolean(stripeSecretKey() && (stripeReceivablesPriceId() || await resolveStripePlanPriceId(PLAN_CODES.RECEIVABLES).catch(() => ""))),
    pix: Boolean(mercadoPagoAccessToken()),
    pix_provider: mercadoPagoAccessToken() ? "mercado_pago" : "",
  };
  stripeCapabilitiesCache = { expiresAt: Date.now() + 5 * 60 * 1000, value };
  return value;
}

function adminStatusPayload() {
  return {
    admin_ready: firebaseAdminReady,
    stripe_ready: Boolean(stripeSecretKey() && stripePriceId()),
    stripe_receivables_ready: Boolean(stripeSecretKey() && stripeReceivablesPriceId()),
    stripe_mode: stripeMode(),
    webhook_ready: Boolean(stripeWebhookSecret()),
    mercado_pago_ready: Boolean(mercadoPagoAccessToken()),
    mercado_pago_webhook_ready: Boolean(mercadoPagoWebhookSecret()),
  };
}

async function requireFirebaseUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Login obrigatório." });

    if (!firebaseAdminReady || !adminAuth) {
      return res.status(503).json({ error: "Serviço de autenticação temporariamente indisponível." });
    }
    const payload = await adminAuth.verifyIdToken(token, true);

    req.user = {
      uid: payload.uid || payload.user_id || payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email || "Profissional",
      emailVerified: payload.email_verified === true,
      platformAdmin: payload.platform_admin === true,
      platformRole: String(payload.platform_role || ""),
      authTime: Number(payload.auth_time || 0),
    };
    return next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function requireMasterAdmin(req, res, next) {
  requireFirebaseUser(req, res, () => {
    const email = String(req.user?.email || "").trim().toLowerCase();
    if (
      !req.user?.platformAdmin ||
      req.user?.platformRole !== "master_admin" ||
      !req.user?.emailVerified ||
      email !== MASTER_ADMIN_EMAIL
    ) {
      return res.status(403).json({ error: "Ação restrita ao administrador mestre do StudiosBook." });
    }
    return next();
  });
}

function requirePlatformAdmin(req, res, next) {
  requireFirebaseUser(req, res, () => {
    if (!req.user?.platformAdmin || !req.user?.emailVerified) {
      return res.status(403).json({ error: "Acesso restrito ao administrador do StudiosBook." });
    }
    return next();
  });
}

function requireRecentAdminAuth(req, res, next) {
  const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(req.user?.authTime || 0);
  if (!Number.isFinite(authAgeSeconds) || authAgeSeconds < -60 || authAgeSeconds > 15 * 60) {
    return res.status(401).json({
      error: "Confirme novamente sua senha para executar esta ação administrativa.",
      code: "recent_auth_required",
    });
  }
  return next();
}

function requireFirebaseAdminSdk(res) {
  if (firebaseAdminReady && adminDb && adminAuth) return true;
  res.status(503).json({ error: "Serviço administrativo temporariamente indisponível." });
  return false;
}

async function recordAdminAudit(req, action, details = {}) {
  if (!adminDb || !req.user?.uid) return;
  const forwarded = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  const ipHash = createHash("sha256")
    .update(`${forwarded}:${process.env.AUDIT_HASH_SALT || FIREBASE_PROJECT_ID}`)
    .digest("hex");
  await adminDb.collection("AdminAuditLog").add({
    action,
    admin_uid: req.user.uid,
    admin_email: req.user.email || "",
    target_uid: String(details.target_uid || ""),
    metadata: toJsonSafe(details.metadata || {}),
    request_id: req.requestId || "",
    ip_hash: ipHash,
    created_at: FieldValue.serverTimestamp(),
  });
}

async function safeAdminAudit(req, action, details = {}) {
  try {
    await recordAdminAudit(req, action, details);
  } catch (error) {
    console.error("Admin audit write failed", { requestId: req.requestId, action, error: error?.message });
  }
}

async function sendFirebasePasswordReset(email) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Firebase-Locale": "pt-BR",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl: `${PUBLIC_APP_URL}/admin`,
        canHandleCodeInApp: false,
        linkDomain: "studiosbook.com.br",
      }),
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Não foi possível enviar o e-mail de redefinição.");
    error.code = payload?.error?.message || "PASSWORD_RESET_FAILED";
    throw error;
  }
}

function toJsonSafe(value) {
  if (!value || typeof value !== "object") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]));
}

function mercadoPagoTokenMode() {
  const token = mercadoPagoAccessToken();
  if (/^APP_USR-/i.test(token)) return "live";
  if (/^TEST-/i.test(token)) return "test";
  return token ? "configured" : "unconfigured";
}

function mercadoPagoRequireLiveMode() {
  return String(process.env.MERCADO_PAGO_REQUIRE_LIVE || "false").toLowerCase() === "true";
}

function mercadoPagoPaymentId(payment = {}) {
  return String(payment.id || payment.data?.id || "").trim();
}

function mercadoPagoPaymentDocId(payment = {}) {
  return `mp_${mercadoPagoPaymentId(payment).replace(/[^A-Za-z0-9._:-]/g, "_")}`;
}

function mercadoPagoPixData(payment = {}) {
  const transactionData = payment.point_of_interaction?.transaction_data || {};
  return {
    qr_code: transactionData.qr_code || "",
    qr_code_base64: transactionData.qr_code_base64 || "",
    ticket_url: transactionData.ticket_url || payment.transaction_details?.external_resource_url || "",
    expires_at: payment.date_of_expiration || "",
  };
}

async function mercadoPagoRequest(path, options = {}) {
  const token = mercadoPagoAccessToken();
  if (!token) {
    const error = new Error("Mercado Pago não configurado.");
    error.missingSecret = "MERCADO_PAGO_ACCESS_TOKEN";
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || "Falha na API do Mercado Pago.";
    const error = new Error(message);
    error.statusCode = response.status;
    error.data = payload;
    throw error;
  }
  return payload;
}

function mercadoPagoRecordFromPayment(uid, payment = {}, options = {}) {
  const status = mercadoPagoPaymentStatus(payment);
  const pix = mercadoPagoPixData(payment);
  const paymentId = mercadoPagoPaymentId(payment);
  const now = new Date().toISOString();
  return {
    user_uid: uid,
    user_email: payment.payer?.email || options.email || "",
    provider: "mercado_pago",
    billing_flow: "pix",
    mercado_pago_payment_id: paymentId,
    external_reference: String(payment.external_reference || ""),
    status,
    status_detail: payment.status_detail || payment.status || "",
    amount: Number(payment.transaction_amount || 0),
    net_received_amount: Number(payment.transaction_details?.net_received_amount || 0),
    currency_id: String(payment.currency_id || "BRL").toUpperCase(),
    payment_method_id: payment.payment_method_id || "",
    payment_type_id: payment.payment_type_id || "",
    date_created: payment.date_created || now,
    date_approved: status === "approved" ? payment.date_approved || now : "",
    date_last_updated: payment.date_last_updated || now,
    date_of_expiration: payment.date_of_expiration || "",
    live_mode: Boolean(payment.live_mode),
    pix_qr_code: pix.qr_code,
    pix_qr_code_base64: pix.qr_code_base64,
    pix_ticket_url: pix.ticket_url,
    pix_expires_at: pix.expires_at,
    updated_date: now,
  };
}

function paymentWebhookDataId(req) {
  return String(req.query?.["data.id"] || req.query?.id || req.body?.data?.id || req.body?.id || "").trim();
}

function parseMercadoPagoSignature(value = "") {
  return String(value)
    .split(",")
    .map((entry) => entry.trim().split("="))
    .reduce((acc, [key, val]) => {
      if (key && val) acc[key] = val;
      return acc;
    }, {});
}

function safeSignatureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validateMercadoPagoWebhook(req) {
  const secret = mercadoPagoWebhookSecret();
  if (!secret) return { valid: false, reason: "missing_secret" };
  const signature = parseMercadoPagoSignature(req.headers["x-signature"]);
  const dataId = paymentWebhookDataId(req);
  const requestId = String(req.headers["x-request-id"] || "");
  if (!signature.ts || !signature.v1 || !dataId || !requestId) {
    return { valid: false, reason: "missing_signature_parts" };
  }
  const manifest = `id:${dataId};request-id:${requestId};ts:${signature.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeSignatureEqual(expected, signature.v1)
    ? { valid: true, dataId }
    : { valid: false, reason: "signature_mismatch" };
}

async function claimMercadoPagoWebhookEvent(eventId, eventType) {
  const safeId = String(eventId || randomUUID()).replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 180);
  const ref = adminDb.collection("MercadoPagoWebhookEvent").doc(safeId);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    if (current?.status === "processed") return false;
    const lastAttempt = new Date(current?.updated_date || 0).getTime();
    if (current?.status === "processing" && Date.now() - lastAttempt < 5 * 60 * 1000) return false;
    transaction.set(
      ref,
      {
        event_id: safeId,
        event_type: eventType || "",
        status: "processing",
        attempts: Number(current?.attempts || 0) + 1,
        created_date: current?.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  });
}

async function listCollection(ref, limit = 500) {
  const snapshot = await ref.limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...toJsonSafe(doc.data()) }));
}

async function listCollectionAll(ref, pageSize = 500) {
  const rows = [];
  let cursor = null;
  do {
    let query = ref.orderBy(FieldPath.documentId()).limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    rows.push(...snapshot.docs.map((doc) => ({ id: doc.id, ...toJsonSafe(doc.data()) })));
    cursor = snapshot.docs.at(-1) || null;
    if (snapshot.size < pageSize) break;
  } while (cursor);
  return rows;
}

function sortByLatest(rows = []) {
  return [...rows].sort((left, right) => {
    const leftDate = new Date(left.updated_date || left.created_date || 0).getTime();
    const rightDate = new Date(right.updated_date || right.created_date || 0).getTime();
    return rightDate - leftDate;
  });
}

function billingCollection(uid) {
  return adminDb.collection("users").doc(uid).collection("BillingSubscription");
}

function paymentCollection(uid) {
  return adminDb.collection("users").doc(uid).collection("BillingPayment");
}

async function currentSubscription(uid) {
  const collectionRef = billingCollection(uid);
  const currentRef = collectionRef.doc("current");
  const currentSnapshot = await currentRef.get();
  if (currentSnapshot.exists) {
    return { ref: currentRef, data: { id: currentSnapshot.id, ...toJsonSafe(currentSnapshot.data()) } };
  }

  const rows = sortByLatest(await listCollection(collectionRef, 20));
  if (rows[0]) return { ref: collectionRef.doc(rows[0].id), data: rows[0] };
  return { ref: currentRef, data: null };
}

async function latestBillingPayment(uid) {
  const rows = sortByLatest(await listCollection(paymentCollection(uid), 30));
  return rows[0] || null;
}

function marketingPaymentId(payment = {}) {
  return safeMarketingString(
    payment.id || payment.stripe_invoice_id || payment.mercado_pago_payment_id || payment.stripe_payment_intent_id,
    180
  );
}

async function claimFirstPurchase(uid, payment = {}) {
  const paymentId = marketingPaymentId(payment);
  if (!uid || !paymentId) return { firstPayment: false, eventId: "", reason: "missing_payment_id" };
  const conversionRef = adminDb.collection("MarketingAcquisition").doc(uid);
  const eventId = `purchase-${safeMarketingString(payment.provider || "payment", 32)}-${paymentId}`
    .replace(/[^A-Za-z0-9._:-]/g, "_")
    .slice(0, 180);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(conversionRef);
    const current = snapshot.exists ? toJsonSafe(snapshot.data()) : null;
    if (current && current.payment_id !== paymentId) {
      return { firstPayment: false, eventId: current.event_id || "", reason: "renewal" };
    }
    const now = new Date().toISOString();
    transaction.set(
      conversionRef,
      {
        uid,
        payment_id: paymentId,
        provider: payment.provider || "",
        event_id: current?.event_id || eventId,
        status: "processing",
        attempts: Number(current?.attempts || 0) + 1,
        created_date: current?.created_date || now,
        updated_date: now,
      },
      { merge: true }
    );
    return { firstPayment: true, eventId: current?.event_id || eventId, reason: current ? "retry" : "first_payment" };
  });
}

async function sendMetaPurchase(context, payment, eventId, uid) {
  if (!marketingConfiguration().meta_capi) return { target: "meta", status: "unconfigured" };
  const eventTimestamp = Math.floor(new Date(payment.date_approved || Date.now()).getTime() / 1000);
  const userData = {};
  if (context.client_user_agent) userData.client_user_agent = context.client_user_agent;
  if (context.fbp) userData.fbp = context.fbp;
  if (context.fbc) userData.fbc = context.fbc;
  const emailHash = sha256MarketingValue(payment.user_email);
  const externalIdHash = sha256MarketingValue(uid);
  if (emailHash) userData.em = [emailHash];
  if (externalIdHash) userData.external_id = [externalIdHash];
  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(META_GRAPH_API_VERSION)}/${encodeURIComponent(process.env.META_PIXEL_ID)}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: "Purchase",
            event_time: Number.isFinite(eventTimestamp) ? eventTimestamp : Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: "website",
            event_source_url: context.landing_page || `${PUBLIC_APP_URL}/gestao-para-studios`,
            user_data: userData,
            custom_data: {
              currency: "BRL",
              value: Number(payment.amount || MONTHLY_AMOUNT),
              content_ids: ["studiosbook-monthly"],
              content_type: "product",
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!response.ok) throw new Error(`Meta CAPI respondeu ${response.status}.`);
  return { target: "meta", status: "sent" };
}

async function sendGa4Purchase(context, payment, eventId) {
  if (!marketingConfiguration().ga4_measurement_protocol) return { target: "ga4", status: "unconfigured" };
  if (!context.client_id) return { target: "ga4", status: "missing_client_id" };
  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", process.env.GA4_MEASUREMENT_ID);
  url.searchParams.set("api_secret", process.env.GA4_API_SECRET);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: context.client_id,
      non_personalized_ads: false,
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: marketingPaymentId(payment),
            value: Number(payment.amount || MONTHLY_AMOUNT),
            currency: "BRL",
            payment_type: payment.provider || "",
            event_id: eventId,
            items: [{ item_id: "studiosbook-monthly", item_name: "StudiosBook mensal", price: Number(payment.amount || MONTHLY_AMOUNT), quantity: 1 }],
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`GA4 Measurement Protocol respondeu ${response.status}.`);
  return { target: "ga4", status: "sent" };
}

async function reportFirstPurchase(uid, payment = {}) {
  if (String(payment.status || "").toLowerCase() !== "approved") return { firstPayment: false };
  if (Number(payment.amount || 0) < MONTHLY_AMOUNT - 0.01) return { firstPayment: false, reason: "zero_or_partial_amount" };
  const claim = await claimFirstPurchase(uid, payment);
  if (!claim.firstPayment) return claim;

  const account = await ensureBillingAccount(uid, payment.user_email || "");
  const context = normalizeMarketingContext(account.subscription?.marketing_context || {});
  const conversionRef = adminDb.collection("MarketingAcquisition").doc(uid);
  const paymentRef = paymentCollection(uid).doc(marketingPaymentId(payment));
  let status = "pending_configuration";
  let deliveries = [];

  if (!context) {
    status = "skipped_no_consent";
  } else if (String(payment.user_email || account.subscription?.user_email || "").toLowerCase() === MASTER_ADMIN_EMAIL) {
    status = "excluded_internal_account";
  } else if (payment.live_mode !== true) {
    status = "excluded_test_payment";
  } else {
    const results = await Promise.allSettled([
      sendMetaPurchase(context, payment, claim.eventId, uid),
      sendGa4Purchase(context, payment, claim.eventId),
    ]);
    deliveries = results.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : { target: index === 0 ? "meta" : "ga4", status: "failed", error: safeMarketingString(result.reason?.message, 180) }
    );
    const sent = deliveries.filter((delivery) => delivery.status === "sent").length;
    const failed = deliveries.filter((delivery) => delivery.status === "failed").length;
    status = sent > 0 && failed === 0 ? "sent" : failed > 0 ? "partial_or_failed" : "pending_configuration";
  }

  const update = {
    status,
    deliveries,
    consent: Boolean(context),
    updated_date: new Date().toISOString(),
  };
  await Promise.all([
    conversionRef.set(update, { merge: true }),
    paymentRef.set(
      {
        marketing_first_payment: true,
        marketing_event_id: claim.eventId,
        marketing_delivery_status: status,
        updated_date: new Date().toISOString(),
      },
      { merge: true }
    ),
  ]);
  return { ...claim, status, deliveries };
}

async function persistBillingState(uid, patch, options = {}) {
  const now = new Date().toISOString();
  const current = await currentSubscription(uid);
  const userRef = adminDb.collection("users").doc(uid);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(current.ref);
    const stored = snapshot.exists ? { id: snapshot.id, ...toJsonSafe(snapshot.data()) } : current.data || {};
    const merged = {
      ...stored,
      ...patch,
      updated_date: now,
    };
    if (!snapshot.exists && !current.data) merged.created_date = patch.created_date || now;

    const access = billingAccess(merged);
    merged.status = access.status;
    const expiryCandidates = [merged.current_period_end, merged.trial_end_date, merged.admin_override_until]
      .map((value) => new Date(value || 0))
      .filter((date) => Number.isFinite(date.getTime()));
    const accessExpiresAt = expiryCandidates.length
      ? new Date(Math.max(...expiryCandidates.map((date) => date.getTime())))
      : new Date(0);
    const activePlan = planDefinition(merged.plan_code);
    merged.plan_code = activePlan.code;
    merged.plan_name = activePlan.name;
    merged.monthly_amount = activePlan.amount;
    const receivablesAllowed = access.allowed && planGrantsReceivables(activePlan.code);

    transaction.set(current.ref, merged, { merge: true });
    transaction.set(
      userRef,
      {
        user_email: merged.user_email || options.email || "",
        billing_status: access.status,
        access_allowed: options.forceAccess === true || access.allowed,
        access_reason: options.forceAccess === true ? "admin_override" : access.reason,
        access_expires_at: Timestamp.fromDate(accessExpiresAt),
        admin_access_override: merged.admin_access_override || "",
        admin_override_until: merged.admin_override_until || "",
        trial_start_date: merged.trial_start_date || "",
        trial_end_date: merged.trial_end_date || "",
        current_period_end: merged.current_period_end || "",
        plan_code: activePlan.code,
        plan_name: activePlan.name,
        receivables_access_allowed: receivablesAllowed,
        receivables_access_expires_at: receivablesAllowed ? accessExpiresAt.toISOString() : "",
        receivables_plan_code: activePlan.code,
        billing_updated_at: now,
      },
      { merge: true }
    );

    return {
      subscription: { id: current.ref.id, ...merged },
      access: options.forceAccess === true ? { ...access, allowed: true, reason: "admin_override" } : access,
    };
  });
}

async function ensureBillingAccount(uid, email = "") {
  const authUser = await adminAuth.getUser(uid);
  const accountEmail = authUser.email || email || "";
  const trial = trialFromAccountCreation(authUser.metadata?.creationTime || new Date());
  const current = await currentSubscription(uid);
  const existing = current.data || {};
  const existingPlan = planDefinition(existing.plan_code);
  const migratingToStripe = existing.billing_provider !== "stripe";
  const paidPeriodActive = new Date(existing.current_period_end || 0).getTime() > Date.now();
  const result = await persistBillingState(
    uid,
    {
      user_email: accountEmail,
      plan_code: existingPlan.code,
      plan_name: existingPlan.name,
      monthly_amount: existingPlan.amount,
      currency_id: "BRL",
      billing_provider: "stripe",
      trial_start_date: trial.start.toISOString(),
      trial_end_date: trial.end.toISOString(),
      status: existing.status || (trial.active ? "trialing" : "expired"),
      ...(migratingToStripe
        ? {
            stripe_subscription_status: "not_started",
            last_payment_status: paidPeriodActive ? existing.last_payment_status || "approved" : "not_started",
            last_payment_detail: "",
          }
        : {}),
      notes: migratingToStripe
        ? "Cobrança migrada para a Stripe; teste gratuito preservado desde o cadastro."
        : existing.notes || "Teste gratuito iniciado na data de criação da conta.",
    },
    { email: accountEmail }
  );

  return {
    ...result,
    latest_payment: await latestBillingPayment(uid),
    account_created_at: trial.start.toISOString(),
  };
}

const USER_ENTITY_NAMES = [
  "Client",
  "ServiceRecord",
  "Appointment",
  "StudioProfile",
  "BackupSnapshot",
  "BillingSubscription",
  "BillingPayment",
];

async function loadWorkspace(uid, includeRows = false) {
  const userDoc = adminDb.collection("users").doc(uid);
  const entityRows = {};
  const entityCounts = {};

  const [rootSnapshot] = await Promise.all([
    userDoc.get(),
    ...USER_ENTITY_NAMES.map(async (entityName) => {
      const collectionRef = userDoc.collection(entityName);
      if (includeRows) {
        entityRows[entityName] = await listCollectionAll(collectionRef);
        entityCounts[entityName] = entityRows[entityName].length;
        return;
      }
      const [rows, countSnapshot] = await Promise.all([
        listCollection(collectionRef, 20),
        collectionRef.count().get(),
      ]);
      entityRows[entityName] = rows;
      entityCounts[entityName] = Number(countSnapshot.data().count || 0);
    }),
  ]);

  const profile = entityRows.StudioProfile?.[0] || null;
  const subscription = sortByLatest(entityRows.BillingSubscription)?.[0] || null;
  const payments = sortByLatest(entityRows.BillingPayment).slice(0, 10);
  const counts = Object.fromEntries(USER_ENTITY_NAMES.map((entityName) => [entityName, entityCounts[entityName] || 0]));

  return {
    uid,
    root: rootSnapshot.data() || {},
    profile,
    subscription,
    payments,
    latestPayment: payments[0] || null,
    counts,
    rows: includeRows ? entityRows : undefined,
  };
}

async function listWorkspaceIds() {
  const docs = await adminDb.collection("users").listDocuments();
  return docs.map((doc) => doc.id);
}

async function listAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    users.push(
      ...result.users.map((user) => ({
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        disabled: user.disabled,
        creationTime: user.metadata?.creationTime || "",
        lastSignInTime: user.metadata?.lastSignInTime || "",
        providers: user.providerData?.map((provider) => provider.providerId) || [],
        platformAdmin: user.customClaims?.platform_admin === true,
        platformRole: String(user.customClaims?.platform_role || ""),
      }))
    );
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

function stripeResourceId(value) {
  return typeof value === "string" ? value : value?.id || "";
}

function stripeSubscriptionScore(status) {
  return {
    active: 7,
    trialing: 6,
    past_due: 5,
    incomplete: 4,
    paused: 3,
    unpaid: 2,
    canceled: 1,
    incomplete_expired: 0,
  }[String(status || "").toLowerCase()] ?? -1;
}

function stripePaymentIntentStatus(status) {
  if (status === "succeeded") return "approved";
  if (["processing", "requires_action", "requires_confirmation"].includes(status)) return "pending";
  return "rejected";
}

async function stripeSubscriptionUsesConfiguredPlan(subscription) {
  const firstItem = subscription?.items?.data?.[0];
  const priceId = stripeResourceId(firstItem?.price);
  const plan = await stripePlanFromSubscription(subscription);
  if (!plan || !priceId) return false;
  const configuredPriceId = await resolveStripePlanPriceId(plan.code);
  return priceId === configuredPriceId;
}

async function assertStripeSubscriptionPlan(subscription) {
  if (!(await stripeSubscriptionUsesConfiguredPlan(subscription))) {
    throw new Error("Assinatura Stripe não pertence ao plano configurado do StudiosBook.");
  }
  if (stripeMode() === "live" && subscription?.livemode !== true) {
    throw new Error("Assinatura de teste não pode liberar acesso em produção.");
  }
  return stripePlanFromSubscription(subscription);
}

async function resolveStripeUid(object = {}) {
  const direct = stripeObjectUid(object);
  if (direct) return direct;

  const subscriptionId = stripeInvoiceSubscriptionId(object) || stripeResourceId(object.subscription);
  if (subscriptionId) {
    const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
    const fromSubscription = stripeObjectUid(subscription);
    if (fromSubscription) return fromSubscription;
  }

  const customerId = stripeResourceId(object.customer);
  if (customerId) {
    const customer = await stripeClient().customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.studiosbook_uid) {
      return String(customer.metadata.studiosbook_uid);
    }
  }
  return "";
}

async function resolveStripeChargeUid(charge = {}) {
  const direct = await resolveStripeUid(charge);
  if (direct) return direct;

  const paymentIntentId = stripeResourceId(charge.payment_intent);
  if (!paymentIntentId) return "";
  const paymentIntent = await stripeClient().paymentIntents.retrieve(paymentIntentId);
  return stripeObjectUid(paymentIntent) || resolveStripeUid(paymentIntent);
}

async function stripeInvoiceCharge(invoice = {}) {
  if (invoice.charge) {
    return typeof invoice.charge === "object"
      ? invoice.charge
      : stripeClient().charges.retrieve(invoice.charge);
  }

  const paymentIntentId = stripeInvoicePaymentIntentId(invoice);
  if (!paymentIntentId) return null;
  const paymentIntent = await stripeClient().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  if (!paymentIntent.latest_charge) return null;
  return typeof paymentIntent.latest_charge === "object"
    ? paymentIntent.latest_charge
    : stripeClient().charges.retrieve(paymentIntent.latest_charge);
}

async function stripeRefundCharge(object = {}) {
  if (object.object === "charge" || String(object.id || "").startsWith("ch_")) return object;
  const chargeId = stripeResourceId(object.charge);
  return chargeId ? stripeClient().charges.retrieve(chargeId) : null;
}

async function ensureStripeCustomer(uid, email, name = "") {
  const account = await ensureBillingAccount(uid, email);
  const storedId = account.subscription?.stripe_customer_id || "";
  if (storedId) {
    try {
      const stored = await stripeClient().customers.retrieve(storedId);
      if (!stored.deleted) return stored;
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
    }
  }

  const listed = email ? await stripeClient().customers.list({ email, limit: 100 }) : { data: [] };
  let customer = listed.data.find((item) => item.metadata?.studiosbook_uid === uid);
  if (!customer) {
    customer = await stripeClient().customers.create(
      {
        email: email || undefined,
        name: name || undefined,
        metadata: { studiosbook_uid: uid, product: PRODUCT_NAME },
      },
      { idempotencyKey: `studiosbook-customer-${createHash("sha256").update(uid).digest("hex")}` }
    );
  }

  await persistBillingState(
    uid,
    { billing_provider: "stripe", stripe_customer_id: customer.id, last_sync_date: new Date().toISOString() },
    { email }
  );
  return customer;
}

async function applyStripeSubscription(uid, subscription) {
  const ownerUid = stripeObjectUid(subscription);
  if (!uid || (ownerUid && ownerUid !== uid)) throw new Error("Assinatura Stripe não pertence à conta informada.");
  const plan = await assertStripeSubscriptionPlan(subscription);

  const account = await ensureBillingAccount(uid);
  const period = stripeSubscriptionPeriod(subscription);
  const providerStatus = String(subscription.status || "pending").toLowerCase();
  const firstItem = subscription.items?.data?.[0];
  const failed = ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(providerStatus);
  const patch = {
    billing_provider: "stripe",
    plan_code: plan.code,
    plan_name: plan.name,
    monthly_amount: plan.amount,
    stripe_customer_id: stripeResourceId(subscription.customer) || account.subscription?.stripe_customer_id || "",
    stripe_subscription_id: subscription.id || "",
    stripe_price_id: stripeResourceId(firstItem?.price) || stripePriceId(),
    stripe_subscription_status: providerStatus,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: stripeTimestampToIso(subscription.canceled_at),
    ...(period.start ? { current_period_start: period.start } : {}),
    ...(period.end ? { current_period_end: period.end, next_payment_date: period.end } : {}),
    ...(subscription.trial_end ? { trial_end_date: stripeTimestampToIso(subscription.trial_end) } : {}),
    last_sync_date: new Date().toISOString(),
    notes: `Assinatura Stripe ${providerStatus} sincronizada.`,
  };
  if (failed) {
    patch.last_payment_status = "rejected";
    patch.last_payment_detail = providerStatus;
  } else if (providerStatus === "canceled") {
    patch.last_payment_status = account.subscription?.last_payment_status || "cancelled";
  } else if (providerStatus === "trialing" && account.subscription?.last_payment_status !== "approved") {
    patch.last_payment_status = "pending";
  }

  return persistBillingState(uid, patch, {
    email: account.subscription?.user_email || "",
  });
}

function stripeInvoicePeriod(invoice = {}) {
  const periods = (invoice.lines?.data || []).map((line) => line?.period || {}).filter(Boolean);
  const starts = periods.map((period) => Number(period.start)).filter((value) => value > 0);
  const ends = periods.map((period) => Number(period.end)).filter((value) => value > 0);
  return {
    start: starts.length ? stripeTimestampToIso(Math.min(...starts)) : stripeTimestampToIso(invoice.period_start),
    end: ends.length ? stripeTimestampToIso(Math.max(...ends)) : stripeTimestampToIso(invoice.period_end),
  };
}

async function applyStripeInvoice(uid, invoice, forcedStatus = "", validatedSubscription = null) {
  if (!uid) throw new Error("Fatura Stripe sem vínculo com a conta StudiosBook.");
  const account = await ensureBillingAccount(uid, invoice.customer_email || "");
  const refundedInvoice = account.subscription?.refunded_invoice_id === invoice.id;
  const status = refundedInvoice ? "refunded" : forcedStatus || stripeInvoicePaymentStatus(invoice);
  const period = stripeInvoicePeriod(invoice);
  const now = new Date().toISOString();
  const paymentIntentId = stripeInvoicePaymentIntentId(invoice);
  const subscriptionId = stripeInvoiceSubscriptionId(invoice);
  if (!subscriptionId) throw new Error("Fatura Stripe sem assinatura recorrente vinculada.");
  const invoiceCustomerId = stripeResourceId(invoice.customer);
  if (account.subscription?.stripe_customer_id && invoiceCustomerId !== account.subscription.stripe_customer_id) {
    throw new Error("Fatura Stripe não pertence ao cliente de cobrança da conta informada.");
  }
  const subscription = validatedSubscription?.id === subscriptionId
    ? validatedSubscription
    : await stripeClient().subscriptions.retrieve(subscriptionId);
  const ownerUid = stripeObjectUid(subscription);
  const trustedStoredSubscription = subscriptionId === account.subscription?.stripe_subscription_id;
  if (ownerUid !== uid && !(trustedStoredSubscription && !ownerUid)) {
    throw new Error("Fatura Stripe não pertence à assinatura da conta informada.");
  }
  const plan = await assertStripeSubscriptionPlan(subscription);
  const record = {
    user_uid: uid,
    user_email: invoice.customer_email || account.subscription?.user_email || "",
    provider: "stripe",
    billing_flow: "subscription",
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: subscriptionId,
    status,
    status_detail: invoice.status || forcedStatus || "",
    amount: Number(invoice.amount_paid || invoice.total || 0) / 100,
    net_received_amount: Number(invoice.amount_paid || 0) / 100,
    currency_id: String(invoice.currency || "brl").toUpperCase(),
    date_created: stripeTimestampToIso(invoice.created) || now,
    date_approved: status === "approved" ? stripeTimestampToIso(invoice.status_transitions?.paid_at) || now : "",
    date_last_updated: now,
    live_mode: Boolean(invoice.livemode),
    updated_date: now,
  };
  await paymentCollection(uid).doc(invoice.id).set(record, { merge: true });

  const patch = {
    billing_provider: "stripe",
    plan_code: plan.code,
    plan_name: plan.name,
    monthly_amount: plan.amount,
    stripe_customer_id: stripeResourceId(invoice.customer) || account.subscription?.stripe_customer_id || "",
    stripe_subscription_id: subscriptionId || account.subscription?.stripe_subscription_id || "",
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: paymentIntentId,
    last_payment_status: status,
    last_payment_detail: record.status_detail,
    last_payment_date: record.date_approved || now,
    last_sync_date: now,
    notes: `Fatura Stripe ${status} sincronizada.`,
  };
  if (status === "approved") {
    if (period.start) patch.current_period_start = period.start;
    if (period.end) {
      patch.current_period_end = period.end;
      patch.next_payment_date = period.end;
    }
    patch.last_approved_payment_id = invoice.id;
    patch.last_approved_payment_date = record.date_approved;
    const paidAt = Number(invoice.status_transitions?.paid_at || 0) * 1000;
    const revokedAt = new Date(account.subscription?.access_revoked_at || 0).getTime();
    if (
      account.subscription?.access_revoked_reason &&
      invoice.id !== account.subscription?.refunded_invoice_id &&
      Number.isFinite(revokedAt) &&
      paidAt > revokedAt
    ) {
      patch.access_revoked_at = "";
      patch.access_revoked_reason = "";
      patch.refund_status = "";
      patch.refunded_invoice_id = "";
      patch.refunded_charge_id = "";
    }
  } else if (status === "pending" && !forcedStatus) {
    delete patch.last_payment_status;
    delete patch.last_payment_detail;
    delete patch.last_payment_date;
  }

  const billing = await persistBillingState(uid, patch, {
    email: account.subscription?.user_email || record.user_email,
  });
  let marketing = { firstPayment: false };
  if (status === "approved") {
    marketing = await reportFirstPurchase(uid, { id: invoice.id, ...record }).catch((error) => {
      console.error("First purchase tracking error", { provider: "stripe", paymentId: invoice.id, message: error?.message });
      return { firstPayment: false, status: "failed" };
    });
  }
  return {
    ...billing,
    payment: {
      id: invoice.id,
      ...record,
      ...(marketing.firstPayment
        ? { marketing_first_payment: true, marketing_event_id: marketing.eventId, marketing_delivery_status: marketing.status }
        : {}),
    },
  };
}

async function applyStripeChargeRefund(uid, charge, options = {}) {
  const refund = stripeChargeRefundState(charge);
  if (!uid || refund.status === "none") return null;

  const now = new Date().toISOString();
  const account = await ensureBillingAccount(uid);
  const chargeCustomerId = stripeResourceId(charge.customer);
  if (account.subscription?.stripe_customer_id && chargeCustomerId !== account.subscription.stripe_customer_id) {
    throw new Error("Reembolso Stripe não pertence ao cliente da conta informada.");
  }

  const invoiceId = stripeResourceId(charge.invoice);
  const invoice = options.invoice || (invoiceId
    ? await stripeClient().invoices.retrieve(invoiceId, { expand: ["payments"] })
    : null);
  const subscriptionId = invoice ? stripeInvoiceSubscriptionId(invoice) : "";
  let subscription = null;
  if (subscriptionId) {
    subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
    const ownerUid = stripeObjectUid(subscription);
    const trustedStoredSubscription = subscriptionId === account.subscription?.stripe_subscription_id;
    if (ownerUid !== uid && !(trustedStoredSubscription && !ownerUid)) {
      throw new Error("Reembolso Stripe não pertence à assinatura da conta informada.");
    }
    await assertStripeSubscriptionPlan(subscription);
  }

  if (refund.full && subscriptionId && subscription?.status !== "canceled") {
    try {
      subscription = await stripeClient().subscriptions.cancel(subscriptionId);
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
    }
  }

  const paymentIntentId = stripeResourceId(charge.payment_intent) || (invoice ? stripeInvoicePaymentIntentId(invoice) : "");
  const paymentId = invoiceId || paymentIntentId || charge.id;
  const paymentRef = paymentCollection(uid).doc(paymentId);
  const existingPayment = await paymentRef.get();
  const existing = existingPayment.exists ? toJsonSafe(existingPayment.data()) : {};
  const record = {
    ...existing,
    user_uid: uid,
    user_email: existing.user_email || account.subscription?.user_email || "",
    provider: "stripe",
    billing_flow: invoiceId ? "subscription" : existing.billing_flow || "payment",
    stripe_invoice_id: invoiceId || existing.stripe_invoice_id || "",
    stripe_payment_intent_id: paymentIntentId || existing.stripe_payment_intent_id || "",
    stripe_subscription_id: subscriptionId || existing.stripe_subscription_id || "",
    stripe_charge_id: charge.id || existing.stripe_charge_id || "",
    status: refund.status,
    status_detail: options.eventType || "stripe_refund_sync",
    amount: refund.amount / 100,
    refunded_amount: refund.amountRefunded / 100,
    net_received_amount: refund.netAmount / 100,
    currency_id: String(charge.currency || existing.currency_id || "brl").toUpperCase(),
    date_refunded: now,
    date_last_updated: now,
    live_mode: Boolean(charge.livemode),
    updated_date: now,
  };
  await paymentRef.set(record, { merge: true });

  const commonPatch = {
    refund_status: refund.status,
    refunded_amount: refund.amountRefunded / 100,
    refunded_charge_id: charge.id || "",
    last_sync_date: now,
    notes: refund.full
      ? "Reembolso integral Stripe sincronizado; acesso revogado."
      : "Reembolso parcial Stripe sincronizado; acesso mantido.",
  };
  if (!refund.full) {
    const billing = await persistBillingState(uid, commonPatch, {
      email: account.subscription?.user_email || "",
    });
    return { ...billing, payment: { id: paymentId, ...record }, refund };
  }

  const billing = await persistBillingState(
    uid,
    {
      ...commonPatch,
      last_payment_status: "refunded",
      last_payment_detail: options.eventType || "charge.refunded",
      last_payment_date: now,
      stripe_subscription_status: subscriptionId ? "canceled" : account.subscription?.stripe_subscription_status || "",
      cancel_at_period_end: false,
      canceled_at: now,
      current_period_end: now,
      next_payment_date: "",
      access_revoked_at: now,
      access_revoked_reason: "refunded",
      refunded_invoice_id: invoiceId || "",
    },
    {
      email: account.subscription?.user_email || "",
    }
  );
  return { ...billing, payment: { id: paymentId, ...record }, refund };
}

async function applyStripePixPayment(uid, paymentIntent) {
  const ownerUid = stripeObjectUid(paymentIntent);
  if (!uid || ownerUid !== uid) throw new Error("Pagamento Pix Stripe não pertence à conta informada.");
  const now = new Date();
  const status = stripePaymentIntentStatus(paymentIntent.status);
  if (status === "approved") {
    const validation = validatePixPayment(paymentIntent, {
      expectedAmountCents: Math.round(MONTHLY_AMOUNT * 100),
      currency: "brl",
      productName: PRODUCT_NAME,
      requireLiveMode: stripeMode() === "live",
    });
    if (!validation.valid) {
      throw new Error(`Pagamento Pix inválido para concessão de acesso: ${validation.reason}.`);
    }
  }
  const account = await ensureBillingAccount(uid);
  const record = {
    user_uid: uid,
    user_email: account.subscription?.user_email || "",
    provider: "stripe",
    billing_flow: "pix",
    payment_method: "pix",
    stripe_payment_intent_id: paymentIntent.id,
    status,
    status_detail: paymentIntent.last_payment_error?.code || paymentIntent.status || "",
    amount: Number(paymentIntent.amount_received || paymentIntent.amount || 0) / 100,
    net_received_amount: Number(paymentIntent.amount_received || 0) / 100,
    currency_id: String(paymentIntent.currency || "brl").toUpperCase(),
    date_created: stripeTimestampToIso(paymentIntent.created) || now.toISOString(),
    date_approved: status === "approved" ? now.toISOString() : "",
    date_last_updated: now.toISOString(),
    live_mode: Boolean(paymentIntent.livemode),
    updated_date: now.toISOString(),
  };
  const patch = {
    billing_provider: "stripe",
    stripe_customer_id: stripeResourceId(paymentIntent.customer) || account.subscription?.stripe_customer_id || "",
    stripe_payment_intent_id: paymentIntent.id,
    last_payment_status: status,
    last_payment_detail: record.status_detail,
    last_payment_date: record.date_approved || record.date_last_updated,
    last_sync_date: now.toISOString(),
    notes: `Pagamento Pix Stripe ${status} sincronizado.`,
  };

  if (status !== "approved") {
    await paymentCollection(uid).doc(paymentIntent.id).set(record, { merge: true });
    const billing = await persistBillingState(uid, patch, {
      email: account.subscription?.user_email || "",
    });
    return { ...billing, payment: { id: paymentIntent.id, ...record } };
  }

  const current = await currentSubscription(uid);
  const paymentRef = paymentCollection(uid).doc(paymentIntent.id);
  const userRef = adminDb.collection("users").doc(uid);
  const result = await adminDb.runTransaction(async (transaction) => {
    const [subscriptionSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(current.ref),
      transaction.get(paymentRef),
    ]);
    const existingPayment = paymentSnapshot.exists ? toJsonSafe(paymentSnapshot.data()) : {};
    const subscription = subscriptionSnapshot.exists
      ? { id: subscriptionSnapshot.id, ...toJsonSafe(subscriptionSnapshot.data()) }
      : account.subscription || {};

    if (existingPayment.access_granted === true) {
      transaction.set(
        paymentRef,
        {
          ...record,
          date_approved: existingPayment.date_approved || record.date_approved,
          access_granted: true,
        },
        { merge: true }
      );
      return {
        duplicate: true,
        subscription,
        access: billingAccess(subscription),
        payment: { id: paymentIntent.id, ...existingPayment, ...record, access_granted: true },
      };
    }

    const starts = [
      now,
      new Date(subscription.trial_end_date || 0),
      new Date(subscription.current_period_end || 0),
    ].filter((date) => Number.isFinite(date.getTime()));
    const periodStart = new Date(Math.max(...starts.map((date) => date.getTime())));
    const periodEnd = addDays(periodStart, PIX_ACCESS_DAYS);
    const merged = {
      ...subscription,
      ...patch,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_payment_date: periodEnd.toISOString(),
      last_approved_payment_id: paymentIntent.id,
      last_approved_payment_date: now.toISOString(),
      status: "active",
      updated_date: now.toISOString(),
      ...(subscription.created_date ? {} : { created_date: now.toISOString() }),
    };
    const access = billingAccess(merged, now);
    const payment = {
      ...record,
      access_granted: true,
      access_period_start: periodStart.toISOString(),
      access_period_end: periodEnd.toISOString(),
    };

    transaction.set(current.ref, merged, { merge: true });
    transaction.set(paymentRef, payment, { merge: true });
    transaction.set(
      userRef,
      {
        user_email: merged.user_email || account.subscription?.user_email || "",
        billing_status: access.status,
        access_allowed: access.allowed,
        access_reason: access.reason,
        access_expires_at: Timestamp.fromDate(periodEnd),
        trial_start_date: merged.trial_start_date || "",
        trial_end_date: merged.trial_end_date || "",
        current_period_end: merged.current_period_end,
        billing_updated_at: now.toISOString(),
      },
      { merge: true }
    );

    return {
      duplicate: false,
      subscription: { id: current.ref.id, ...merged },
      access,
      payment: { id: paymentIntent.id, ...payment },
    };
  });

  return result;
}

async function applyMercadoPagoPixPayment(uid, payment, options = {}) {
  const ownerUid = mercadoPagoPaymentUid(payment);
  if (!uid || ownerUid !== uid) throw new Error("Pagamento Pix Mercado Pago não pertence à conta informada.");

  const status = mercadoPagoPaymentStatus(payment);
  const validation = validateMercadoPagoPixPayment(payment, {
    expectedAmount: MONTHLY_AMOUNT,
    currency: "BRL",
    productName: PRODUCT_NAME,
    requireLiveMode: mercadoPagoRequireLiveMode(),
  });
  if (!validation.valid) {
    throw new Error(`Pagamento Pix Mercado Pago inválido: ${validation.reason}.`);
  }

  const account = await ensureBillingAccount(uid, payment.payer?.email || "");
  const now = new Date();
  const nowIso = now.toISOString();
  const paymentId = mercadoPagoPaymentId(payment);
  const paymentDocId = mercadoPagoPaymentDocId(payment);
  const record = mercadoPagoRecordFromPayment(uid, payment, {
    email: account.subscription?.user_email || payment.payer?.email || "",
  });
  const patch = {
    billing_provider: account.subscription?.billing_provider || "stripe",
    last_payment_provider: "mercado_pago",
    mercado_pago_payment_id: paymentId,
    last_payment_status: status,
    last_payment_detail: record.status_detail,
    last_payment_date: record.date_approved || record.date_last_updated,
    last_sync_date: nowIso,
    notes: `Pagamento Pix Mercado Pago ${status} sincronizado.`,
  };

  const paymentRef = paymentCollection(uid).doc(paymentDocId);
  const existingPaymentSnapshot = await paymentRef.get();
  const existingPayment = existingPaymentSnapshot.exists ? toJsonSafe(existingPaymentSnapshot.data()) : {};

  if (["refunded", "charged_back"].includes(status) && existingPayment.access_granted === true) {
    await paymentRef.set(
      {
        ...existingPayment,
        ...record,
        access_granted: true,
        date_refunded: nowIso,
      },
      { merge: true }
    );
    const billing = await persistBillingState(
      uid,
      {
        ...patch,
        current_period_end: nowIso,
        next_payment_date: "",
        access_revoked_at: nowIso,
        access_revoked_reason: status,
      },
      { email: account.subscription?.user_email || record.user_email }
    );
    return { ...billing, payment: { id: paymentDocId, ...existingPayment, ...record, access_granted: true } };
  }

  if (status !== "approved") {
    await paymentRef.set(record, { merge: true });
    const billing = await persistBillingState(uid, patch, {
      email: account.subscription?.user_email || record.user_email,
    });
    return { ...billing, payment: { id: paymentDocId, ...record } };
  }

  const current = await currentSubscription(uid);
  const userRef = adminDb.collection("users").doc(uid);
  const result = await adminDb.runTransaction(async (transaction) => {
    const [subscriptionSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(current.ref),
      transaction.get(paymentRef),
    ]);
    const storedPayment = paymentSnapshot.exists ? toJsonSafe(paymentSnapshot.data()) : {};
    const subscription = subscriptionSnapshot.exists
      ? { id: subscriptionSnapshot.id, ...toJsonSafe(subscriptionSnapshot.data()) }
      : account.subscription || {};

    if (storedPayment.access_granted === true) {
      transaction.set(
        paymentRef,
        {
          ...storedPayment,
          ...record,
          date_approved: storedPayment.date_approved || record.date_approved,
          access_granted: true,
        },
        { merge: true }
      );
      return {
        duplicate: true,
        subscription,
        access: billingAccess(subscription, now),
        payment: { id: paymentDocId, ...storedPayment, ...record, access_granted: true },
      };
    }

    const starts = [
      now,
      new Date(subscription.trial_end_date || 0),
      new Date(subscription.current_period_end || 0),
    ].filter((date) => Number.isFinite(date.getTime()));
    const periodStart = new Date(Math.max(...starts.map((date) => date.getTime())));
    const periodEnd = addDays(periodStart, PIX_ACCESS_DAYS);
    const merged = {
      ...subscription,
      ...patch,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_payment_date: periodEnd.toISOString(),
      last_approved_payment_id: paymentDocId,
      last_approved_payment_date: nowIso,
      access_revoked_at: "",
      access_revoked_reason: "",
      status: "active",
      updated_date: nowIso,
      ...(subscription.created_date ? {} : { created_date: nowIso }),
    };
    const access = billingAccess(merged, now);
    const storedRecord = {
      ...record,
      access_granted: true,
      access_period_start: periodStart.toISOString(),
      access_period_end: periodEnd.toISOString(),
    };

    transaction.set(current.ref, merged, { merge: true });
    transaction.set(paymentRef, storedRecord, { merge: true });
    transaction.set(
      userRef,
      {
        user_email: merged.user_email || account.subscription?.user_email || record.user_email || "",
        billing_status: access.status,
        access_allowed: access.allowed,
        access_reason: access.reason,
        access_expires_at: Timestamp.fromDate(periodEnd),
        trial_start_date: merged.trial_start_date || "",
        trial_end_date: merged.trial_end_date || "",
        current_period_end: merged.current_period_end,
        billing_updated_at: nowIso,
      },
      { merge: true }
    );

    return {
      duplicate: false,
      subscription: { id: current.ref.id, ...merged },
      access,
      payment: { id: paymentDocId, ...storedRecord },
    };
  });
  const marketing = await reportFirstPurchase(uid, result.payment).catch((error) => {
    console.error("First purchase tracking error", { provider: "mercado_pago", paymentId, message: error?.message });
    return { firstPayment: false, status: "failed" };
  });
  if (marketing.firstPayment) {
    result.payment = {
      ...result.payment,
      marketing_first_payment: true,
      marketing_event_id: marketing.eventId,
      marketing_delivery_status: marketing.status,
    };
  }
  return result;
}

async function findStripeSubscription(uid, customerId, preferredId = "") {
  if (preferredId) {
    try {
      const subscription = await stripeClient().subscriptions.retrieve(preferredId, { expand: ["latest_invoice"] });
      const ownerUid = stripeObjectUid(subscription);
      const sameCustomer = !customerId || stripeResourceId(subscription.customer) === customerId;
      if (sameCustomer && (!ownerUid || ownerUid === uid) && await stripeSubscriptionUsesConfiguredPlan(subscription)) {
        return subscription;
      }
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
    }
  }
  if (!customerId) return null;
  const subscriptions = await stripeClient().subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const knownSubscriptions = [];
  for (const subscription of subscriptions.data) {
    if (stripeObjectUid(subscription) === uid && await stripeSubscriptionUsesConfiguredPlan(subscription)) {
      knownSubscriptions.push(subscription);
    }
  }
  return knownSubscriptions
    .sort((left, right) => {
      const statusDifference = stripeSubscriptionScore(right.status) - stripeSubscriptionScore(left.status);
      return statusDifference || Number(right.created || 0) - Number(left.created || 0);
    })[0] || null;
}

async function syncStripeBilling(uid, options = {}) {
  let account = await ensureBillingAccount(uid, options.email || "");
  if (options.checkoutSessionId) {
    const session = await stripeClient().checkout.sessions.retrieve(options.checkoutSessionId, {
      expand: ["subscription", "payment_intent", "setup_intent"],
    });
    if (stripeObjectUid(session) !== uid) throw new Error("Checkout Stripe não pertence à conta informada.");
    await processStripeCheckoutSession(session);
    account = await ensureBillingAccount(uid, options.email || "");
  }

  const subscription = await findStripeSubscription(
    uid,
    account.subscription?.stripe_customer_id,
    account.subscription?.stripe_subscription_id
  );
  if (!subscription) return { ...account, latest_payment: await latestBillingPayment(uid) };

  let result = await applyStripeSubscription(uid, subscription);
  const invoices = await stripeClient().invoices.list({
    subscription: subscription.id,
    limit: 10,
    expand: ["data.payments"],
  });
  const latestPaidInvoiceId = invoices.data.find(
    (invoice) => invoice.status === "paid" || Number(invoice.amount_paid || 0) > 0
  )?.id;
  for (const invoice of [...invoices.data].reverse()) {
    const charge = invoice.id === latestPaidInvoiceId ? await stripeInvoiceCharge(invoice) : null;
    result = stripeChargeRefundState(charge || {}).status === "none"
      ? await applyStripeInvoice(uid, invoice, "", subscription)
      : await applyStripeChargeRefund(uid, charge, { invoice, eventType: "billing.sync" });
  }
  return { ...result, latest_payment: await latestBillingPayment(uid) };
}

async function syncMercadoPagoBilling(uid, options = {}) {
  if (!mercadoPagoAccessToken()) return null;
  const account = await ensureBillingAccount(uid, options.email || "");
  const latestPayment = await latestBillingPayment(uid);
  const paymentId =
    String(options.paymentId || "").trim() ||
    String(account.subscription?.mercado_pago_payment_id || "").trim() ||
    String(latestPayment?.mercado_pago_payment_id || "").trim();
  if (!paymentId) return { ...account, latest_payment: latestPayment };

  const payment = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
  if (mercadoPagoPaymentUid(payment) !== uid) {
    throw new Error("Pagamento Mercado Pago não pertence à conta informada.");
  }
  return { ...(await applyMercadoPagoPixPayment(uid, payment, { eventType: "billing.sync" })), latest_payment: await latestBillingPayment(uid) };
}

async function createSubscriptionFromSetupSession(session, uid) {
  const account = await ensureBillingAccount(uid);
  const existing = await findStripeSubscription(
    uid,
    stripeResourceId(session.customer) || account.subscription?.stripe_customer_id,
    account.subscription?.stripe_subscription_id
  );
  if (existing && !["canceled", "incomplete_expired"].includes(existing.status)) return existing;

  const setupIntent = typeof session.setup_intent === "object"
    ? session.setup_intent
    : await stripeClient().setupIntents.retrieve(session.setup_intent);
  const trialEnd = Number(session.metadata?.trial_end || 0);
  const plan = planDefinition(session.metadata?.plan_code);
  const planPriceId = await resolveStripePlanPriceId(plan.code);
  const params = {
    customer: stripeResourceId(session.customer),
    items: [{ price: planPriceId }],
    default_payment_method: stripeResourceId(setupIntent.payment_method),
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { studiosbook_uid: uid, product: PRODUCT_NAME, plan_code: plan.code },
  };
  if (trialEnd > Math.floor(Date.now() / 1000) + 60) params.trial_end = trialEnd;
  return stripeClient().subscriptions.create(params, {
    idempotencyKey: `studiosbook-subscription-${session.id}`,
  });
}

async function processStripeCheckoutSession(session) {
  const uid = stripeObjectUid(session);
  if (!uid) throw new Error("Checkout Stripe sem vínculo com o StudiosBook.");
  const flow = session.metadata?.billing_flow || "";
  const requestedPlan = planDefinition(session.metadata?.plan_code);
  await persistBillingState(
    uid,
    {
      billing_provider: "stripe",
      plan_code: requestedPlan.code,
      plan_name: requestedPlan.name,
      monthly_amount: requestedPlan.amount,
      stripe_customer_id: stripeResourceId(session.customer),
      stripe_checkout_session_id: session.id,
      last_sync_date: new Date().toISOString(),
    },
    { email: session.customer_details?.email || session.customer_email || "" }
  );

  if (flow === "subscription_setup") {
    const subscription = await createSubscriptionFromSetupSession(session, uid);
    return applyStripeSubscription(uid, subscription);
  }
  if (flow === "subscription" && session.subscription) {
    const subscription = typeof session.subscription === "object"
      ? session.subscription
      : await stripeClient().subscriptions.retrieve(session.subscription);
    return applyStripeSubscription(uid, subscription);
  }
  if (flow === "pix" && session.payment_status === "paid" && session.payment_intent) {
    const paymentIntent = typeof session.payment_intent === "object"
      ? session.payment_intent
      : await stripeClient().paymentIntents.retrieve(session.payment_intent);
    return applyStripePixPayment(uid, paymentIntent);
  }
  return ensureBillingAccount(uid, session.customer_details?.email || session.customer_email || "");
}

async function claimStripeWebhookEvent(event) {
  const ref = adminDb.collection("StripeWebhookEvent").doc(event.id);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    if (current?.status === "processed") return false;
    const lastAttempt = new Date(current?.updated_date || 0).getTime();
    if (current?.status === "processing" && Date.now() - lastAttempt < 5 * 60 * 1000) return false;
    transaction.set(
      ref,
      {
        event_id: event.id,
        event_type: event.type,
        live_mode: Boolean(event.livemode),
        status: "processing",
        attempts: Number(current?.attempts || 0) + 1,
        created_date: current?.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  });
}

async function handleStripeEvent(event) {
  const object = event.data.object;
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return processStripeCheckoutSession(object);
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const uid = await resolveStripeUid(object);
    return uid
      ? persistBillingState(uid, {
          billing_provider: "stripe",
          last_payment_status: "rejected",
          last_payment_detail: event.type,
          last_sync_date: new Date().toISOString(),
        })
      : null;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const uid = stripeObjectUid(object);
    return uid ? syncStripeBilling(uid) : null;
  }
  if (["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required"].includes(event.type)) {
    const uid = await resolveStripeUid(object);
    if (!uid) return null;
    const forcedStatus = event.type === "invoice.paid" ? "approved" : event.type === "invoice.payment_failed" ? "rejected" : "pending";
    await applyStripeInvoice(uid, object, forcedStatus);
    return syncStripeBilling(uid);
  }
  if (["charge.refunded", "refund.created", "refund.updated"].includes(event.type)) {
    const charge = await stripeRefundCharge(object);
    if (!charge) return null;
    const uid = await resolveStripeChargeUid(charge);
    return uid ? applyStripeChargeRefund(uid, charge, { eventType: event.type }) : null;
  }
  if (event.type === "refund.failed") return null;
  if (event.type.startsWith("payment_intent.") && object.metadata?.billing_flow === "pix") {
    const uid = await resolveStripeUid(object);
    return uid ? applyStripePixPayment(uid, object) : null;
  }
  return null;
}

async function stripeWebhookHandler(req, res) {
  if (!stripeWebhookSecret()) return res.status(503).json({ error: "Webhook Stripe não configurado." });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      req.body,
      String(req.headers["stripe-signature"] || ""),
      stripeWebhookSecret()
    );
  } catch {
    return res.status(400).json({ error: "Assinatura do webhook Stripe inválida." });
  }
  if (!firebaseAdminReady || !adminDb) return res.status(503).json({ error: "Banco temporariamente indisponível." });

  const eventRef = adminDb.collection("StripeWebhookEvent").doc(event.id);
  try {
    const claimed = await claimStripeWebhookEvent(event);
    if (!claimed) return res.json({ received: true, duplicate: true });
    await handleStripeEvent(event);
    await eventRef.set({ status: "processed", updated_date: new Date().toISOString() }, { merge: true });
    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error", { eventId: event.id, eventType: event.type, message: error?.message });
    await eventRef.set(
      { status: "failed", error: String(error?.message || "processing_failed").slice(0, 240), updated_date: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
    return res.status(500).json({ error: "Falha ao processar evento Stripe." });
  }
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "StudiosBook API",
    version: "1",
  });
});

app.get("/health", (_req, res) => {
  const ready = firebaseAdminReady && Boolean(stripeSecretKey() && stripePriceId()) && Boolean(stripeWebhookSecret());
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "StudiosBook API",
    marketing_measurement: marketingConfiguration(),
  });
});

app.post("/functions/ensure-billing-account", requireFirebaseUser, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    let billing = await ensureBillingAccount(req.user.uid, req.user.email);
    const lastSyncAt = new Date(billing.subscription?.last_sync_date || 0).getTime();
    const providerSyncStale =
      !Number.isFinite(lastSyncAt) || Date.now() - lastSyncAt > 5 * 60 * 1000;
    const shouldSearchProvider = Boolean(
      billing.subscription?.stripe_customer_id || billing.subscription?.stripe_subscription_id
    );

    if (providerSyncStale && shouldSearchProvider) {
      try {
        const reconciled = await syncStripeBilling(req.user.uid, { email: req.user.email });
        if (reconciled) {
          billing = { ...reconciled, latest_payment: await latestBillingPayment(req.user.uid) };
        }
      } catch (syncError) {
        console.warn("Automatic billing reconciliation unavailable", {
          requestId: req.requestId,
          uid: req.user.uid,
          message: syncError?.message || "provider_sync_failed",
        });
      }
    }
    res.json({ success: true, ...billing, payment_capabilities: await stripePaymentCapabilities() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao iniciar período gratuito.", request_id: req.requestId });
  }
});

app.post(
  "/functions/create-subscription-checkout",
  requireFirebaseUser,
  billingPaymentRateLimit,
  async (req, res) => {
    if (!requireFirebaseAdminSdk(res)) return;
    try {
      if (!stripeSecretKey()) {
        return res.status(503).json({ error: "Cobrança Stripe temporariamente indisponível." });
      }
      const requestedPlanCode = normalizePlanCode(req.body?.plan_code);
      if (req.body?.plan_code && requestedPlanCode !== String(req.body.plan_code).trim().toLowerCase()) {
        return res.status(400).json({ error: "Plano de assinatura inválido." });
      }
      const requestedPlan = planDefinition(requestedPlanCode);
      const requestedPriceId = await resolveStripePlanPriceId(requestedPlan.code);
      const account = await ensureBillingAccount(req.user.uid, req.user.email);
      const marketing = normalizeMarketingContext(req.body?.marketing);
      const appOrigin = safeOrigin(req.body?.app_url);
      const returnPath = safeReturnPath(req.body?.return_path);
      const existing = await findStripeSubscription(
        req.user.uid,
        account.subscription?.stripe_customer_id,
        account.subscription?.stripe_subscription_id
      );
      if (existing && !["canceled", "incomplete_expired"].includes(existing.status)) {
        const customerId = stripeResourceId(existing.customer);
        const existingPlan = await assertStripeSubscriptionPlan(existing);
        const existingItem = existing.items?.data?.[0];
        const portalParams = {
          customer: customerId,
          return_url: `${appOrigin}${returnPath}?billing=return`,
          ...(stripePortalConfigurationId() ? { configuration: stripePortalConfigurationId() } : {}),
        };
        if (existingPlan.code !== requestedPlan.code) {
          if (!stripePortalConfigurationId() || !existingItem?.id) {
            return res.status(503).json({ error: "A troca de plano está temporariamente indisponível." });
          }
          portalParams.flow_data = {
            type: "subscription_update_confirm",
            after_completion: {
              type: "redirect",
              redirect: { return_url: `${appOrigin}${returnPath}?billing=return&plan=${requestedPlan.code}` },
            },
            subscription_update_confirm: {
              subscription: existing.id,
              items: [{ id: existingItem.id, price: requestedPriceId, quantity: 1 }],
            },
          };
        }
        const portal = await stripeClient().billingPortal.sessions.create(portalParams);
        return res.json({
          success: true,
          already_exists: existingPlan.code === requestedPlan.code,
          checkout_mode: existingPlan.code === requestedPlan.code ? "portal" : "plan_change",
          plan_code: requestedPlan.code,
          url: portal.url,
        });
      }

      const customer = await ensureStripeCustomer(req.user.uid, req.user.email, req.user.name);
      const trialEndSeconds = Math.floor(new Date(account.subscription?.trial_end_date || 0).getTime() / 1000);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const hasRemainingTrial = Number.isFinite(trialEndSeconds) && trialEndSeconds > nowSeconds;
      const exactTrialSupported = trialEndSeconds >= nowSeconds + 48 * 60 * 60;
      const useSetupCheckout = hasRemainingTrial && !exactTrialSupported;
      const metadata = {
        studiosbook_uid: req.user.uid,
        product: PRODUCT_NAME,
        plan_code: requestedPlan.code,
        billing_flow: useSetupCheckout ? "subscription_setup" : "subscription",
        ...(marketing?.checkout_event_id ? { marketing_checkout_event_id: marketing.checkout_event_id } : {}),
        ...(hasRemainingTrial ? { trial_end: String(trialEndSeconds) } : {}),
      };
      const checkoutWindow = Math.floor(Date.now() / 600000);
      const common = {
        customer: customer.id,
        client_reference_id: req.user.uid,
        integration_identifier: `studiosbook_${alphabeticIdentifierSuffix(`${req.user.uid}:${requestedPlan.code}:${checkoutWindow}`)}`,
        locale: "pt-BR",
        success_url: `${appOrigin}${returnPath}?checkout=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appOrigin}${returnPath}?checkout=cancelled`,
        metadata,
      };
      const params = useSetupCheckout
        ? {
            ...common,
            mode: "setup",
            setup_intent_data: { metadata },
          }
        : {
            ...common,
            mode: "subscription",
            payment_method_collection: "always",
            line_items: [{ price: requestedPriceId, quantity: 1 }],
            subscription_data: {
              metadata,
              ...(exactTrialSupported ? { trial_end: trialEndSeconds } : {}),
            },
          };
      const session = await stripeClient().checkout.sessions.create(params, {
        idempotencyKey: `studiosbook-checkout-${requestedPlan.code}-${req.user.uid}-${checkoutWindow}`,
      });
      await persistBillingState(
        req.user.uid,
        {
          billing_provider: "stripe",
          plan_code: requestedPlan.code,
          plan_name: requestedPlan.name,
          monthly_amount: requestedPlan.amount,
          stripe_customer_id: customer.id,
          stripe_checkout_session_id: session.id,
          checkout_url: session.url,
          last_payment_status: hasRemainingTrial ? "pending" : "not_started",
          last_sync_date: new Date().toISOString(),
          notes: `Checkout seguro do ${requestedPlan.name} criado na Stripe.`,
          ...(marketing ? { marketing_context: marketing } : {}),
        },
        { email: req.user.email }
      );
      return res.json({ success: true, url: session.url, checkout_mode: params.mode, plan_code: requestedPlan.code });
    } catch (error) {
      console.error("Stripe checkout error", { requestId: req.requestId, type: error?.type, code: error?.code, message: error?.message });
      return res.status(error?.statusCode && error.statusCode < 500 ? 422 : 500).json({
        error: "Não foi possível abrir o checkout da Stripe. Tente novamente ou fale com o suporte.",
        request_id: req.requestId,
      });
    }
  }
);

app.post("/functions/create-billing-portal", requireFirebaseUser, billingPaymentRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const account = await ensureBillingAccount(req.user.uid, req.user.email);
    if (!account.subscription?.stripe_customer_id) {
      return res.status(400).json({ error: "Nenhum cadastro de cobrança Stripe foi localizado." });
    }
    const session = await stripeClient().billingPortal.sessions.create({
      customer: account.subscription.stripe_customer_id,
      return_url: `${safeOrigin(req.body?.app_url)}/?billing=return`,
      ...(stripePortalConfigurationId() ? { configuration: stripePortalConfigurationId() } : {}),
    });
    return res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe portal error", { requestId: req.requestId, message: error?.message });
    return res.status(500).json({ error: "Não foi possível abrir o portal de cobrança.", request_id: req.requestId });
  }
});

app.post("/functions/create-card-subscription", requireFirebaseUser, (_req, res) => {
  return res.status(410).json({
    error: "O formulário antigo foi desativado. Use o checkout seguro da Stripe.",
  });
});

app.post("/functions/create-pix-payment", requireFirebaseUser, billingPaymentRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    if (!mercadoPagoAccessToken()) {
      return res.status(503).json({
        error: "Pagamento Pix temporariamente indisponível.",
        code: "pix_unavailable",
      });
    }
    const account = await ensureBillingAccount(req.user.uid, req.user.email);
    const marketing = normalizeMarketingContext(req.body?.marketing);
    const attemptId = randomUUID();
    const externalReference = `studiosbook:${req.user.uid}:${attemptId}`;
    const metadata = {
      studiosbook_uid: req.user.uid,
      product: PRODUCT_NAME,
      billing_flow: "pix",
      ...(marketing?.checkout_event_id ? { marketing_checkout_event_id: marketing.checkout_event_id } : {}),
    };
    if (marketing) {
      await persistBillingState(req.user.uid, { marketing_context: marketing }, { email: req.user.email });
    }
    const payment = await mercadoPagoRequest("/v1/payments", {
      method: "POST",
      idempotencyKey: `studiosbook-pix-${req.user.uid}-${attemptId}`,
      body: {
        transaction_amount: MONTHLY_AMOUNT,
        description: `${PRODUCT_NAME} - 30 dias de acesso`,
        payment_method_id: "pix",
        payer: {
          email: req.user.email || account.subscription?.user_email || `${req.user.uid}@studiosbook.local`,
          first_name: String(req.user.name || "Profissional").split(" ")[0],
        },
        external_reference: externalReference,
        notification_url: MERCADO_PAGO_WEBHOOK_URL,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        metadata,
        additional_info: {
          items: [
            {
              id: req.user.uid,
              title: `${PRODUCT_NAME} - 30 dias de acesso`,
              description: "Pagamento Pix avulso sem renovação automática.",
              quantity: 1,
              unit_price: MONTHLY_AMOUNT,
            },
          ],
        },
      },
    });
    payment.metadata = { ...metadata, ...(payment.metadata || {}) };
    const result = await applyMercadoPagoPixPayment(req.user.uid, payment, { eventType: "pix.created" });
    return res.json({ success: true, ...result, payment_capabilities: await stripePaymentCapabilities() });
  } catch (error) {
    console.error("Mercado Pago Pix error", { requestId: req.requestId, statusCode: error?.statusCode, message: error?.message });
    return res.status(error?.statusCode && error.statusCode < 500 ? 422 : error?.statusCode || 500).json({
      error: "Não foi possível gerar o Pix no Mercado Pago. Use cartão ou fale com o suporte.",
      request_id: req.requestId,
    });
  }
});

app.post("/functions/sync-subscription-status", requireFirebaseUser, billingSyncRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const checkoutSessionId = String(req.body?.session_id || "").trim();
    let result = null;
    if (checkoutSessionId || stripeSecretKey()) {
      result = await syncStripeBilling(req.user.uid, {
        email: req.user.email,
        checkoutSessionId,
      });
    }
    const mercadoPagoResult = await syncMercadoPagoBilling(req.user.uid, {
      email: req.user.email,
      paymentId: String(req.body?.payment_id || "").trim(),
    });
    if (mercadoPagoResult) result = mercadoPagoResult;
    if (!result) result = await ensureBillingAccount(req.user.uid, req.user.email);
    res.json({ success: true, ...result, payment_capabilities: await stripePaymentCapabilities() });
  } catch (error) {
    console.error(error);
    res.status(error?.statusCode && error.statusCode < 500 ? 422 : 500).json({
      error: "Erro interno ao sincronizar assinatura.",
      request_id: req.requestId,
    });
  }
});

app.post("/functions/sync-billing-status", requireFirebaseUser, billingSyncRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const checkoutSessionId = String(req.body?.session_id || "").trim();
    let result = null;
    if (checkoutSessionId || stripeSecretKey()) {
      try {
        result = await syncStripeBilling(req.user.uid, {
          email: req.user.email,
          checkoutSessionId,
        });
      } catch (stripeError) {
        if (checkoutSessionId) throw stripeError;
        console.warn("Stripe sync skipped during billing refresh", {
          requestId: req.requestId,
          message: stripeError?.message || "stripe_sync_failed",
        });
      }
    }
    const mercadoPagoResult = await syncMercadoPagoBilling(req.user.uid, {
      email: req.user.email,
      paymentId: String(req.body?.payment_id || "").trim(),
    });
    if (mercadoPagoResult) result = mercadoPagoResult;
    if (!result) result = await ensureBillingAccount(req.user.uid, req.user.email);
    res.json({ success: true, ...result, payment_capabilities: await stripePaymentCapabilities() });
  } catch (error) {
    console.error(error);
    res.status(error?.statusCode && error.statusCode < 500 ? 422 : 500).json({
      error: "Erro ao sincronizar cobrança.",
      request_id: req.requestId,
    });
  }
});

app.get("/functions/stripe-webhook", (_req, res) => {
  res.json({ ok: true, service: "StudiosBook webhook" });
});

app.get("/functions/mercado-pago-webhook", (_req, res) => {
  res.json({ ok: true, service: "StudiosBook Mercado Pago webhook" });
});

app.post("/functions/mercado-pago-webhook", async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  if (!mercadoPagoWebhookSecret()) {
    return res.status(503).json({ error: "Webhook Mercado Pago não configurado." });
  }

  const validation = validateMercadoPagoWebhook(req);
  if (!validation.valid) {
    return res.status(401).json({ error: "Assinatura do webhook Mercado Pago inválida." });
  }

  const dataId = validation.dataId || paymentWebhookDataId(req);
  const eventType = String(req.body?.action || req.body?.type || req.query?.type || "payment").toLowerCase();
  if (!dataId) return res.json({ received: true, ignored: true });

  const eventId = req.body?.id
    ? `mp_event_${req.body.id}`
    : `mp_${eventType}_${dataId}_${String(req.headers["x-request-id"] || randomUUID())}`;
  const eventRef = adminDb.collection("MercadoPagoWebhookEvent").doc(
    String(eventId).replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 180)
  );

  try {
    const claimed = await claimMercadoPagoWebhookEvent(eventRef.id, eventType);
    if (!claimed) return res.json({ received: true, duplicate: true });

    const payment = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(dataId)}`);
    const uid = mercadoPagoPaymentUid(payment);
    if (!uid) throw new Error("Webhook Mercado Pago sem vínculo com conta StudiosBook.");
    await applyMercadoPagoPixPayment(uid, payment, { eventType });
    await eventRef.set(
      {
        status: "processed",
        mercado_pago_payment_id: dataId,
        updated_date: new Date().toISOString(),
      },
      { merge: true }
    );
    return res.json({ received: true });
  } catch (error) {
    console.error("Mercado Pago webhook processing error", {
      requestId: req.requestId,
      eventType,
      dataId,
      message: error?.message,
    });
    await eventRef.set(
      {
        status: "failed",
        mercado_pago_payment_id: dataId,
        error: String(error?.message || "processing_failed").slice(0, 240),
        updated_date: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});
    return res.status(500).json({ error: "Falha ao processar evento Mercado Pago." });
  }
});

app.post("/functions/admin-session", requirePlatformAdmin, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  await safeAdminAudit(req, "admin.session.validated");
  res.json({
    success: true,
    admin: {
      uid: req.user.uid,
      email: req.user.email,
      role:
        req.user.platformRole === "master_admin" &&
        String(req.user.email || "").toLowerCase() === MASTER_ADMIN_EMAIL
          ? "master_admin"
          : "platform_admin",
    },
  });
});

app.post("/functions/admin-overview", requirePlatformAdmin, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const workspaceIds = await listWorkspaceIds();
    let authUsers = [];
    let authError = "";

    try {
      authUsers = await listAuthUsers();
    } catch (error) {
      authError = error?.message || "Não foi possível listar usuários do Firebase Auth.";
    }

    const allIds = [...new Set([...workspaceIds, ...authUsers.map((user) => user.uid)])];
    const workspaces = await Promise.all(allIds.map((uid) => loadWorkspace(uid)));
    const authByUid = new Map(authUsers.map((user) => [user.uid, user]));

    const users = workspaces.map((workspace) => {
      const authUser = authByUid.get(workspace.uid) || {};
      const subscription = workspace.subscription || null;
      return {
        uid: workspace.uid,
        email: authUser.email || workspace.profile?.user_email || workspace.subscription?.user_email || "",
        displayName: authUser.displayName || workspace.profile?.owner_name || "",
        disabled: Boolean(authUser.disabled),
        platform_admin: Boolean(authUser.platformAdmin),
        platform_role: authUser.platformRole || "",
        creationTime: authUser.creationTime || "",
        lastSignInTime: authUser.lastSignInTime || "",
        providers: authUser.providers || [],
        receivables_access_allowed: workspace.root?.receivables_access_allowed === true,
        receivables_access_expires_at: workspace.root?.receivables_access_expires_at || "",
        receivables_plan_code: workspace.root?.receivables_plan_code || "studiosbook_agenda",
        business_name: workspace.profile?.business_name || "",
        categories: workspace.profile?.categories || [],
        subscription,
        access: billingAccess(subscription || {}),
        latest_payment: workspace.latestPayment || null,
        counts: workspace.counts,
      };
    });

    const recentPayments = workspaces
      .flatMap((workspace) =>
        (workspace.payments || []).map((payment) => ({
          ...payment,
          uid: workspace.uid,
          business_name: workspace.profile?.business_name || "",
        }))
      )
      .sort((left, right) => new Date(right.date_last_updated || 0) - new Date(left.date_last_updated || 0))
      .slice(0, 30);

    const metrics = users.reduce(
      (acc, user) => {
        acc.users += 1;
        acc.clients += user.counts.Client || 0;
        acc.records += user.counts.ServiceRecord || 0;
        acc.appointments += user.counts.Appointment || 0;
        if (user.access?.allowed) acc.active_subscriptions += 1;
        if (user.subscription?.admin_access_override === "active") acc.manual_access_users += 1;
        if (user.subscription?.admin_access_override === "suspended") acc.suspended_subscriptions += 1;
        if (user.subscription?.status === "trialing") acc.trialing_users += 1;
        if (user.subscription?.status === "expired") acc.expired_users += 1;
        if (user.latest_payment?.status === "pending") acc.pending_payments += 1;
        if (user.disabled) acc.disabled_users += 1;
        return acc;
      },
      {
        users: 0,
        clients: 0,
        records: 0,
        appointments: 0,
        active_subscriptions: 0,
        manual_access_users: 0,
        suspended_subscriptions: 0,
        trialing_users: 0,
        expired_users: 0,
        pending_payments: 0,
        disabled_users: 0,
      }
    );
    metrics.approved_revenue = recentPayments
      .filter((payment) => payment.status === "approved")
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    await safeAdminAudit(req, "admin.overview.viewed", {
      metadata: { user_count: metrics.users },
    });

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      metrics,
      users,
      recent_payments: recentPayments,
      auth_degraded: Boolean(authError),
      ...adminStatusPayload(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar painel admin.", request_id: req.requestId });
  }
});

app.post("/functions/admin-payment-diagnostics", requirePlatformAdmin, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const paymentCapabilities = await stripePaymentCapabilities(true);
    const [balanceResult, priceResult, webhookEvents, mercadoPagoWebhookEvents, mercadoPagoUserResult] = await Promise.allSettled([
      stripeSecretKey() ? stripeClient().balance.retrieve() : Promise.resolve(null),
      stripePriceId() ? stripeClient().prices.retrieve(stripePriceId()) : Promise.resolve(null),
      adminDb.collection("StripeWebhookEvent").limit(50).get(),
      adminDb.collection("MercadoPagoWebhookEvent").limit(50).get(),
      mercadoPagoAccessToken() ? mercadoPagoRequest("/users/me") : Promise.resolve(null),
    ]);
    const balance = balanceResult.status === "fulfilled" ? balanceResult.value : null;
    const price = priceResult.status === "fulfilled" ? priceResult.value : null;
    const eventRows = webhookEvents.status === "fulfilled" ? webhookEvents.value.docs.map((doc) => doc.data()) : [];
    const mercadoPagoEventRows =
      mercadoPagoWebhookEvents.status === "fulfilled" ? mercadoPagoWebhookEvents.value.docs.map((doc) => doc.data()) : [];
    const mercadoPagoUser = mercadoPagoUserResult.status === "fulfilled" ? mercadoPagoUserResult.value : null;
    await safeAdminAudit(req, "admin.payments.diagnostics");
    res.json({
      success: true,
      stripe_api: balance?.object === "balance" ? "online" : "error",
      stripe_mode: stripeMode(),
      recurring_price_ready: price?.active === true && price?.currency === "brl",
      recurring_amount: Number(price?.unit_amount || 0) / 100,
      pix_available: paymentCapabilities.pix,
      pix_provider: paymentCapabilities.pix_provider || "",
      mercado_pago_api: mercadoPagoUser?.id ? "online" : mercadoPagoAccessToken() ? "error" : "unconfigured",
      mercado_pago_mode: mercadoPagoTokenMode(),
      webhook_ready: Boolean(stripeWebhookSecret()),
      webhook_url: STRIPE_WEBHOOK_URL,
      mercado_pago_webhook_ready: Boolean(mercadoPagoWebhookSecret()),
      mercado_pago_webhook_url: MERCADO_PAGO_WEBHOOK_URL,
      webhook_events: eventRows.length,
      webhook_processed: eventRows.filter((event) => event.status === "processed").length,
      webhook_failed: eventRows.filter((event) => event.status === "failed").length,
      mercado_pago_webhook_events: mercadoPagoEventRows.length,
      mercado_pago_webhook_processed: mercadoPagoEventRows.filter((event) => event.status === "processed").length,
      mercado_pago_webhook_failed: mercadoPagoEventRows.filter((event) => event.status === "failed").length,
      marketing_measurement: marketingConfiguration(),
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro no diagnóstico de pagamentos.",
      request_id: req.requestId,
    });
  }
});

app.post("/functions/admin-export", requirePlatformAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const workspaceIds = await listWorkspaceIds();
    const authUsers = await listAuthUsers().catch(() => []);
    const allIds = [...new Set([...workspaceIds, ...authUsers.map((user) => user.uid)])];
    const workspaces = await Promise.all(allIds.map((uid) => loadWorkspace(uid, true)));
    await safeAdminAudit(req, "admin.data.exported", {
      metadata: { workspace_count: workspaces.length, auth_user_count: authUsers.length },
    });
    res.json({
      success: true,
      exported_at: new Date().toISOString(),
      auth_users: authUsers,
      workspaces,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao exportar dados administrativos.", request_id: req.requestId });
  }
});

app.post("/functions/admin-update-subscription", requirePlatformAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }

    const current = await currentSubscription(uid);
    const previousStatus = current.data?.status || "";
    const result = await syncStripeBilling(uid, { email: current.data?.user_email || "" });

    await safeAdminAudit(req, "admin.subscription.updated", {
      target_uid: uid,
      metadata: {
        source: "stripe",
        previous_status: previousStatus,
        confirmed_status: result.subscription?.status || "",
      },
    });

    res.json({ success: true, source: "stripe", ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar assinatura.", request_id: req.requestId });
  }
});

app.post("/functions/admin-set-subscription-override", requireMasterAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    const action = String(req.body?.action || "").trim().toLowerCase();
    const reason = String(req.body?.reason || "Ajuste administrativo").trim().slice(0, 200);
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }
    if (!new Set(["grant", "suspend", "automatic"]).has(action)) {
      return res.status(400).json({ error: "Ação de assinatura inválida." });
    }
    const targetUser = await adminAuth.getUser(uid);

    const now = new Date();
    const current = await currentSubscription(uid);
    const patch = {
      user_email: targetUser.email || current.data?.user_email || "",
      admin_access_override: action === "grant" ? "active" : action === "suspend" ? "suspended" : "",
      admin_override_until: "",
      admin_override_reason: action === "automatic" ? "" : reason,
      admin_override_updated_at: now.toISOString(),
      admin_override_updated_by: req.user.email,
    };

    let grantedDays = 0;
    if (action === "grant") {
      grantedDays = Number(req.body?.days || 30);
      if (!Number.isInteger(grantedDays) || grantedDays < 1 || grantedDays > 3650) {
        return res.status(400).json({ error: "Informe um período entre 1 e 3650 dias." });
      }
      patch.admin_override_until = addDays(now, grantedDays).toISOString();
    }

    const result = await persistBillingState(uid, patch, { email: patch.user_email });

    await safeAdminAudit(req, `admin.subscription.${action}`, {
      target_uid: uid,
      metadata: {
        reason: patch.admin_override_reason,
        days: grantedDays,
        override_until: patch.admin_override_until,
      },
    });

    res.json({ success: true, action, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar o acesso da assinatura.", request_id: req.requestId });
  }
});

app.post("/functions/admin-set-stripe-renewal", requireMasterAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    if (typeof req.body?.cancel_at_period_end !== "boolean") {
      return res.status(400).json({ error: "Informe uma opção válida para a renovação." });
    }
    const cancelAtPeriodEnd = req.body.cancel_at_period_end;
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }

    const current = await currentSubscription(uid);
    const subscriptionId = String(current.data?.stripe_subscription_id || "").trim();
    if (!subscriptionId) {
      return res.status(400).json({ error: "Esta conta não possui assinatura recorrente na Stripe." });
    }

    const existing = await stripeClient().subscriptions.retrieve(subscriptionId);
    const ownerUid = stripeObjectUid(existing);
    if (ownerUid && ownerUid !== uid) {
      return res.status(409).json({ error: "A assinatura não pertence a esta conta." });
    }
    await assertStripeSubscriptionPlan(existing);

    const updated = await stripeClient().subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    const result = await applyStripeSubscription(uid, updated);

    await safeAdminAudit(req, "admin.subscription.renewal_changed", {
      target_uid: uid,
      metadata: { subscription_id: subscriptionId, cancel_at_period_end: cancelAtPeriodEnd },
    });

    res.json({ success: true, cancel_at_period_end: cancelAtPeriodEnd, ...result });
  } catch (error) {
    console.error(error);
    const status = error?.statusCode && error.statusCode < 500 ? 422 : 500;
    res.status(status).json({ error: "Erro ao alterar a renovação da assinatura.", request_id: req.requestId });
  }
});

app.post("/functions/admin-audit-log", requirePlatformAdmin, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const snapshot = await adminDb
      .collection("AdminAuditLog")
      .orderBy("created_at", "desc")
      .limit(100)
      .get();
    const events = snapshot.docs.map((doc) => ({ id: doc.id, ...toJsonSafe(doc.data()) }));
    res.json({ success: true, events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar auditoria administrativa.", request_id: req.requestId });
  }
});

app.post("/functions/admin-send-password-reset", requirePlatformAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }
    const targetUser = await adminAuth.getUser(uid);
    if (!targetUser.email) {
      return res.status(400).json({ error: "A conta não possui e-mail para redefinição." });
    }
    await sendFirebasePasswordReset(targetUser.email);
    await safeAdminAudit(req, "admin.user.password_reset_sent", { target_uid: uid });
    res.json({ success: true, uid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao enviar redefinição de senha.", request_id: req.requestId });
  }
});

app.post("/functions/admin-revoke-user-sessions", requirePlatformAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }
    await adminAuth.getUser(uid);
    await adminAuth.revokeRefreshTokens(uid);
    await safeAdminAudit(req, "admin.user.sessions_revoked", { target_uid: uid });
    res.json({ success: true, uid, self: uid === req.user.uid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao encerrar sessões da conta.", request_id: req.requestId });
  }
});

app.post("/functions/admin-set-user-access", requirePlatformAdmin, requireRecentAdminAuth, adminRateLimit, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    const disabled = Boolean(req.body?.disabled);
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }
    if (uid === req.user.uid && disabled) {
      return res.status(400).json({ error: "Você não pode desativar o próprio acesso admin." });
    }

    const targetUser = await adminAuth.getUser(uid);
    if (disabled && targetUser.customClaims?.platform_admin === true) {
      return res.status(400).json({ error: "Contas administrativas não podem ser bloqueadas por este painel." });
    }
    const user = await adminAuth.updateUser(uid, { disabled });
    if (disabled) await adminAuth.revokeRefreshTokens(uid);
    await safeAdminAudit(req, "admin.user.access_changed", {
      target_uid: uid,
      metadata: { disabled },
    });
    res.json({ success: true, uid: user.uid, disabled: user.disabled });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar acesso do usuário.", request_id: req.requestId });
  }
});

app.use(createMarketplaceBookingRouter({
  getDb: () => adminDb,
  requireFirebaseUser,
  requireMasterAdmin,
  requireRecentAdminAuth,
}));

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada.", request_id: req.requestId });
});

app.use((error, req, res, _next) => {
  if (error?.code === "CORS_ORIGIN_DENIED") {
    return res.status(403).json({ error: "Origem não autorizada.", request_id: req.requestId });
  }
  console.error("Unhandled request error", { requestId: req.requestId, message: error?.message });
  return res.status(500).json({ error: "Erro interno do servidor.", request_id: req.requestId });
});

const port = process.env.PORT || 8080;
const isVercelRuntime = Boolean(process.env.VERCEL);
const server = isVercelRuntime
  ? null
  : app.listen(port, () => {
      console.log(`StudiosBook API running on port ${port}`);
    });

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; draining HTTP connections.`);

  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 12000);
  forceExitTimer.unref();

  server?.close((error) => {
    clearTimeout(forceExitTimer);
    if (error) {
      console.error("HTTP server shutdown failed", { message: error.message });
      process.exit(1);
    }
    console.log("HTTP server stopped cleanly.");
    process.exit(0);
  });

  server?.closeIdleConnections?.();
}

if (server) {
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

export default app;
