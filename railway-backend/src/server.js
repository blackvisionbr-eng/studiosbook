import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import {
  PIX_ACCESS_DAYS,
  TRIAL_DAYS,
  addDays,
  billingAccess,
  isValidCpf,
  localPaymentStatus,
  normalizeCpf,
  trialFromAccountCreation,
  uidFromExternalReference,
  validateWebhookSignature,
} from "./billing.js";

const app = express();
const MP_API = "https://api.mercadopago.com";
const PRODUCT_NAME = "StudiosBook";
const PLAN_NAME = "StudiosBook Intermediário";
const MONTHLY_AMOUNT = 26.9;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://studiosbook.com.br";
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app";
const MERCADO_PAGO_WEBHOOK_URL =
  process.env.MERCADO_PAGO_WEBHOOK_URL || `${PUBLIC_API_URL}/functions/mercado-pago-webhook`;
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
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origem não autorizada pelo CORS."));
    },
  })
);
app.use((req, res, next) => {
  req.requestId = String(req.headers["x-request-id"] || randomUUID()).slice(0, 128);
  res.setHeader("X-Request-ID", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => req.path === "/functions/mercado-pago-webhook",
    message: { error: "Muitas solicitações. Aguarde alguns minutos." },
  })
);
app.use(express.json({ limit: "256kb" }));

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite administrativo temporariamente atingido." },
});
app.use((req, res, next) => {
  if (req.path.startsWith("/functions/admin-")) return adminRateLimit(req, res, next);
  return next();
});

function safeOrigin(value) {
  try {
    const parsed = new URL(value || PUBLIC_APP_URL);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return PUBLIC_APP_URL;
  }
}

function mercadoPagoStatusToLocal(status) {
  if (status === "authorized") return "authorized";
  if (status === "paused") return "paused";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "pending") return "pending";
  return status || "pending";
}

function apiAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
}

function webhookSecret() {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || "";
}

async function readMercadoPagoResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function adminStatusPayload() {
  return {
    admin_ready: firebaseAdminReady,
    mercado_pago_ready: Boolean(apiAccessToken()),
    webhook_ready: Boolean(webhookSecret()),
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
    };
    return next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function requirePlatformAdmin(req, res, next) {
  requireFirebaseUser(req, res, () => {
    if (!req.user?.platformAdmin || !req.user?.emailVerified) {
      return res.status(403).json({ error: "Acesso restrito ao administrador do StudiosBook." });
    }
    return next();
  });
}

function requireFirebaseAdminSdk(res) {
  if (firebaseAdminReady && adminDb && adminAuth) return true;
  res.status(503).json({ error: "Serviço administrativo temporariamente indisponível." });
  return false;
}

async function isPlatformAdminUid(uid) {
  if (!uid || !adminAuth) return false;
  const user = await adminAuth.getUser(uid);
  return user.customClaims?.platform_admin === true;
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

function toJsonSafe(value) {
  if (!value || typeof value !== "object") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]));
}

async function listCollection(ref, limit = 500) {
  const snapshot = await ref.limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...toJsonSafe(doc.data()) }));
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

async function persistBillingState(uid, patch, options = {}) {
  const now = new Date().toISOString();
  const current = await currentSubscription(uid);
  const merged = {
    ...(current.data || {}),
    ...patch,
    updated_date: now,
  };
  if (!current.data) merged.created_date = patch.created_date || now;

  const access = billingAccess(merged);
  merged.status = access.status;
  const expiryValue = merged.current_period_end || merged.trial_end_date || 0;
  const expiryDate = new Date(expiryValue);
  const accessExpiresAt = Number.isFinite(expiryDate.getTime()) ? expiryDate : new Date(0);

  await Promise.all([
    current.ref.set(merged, { merge: true }),
    adminDb.collection("users").doc(uid).set(
      {
        user_email: merged.user_email || options.email || "",
        billing_status: access.status,
        access_allowed: options.forceAccess === true || access.allowed,
        access_expires_at: Timestamp.fromDate(accessExpiresAt),
        trial_start_date: merged.trial_start_date || "",
        trial_end_date: merged.trial_end_date || "",
        current_period_end: merged.current_period_end || "",
        billing_updated_at: now,
      },
      { merge: true }
    ),
  ]);

  return {
    subscription: { id: current.ref.id, ...merged },
    access: options.forceAccess === true ? { ...access, allowed: true, reason: "admin_override" } : access,
  };
}

