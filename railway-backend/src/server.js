import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import cors from "cors";
import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const MP_API = "https://api.mercadopago.com";
const PRODUCT_NAME = "StudiosBook";
const PLAN_NAME = "StudiosBook Intermediário";
const MONTHLY_AMOUNT = 19.9;
const TRIAL_DAYS = 7;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://studiosbook.com.br";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "getblackvision.br@gmail.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "73981068594";
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "sobrinhonewton@gmail.com,getblackvision.br@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
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

const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

let adminAuth = null;
let adminDb = null;
let firebaseAdminReady = false;
let firebaseAdminError = "";

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
        firebaseAdminError =
          "Credencial Firebase Admin não configurada. Configure FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.";
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
    firebaseAdminError = error?.message || "Erro ao iniciar Firebase Admin.";
    console.error("Firebase Admin init error", error);
  }
}

initializeFirebaseAdmin();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origem não autorizada pelo CORS."));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

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
    firebase_project_id: FIREBASE_PROJECT_ID,
    missing_admin_credential: !firebaseAdminReady,
    admin_error: firebaseAdminReady ? "" : firebaseAdminError,
    mercado_pago_ready: Boolean(apiAccessToken()),
    support: {
      email: SUPPORT_EMAIL,
      phone: SUPPORT_PHONE,
    },
  };
}

async function requireFirebaseUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Login obrigatório." });

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    req.user = {
      uid: payload.user_id || payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email || "Profissional",
    };
    return next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function requirePlatformAdmin(req, res, next) {
  requireFirebaseUser(req, res, () => {
    const email = String(req.user?.email || "").toLowerCase();
    if (!ADMIN_EMAILS.has(email)) {
      return res.status(403).json({ error: "Acesso restrito ao administrador do StudiosBook." });
    }
    return next();
  });
}

function requireFirebaseAdminSdk(res) {
  if (firebaseAdminReady && adminDb && adminAuth) return true;
  res.status(503).json({
    error: "Painel admin indisponível. Configure a credencial Firebase Admin no Railway.",
    setup_required: true,
    ...adminStatusPayload(),
  });
  return false;
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

const USER_ENTITY_NAMES = [
  "Client",
  "ServiceRecord",
  "Appointment",
  "StudioProfile",
  "BackupSnapshot",
  "BillingSubscription",
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
  const subscription = entityRows.BillingSubscription?.[0] || null;
  const counts = Object.fromEntries(
    USER_ENTITY_NAMES.map((entityName) => [entityName, entityRows[entityName]?.length || 0])
  );

  return {
    uid,
    profile,
    subscription,
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

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "StudiosBook API",
    company: "BlackVision",
    public_app_url: PUBLIC_APP_URL,
    allowed_origins: [...allowedOrigins],
    ...adminStatusPayload(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "StudiosBook API", ...adminStatusPayload() });
});

