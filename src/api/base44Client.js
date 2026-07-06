import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getBlob,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { sanitizeFirestorePayload } from "../lib/firestorePayload.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studiosbook.com.br",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blackvision-27f1c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blackvision-27f1c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "574358182772",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:574358182772:web:9796070587004f3f33aa21",
};

const apiBaseUrls = (import.meta.env.VITE_API_BASE_URLS || import.meta.env.VITE_API_BASE_URL || "https://studiosbook-api-production.up.railway.app")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "pt-BR";
const db = getFirestore(app);
const storage = getStorage(app);

const MAX_PROCEDURE_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROCEDURE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let lastRedirectError = null;
const redirectResultReady = getRedirectResult(auth).catch((error) => {
  lastRedirectError = error;
  console.error("Firebase redirect login error", error);
  return null;
});

let authReadyResolved = false;
const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    authReadyResolved = true;
    resolve(user);
  });
});

async function currentUser() {
  if (!authReadyResolved) await authReady;
  return auth.currentUser;
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Login obrigatório.");
  return user;
}

function toBaseUser(user) {
  return {
    id: user.uid,
    uid: user.uid,
    email: user.email || "",
    full_name: user.displayName || user.email || "Profissional",
    photo_url: user.photoURL || "",
  };
}

function entityPath(uid, entityName) {
  return ["users", uid, entityName];
}

function serializeDoc(snapshot) {
  const data = snapshot.data() || {};
  return { id: snapshot.id, ...data };
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const descending = String(sort).startsWith("-");
  const field = descending ? String(sort).slice(1) : String(sort);
  return [...rows].sort((a, b) => {
    const left = a?.[field] ?? "";
    const right = b?.[field] ?? "";
    const result = String(left).localeCompare(String(right));
    return descending ? -result : result;
  });
}

function matchesFilter(row, filter = {}) {
  return Object.entries(filter).every(([key, value]) => row?.[key] === value);
}

function createEntity(entityName) {
  return {
    async list(sort, limitCount = 500) {
      const user = await requireUser();
      const ref = collection(db, ...entityPath(user.uid, entityName));
      const snapshots = await getDocs(ref);
      const rows = snapshots.docs.map(serializeDoc);
      return sortRows(rows, sort).slice(0, limitCount || rows.length);
    },

    async filter(filter = {}, sort, limitCount = 500) {
      const rows = await this.list(sort, 5000);
      return rows.filter((row) => matchesFilter(row, filter)).slice(0, limitCount || rows.length);
    },

    async create(data) {
      const user = await requireUser();
      const now = new Date().toISOString();
      const payload = sanitizeFirestorePayload({
        ...data,
        created_by: user.email || user.uid,
        created_date: data?.created_date || now,
        updated_date: now,
      });
      const ref = await addDoc(collection(db, ...entityPath(user.uid, entityName)), payload);
      return { id: ref.id, ...payload };
    },

    async update(id, data) {
      const user = await requireUser();
      const now = new Date().toISOString();
      const payload = sanitizeFirestorePayload({
        ...data,
        updated_date: now,
      });
      await updateDoc(doc(db, ...entityPath(user.uid, entityName), id), payload);
      return { id, ...payload };
    },

    async delete(id) {
      const user = await requireUser();
      await deleteDoc(doc(db, ...entityPath(user.uid, entityName), id));
      return { success: true };
    },
  };
}

