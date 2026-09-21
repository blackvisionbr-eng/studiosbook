const GTM_ID = String(import.meta.env.VITE_GTM_ID || "").trim();
const GA4_ID = String(import.meta.env.VITE_GA4_ID || "").trim();
// Pixel IDs are public identifiers. Keeping the production dataset as a safe
// fallback prevents a missing build variable from silently disabling consent UI.
const META_PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || "1123734077006677").trim();

const ATTRIBUTION_KEY = "studiosbook_marketing_attribution";
const CLIENT_ID_KEY = "studiosbook_marketing_client_id";
const PURCHASE_EVENT_KEY_PREFIX = "studiosbook_purchase_event_";
const EVENT_DEFINITIONS = {
  view_content: { ga4: "page_view", meta: "ViewContent" },
  complete_registration: { ga4: "sign_up", meta: "CompleteRegistration" },
  start_trial: { ga4: "start_trial", meta: "StartTrial" },
  initiate_checkout: { ga4: "begin_checkout", meta: "InitiateCheckout" },
  purchase: { ga4: "purchase", meta: "Purchase" },
};
const ATTRIBUTION_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
];

let initialized = false;
let landingViewTracked = false;

function safeString(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function appendScript(src, id) {
  if (!src || document.getElementById(id)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.id = id;
  document.head.appendChild(script);
}

function setupDataLayer() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
}

function setDefaultGoogleConsent() {
  setupDataLayer();
  window.gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500,
  });
}

function updateGoogleConsent(granted) {
  setupDataLayer();
  window.gtag("consent", "update", {
    ad_storage: granted ? "granted" : "denied",
    analytics_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
  });
}

function setupMetaPixel() {
  if (window.fbq) return;
  window.fbq = function fbq() {
    window.fbq.callMethod
      ? window.fbq.callMethod.apply(window.fbq, arguments)
      : window.fbq.queue.push(arguments);
  };
  window.fbq.queue = [];
  window.fbq.loaded = true;
  window.fbq.version = "2.0";
}

function randomEventId(prefix = "event") {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function readCookie(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || "";
}

function analyticsClientId() {
  const gaCookie = readCookie("_ga");
  const gaParts = gaCookie.split(".");
  if (gaParts.length >= 4) return `${gaParts.at(-2)}.${gaParts.at(-1)}`;
  const existing = safeString(window.sessionStorage.getItem(CLIENT_ID_KEY), 80);
  if (existing) return existing;
  const generated = `${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`;
  window.sessionStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

function sanitizeAttribution(source = {}) {
  return ATTRIBUTION_PARAMETERS.reduce((result, key) => {
    const value = safeString(source[key], 180);
    if (value) result[key] = value;
    return result;
  }, {});
}

export function marketingTrackingConfigured() {
  return Boolean(GTM_ID || GA4_ID || META_PIXEL_ID);
}

export function captureMarketingAttribution(consentGranted = false) {
  if (typeof window === "undefined" || !consentGranted) return {};
  const query = Object.fromEntries(new URLSearchParams(window.location.search));
  const current = sanitizeAttribution(query);
  let previous = {};
  try {
    previous = sanitizeAttribution(JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY) || "{}"));
  } catch {
    previous = {};
  }
  const attribution = { ...previous, ...current };
  if (Object.keys(attribution).length) {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  }
  return attribution;
}

export function initializeMarketingTracking(consentGranted = false) {
  if (typeof window === "undefined" || !marketingTrackingConfigured()) return;
  if (!initialized) setDefaultGoogleConsent();
  updateGoogleConsent(consentGranted);

  if (!consentGranted) {
    if (window.fbq) window.fbq("consent", "revoke");
    return;
  }

  captureMarketingAttribution(true);
  if (!initialized) {
    initialized = true;
    if (GTM_ID) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      appendScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`, "studiosbook-gtm");
    } else if (GA4_ID) {
      appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`, "studiosbook-ga4");
      window.gtag("js", new Date());
      window.gtag("config", GA4_ID, { send_page_view: false });
    }
    if (META_PIXEL_ID) {
      setupMetaPixel();
      window.fbq("consent", "grant");
      appendScript("https://connect.facebook.net/en_US/fbevents.js", "studiosbook-meta-pixel");
      window.fbq("init", META_PIXEL_ID);
    }
  }

  if (!landingViewTracked) {
    landingViewTracked = true;
    trackMarketingEvent("view_content", {
      content_name: "StudiosBook",
      content_category: "SaaS para profissionais da beleza",
      page_location: window.location.href,
      page_title: document.title,
    });
  }
}

export function trackMarketingEvent(eventName, params = {}) {
  if (typeof window === "undefined" || !eventName) return "";
  const definition = EVENT_DEFINITIONS[eventName];
  if (!definition) return "";

  const eventId = safeString(params.event_id, 180) || randomEventId(eventName);
  const payload = { ...params, event_id: eventId };
  delete payload.meta_event_name;

  if (window.gtag && GA4_ID && !GTM_ID) window.gtag("event", definition.ga4, payload);
  if (window.fbq) {
    const metaPayload = { ...payload };
    delete metaPayload.event_id;
    window.fbq("track", definition.meta, metaPayload, { eventID: eventId });
  }
  if (window.dataLayer) {
    window.dataLayer.push({
      event: `studiosbook_${definition.ga4}`,
      meta_event_name: definition.meta,
      ...payload,
    });
  }
  return eventId;
}

export function createCheckoutMarketingContext(consentGranted = false, channel = "card") {
  if (typeof window === "undefined" || !consentGranted || !marketingTrackingConfigured()) return null;
  const eventId = randomEventId(`checkout-${channel}`);
  const attribution = captureMarketingAttribution(true);
  const fbclid = attribution.fbclid || "";
  const context = {
    consent: true,
    checkout_event_id: eventId,
    attribution,
    landing_page: safeString(window.location.href, 500),
    referrer: safeString(document.referrer, 500),
    client_id: analyticsClientId(),
    client_user_agent: safeString(window.navigator.userAgent, 300),
    fbp: safeString(readCookie("_fbp"), 180),
    fbc: safeString(readCookie("_fbc") || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : ""), 220),
  };
  return context;
}

export function trackConfirmedPurchase(payment = {}, consentGranted = false) {
  if (typeof window === "undefined" || !consentGranted) return false;
  const eventId = safeString(payment.marketing_event_id, 180);
  const isFirstPayment = payment.marketing_first_payment === true;
  const isApproved = String(payment.status || "").toLowerCase() === "approved";
  if (!eventId || !isFirstPayment || !isApproved) return false;

  const storageKey = `${PURCHASE_EVENT_KEY_PREFIX}${eventId}`;
  if (window.localStorage.getItem(storageKey) === "sent") return false;
  trackMarketingEvent("purchase", {
    event_id: eventId,
    transaction_id: safeString(payment.id || payment.stripe_invoice_id || payment.mercado_pago_payment_id, 180),
    value: Number(payment.amount || 26.9),
    currency: safeString(payment.currency_id || "BRL", 3).toUpperCase(),
    payment_type: safeString(payment.provider || "", 40),
    items: [{ item_id: "studiosbook-monthly", item_name: "StudiosBook mensal", price: Number(payment.amount || 26.9), quantity: 1 }],
  });
  window.localStorage.setItem(storageKey, "sent");
  return true;
}

export function trackEvent(name, params = {}) {
  if (typeof window === "undefined" || !name) return;
  if (window.gtag && GA4_ID && !GTM_ID) window.gtag("event", name, params);
  if (window.dataLayer) window.dataLayer.push({ event: name, ...params });
}