async function ensureBillingAccount(uid, email = "") {
  const authUser = await adminAuth.getUser(uid);
  const accountEmail = authUser.email || email || "";
  const trial = trialFromAccountCreation(authUser.metadata?.creationTime || new Date());
  const current = await currentSubscription(uid);
  const existing = current.data || {};
  const result = await persistBillingState(
    uid,
    {
      user_email: accountEmail,
      plan_name: PLAN_NAME,
      monthly_amount: MONTHLY_AMOUNT,
      currency_id: "BRL",
      trial_start_date: trial.start.toISOString(),
      trial_end_date: trial.end.toISOString(),
      status: existing.status || (trial.active ? "trialing" : "expired"),
      last_sync_date: new Date().toISOString(),
      notes: existing.notes || "Teste gratuito iniciado na data de criação da conta.",
    },
    { email: accountEmail, forceAccess: authUser.customClaims?.platform_admin === true }
  );

  return {
    ...result,
    latest_payment: await latestBillingPayment(uid),
    account_created_at: trial.start.toISOString(),
  };
}

async function mercadoPagoRequest(path, options = {}) {
  const accessToken = apiAccessToken();
  if (!accessToken) {
    const error = new Error("Token do Mercado Pago não configurado.");
    error.missingSecret = "MERCADO_PAGO_ACCESS_TOKEN";
    throw error;
  }

  const response = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await readMercadoPagoResponse(response);
  return { response, data };
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

  await Promise.all(
    USER_ENTITY_NAMES.map(async (entityName) => {
      entityRows[entityName] = await listCollection(userDoc.collection(entityName), includeRows ? 1000 : 20);
    })
  );

  const profile = entityRows.StudioProfile?.[0] || null;
  const subscription = sortByLatest(entityRows.BillingSubscription)?.[0] || null;
  const payments = sortByLatest(entityRows.BillingPayment).slice(0, 10);
  const counts = Object.fromEntries(
    USER_ENTITY_NAMES.map((entityName) => [entityName, entityRows[entityName]?.length || 0])
  );

  return {
    uid,
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
      }))
    );
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

function paymentRecordFromMercadoPago(uid, payment) {
  const transactionData = payment?.point_of_interaction?.transaction_data || {};
  return {
    user_uid: uid,
    user_email: payment?.payer?.email || "",
    provider: "mercado_pago",
    payment_method: payment?.payment_method_id || "",
    payment_type: payment?.payment_type_id || "",
    mercado_pago_payment_id: String(payment?.id || ""),
    external_reference: payment?.external_reference || "",
    status: localPaymentStatus(payment?.status),
    status_detail: payment?.status_detail || "",
    amount: Number(payment?.transaction_amount || MONTHLY_AMOUNT),
    net_received_amount: Number(payment?.transaction_details?.net_received_amount || 0),
    currency_id: payment?.currency_id || "BRL",
    date_created: payment?.date_created || new Date().toISOString(),
    date_approved: payment?.date_approved || "",
    date_last_updated: payment?.date_last_updated || new Date().toISOString(),
    date_of_expiration: payment?.date_of_expiration || "",
    qr_code: transactionData.qr_code || "",
    qr_code_base64: transactionData.qr_code_base64 || "",
    ticket_url: transactionData.ticket_url || "",
    live_mode: Boolean(payment?.live_mode),
    updated_date: new Date().toISOString(),
  };
}

