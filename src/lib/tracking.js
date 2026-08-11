const GTM_ID = String(import.meta.env.VITE_GTM_ID || "").trim();
const GA4_ID = String(import.meta.env.VITE_GA4_ID || "").trim();
const META_PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || "").trim();

let initialized = false;

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
  window.gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
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

export function marketingTrackingConfigured() {
  return Boolean(GTM_ID || GA4_ID || META_PIXEL_ID);
}

export function initializeMarketingTracking(consentGranted = false) {
  if (typeof window === "undefined" || !marketingTrackingConfigured()) return;
  setupDataLayer();

  if (!consentGranted) return;

  window.gtag("consent", "update", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });

  if (!initialized) {
    initialized = true;
    if (GTM_ID) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      appendScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`, "studiosbook-gtm");
    }
    if (GA4_ID) {
      appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`, "studiosbook-ga4");
      window.gtag("js", new Date());
      window.gtag("config", GA4_ID, { send_page_view: true });
    }
    if (META_PIXEL_ID) {
      setupMetaPixel();
      appendScript("https://connect.facebook.net/en_US/fbevents.js", "studiosbook-meta-pixel");
      window.fbq("init", META_PIXEL_ID);
      window.fbq("track", "PageView");
    }
  }
}

export function trackEvent(name, params = {}) {
  if (typeof window === "undefined" || !name) return;
  if (window.gtag) window.gtag("event", name, params);
  if (window.fbq) window.fbq("trackCustom", name, params);
  if (window.dataLayer) window.dataLayer.push({ event: name, ...params });
}
