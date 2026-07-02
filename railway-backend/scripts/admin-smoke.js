import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (raw) {
    const source = raw.trim();
    const parsed = JSON.parse(source.startsWith("{") ? source : Buffer.from(source, "base64").toString("utf8"));
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
const apiUrl =
  process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app";
const apiKey = process.env.FIREBASE_WEB_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs";
const adminEmail = String(process.env.ADMIN_SMOKE_EMAIL || "").trim().toLowerCase();
if (!adminEmail) throw new Error("Defina ADMIN_SMOKE_EMAIL para executar o teste administrativo.");

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount()), projectId });
}

const auth = getAuth();
const adminUser = await auth.getUserByEmail(adminEmail);
if (adminUser.customClaims?.platform_admin !== true) {
  throw new Error("A conta de teste não possui a claim platform_admin.");
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
if (!signInResponse.ok || !signIn.idToken) throw new Error("Não foi possível criar sessão de diagnóstico admin.");

async function invoke(name) {
  const response = await fetch(`${apiUrl}/functions/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signIn.idToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const data = await response.json();
  return { response, data };
}

const overview = await invoke("admin-overview");
const diagnostics = await invoke("admin-payment-diagnostics");
const result = {
  admin_overview: overview.response.ok && overview.data.success === true,
  users_visible: Number(overview.data?.metrics?.users || 0) >= 1,
  recent_payments_available: Array.isArray(overview.data?.recent_payments),
  payment_diagnostics: diagnostics.response.ok && diagnostics.data.success === true,
  stripe_api: diagnostics.data?.stripe_api === "online",
  recurring_price_ready: diagnostics.data?.recurring_price_ready === true,
  webhook_ready: diagnostics.data?.webhook_ready === true,
};

console.log(JSON.stringify(result));
if (Object.values(result).some((value) => value !== true)) process.exitCode = 1;
