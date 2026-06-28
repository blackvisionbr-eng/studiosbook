import { randomUUID } from "node:crypto";
import { createWebhookSignature } from "../src/billing.js";

const apiUrl =
  process.env.PUBLIC_API_URL || "https://studiosbook-api-production.up.railway.app";
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || "";

if (!accessToken || !webhookSecret) {
  throw new Error("Variáveis de produção do Mercado Pago incompletas.");
}

const healthResponse = await fetch(`${apiUrl}/health`);
const health = await healthResponse.json();

const paymentMethodsResponse = await fetch("https://api.mercadopago.com/v1/payment_methods", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const paymentMethods = await paymentMethodsResponse.json();
const pix = Array.isArray(paymentMethods)
  ? paymentMethods.find((method) => method.id === "pix")
  : null;

const webhookUrl = `${apiUrl}/functions/mercado-pago-webhook`;
const invalidResponse = await fetch(`${webhookUrl}?data.id=invalid-smoke`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: randomUUID(), type: "studiosbook_smoke_test", data: { id: "invalid-smoke" } }),
});

const dataId = `smoke-${Date.now()}`;
const requestId = randomUUID();
const timestamp = String(Date.now());
const eventId = randomUUID();
const signature = createWebhookSignature({ dataId, requestId, timestamp, secret: webhookSecret });
const headers = {
  "Content-Type": "application/json",
  "x-request-id": requestId,
  "x-signature": `ts=${timestamp},v1=${signature}`,
};
const event = { id: eventId, type: "studiosbook_smoke_test", action: "test", data: { id: dataId } };
const validResponse = await fetch(`${webhookUrl}?data.id=${encodeURIComponent(dataId)}`, {
  method: "POST",
  headers,
  body: JSON.stringify(event),
});
const validBody = await validResponse.json();
const duplicateResponse = await fetch(`${webhookUrl}?data.id=${encodeURIComponent(dataId)}`, {
  method: "POST",
  headers,
  body: JSON.stringify(event),
});
const duplicateBody = await duplicateResponse.json();

const result = {
  backend_health: healthResponse.ok && health.ok,
  mercado_pago_token: paymentMethodsResponse.ok,
  pix_available: pix?.status === "active",
  webhook_secret_configured: Boolean(webhookSecret),
  invalid_signature_rejected: invalidResponse.status === 401,
  valid_signature_accepted: validResponse.ok && validBody.received === true,
  duplicate_event_detected: duplicateResponse.ok && duplicateBody.duplicate === true,
};

console.log(JSON.stringify(result));
if (Object.values(result).some((value) => value !== true)) process.exitCode = 1;
