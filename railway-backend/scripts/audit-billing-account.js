import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { stripeInvoiceSubscriptionId } from "../src/billing.js";

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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { maxNetworkRetries: 2, timeout: 12000 });

function rows(snapshot) {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function subscriptionSummary(item) {
  return {
    id: item?.id || "",
    status: item?.status || "",
    customer: typeof item?.customer === "string" ? item.customer : item?.customer?.id || "",
    price_id: item?.items?.data?.[0]?.price?.id || "",
    current_period_end: item?.items?.data?.[0]?.current_period_end || item?.current_period_end || 0,
    cancel_at_period_end: Boolean(item?.cancel_at_period_end),
    created: item?.created || 0,
  };
}

function paymentSummary(item) {
  return {
    id: String(item?.id || item?.stripe_invoice_id || item?.stripe_payment_intent_id || ""),
    status: item?.status || "",
    status_detail: item?.status_detail || "",
    amount: Number(item?.amount_paid || item?.amount || 0),
    payment_method_id: item?.payment_method || "",
    date_approved: item?.date_approved || "",
    date_last_updated: item?.date_last_updated || "",
  };
}

const user = await auth.getUserByEmail(targetEmail);
const userRef = db.collection("users").doc(user.uid);
const [userDoc, subscriptionDocs, paymentDocs] = await Promise.all([
  userRef.get(),
  userRef.collection("BillingSubscription").get(),
  userRef.collection("BillingPayment").get(),
]);
const localSubscriptions = rows(subscriptionDocs);
const storedCustomerId = localSubscriptions.find((item) => item.stripe_customer_id)?.stripe_customer_id || "";
const customerList = storedCustomerId
  ? { data: [await stripe.customers.retrieve(storedCustomerId)] }
  : await stripe.customers.list({ email: targetEmail, limit: 100 });
const customer = customerList.data.find(
  (item) => !item.deleted && (item.metadata?.studiosbook_uid === user.uid || item.email === targetEmail)
) || null;
const stripeSubscriptions = customer
  ? (await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 })).data
  : [];
const stripeInvoices = customer
  ? (await stripe.invoices.list({ customer: customer.id, limit: 25 })).data
  : [];

console.log(
  JSON.stringify(
    {
      firebase_user: {
        uid: user.uid,
        email: user.email || "",
        created_at: user.metadata?.creationTime || "",
      },
      firebase_root: userDoc.exists ? userDoc.data() : null,
      firebase_subscriptions: localSubscriptions,
      firebase_payments: rows(paymentDocs).map(paymentSummary),
      stripe_customer: customer && !customer.deleted ? { id: customer.id, email: customer.email, livemode: customer.livemode } : null,
      stripe_subscriptions: stripeSubscriptions.map(subscriptionSummary),
      stripe_invoices: stripeInvoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        amount_paid: Number(invoice.amount_paid || 0) / 100,
        currency: invoice.currency,
        subscription: stripeInvoiceSubscriptionId(invoice),
        created: invoice.created,
      })),
    },
    null,
    2
  )
);
