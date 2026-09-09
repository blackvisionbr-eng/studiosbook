import Stripe from "stripe";
import { stripeKeyMode } from "../src/billing.js";

const apiUrl = process.env.PUBLIC_API_URL || "https://studiosbook-api-equipe-blackvision.vercel.app";
const secretKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const priceId = process.env.STRIPE_PRICE_ID || "";

if (!secretKey || !webhookSecret || !priceId) {
  throw new Error("Variáveis da Stripe incompletas.");
}

const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 12000 });
const [healthResponse, balance, price] = await Promise.all([
  fetch(`${apiUrl}/health`),
  stripe.balance.retrieve(),
  stripe.prices.retrieve(priceId),
]);
const health = await healthResponse.json();

const webhookUrl = `${apiUrl}/functions/stripe-webhook`;
const invalidResponse = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json", "stripe-signature": "invalid" },
  body: JSON.stringify({ id: `evt_invalid_${Date.now()}`, type: "studiosbook.smoke" }),
});

const event = {
  id: `evt_smoke_${Date.now()}`,
  object: "event",
  api_version: null,
  created: Math.floor(Date.now() / 1000),
  data: { object: { id: "smoke", object: "studiosbook_smoke" } },
  livemode: stripeKeyMode(secretKey) === "live",
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: "studiosbook.smoke",
};
const payload = JSON.stringify(event);
const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
const headers = { "Content-Type": "application/json", "stripe-signature": signature };
const validResponse = await fetch(webhookUrl, { method: "POST", headers, body: payload });
const validBody = await validResponse.json();
const duplicateResponse = await fetch(webhookUrl, { method: "POST", headers, body: payload });
const duplicateBody = await duplicateResponse.json();

const result = {
  backend_health: healthResponse.ok && health.ok,
  stripe_api: balance?.object === "balance",
  recurring_price: price?.active === true && price?.currency === "brl" && price?.unit_amount === 2690,
  webhook_secret_configured: Boolean(webhookSecret),
  invalid_signature_rejected: invalidResponse.status === 400,
  valid_signature_accepted: validResponse.ok && validBody.received === true,
  duplicate_event_detected: duplicateResponse.ok && duplicateBody.duplicate === true,
};

console.log(JSON.stringify(result));
if (Object.values(result).some((value) => value !== true)) process.exitCode = 1;
