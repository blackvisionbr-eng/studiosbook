import "dotenv/config";
import cors from "cors";
import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const MP_API = "https://api.mercadopago.com";
const PRODUCT_NAME = "StudioBook";
const PLAN_NAME = "StudioBook Intermediário";
const MONTHLY_AMOUNT = 19.9;
const TRIAL_DAYS = 7;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://studiosbook.com.br";
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

async function readMercadoPagoResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "StudioBook API",
    company: "BlackVision",
    public_app_url: PUBLIC_APP_URL,
    allowed_origins: [...allowedOrigins],
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/functions/create-subscription-checkout", requireFirebaseUser, async (req, res) => {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
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
    const externalReference = `studiobook:${req.user.uid}:${Date.now()}`;
    const planId = process.env.MERCADO_PAGO_PLAN_ID;

    const mpPayload = {
      payer_email: req.user.email,
      external_reference: externalReference,
      back_url: `${appOrigin}/?checkout=studiobook`,
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
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
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
  res.json({ ok: true, service: "StudioBook Mercado Pago webhook" });
});

app.post("/functions/mercado-pago-webhook", async (req, res) => {
  console.log("Mercado Pago webhook", JSON.stringify(req.body || {}));
  res.json({
    ok: true,
    received: true,
    note: "Evento recebido. A sincronização visual acontece pelo botão Atualizar status dentro do StudioBook.",
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`StudioBook API running on port ${port}`);
});
