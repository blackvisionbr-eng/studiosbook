import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const targetEmail = String(process.argv[2] || "").trim().toLowerCase();
if (!targetEmail) throw new Error("Informe o e-mail da conta a auditar.");

function parseServiceAccount() {
  const source = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      ""
  ).trim();
  if (source) {
    return JSON.parse(source.startsWith("{") ? source : Buffer.from(source, "base64").toString("utf8"));
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

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

const serviceAccount = parseServiceAccount();
initializeApp({ credential: cert(serviceAccount), projectId: process.env.FIREBASE_PROJECT_ID });
const auth = getAuth();
const db = getFirestore();
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";

async function mercadoPago(path) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function rows(snapshot) {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function subscriptionSummary(item) {
  return {
    id: item?.id || "",
    status: item?.status || "",
    payer_email: item?.payer_email || "",
    external_reference: item?.external_reference || "",
    payment_method_id: item?.payment_method_id || "",
    next_payment_date: item?.next_payment_date || "",
    date_created: item?.date_created || "",
    last_modified: item?.last_modified || "",
  };
}

function paymentSummary(item) {
  return {
    id: String(item?.id || item?.mercado_pago_payment_id || ""),
    status: item?.status || "",
    status_detail: item?.status_detail || "",
    amount: Number(item?.transaction_amount || item?.amount || 0),
    external_reference: item?.external_reference || "",
    payment_method_id: item?.payment_method_id || item?.payment_method || "",
    date_approved: item?.date_approved || "",
    date_last_updated: item?.date_last_updated || "",
  };
}

const user = await auth.getUserByEmail(targetEmail);
const userRef = db.collection("users").doc(user.uid);
const [userDoc, subscriptionDocs, paymentDocs, searchResult] = await Promise.all([
  userRef.get(),
  userRef.collection("BillingSubscription").get(),
  userRef.collection("BillingPayment").get(),
  mercadoPago(`/preapproval/search?payer_email=${encodeURIComponent(targetEmail)}&limit=100`),
]);

const mercadoPagoSubscriptions = Array.isArray(searchResult.data?.results)
  ? searchResult.data.results
  : [];
const invoiceGroups = [];
for (const subscription of mercadoPagoSubscriptions) {
  const invoiceResult = await mercadoPago(
    `/authorized_payments/search?preapproval_id=${encodeURIComponent(subscription.id)}`
  );
  const invoices = Array.isArray(invoiceResult.data?.results) ? invoiceResult.data.results : [];
  const payments = [];
  for (const invoice of invoices) {
    const paymentId = invoice?.payment?.id;
    if (!paymentId) continue;
    const paymentResult = await mercadoPago(`/v1/payments/${encodeURIComponent(paymentId)}`);
    if (paymentResult.ok) payments.push(paymentSummary(paymentResult.data));
  }
  invoiceGroups.push({
    preapproval_id: subscription.id,
    invoice_status: invoiceResult.status,
    invoices: invoices.map((invoice) => ({
      id: invoice?.id || "",
      status: invoice?.status || "",
      payment_id: String(invoice?.payment?.id || ""),
      last_modified: invoice?.last_modified || "",
    })),
    payments,
  });
}

console.log(
  JSON.stringify(
    {
      firebase_user: {
        uid: user.uid,
        email: user.email || "",
        created_at: user.metadata?.creationTime || "",
      },
      firebase_root: userDoc.exists ? userDoc.data() : null,
      firebase_subscriptions: rows(subscriptionDocs),
      firebase_payments: rows(paymentDocs).map(paymentSummary),
      mercado_pago_search_status: searchResult.status,
      mercado_pago_subscriptions: mercadoPagoSubscriptions.map(subscriptionSummary),
      mercado_pago_invoices: invoiceGroups,
    },
    null,
    2
  )
);
