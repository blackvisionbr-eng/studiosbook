import Stripe from "stripe";
import { stripeChargeRefundState, stripeInvoicePaymentIntentId } from "../src/billing.js";

const invoiceId = String(process.argv[2] || "").trim();
const apiUrl = String(
  process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app"
).replace(/\/$/, "");
const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();

if (!invoiceId) throw new Error("Informe o ID da fatura reembolsada.");
if (!secretKey || !webhookSecret) throw new Error("Variaveis Stripe incompletas.");

const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 12000 });
const invoice = await stripe.invoices.retrieve(invoiceId);
let charge = null;
if (invoice.charge) {
  charge = typeof invoice.charge === "object" ? invoice.charge : await stripe.charges.retrieve(invoice.charge);
} else {
  const invoicePayments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    status: "paid",
    limit: 10,
    expand: ["data.payment.charge", "data.payment.payment_intent.latest_charge"],
  });
  const invoicePayment = invoicePayments.data.find((payment) => payment.status === "paid");
  if (invoicePayment?.payment?.charge) {
    charge =
      typeof invoicePayment.payment.charge === "object"
        ? invoicePayment.payment.charge
        : await stripe.charges.retrieve(invoicePayment.payment.charge);
  }
  const expandedPaymentIntent = invoicePayment?.payment?.payment_intent;
  const paymentIntentId =
    (typeof expandedPaymentIntent === "string" ? expandedPaymentIntent : expandedPaymentIntent?.id) ||
    stripeInvoicePaymentIntentId(invoice);
  if (paymentIntentId) {
    const paymentIntent =
      typeof expandedPaymentIntent === "object"
        ? expandedPaymentIntent
        : await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    if (paymentIntent.latest_charge) {
      charge =
        typeof paymentIntent.latest_charge === "object"
          ? paymentIntent.latest_charge
          : await stripe.charges.retrieve(paymentIntent.latest_charge);
    }
  }
}

if (!charge) throw new Error("Charge da fatura nao encontrado na Stripe.");
if (stripeChargeRefundState(charge).status !== "refunded") {
  throw new Error("A fatura informada nao possui estorno total confirmado pela Stripe.");
}

const replayEvent = {
  id: `evt_studiosbook_refund_retest_${Date.now()}`,
  object: "event",
  api_version: null,
  created: Math.floor(Date.now() / 1000),
  data: { object: JSON.parse(JSON.stringify(charge)) },
  livemode: Boolean(charge.livemode),
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: "charge.refunded",
};

const payload = JSON.stringify(replayEvent);
const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
const response = await fetch(`${apiUrl}/functions/stripe-webhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "stripe-signature": signature,
  },
  body: payload,
});
const body = await response.json().catch(() => ({}));
const duplicateResponse = await fetch(`${apiUrl}/functions/stripe-webhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "stripe-signature": signature,
  },
  body: payload,
});
const duplicateBody = await duplicateResponse.json().catch(() => ({}));

const result = {
  ok:
    response.ok &&
    body.received === true &&
    duplicateResponse.ok &&
    duplicateBody.received === true &&
    duplicateBody.duplicate === true,
  event_type: replayEvent.type,
  charge_id: charge.id,
  replay_event_id: replayEvent.id,
  http_status: response.status,
  received: body.received === true,
  duplicate_http_status: duplicateResponse.status,
  duplicate_detected: duplicateBody.duplicate === true,
};

console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
