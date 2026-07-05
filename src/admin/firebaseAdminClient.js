import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studiosbook.com.br",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blackvision-27f1c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blackvision-27f1c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "574358182772",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:574358182772:web:9796070587004f3f33aa21",
};

const apiBaseUrls = (
  import.meta.env.VITE_API_BASE_URLS ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://studiosbook-api-production.up.railway.app"
)
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

const app = initializeApp(firebaseConfig, "studiosbook-admin");
export const adminAuth = getAuth(app);
adminAuth.languageCode = "pt-BR";
const adminPersistenceReady = setPersistence(adminAuth, browserSessionPersistence);

export async function signInAdmin(email, password) {
  await adminPersistenceReady;
  const credential = await signInWithEmailAndPassword(adminAuth, email, password);
  await credential.user.getIdToken(true);
  return credential.user;
}

export function signOutAdmin() {
  return signOut(adminAuth);
}

export function sendAdminPasswordResetEmail(email) {
  return sendPasswordResetEmail(adminAuth, String(email || "").trim(), {
    url: "https://studiosbook.com.br/admin",
    handleCodeInApp: false,
    linkDomain: "studiosbook.com.br",
  });
}

export async function changeAdminPassword(currentPassword, newPassword) {
  const user = adminAuth.currentUser;
  if (!user?.email) throw new Error("Sessão administrativa não encontrada.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  await user.getIdToken(true);
}

export async function invokeAdmin(name, data = {}, user = adminAuth.currentUser) {
  if (!user) throw new Error("Sessão administrativa não encontrada.");
  const token = await user.getIdToken();
  let lastError = null;

  for (const apiBaseUrl of apiBaseUrls) {
    try {
      const response = await fetch(`${apiBaseUrl}/functions/${name}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.error || "A operação administrativa falhou.");
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (error?.status) throw error;
    }
  }

  throw lastError || new Error("Backend administrativo indisponível.");
}
