import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const backendServer = readFileSync(new URL("../railway-backend/src/server.js", import.meta.url), "utf8");
const appAuthClient = readFileSync(new URL("../src/api/base44Client.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

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
