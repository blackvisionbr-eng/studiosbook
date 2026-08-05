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

const email = String(process.env.MASTER_ADMIN_EMAIL || "getblackvision.br@gmail.com").trim().toLowerCase();
const projectId = process.env.FIREBASE_PROJECT_ID || "blackvision-27f1c";
if (!getApps().length) initializeApp({ credential: cert(serviceAccount()), projectId });

const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.updateUser(user.uid, { emailVerified: true, disabled: false });
await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  platform_admin: true,
  platform_role: "master_admin",
});
await auth.revokeRefreshTokens(user.uid);
console.log(JSON.stringify({ success: true, uid: user.uid, email: user.email, role: "master_admin" }));