function subscribeBillingAccess(onChange, onError) {
  const user = auth.currentUser;
  if (!user) throw new Error("Login obrigatório.");
  return onSnapshot(
    doc(db, "users", user.uid),
    (snapshot) => onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

function assertProcedurePhoto(file) {
  if (!(file instanceof File)) throw new Error("Selecione uma imagem válida.");
  if (!ALLOWED_PROCEDURE_PHOTO_TYPES.has(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > MAX_PROCEDURE_PHOTO_BYTES) {
    throw new Error("A imagem deve ter no máximo 8 MB.");
  }
}

function photoExtension(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function uploadProcedurePhoto(recordId, slot, file) {
  const user = await requireUser();
  assertProcedurePhoto(file);
  if (!recordId || !["before", "after"].includes(slot)) {
    throw new Error("Destino da foto inválido.");
  }
  const extension = photoExtension(file.type);
  const path = `users/${user.uid}/procedures/${recordId}/${slot}-${Date.now()}.${extension}`;
  const target = storageRef(storage, path);
  await uploadBytes(target, file, {
    contentType: file.type,
    cacheControl: "private,max-age=3600",
    customMetadata: { ownerId: user.uid, procedureId: recordId, slot },
  });
  return path;
}

async function getPrivatePhotoObjectUrl(path) {
  const user = await requireUser();
  const expectedPrefix = `users/${user.uid}/procedures/`;
  if (!String(path || "").startsWith(expectedPrefix)) {
    throw new Error("Foto fora do espaço privado da conta.");
  }
  const blob = await getBlob(storageRef(storage, path));
  return URL.createObjectURL(blob);
}

async function deleteProcedurePhoto(path) {
  const user = await requireUser();
  const expectedPrefix = `users/${user.uid}/procedures/`;
  if (!String(path || "").startsWith(expectedPrefix)) return;
  await deleteObject(storageRef(storage, path));
}

async function invokeFunction(name, data = {}) {
  if (!apiBaseUrls.length) {
    throw new Error("Serviço temporariamente indisponível.");
  }

  const user = await requireUser();
  const token = await user.getIdToken();

  let lastError;
  for (const apiBaseUrl of apiBaseUrls) {
    try {
      const response = await fetch(`${apiBaseUrl}/functions/${name}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data || {}),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(payload?.error || "Erro no backend.");
        error.data = payload;
        throw error;
      }

      return payload;
    } catch (error) {
      lastError = error;
      if (error?.data) throw error;
    }
  }

  throw lastError || new Error("Serviço temporariamente indisponível.");
}

export const base44 = {
  auth: {
    async isAuthenticated() {
      await redirectResultReady;
      return Boolean(await currentUser());
    },
    getLastRedirectError() {
      return lastRedirectError;
    },
    async me() {
      const user = await requireUser();
      return toBaseUser(user);
    },
    async loginWithProvider(providerName = "google") {
      if (providerName !== "google") throw new Error("Provedor não suportado.");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
    },
    async loginWithEmail(email, password) {
      const credential = await signInWithEmailAndPassword(
        auth,
        String(email || "").trim().toLowerCase(),
        String(password || "")
      );
      await credential.user.getIdToken(true);
      return toBaseUser(credential.user);
    },
    async registerWithEmail(email, password, fullName) {
      const credential = await createUserWithEmailAndPassword(
        auth,
        String(email || "").trim().toLowerCase(),
        String(password || "")
      );
      const name = String(fullName || "").trim();
      if (name) await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user, {
        url: "https://studiosbook.com.br/",
        handleCodeInApp: false,
        linkDomain: "studiosbook.com.br",
      }).catch((error) => console.warn("E-mail de verificação não enviado", error?.code || error?.message));
      await credential.user.getIdToken(true);
      return toBaseUser(credential.user);
    },
    async sendPasswordReset(email) {
      await sendPasswordResetEmail(auth, String(email || "").trim().toLowerCase(), {
        url: "https://studiosbook.com.br/",
        handleCodeInApp: false,
        linkDomain: "studiosbook.com.br",
      });
      return { success: true };
    },
    async logout(returnUrl = window.location.origin) {
      await signOut(auth);
      window.location.href = returnUrl;
    },
  },
  entities: {
    Client: createEntity("Client"),
    ServiceRecord: createEntity("ServiceRecord"),
    Appointment: createEntity("Appointment"),
    StudioProfile: createEntity("StudioProfile"),
    BackupSnapshot: createEntity("BackupSnapshot"),
    BillingSubscription: createEntity("BillingSubscription"),
  },
  functions: {
    invoke: invokeFunction,
  },
  billing: {
    subscribeAccess: subscribeBillingAccess,
  },
  storage: {
    uploadProcedurePhoto,
    getPrivatePhotoObjectUrl,
    deleteProcedurePhoto,
    maxProcedurePhotoBytes: MAX_PROCEDURE_PHOTO_BYTES,
  },
};