async function applyPixPayment(uid, payment) {
  const referenceUid = uidFromExternalReference(payment?.external_reference);
  if (!uid || (referenceUid && referenceUid !== uid)) {
    throw new Error("Pagamento Pix não pertence à conta informada.");
  }

  const account = await ensureBillingAccount(uid, payment?.payer?.email || "");
  const record = paymentRecordFromMercadoPago(uid, payment);
  const paymentId = record.mercado_pago_payment_id;
  if (!paymentId) throw new Error("Pagamento Mercado Pago sem identificador.");

  await paymentCollection(uid).doc(paymentId).set(record, { merge: true });

  const patch = {
    pix_payment_id: paymentId,
    payment_method_id: record.payment_method || "pix",
    last_payment_status: record.status,
    last_payment_date: record.date_approved || record.date_last_updated,
    last_sync_date: new Date().toISOString(),
    external_reference: record.external_reference,
    notes: `Pagamento Pix ${record.status} sincronizado pelo Mercado Pago.`,
  };

  if (record.status === "approved") {
    const now = new Date(record.date_approved || new Date());
    const possibleStarts = [
      now,
      new Date(account.subscription?.trial_end_date || 0),
      new Date(account.subscription?.current_period_end || 0),
    ].filter((date) => Number.isFinite(date.getTime()));
    const periodStart = new Date(Math.max(...possibleStarts.map((date) => date.getTime())));
    patch.status = "active";
    patch.current_period_start = periodStart.toISOString();
    patch.current_period_end = addDays(periodStart, PIX_ACCESS_DAYS).toISOString();
    patch.next_payment_date = patch.current_period_end;
  } else if (!account.access.allowed) {
    patch.status = record.status === "pending" ? "pending" : "payment_failed";
  }

  const billing = await persistBillingState(uid, patch, {
    email: account.subscription?.user_email || payment?.payer?.email || "",
    forceAccess: await isPlatformAdminUid(uid),
  });
  return { ...billing, payment: { id: paymentId, ...record } };
}

async function applySubscription(uid, subscription) {
  const referenceUid = uidFromExternalReference(subscription?.external_reference);
  if (!uid || (referenceUid && referenceUid !== uid)) {
    throw new Error("Assinatura não pertence à conta informada.");
  }

  const account = await ensureBillingAccount(uid, subscription?.payer_email || "");
  return persistBillingState(
    uid,
    {
      status: mercadoPagoStatusToLocal(subscription?.status),
      current_period_start: subscription?.auto_recurring?.start_date || "",
      current_period_end: subscription?.auto_recurring?.end_date || "",
      next_payment_date: subscription?.next_payment_date || "",
      mercado_pago_preapproval_id: subscription?.id || "",
      mercado_pago_plan_id: subscription?.preapproval_plan_id || "",
      checkout_url: subscription?.init_point || "",
      external_reference: subscription?.external_reference || "",
      payer_email: subscription?.payer_email || account.subscription?.user_email || "",
      payment_method_id: subscription?.payment_method_id || "",
      last_payment_status: subscription?.status || "",
      last_sync_date: new Date().toISOString(),
      notes: "Assinatura recorrente sincronizada com o Mercado Pago.",
    },
    {
      email: subscription?.payer_email || account.subscription?.user_email || "",
      forceAccess: await isPlatformAdminUid(uid),
    }
  );
}

async function syncPixPayment(uid, paymentId) {
  const { response, data } = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
  if (!response.ok) {
    const error = new Error("Não foi possível consultar o pagamento Pix no Mercado Pago.");
    error.status = response.status;
    error.providerResponse = data;
    throw error;
  }
  return applyPixPayment(uid, data);
}

async function syncSubscription(uid, preapprovalId) {
  const { response, data } = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  if (!response.ok) {
    const error = new Error("Não foi possível consultar a assinatura no Mercado Pago.");
    error.status = response.status;
    error.providerResponse = data;
    throw error;
  }
  return { ...(await applySubscription(uid, data)), mercado_pago_status: data.status || "" };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "StudiosBook API",
    version: "1",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "StudiosBook API" });
});

app.post("/functions/ensure-billing-account", requireFirebaseUser, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const billing = await ensureBillingAccount(req.user.uid, req.user.email);
    res.json({ success: true, ...billing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao iniciar período gratuito.", request_id: req.requestId });
  }
});

