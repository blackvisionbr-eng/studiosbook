import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function normalizePrivateKey(value) {
  const marker = "-----END PRIVATE KEY-----";
  let key = String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
  const begin = key.indexOf("-----BEGIN PRIVATE KEY-----");
  const end = key.indexOf(marker);
  if (begin >= 0 && end >= 0) key = `${key.slice(begin, end + marker.length)}\n`;
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

const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
if (!email || !password || password.length < 8) {
  throw new Error("Defina ADMIN_BOOTSTRAP_EMAIL e uma ADMIN_BOOTSTRAP_PASSWORD com pelo menos 8 caracteres.");
}

const projectId = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
if (!getApps().length) initializeApp({ credential: cert(serviceAccount()), projectId });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
  user = await auth.updateUser(user.uid, { password, emailVerified: true, disabled: false });
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
  user = await auth.createUser({ email, password, emailVerified: true, disabled: false });
}

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  platform_admin: true,
});
await auth.revokeRefreshTokens(user.uid);
console.log(JSON.stringify({ success: true, uid: user.uid, email: user.email, role: "platform_admin" }));
