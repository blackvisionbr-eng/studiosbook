import "dotenv/config";
import { readFile } from "node:fs/promises";
import Stripe from "stripe";

async function readSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET.trim();
  if (process.env.STRIPE_SETUP_OUTPUT_FILE) {
    const setup = JSON.parse(await readFile(process.env.STRIPE_SETUP_OUTPUT_FILE, "utf8"));
    return String(setup.STRIPE_WEBHOOK_SECRET || "").trim();
  }
  return "";
}

async function main() {
  const secret = await readSecret();
  const url = process.env.STRIPE_WEBHOOK_URL || "";
  if (!secret || !url) throw new Error("Webhook Stripe sem URL ou segredo para o teste.");

  const event = {
    id: `evt_studiosbook_health_${Date.now()}`,
    object: "event",
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "health_check", object: "studiosbook.health_check" } },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "studiosbook.health_check",
  };
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const request = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
      body: payload,
    });

  const first = await request();
  const firstBody = await first.json().catch(() => ({}));
  if (!first.ok || firstBody.received !== true || firstBody.duplicate === true) {
    throw new Error(`Primeira entrega rejeitada (${first.status}).`);
  }
  const duplicate = await request();
  const duplicateBody = await duplicate.json().catch(() => ({}));
  if (!duplicate.ok || duplicateBody.duplicate !== true) {
    throw new Error(`Idempotência do webhook falhou (${duplicate.status}).`);
  }
  console.log(JSON.stringify({ ok: true, signature_validated: true, idempotency_validated: true }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || "Webhook test failed" }));
  process.exitCode = 1;
});