app.post("/functions/create-subscription-checkout", requireFirebaseUser, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const account = await ensureBillingAccount(req.user.uid, req.user.email);
    const now = new Date();
    const originalTrialEnd = new Date(account.subscription.trial_end_date);
    const minimumStart = new Date(now.getTime() + 5 * 60 * 1000);
    const chargeStart = originalTrialEnd > minimumStart ? originalTrialEnd : minimumStart;
    const appOrigin = safeOrigin(req.body?.app_url || PUBLIC_APP_URL);
    const externalReference = `studiosbook:subscription:${req.user.uid}:${Date.now()}`;
    const mpPayload = {
      payer_email: req.user.email,
      reason: `${PRODUCT_NAME} - assinatura mensal`,
      external_reference: externalReference,
      back_url: `${appOrigin}/?checkout=studiosbook`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        start_date: chargeStart.toISOString(),
        transaction_amount: MONTHLY_AMOUNT,
        currency_id: "BRL",
      },
    };

    const { response, data } = await mercadoPagoRequest("/preapproval", {
      method: "POST",
      body: JSON.stringify(mpPayload),
    });
    if (!response.ok) {
      return res.status(502).json({
        error: "Mercado Pago recusou a criação do checkout.",
        mercado_pago_status: response.status,
        request_id: req.requestId,
      });
    }

    const checkoutUrl = data.init_point || data.sandbox_init_point || "";
    const saved = await persistBillingState(
      req.user.uid,
      {
        mercado_pago_preapproval_id: data.id || "",
        mercado_pago_plan_id: data.preapproval_plan_id || "",
        checkout_url: checkoutUrl,
        external_reference: externalReference,
        payer_email: req.user.email,
        payment_method_id: data.payment_method_id || "",
        last_payment_status: data.status || "pending",
        last_sync_date: now.toISOString(),
        notes: "Checkout recorrente criado. O teste gratuito continua vinculado à data de cadastro.",
      },
      { email: req.user.email, forceAccess: req.user.platformAdmin === true }
    );

    return res.json({
      success: true,
      checkout_url: checkoutUrl,
      ...saved,
      trial_days: TRIAL_DAYS,
      trial_end_date: account.subscription.trial_end_date,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro interno ao criar assinatura.",
      request_id: req.requestId,
    });
  }
});

app.post("/functions/create-pix-payment", requireFirebaseUser, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const cpf = normalizeCpf(req.body?.cpf);
    if (!isValidCpf(cpf)) return res.status(400).json({ error: "Informe um CPF válido para gerar o Pix." });

    const account = await ensureBillingAccount(req.user.uid, req.user.email);
    const pendingPayment = account.latest_payment;
    if (
      pendingPayment?.status === "pending" &&
      pendingPayment?.qr_code &&
      new Date(pendingPayment.date_of_expiration || 0).getTime() > Date.now()
    ) {
      return res.json({
        success: true,
        reused: true,
        subscription: account.subscription,
        access: account.access,
        payment: pendingPayment,
      });
    }

    const now = new Date();
    const expiration = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const externalReference = `studiosbook:pix:${req.user.uid}:${Date.now()}`;
    const names = String(req.user.name || "Profissional StudiosBook").trim().split(/\s+/);
    const payload = {
      transaction_amount: MONTHLY_AMOUNT,
      description: `${PRODUCT_NAME} - acesso por ${PIX_ACCESS_DAYS} dias`,
      payment_method_id: "pix",
      external_reference: externalReference,
      notification_url: MERCADO_PAGO_WEBHOOK_URL,
      date_of_expiration: expiration.toISOString(),
      payer: {
        email: req.user.email,
        first_name: names[0] || "Profissional",
        last_name: names.slice(1).join(" ") || "StudiosBook",
        identification: { type: "CPF", number: cpf },
      },
      metadata: { studiosbook_uid: req.user.uid, product: PRODUCT_NAME },
    };

    const { response, data } = await mercadoPagoRequest("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": randomUUID() },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return res.status(502).json({
        error: "Mercado Pago recusou a criação do Pix.",
        mercado_pago_status: response.status,
        request_id: req.requestId,
      });
    }

    const billing = await applyPixPayment(req.user.uid, data);
    return res.json({ success: true, ...billing });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno ao gerar Pix.", request_id: req.requestId });
  }
});

