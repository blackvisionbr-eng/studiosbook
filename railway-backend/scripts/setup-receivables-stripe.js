import "dotenv/config";
import Stripe from "stripe";
import { PLAN_CATALOG, PLAN_CODES, validateStripePriceForPlan } from "../src/plans.js";

const secret = process.env.STRIPE_SECRET_KEY || "";
if (!secret) throw new Error("STRIPE_SECRET_KEY não configurada.");
if (!/^[sr]k_live_/.test(secret)) throw new Error("A configuração de produção exige uma chave Stripe live.");

const stripe = new Stripe(secret, { maxNetworkRetries: 2, timeout: 12000 });
const agenda = PLAN_CATALOG[PLAN_CODES.AGENDA];
const receivables = PLAN_CATALOG[PLAN_CODES.RECEIVABLES];

const agendaPrice = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID, { expand: ["product"] });
if (agendaPrice.active !== true || agendaPrice.unit_amount !== agenda.amountCents || agendaPrice.currency !== "brl") {
  throw new Error("O preço de produção do StudiosBook Agenda não corresponde ao catálogo esperado.");
}
if (agendaPrice.lookup_key !== agenda.lookupKey) {
  await stripe.prices.update(agendaPrice.id, { lookup_key: agenda.lookupKey, transfer_lookup_key: true });
}

const listed = await stripe.prices.list({ active: true, lookup_keys: [receivables.lookupKey], limit: 10 });
let receivablesPrice = listed.data.find((price) => validateStripePriceForPlan(price, receivables.code).valid) || null;
if (!receivablesPrice) {
  const product = await stripe.products.create(
    {
      name: receivables.name,
      description: "Agenda, clientes, agendamento on-line, Pix, cartão, sinal e confirmação automática.",
      metadata: { product: "StudiosBook", plan_code: receivables.code },
    },
    { idempotencyKey: "studiosbook-receivables-product-v1" }
  );
  receivablesPrice = await stripe.prices.create(
    {
      product: product.id,
      currency: "brl",
      unit_amount: receivables.amountCents,
      recurring: { interval: "month", interval_count: 1 },
      lookup_key: receivables.lookupKey,
      metadata: { product: "StudiosBook", plan_code: receivables.code },
    },
    { idempotencyKey: "studiosbook-receivables-price-monthly-brl-v1" }
  );
}

const validation = validateStripePriceForPlan(receivablesPrice, receivables.code);
if (!validation.valid) throw new Error(`Preço Recebimentos inválido: ${validation.reason}.`);

const portalConfigurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID || "";
if (!portalConfigurationId) throw new Error("STRIPE_PORTAL_CONFIGURATION_ID não configurado.");

await stripe.billingPortal.configurations.update(portalConfigurationId, {
  business_profile: {
    headline: "Gerencie sua assinatura StudiosBook",
    privacy_policy_url: "https://studiosbook.com.br/privacy.html",
    terms_of_service_url: "https://studiosbook.com.br/terms.html",
  },
  default_return_url: "https://studiosbook.com.br/?billing=return",
  features: {
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "always_invoice",
      trial_update_behavior: "continue_trial",
      products: [
        { product: typeof agendaPrice.product === "string" ? agendaPrice.product : agendaPrice.product.id, prices: [agendaPrice.id] },
        { product: typeof receivablesPrice.product === "string" ? receivablesPrice.product : receivablesPrice.product.id, prices: [receivablesPrice.id] },
      ],
    },
  },
});

console.log(JSON.stringify({
  ok: true,
  mode: "live",
  agenda: { amount: agendaPrice.unit_amount, interval: agendaPrice.recurring?.interval },
  receivables: { amount: receivablesPrice.unit_amount, interval: receivablesPrice.recurring?.interval },
  portal_update_enabled: true,
  receivables_price_id: receivablesPrice.id,
}));
