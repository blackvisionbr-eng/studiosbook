import "dotenv/config";
import { chmod, readFile, writeFile } from "node:fs/promises";
import Stripe from "stripe";
import { stripeKeyMode } from "../src/billing.js";

const PRODUCT_NAME = "StudiosBook";
const PRICE_IN_CENTS = 2690;
const DEFAULT_WEBHOOK_URL =
  "https://studiosbook-api-production.up.railway.app/functions/stripe-webhook";
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.payment_failed",
];

async function loadSecretKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY.trim();
  if (process.env.STRIPE_SECRET_FILE) {
    return (await readFile(process.env.STRIPE_SECRET_FILE, "utf8")).trim();
  }
  throw new Error("Defina STRIPE_SECRET_KEY ou STRIPE_SECRET_FILE.");
}

async function ensureProduct(stripe) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find(
    (product) => product.metadata?.studiosbook_product === "true" || product.name === PRODUCT_NAME
  );
  if (existing) {
    return stripe.products.update(existing.id, {
      name: PRODUCT_NAME,
      description: "Gestão de clientes, agenda, atendimentos e relacionamento para profissionais da beleza.",
      metadata: { studiosbook_product: "true" },
    });
  }
  return stripe.products.create({
    name: PRODUCT_NAME,
    description: "Gestão de clientes, agenda, atendimentos e relacionamento para profissionais da beleza.",
    metadata: { studiosbook_product: "true" },
  });
}

async function ensurePrice(stripe, productId) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const existing = prices.data.find(
    (price) =>
      price.currency === "brl" &&
      price.unit_amount === PRICE_IN_CENTS &&
      price.recurring?.interval === "month" &&
      price.recurring?.interval_count === 1
  );
  if (existing) return existing;
  return stripe.prices.create({
    product: productId,
    currency: "brl",
    unit_amount: PRICE_IN_CENTS,
    recurring: { interval: "month", interval_count: 1 },
    nickname: "StudiosBook mensal - R$ 26,90",
    metadata: { studiosbook_plan: "intermediario", studiosbook_monthly: "true" },
  });
}

async function ensurePortalConfiguration(stripe) {
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const existing = configurations.data.find(
    (configuration) =>
      configuration.active && configuration.business_profile?.headline === "Gerencie sua assinatura StudiosBook"
  );
  if (existing) return existing;
  return stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Gerencie sua assinatura StudiosBook",
      privacy_policy_url: "https://studiosbook.com.br/?view=privacy",
      terms_of_service_url: "https://studiosbook.com.br/?view=privacy",
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "phone"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
  });
}

async function ensureWebhook(stripe, url) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === url && endpoint.status === "enabled");
  if (existing) {
    const enabledEvents = new Set(existing.enabled_events || []);
    if (WEBHOOK_EVENTS.some((event) => !enabledEvents.has(event))) {
      return {
        endpoint: await stripe.webhookEndpoints.update(existing.id, { enabled_events: WEBHOOK_EVENTS }),
        secret: "",
        created: false,
      };
    }
    return { endpoint: existing, secret: "", created: false };
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: "StudiosBook - sincronização de assinaturas e Pix",
  });
  return { endpoint, secret: endpoint.secret || "", created: true };
}

async function main() {
  const secretKey = await loadSecretKey();
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20000 });
  const webhookUrl = process.env.STRIPE_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
  const outputFile = process.env.STRIPE_SETUP_OUTPUT_FILE || "stripe-setup-output.json";

  const product = await ensureProduct(stripe);
  const price = await ensurePrice(stripe, product.id);
  const portal = await ensurePortalConfiguration(stripe);
  const webhook = await ensureWebhook(stripe, webhookUrl);
  const output = {
    STRIPE_PRICE_ID: price.id,
    STRIPE_PORTAL_CONFIGURATION_ID: portal.id,
    STRIPE_WEBHOOK_URL: webhook.endpoint.url,
    STRIPE_WEBHOOK_ENDPOINT_ID: webhook.endpoint.id,
    STRIPE_WEBHOOK_SECRET: webhook.secret || process.env.STRIPE_WEBHOOK_SECRET || "",
    STRIPE_MODE: stripeKeyMode(secretKey),
  };

  await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(outputFile, 0o600).catch(() => {});
  console.log(
    JSON.stringify({
      ok: true,
      mode: output.STRIPE_MODE,
      product_id: product.id,
      price_id: price.id,
      portal_configuration_id: portal.id,
      webhook_endpoint_id: webhook.endpoint.id,
      webhook_created: webhook.created,
      webhook_secret_saved: Boolean(output.STRIPE_WEBHOOK_SECRET),
      output_file: outputFile,
    })
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || "Stripe setup failed" }));
  process.exitCode = 1;
});
