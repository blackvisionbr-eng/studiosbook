import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const backendServer = readFileSync(new URL("../railway-backend/src/server.js", import.meta.url), "utf8");
const appAuthClient = readFileSync(new URL("../src/api/base44Client.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../src/admin/AdminApp.jsx", import.meta.url), "utf8");
const adminAuthClient = readFileSync(new URL("../src/admin/firebaseAdminClient.js", import.meta.url), "utf8");
const publicPrivacy = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
const publicTerms = readFileSync(new URL("../public/terms.html", import.meta.url), "utf8");
const publicContact = readFileSync(new URL("../public/contact.html", import.meta.url), "utf8");
const publicSitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const trackingSource = readFileSync(new URL("../src/lib/tracking.js", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
const appHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const assetRecovery = readFileSync(new URL("../public/asset-recovery.js", import.meta.url), "utf8");
const marketplaceBackend = readFileSync(new URL("../railway-backend/src/marketplaceBooking.js", import.meta.url), "utf8");
const bookingSource = readFileSync(new URL("../src/booking/BookingApp.jsx", import.meta.url), "utf8");
const receivablesSource = readFileSync(new URL("../src/receivables/ReceivablesApp.jsx", import.meta.url), "utf8");

test("hosting does not rewrite every unknown path to the authenticated app", () => {
  const rewrites = firebaseConfig.hosting.rewrites || [];
  assert.equal(rewrites.some((rewrite) => rewrite.source === "**"), false);
});

test("email actions use a dedicated protected handler", () => {
  const rewrite = firebaseConfig.hosting.rewrites.find((item) => item.source === "/auth/action");
  assert.equal(rewrite?.destination, "/auth-action.html");
  const handler = readFileSync(new URL("../src/auth/AuthActionApp.jsx", import.meta.url), "utf8");
  assert.match(handler, /confirmPasswordReset/);
  assert.match(handler, /target\.origin !== window\.location\.origin/);
});

test("app and admin pages receive a restrictive CSP", () => {
  for (const source of ["/", "/index.html", "/admin{,/**}"]) {
    const entry = firebaseConfig.hosting.headers.find((item) => item.source === source);
    const csp = entry?.headers?.find((header) => header.key === "Content-Security-Policy")?.value || "";
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
  }
});

test("Firestore user subcollections use an explicit allowlist", () => {
  assert.match(firestoreRules, /isAllowedUserEntity/);
  assert.match(firestoreRules, /entityName != 'BillingSubscription'/);
  assert.match(firestoreRules, /entityName != 'BillingPayment'/);
  assert.doesNotMatch(firestoreRules, /billing_status == 'authorized'/);
  assert.doesNotMatch(firestoreRules, /isPlatformAdmin\(\) \|\|/);
  assert.match(firestoreRules, /access_expires_at > request\.time/);
});

test("the app receives billing access changes in real time", () => {
  assert.match(appAuthClient, /onSnapshot/);
  assert.match(appAuthClient, /subscribeBillingAccess/);
  assert.match(appSource, /base44\.billing\.subscribeAccess/);
  assert.match(appSource, /billingAccessFromRoot/);
  assert.match(appSource, /plan_code: root\.plan_code/);
  assert.match(appSource, /receivables_access_allowed: root\.receivables_access_allowed === true/);
  assert.match(appSource, /Acesso liberado pelo painel mestre/);
  assert.match(appSource, /Cobrança recorrente Stripe/);
});

test("critical admin account controls require role and recent authentication", () => {
  for (const route of ["admin-send-password-reset", "admin-revoke-user-sessions", "admin-set-user-access"]) {
    assert.match(
      backendServer,
      new RegExp(`app\\.post\\(\"/functions/${route}\", requirePlatformAdmin, requireRecentAdminAuth`)
    );
  }
  assert.match(backendServer, /verifyIdToken\(token, true\)/);
  assert.match(backendServer, /linkDomain:\s*"studiosbook\.com\.br"/);
});

test("subscription overrides are restricted to the exact master administrator", () => {
  for (const route of ["admin-set-subscription-override", "admin-set-stripe-renewal"]) {
    assert.match(
      backendServer,
      new RegExp(`app\\.post\\(\"/functions/${route}\", requireMasterAdmin, requireRecentAdminAuth`)
    );
  }
  assert.match(backendServer, /platformRole !== "master_admin"/);
  assert.match(backendServer, /MASTER_ADMIN_EMAIL/);
  assert.match(backendServer, /admin\.subscription\.renewal_changed/);
  assert.doesNotMatch(backendServer, /Contas administrativas não podem ter a assinatura suspensa/);
  assert.doesNotMatch(backendServer, /administrador mestre não pode suspender a própria conta/);
});

test("master subscription controls expose confirmed states and recover expired authentication", () => {
  assert.match(adminSource, /Estado realmente aplicado/);
  assert.match(adminSource, /Liberar por \{validDays \? days/);
  assert.match(adminSource, /Suspender agora/);
  assert.match(adminSource, /Usar automático/);
  assert.match(adminSource, /recent_auth_required/);
  assert.match(adminSource, /AdminReauthDialog/);
  assert.match(adminAuthClient, /reauthenticateAdmin/);
  assert.match(adminAuthClient, /reauthenticateWithCredential/);
});

test("admin accounts are paginated and details render on demand", () => {
  assert.match(adminSource, /ACCOUNT_PAGE_SIZES/);
  assert.match(adminSource, /pageUsers/);
  assert.match(adminSource, /expandedUid/);
  assert.match(adminSource, /Estado realmente aplicado/);
  assert.match(adminSource, /Página \{currentPage\} de \{pageCount\}/);
});

test("the operations header centers the selected horizontal tab", () => {
  assert.match(appSource, /navigationRef/);
  assert.match(appSource, /selectedTab\.getBoundingClientRect\(\)/);
  assert.match(appSource, /navigation\.scrollWidth - navigation\.clientWidth/);
  assert.match(appSource, /navigation\.scrollTo\(\{ left: targetLeft, behavior: "smooth" \}\)/);
  assert.match(appSource, /aria-current=\{active \? "page"/);
});

test("the app supports Google and email account flows", () => {
  assert.match(appAuthClient, /loginWithProvider\(providerName = "google"\)/);
  assert.match(appAuthClient, /signInWithPopup\(auth, provider\)/);
  assert.doesNotMatch(appAuthClient, /signInWithRedirect/);
  assert.match(appAuthClient, /loginWithEmail\(email, password\)/);
  assert.match(appAuthClient, /registerWithEmail\(email, password, fullName\)/);
  assert.match(appAuthClient, /sendPasswordReset\(email\)/);
  assert.match(appAuthClient, /auth\.languageCode\s*=\s*"pt-BR"/);
  assert.match(appAuthClient, /linkDomain:\s*"studiosbook\.com\.br"/);
  assert.match(appSource, /Seu navegador bloqueou a janela segura de login/);
  assert.match(appSource, /Se houver uma conta ativa para este e-mail/);
  assert.match(appSource, /Spam ou Lixo eletrônico/);
});

test("browser releases recover from stale application assets", () => {
  assert.match(viteConfig, /entryFileNames: "assets\/\[name\]\.js"/);
  assert.match(viteConfig, /modulePreload: false/);
  assert.match(viteConfig, /cssCodeSplit: false/);
  assert.match(appHtml, /src="\/asset-recovery\.js"/);
  assert.match(assetRecovery, /startsWith\("\/assets\/"\)/);
  assert.match(assetRecovery, /window\.location\.replace/);

  const assetHeaders = firebaseConfig.hosting.headers.find((item) => item.source === "/assets/**");
  const cacheControl = assetHeaders?.headers?.find((header) => header.key === "Cache-Control")?.value || "";
  assert.match(cacheControl, /max-age=0/);
  assert.match(cacheControl, /must-revalidate/);
});

test("the public hero image is prioritized only when it is rendered", () => {
  assert.doesNotMatch(appHtml, /rel="preload"[^>]+studiosbook-login-hero/);
  assert.match(appSource, /src="\/brand\/studiosbook-login-hero\.jpg"[\s\S]*fetchpriority="high"/);
  assert.match(appSource, /src="\/brand\/studiosbook-login-hero\.jpg"[\s\S]*decoding="async"/);
});

test("the public campaign landing has an explicit rewrite and CSP", () => {
  const rewrite = firebaseConfig.hosting.rewrites.find((item) => item.source === "/gestao-para-studios");
  assert.equal(rewrite?.destination, "/index.html");
  const headers = firebaseConfig.hosting.headers.find((item) => item.source === "/gestao-para-studios");
  const csp = headers?.headers?.find((header) => header.key === "Content-Security-Policy")?.value || "";
  assert.match(csp, /frame-ancestors 'none'/);
});

test("online booking and receivables have isolated routes and restrictive headers", () => {
  const rewrites = firebaseConfig.hosting.rewrites || [];
  assert.equal(rewrites.find((item) => item.source === "/agendar{,/**}")?.destination, "/booking.html");
  assert.equal(rewrites.find((item) => item.source === "/recebimentos{,/**}")?.destination, "/recebimentos.html");
  for (const source of ["/agendar{,/**}", "/recebimentos{,/**}"]) {
    const headers = firebaseConfig.hosting.headers.find((item) => item.source === source);
    const csp = headers?.headers?.find((header) => header.key === "Content-Security-Policy")?.value || "";
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
  }
});

test("the app, admin and booking payments use the healthy Railway API", () => {
  assert.match(appAuthClient, /VITE_BOOKING_API_BASE_URL/);
  assert.match(appAuthClient, /invokeBooking/);
  assert.match(receivablesSource, /functions\.invokeBooking/);
  assert.doesNotMatch(receivablesSource, /functions\.invoke\("booking-/);
  assert.match(bookingSource, /VITE_BOOKING_API_BASE_URL/);
  assert.match(bookingSource, /studiosbook-api-production\.up\.railway\.app/);
  assert.match(appAuthClient, /studiosbook-api-production\.up\.railway\.app/);
  assert.match(adminAuthClient, /studiosbook-api-production\.up\.railway\.app/);
  assert.doesNotMatch(appAuthClient, /vercel\.app/);
});

test("marketplace payments are feature-gated and provider-verified", () => {
  assert.match(marketplaceBackend, /BOOKING_PAYMENTS_ENABLED/);
  assert.match(marketplaceBackend, /MARKETPLACE_TOKEN_ENCRYPTION_KEY/);
  assert.match(marketplaceBackend, /validateWebhookSignature/);
  assert.match(marketplaceBackend, /paymentAccessToken/);
  assert.match(marketplaceBackend, /requireMasterAdmin/);
  assert.match(marketplaceBackend, /runTransaction/);
  assert.match(marketplaceBackend, /lock_conflict/);
});

test("public sales page discloses billing terms before signup", () => {
  assert.match(appSource, /7 dias gratuitos/);
  assert.match(appSource, /R\$ 26,90\/mês/);
  assert.match(appSource, /Sem fidelidade/);
  assert.match(appSource, /Pix.*Mercado Pago/s);
  assert.match(appSource, /Termos de Uso e Assinatura/);
});

test("public legal pages cover subscription and payment processors", () => {
  assert.match(publicTerms, /7 dias gratuitos/);
  assert.match(publicTerms, /R\$ 26,90/);
  assert.match(publicTerms, /Stripe/);
  assert.match(publicTerms, /Mercado Pago/);
  assert.match(publicTerms, /cancelada pelo portal de cobrança/);
  assert.match(publicPrivacy, /Stripe e Mercado Pago/);
  assert.match(publicPrivacy, /privacidade@studiosbook\.com\.br/);
});

test("public compliance routes are friendly, protected and discoverable", () => {
  const expectedRoutes = [
    ["/politica-de-privacidade", "/privacy.html"],
    ["/termos-de-uso", "/terms.html"],
    ["/contato", "/contact.html"],
  ];
  for (const [source, destination] of expectedRoutes) {
    assert.equal(firebaseConfig.hosting.rewrites.find((item) => item.source === source)?.destination, destination);
    const headers = firebaseConfig.hosting.headers.find((item) => item.source === source);
    const csp = headers?.headers?.find((header) => header.key === "Content-Security-Policy")?.value || "";
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(publicSitemap, new RegExp(`https://studiosbook\\.com\\.br${source}`));
  }
  assert.match(publicPrivacy, /canonical" href="https:\/\/studiosbook\.com\.br\/politica-de-privacidade"/);
  assert.match(publicTerms, /canonical" href="https:\/\/studiosbook\.com\.br\/termos-de-uso"/);
  assert.match(publicContact, /canonical" href="https:\/\/studiosbook\.com\.br\/contato"/);
  assert.match(publicContact, /suporte@studiosbook\.com\.br/);
  assert.match(publicContact, /privacidade@studiosbook\.com\.br/);
  assert.match(publicContact, /5573981068594/);
  assert.match(appHtml, /facebook-domain-verification/);
  assert.match(appHtml, /60q2gw8whjwlcovcdgy5uvh9hj4d94/);
});

test("marketing tracking is optional and consent-aware", () => {
  assert.match(trackingSource, /VITE_GTM_ID/);
  assert.match(trackingSource, /VITE_GA4_ID/);
  assert.match(trackingSource, /VITE_META_PIXEL_ID/);
  assert.match(trackingSource, /2163953667421721/);
  assert.match(trackingSource, /ad_storage: "denied"/);
  assert.match(trackingSource, /marketingTrackingConfigured/);
  assert.match(trackingSource, /CompleteRegistration/);
  assert.match(trackingSource, /StartTrial/);
  assert.match(trackingSource, /InitiateCheckout/);
  assert.match(trackingSource, /Purchase/);
  assert.match(trackingSource, /eventID: eventId/);
  assert.match(trackingSource, /fbq\("consent", "revoke"\)/);
  assert.match(trackingSource, /studiosbook_marketing_attribution/);
  assert.match(appSource, /createCheckoutMarketingContext/);
  assert.match(appSource, /trackConfirmedPurchase/);
  assert.match(backendServer, /MarketingAcquisition/);
  assert.match(backendServer, /excluded_internal_account/);
  assert.match(backendServer, /excluded_test_payment/);
  assert.match(backendServer, /META_CAPI_ACCESS_TOKEN/);
  assert.match(backendServer, /sha256MarketingValue/);
  assert.match(backendServer, /userData\.em = \[emailHash\]/);
  assert.match(backendServer, /userData\.external_id = \[externalIdHash\]/);
  assert.match(backendServer, /GA4_API_SECRET/);
});