app.post("/functions/sync-subscription-status", requireFirebaseUser, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const account = await ensureBillingAccount(req.user.uid, req.user.email);
    const preapprovalId =
      req.body?.preapproval_id ||
      req.body?.mercado_pago_preapproval_id ||
      account.subscription?.mercado_pago_preapproval_id;
    if (!preapprovalId) return res.status(400).json({ error: "ID da assinatura Mercado Pago não informado." });
    const result = await syncSubscription(req.user.uid, preapprovalId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(error?.status || 500).json({
      error: "Erro interno ao sincronizar assinatura.",
      request_id: req.requestId,
    });
  }
});

app.post("/functions/sync-billing-status", requireFirebaseUser, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const account = await ensureBillingAccount(req.user.uid, req.user.email);
    let result = account;
    if (account.latest_payment?.mercado_pago_payment_id) {
      result = await syncPixPayment(req.user.uid, account.latest_payment.mercado_pago_payment_id);
    }
    if (account.subscription?.mercado_pago_preapproval_id) {
      result = await syncSubscription(req.user.uid, account.subscription.mercado_pago_preapproval_id);
      result.latest_payment = await latestBillingPayment(req.user.uid);
    }
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(error?.status || 500).json({
      error: "Erro ao sincronizar cobrança.",
      request_id: req.requestId,
    });
  }
});

app.get("/functions/mercado-pago-webhook", (_req, res) => {
  res.json({
    ok: true,
    service: "StudiosBook Mercado Pago webhook",
    signature_required: true,
    webhook_ready: Boolean(webhookSecret()),
  });
});