app.post("/functions/create-subscription-checkout", requireFirebaseUser, async (req, res) => {
  try {
    const accessToken = apiAccessToken();
    if (!accessToken) {
      return res.status(500).json({
        error: "Token do Mercado Pago não configurado.",
        setup_required: true,
        missing_secret: "MERCADO_PAGO_ACCESS_TOKEN",
      });
    }

    const now = new Date();
    const trialEnd = addDays(now, TRIAL_DAYS);
    const appOrigin = safeOrigin(req.body?.app_url || PUBLIC_APP_URL);
    const externalReference = `studiosbook:${req.user.uid}:${Date.now()}`;
    const planId = process.env.MERCADO_PAGO_PLAN_ID;

    const mpPayload = {
      payer_email: req.user.email,
      external_reference: externalReference,
      back_url: `${appOrigin}/?checkout=studiosbook`,
      status: "pending",
    };

    if (planId) {
      mpPayload.preapproval_plan_id = planId;
    } else {
      mpPayload.reason = `${PRODUCT_NAME} - plano mensal com 7 dias grátis`;
      mpPayload.auto_recurring = {
        frequency: 1,
        frequency_type: "months",
        start_date: trialEnd.toISOString(),
        transaction_amount: MONTHLY_AMOUNT,
        currency_id: "BRL",
      };
    }

    const mpResponse = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpPayload),
    });
    const mpData = await readMercadoPagoResponse(mpResponse);

    if (!mpResponse.ok) {
      return res.status(502).json({
        error: "Mercado Pago recusou a criação do checkout.",
        mercado_pago_status: mpResponse.status,
        mercado_pago_response: mpData,
      });
    }

    const checkoutUrl = mpData.init_point || mpData.sandbox_init_point || "";
    const subscription = {
      user_email: req.user.email,
      plan_name: PLAN_NAME,
      status: mercadoPagoStatusToLocal(mpData.status),
      trial_start_date: now.toISOString(),
      trial_end_date: trialEnd.toISOString(),
      current_period_start: mpData?.auto_recurring?.start_date || trialEnd.toISOString(),
      next_payment_date: mpData?.next_payment_date || "",
      monthly_amount: MONTHLY_AMOUNT,
      currency_id: "BRL",
      mercado_pago_preapproval_id: mpData.id || "",
      mercado_pago_plan_id: planId || mpData.preapproval_plan_id || "",
      checkout_url: checkoutUrl,
      external_reference: externalReference,
      payer_email: req.user.email,
      payment_method_id: mpData.payment_method_id || "",
      last_payment_status: mpData.status || "pending",
      last_sync_date: now.toISOString(),
      notes: "Checkout de assinatura criado. A cobrança recorrente será processada pelo Mercado Pago após autorização.",
    };

    return res.json({
      success: true,
      checkout_url: checkoutUrl,
      subscription,
      trial_days: TRIAL_DAYS,
      trial_end_date: trialEnd.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno ao criar assinatura." });
  }
});

app.post("/functions/sync-subscription-status", requireFirebaseUser, async (req, res) => {
  try {
    const accessToken = apiAccessToken();
    if (!accessToken) {
      return res.status(500).json({
        error: "Token do Mercado Pago não configurado.",
        setup_required: true,
        missing_secret: "MERCADO_PAGO_ACCESS_TOKEN",
      });
    }

    const preapprovalId = req.body?.preapproval_id || req.body?.mercado_pago_preapproval_id;
    if (!preapprovalId) {
      return res.status(400).json({ error: "ID da assinatura Mercado Pago não informado." });
    }

    const mpResponse = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const mpData = await readMercadoPagoResponse(mpResponse);

    if (!mpResponse.ok) {
      return res.status(502).json({
        error: "Não foi possível consultar assinatura no Mercado Pago.",
        mercado_pago_status: mpResponse.status,
        mercado_pago_response: mpData,
      });
    }

    return res.json({
      success: true,
      subscription: {
        status: mercadoPagoStatusToLocal(mpData.status),
        current_period_start: mpData?.auto_recurring?.start_date || "",
        current_period_end: mpData?.auto_recurring?.end_date || "",
        next_payment_date: mpData?.next_payment_date || "",
        mercado_pago_plan_id: mpData.preapproval_plan_id || "",
        checkout_url: mpData.init_point || "",
        payment_method_id: mpData.payment_method_id || "",
        last_payment_status: mpData.status || "",
        last_sync_date: new Date().toISOString(),
        notes: "Status sincronizado com o Mercado Pago.",
      },
      mercado_pago_status: mpData.status || "",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno ao sincronizar assinatura." });
  }
});

app.get("/functions/mercado-pago-webhook", (_req, res) => {
  res.json({ ok: true, service: "StudiosBook Mercado Pago webhook" });
});

app.post("/functions/mercado-pago-webhook", async (req, res) => {
  console.log("Mercado Pago webhook", JSON.stringify(req.body || {}));
  res.json({
    ok: true,
    received: true,
    note: "Evento recebido. A sincronização visual acontece pelo botão Atualizar status dentro do StudiosBook.",
  });
});

app.post("/functions/admin-overview", requirePlatformAdmin, async (_req, res) => {
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
      return {
        uid: workspace.uid,
        email: authUser.email || workspace.profile?.user_email || workspace.subscription?.user_email || "",
        displayName: authUser.displayName || workspace.profile?.owner_name || "",
        disabled: Boolean(authUser.disabled),
        creationTime: authUser.creationTime || "",
        lastSignInTime: authUser.lastSignInTime || "",
        business_name: workspace.profile?.business_name || "",
        categories: workspace.profile?.categories || [],
        subscription: workspace.subscription || null,
        counts: workspace.counts,
      };
    });

    const metrics = users.reduce(
      (acc, user) => {
        acc.users += 1;
        acc.clients += user.counts.Client || 0;
        acc.records += user.counts.ServiceRecord || 0;
        acc.appointments += user.counts.Appointment || 0;
        if (user.subscription?.status === "authorized") acc.active_subscriptions += 1;
        if (user.disabled) acc.disabled_users += 1;
        return acc;
      },
      { users: 0, clients: 0, records: 0, appointments: 0, active_subscriptions: 0, disabled_users: 0 }
    );

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      metrics,
      users,
      auth_error: authError,
      ...adminStatusPayload(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar painel admin.", detail: error?.message || "" });
  }
});

