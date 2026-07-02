import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";

const command = process.argv[2] || "prepare";
const stateFile = process.env.STRIPE_E2E_OUTPUT_FILE || "stripe-e2e-state.json";
const apiUrl = (process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs";

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
  if (beginIndex >= 0 && endIndex >= 0) key = `${key.slice(beginIndex, endIndex + endMarker.length)}\n`;
  return key;
}

function initializeAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function exchangeCustomToken(customToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.idToken) throw new Error(payload?.error?.message || "Falha ao autenticar conta técnica.");
  return payload.idToken;
}

async function invoke(idToken, name, data = {}) {
  const response = await fetch(`${apiUrl}/functions/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${name}: ${payload.error || response.status}`);
  return payload;
}

async function prepare() {
  if (!apiUrl || !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    throw new Error("Ambiente de homologação Stripe incompleto.");
  }
  const { auth } = initializeAdmin();
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `stripe-e2e+${suffix}@studiosbook.test`;
  const user = await auth.createUser({ email, emailVerified: true, displayName: "Stripe E2E StudiosBook" });
  const customToken = await auth.createCustomToken(user.uid, { studiosbook_e2e: true });
  const idToken = await exchangeCustomToken(customToken);
  const billing = await invoke(idToken, "ensure-billing-account");
  if (billing.subscription?.status !== "trialing" || billing.access?.allowed !== true) {
    throw new Error("A conta técnica não iniciou o teste gratuito corretamente.");
  }
  const checkout = await invoke(idToken, "create-subscription-checkout", {
    app_url: "https://studiosbook.com.br",
  });
  if (!checkout.url || !checkout.url.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Checkout Stripe hospedado não foi criado.");
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
  const sessionId = new URL(checkout.url).pathname.split("/").filter(Boolean).pop();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  const line = session.line_items?.data?.[0];
  if (session.mode !== "subscription" || line?.price?.id !== process.env.STRIPE_PRICE_ID) {
    throw new Error("Checkout não está vinculado ao plano mensal correto.");
  }

  await writeFile(
    stateFile,
    `${JSON.stringify({ uid: user.uid, email, id_token: idToken, session_id: session.id, session_url: checkout.url }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
  console.log(JSON.stringify({ ok: true, stage: "prepared", checkout_mode: session.mode, trial_status: billing.subscription.status }));
}

async function verify() {
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
  const session = await stripe.checkout.sessions.retrieve(state.session_id, { expand: ["subscription"] });
  if (session.status !== "complete") throw new Error(`Checkout ainda está ${session.status || "incompleto"}.`);
  const result = await invoke(state.id_token, "sync-billing-status", { session_id: state.session_id });
  const subscription = result.subscription || {};
  if (!subscription.stripe_subscription_id || !["trialing", "active"].includes(subscription.stripe_subscription_status)) {
    throw new Error("Assinatura Stripe não foi sincronizada no StudiosBook.");
  }
  if (result.access?.allowed !== true) throw new Error("Assinatura válida não liberou acesso.");
  console.log(
    JSON.stringify({
      ok: true,
      stage: "verified",
      checkout_status: session.status,
      subscription_status: subscription.stripe_subscription_status,
      access_allowed: result.access.allowed,
    })
  );
}

async function preparePix() {
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  const checkout = await invoke(state.id_token, "create-pix-payment", {
    app_url: "https://studiosbook.com.br",
  });
  if (!checkout.url || !checkout.url.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Checkout Pix Stripe hospedado não foi criado.");
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
  const sessionId = new URL(checkout.url).pathname.split("/").filter(Boolean).pop();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (
    session.mode !== "payment" ||
    !session.payment_method_types?.includes("pix") ||
    session.amount_total !== 2690
  ) {
    throw new Error("Checkout Pix não está configurado como pagamento avulso de R$ 26,90.");
  }
  await writeFile(
    stateFile,
    `${JSON.stringify({ ...state, pix_session_id: session.id, pix_session_url: checkout.url }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
  console.log(JSON.stringify({ ok: true, stage: "pix_prepared", checkout_mode: session.mode, amount: session.amount_total }));
}

async function verifyPix() {
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
  const session = await stripe.checkout.sessions.retrieve(state.pix_session_id);
  if (session.payment_status !== "paid") {
    throw new Error(`Pix ainda está ${session.payment_status || "não pago"}.`);
  }
  const result = await invoke(state.id_token, "sync-billing-status", { session_id: state.pix_session_id });
  const payment = result.payment || result.latest_payment || {};
  if (payment.billing_flow !== "pix" || payment.status !== "approved") {
    throw new Error("Pagamento Pix não foi sincronizado como aprovado.");
  }
  if (result.access?.allowed !== true) throw new Error("Pix aprovado não liberou acesso.");
  console.log(
    JSON.stringify({
      ok: true,
      stage: "pix_verified",
      payment_status: session.payment_status,
      local_status: payment.status,
      access_allowed: result.access.allowed,
    })
  );
}

async function cleanup() {
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  const { auth, db } = initializeAdmin();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
  const session = await stripe.checkout.sessions.retrieve(state.session_id).catch(() => null);
  if (session?.subscription) {
    await stripe.subscriptions.cancel(String(session.subscription)).catch(() => {});
  }
  if (session?.customer) await stripe.customers.del(String(session.customer)).catch(() => {});
  await db.recursiveDelete(db.collection("users").doc(state.uid)).catch(() => {});
  await auth.deleteUser(state.uid).catch(() => {});
  await rm(stateFile, { force: true });
  console.log(JSON.stringify({ ok: true, stage: "cleaned" }));
}

const handlers = { prepare, verify, "prepare-pix": preparePix, "verify-pix": verifyPix, cleanup };
if (!handlers[command]) throw new Error(`Comando inválido: ${command}`);
handlers[command]().catch((error) => {
  console.error(JSON.stringify({ ok: false, stage: command, error: error?.message || "E2E failed" }));
  process.exitCode = 1;
});