app.post("/functions/mercado-pago-webhook", async (req, res) => {
  if (!firebaseAdminReady) return res.status(503).json({ error: "Firebase Admin indisponível." });
  const secret = webhookSecret();
  if (!secret) return res.status(503).json({ error: "Chave secreta do webhook não configurada." });

  const body = req.body || {};
  const dataId = String(req.query?.["data.id"] || body?.data?.id || "").toLowerCase();
  const xRequestId = String(req.headers["x-request-id"] || "");
  const xSignature = String(req.headers["x-signature"] || "");
  if (!validateWebhookSignature({ xSignature, xRequestId, dataId, secret })) {
    return res.status(401).json({ error: "Assinatura do webhook inválida." });
  }

  const eventType = String(body.type || req.query?.type || req.query?.topic || "unknown");
  const eventIdentity = String(body.id || `${eventType}:${dataId}:${body.action || "event"}`);
  const eventId = createHash("sha256").update(eventIdentity).digest("hex");
  const eventRef = adminDb.collection("MercadoPagoWebhookEvent").doc(eventId);

  try {
    const existing = await eventRef.get();
    if (existing.exists && existing.data()?.status === "processed") {
      return res.json({ ok: true, received: true, duplicate: true });
    }

    await eventRef.set(
      {
        event_id: eventIdentity,
        type: eventType,
        action: body.action || "",
        data_id: dataId,
        live_mode: Boolean(body.live_mode),
        request_id: xRequestId,
        status: "processing",
        attempts: FieldValue.increment(1),
        received_at: new Date().toISOString(),
        payload: toJsonSafe(body),
      },
      { merge: true }
    );

    let result = { ignored: true };
    if (eventType === "payment") {
      const { response, data } = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(dataId)}`);
      if (!response.ok) throw new Error(`Mercado Pago retornou ${response.status} ao consultar pagamento.`);
      const uid = uidFromExternalReference(data.external_reference) || data?.metadata?.studiosbook_uid || "";
      result = uid ? await applyPixPayment(uid, data) : { ignored: true, reason: "foreign_payment" };
    } else if (eventType === "subscription_preapproval") {
      const { response, data } = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(dataId)}`);
      if (!response.ok) throw new Error(`Mercado Pago retornou ${response.status} ao consultar assinatura.`);
      const uid = uidFromExternalReference(data.external_reference);
      result = uid ? await applySubscription(uid, data) : { ignored: true, reason: "foreign_subscription" };
    } else if (eventType === "subscription_authorized_payment") {
      const { response, data } = await mercadoPagoRequest(`/authorized_payments/${encodeURIComponent(dataId)}`);
      if (!response.ok) throw new Error(`Mercado Pago retornou ${response.status} ao consultar fatura.`);
      const preapprovalId = data.preapproval_id || data.subscription_id || "";
      if (preapprovalId) {
        const subscriptionResult = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(preapprovalId)}`);
        if (!subscriptionResult.response.ok) throw new Error("Não foi possível consultar a assinatura da fatura.");
        const uid = uidFromExternalReference(subscriptionResult.data.external_reference);
        result = uid ? await applySubscription(uid, subscriptionResult.data) : { ignored: true, reason: "foreign_invoice" };
      }
    }

    await eventRef.set(
      {
        status: "processed",
        processed_at: new Date().toISOString(),
        result: toJsonSafe(result),
      },
      { merge: true }
    );
    return res.json({ ok: true, received: true, type: eventType });
  } catch (error) {
    console.error("Mercado Pago webhook error", error);
    await eventRef.set(
      { status: "failed", error: error?.message || "Erro no webhook.", failed_at: new Date().toISOString() },
      { merge: true }
    );
    return res.status(500).json({ error: "Erro ao processar webhook." });
  }
});

app.post("/functions/admin-session", requirePlatformAdmin, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  await safeAdminAudit(req, "admin.session.validated");
  res.json({
    success: true,
    admin: {
      uid: req.user.uid,
      email: req.user.email,
      role: "platform_admin",
    },
  });
});

app.post("/functions/admin-overview", requirePlatformAdmin, async (req, res) => {
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
        creationTime: authUser.creationTime || "",
        lastSignInTime: authUser.lastSignInTime || "",
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

app.post("/functions/admin-payment-diagnostics", requirePlatformAdmin, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;
  try {
    const { response, data } = await mercadoPagoRequest("/v1/payment_methods");
    const pix = Array.isArray(data) ? data.find((method) => method.id === "pix") : null;
    const webhookEvents = await adminDb.collection("MercadoPagoWebhookEvent").limit(50).get();
    const eventRows = webhookEvents.docs.map((doc) => doc.data());
    await safeAdminAudit(req, "admin.payments.diagnostics");
    res.json({
      success: response.ok,
      mercado_pago_api: response.ok ? "online" : "error",
      mercado_pago_status: response.status,
      pix_available: pix?.status === "active",
      pix_status: pix?.status || "not_found",
      webhook_ready: Boolean(webhookSecret()),
      webhook_url: MERCADO_PAGO_WEBHOOK_URL,
      webhook_events: eventRows.length,
      webhook_processed: eventRows.filter((event) => event.status === "processed").length,
      webhook_failed: eventRows.filter((event) => event.status === "failed").length,
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

app.post("/functions/admin-export", requirePlatformAdmin, async (req, res) => {
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

app.post("/functions/admin-update-subscription", requirePlatformAdmin, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
      return res.status(400).json({ error: "UID inválido." });
    }

    const current = await currentSubscription(uid);
    const preapprovalId = current.data?.mercado_pago_preapproval_id || "";
    if (!preapprovalId) {
      return res.status(409).json({ error: "Esta conta ainda não possui uma assinatura no Mercado Pago." });
    }

    const previousStatus = current.data?.status || "";
    const result = await syncSubscription(uid, preapprovalId);

    await safeAdminAudit(req, "admin.subscription.updated", {
      target_uid: uid,
      metadata: {
        source: "mercado_pago",
        previous_status: previousStatus,
        confirmed_status: result.subscription?.status || "",
      },
    });

    res.json({ success: true, source: "mercado_pago", ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar assinatura.", request_id: req.requestId });
  }
});

app.post("/functions/admin-set-user-access", requirePlatformAdmin, async (req, res) => {
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

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`StudiosBook API running on port ${port}`);
});