app.post("/functions/admin-export", requirePlatformAdmin, async (_req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const workspaceIds = await listWorkspaceIds();
    const authUsers = await listAuthUsers().catch(() => []);
    const allIds = [...new Set([...workspaceIds, ...authUsers.map((user) => user.uid)])];
    const workspaces = await Promise.all(allIds.map((uid) => loadWorkspace(uid, true)));
    res.json({
      success: true,
      exported_at: new Date().toISOString(),
      auth_users: authUsers,
      workspaces,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao exportar dados administrativos.", detail: error?.message || "" });
  }
});

app.post("/functions/admin-update-subscription", requirePlatformAdmin, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    const subscriptionId = String(req.body?.subscription_id || "").trim();
    const patch = req.body?.patch || {};
    if (!uid) return res.status(400).json({ error: "UID não informado." });

    const allowedFields = [
      "status",
      "notes",
      "trial_end_date",
      "current_period_end",
      "next_payment_date",
      "last_payment_status",
    ];
    const payload = Object.fromEntries(
      Object.entries(patch)
        .filter(([key]) => allowedFields.includes(key))
        .map(([key, value]) => [key, value])
    );
    payload.updated_date = new Date().toISOString();
    payload.admin_updated = true;

    const collectionRef = adminDb.collection("users").doc(uid).collection("BillingSubscription");
    let docRef;
    if (subscriptionId) {
      docRef = collectionRef.doc(subscriptionId);
      await docRef.set(payload, { merge: true });
    } else {
      docRef = await collectionRef.add({
        user_email: req.body?.user_email || "",
        plan_name: PLAN_NAME,
        monthly_amount: MONTHLY_AMOUNT,
        currency_id: "BRL",
        created_date: new Date().toISOString(),
        ...payload,
      });
    }

    res.json({ success: true, id: docRef.id, payload });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar assinatura.", detail: error?.message || "" });
  }
});

app.post("/functions/admin-set-user-access", requirePlatformAdmin, async (req, res) => {
  if (!requireFirebaseAdminSdk(res)) return;

  try {
    const uid = String(req.body?.uid || "").trim();
    const disabled = Boolean(req.body?.disabled);
    if (!uid) return res.status(400).json({ error: "UID não informado." });
    if (uid === req.user.uid && disabled) {
      return res.status(400).json({ error: "Você não pode desativar o próprio acesso admin." });
    }

    const user = await adminAuth.updateUser(uid, { disabled });
    res.json({ success: true, uid: user.uid, disabled: user.disabled });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar acesso do usuário.", detail: error?.message || "" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`StudiosBook API running on port ${port}`);
});
