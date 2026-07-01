import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const targetEmail = String(process.argv[2] || "").trim().toLowerCase();
const adminEmail = String(process.env.ADMIN_SMOKE_EMAIL || "").trim().toLowerCase();
if (!targetEmail) throw new Error("Informe o e-mail da conta a reconciliar.");
if (!adminEmail) throw new Error("ADMIN_SMOKE_EMAIL não configurado.");

function normalizePrivateKey(value) {
  const endMarker = "-----END PRIVATE KEY-----";
  let key = String(value || "")
    .trim()
    .replace(/^['"]/, "")
    .replace(/['"]$/, "")
    .replace(/\\\"/g, '"')
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
  const beginIndex = key.indexOf("-----BEGIN PRIVATE KEY-----");
  const endIndex = key.indexOf(endMarker);
  if (beginIndex >= 0 && endIndex >= 0) {
    key = `${key.slice(beginIndex, endIndex + endMarker.length)}\n`;
  }
  return key;
}

function serviceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (raw) {
    const parsed = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    return {
      projectId: parsed.projectId || parsed.project_id,
      clientEmail: parsed.clientEmail || parsed.client_email,
      privateKey: normalizePrivateKey(parsed.privateKey || parsed.private_key),
    };
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

const projectId = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
const apiUrl = process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app";
const apiKey = process.env.FIREBASE_WEB_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs";
initializeApp({ credential: cert(serviceAccount()), projectId });

const auth = getAuth();
const [adminUser, targetUser] = await Promise.all([
  auth.getUserByEmail(adminEmail),
  auth.getUserByEmail(targetEmail),
]);
if (adminUser.customClaims?.platform_admin !== true) {
  throw new Error("A conta de serviço administrativo não possui platform_admin.");
}

const customToken = await auth.createCustomToken(adminUser.uid);
const signInResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  }
);
const signIn = await signInResponse.json();
if (!signInResponse.ok || !signIn.idToken) throw new Error("Não foi possível abrir sessão admin.");

const response = await fetch(`${apiUrl}/functions/admin-update-subscription`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${signIn.idToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ uid: targetUser.uid }),
});
const data = await response.json();
if (!response.ok) throw new Error(data.error || `Reconciliação falhou com HTTP ${response.status}.`);

console.log(
  JSON.stringify({
    success: true,
    uid: targetUser.uid,
    email: targetUser.email || targetEmail,
    preapproval_id: data.reconciled_preapproval_id || "",
    access_status: data.access?.status || "",
    access_allowed: data.access?.allowed === true,
    subscription_status: data.subscription?.mercado_pago_subscription_status || "",
    payment_status: data.subscription?.last_payment_status || "",
    payment_detail: data.subscription?.last_payment_detail || "",
    current_period_end: data.subscription?.current_period_end || "",
  })
);
