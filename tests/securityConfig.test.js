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
  assert.match(appAuthClient, /loginWithEmail\(email, password\)/);
  assert.match(appAuthClient, /registerWithEmail\(email, password, fullName\)/);
  assert.match(appAuthClient, /sendPasswordReset\(email\)/);
  assert.match(appAuthClient, /auth\.languageCode\s*=\s*"pt-BR"/);
  assert.match(appAuthClient, /linkDomain:\s*"studiosbook\.com\.br"/);
  assert.match(appSource, /Se houver uma conta ativa para este e-mail/);
  assert.match(appSource, /Spam ou Lixo eletrônico/);
});
