(() => {
  const RECOVERY_KEY = "studiosbook_asset_recovery";
  const RECOVERY_WINDOW_MS = 30_000;

  function isLocalBuildAsset(value) {
    if (!value) return false;
    try {
      const url = new URL(value, window.location.href);
      return url.origin === window.location.origin && url.pathname.startsWith("/assets/");
    } catch {
      return false;
    }
  }

  async function clearAppCaches() {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("studiosbook-")).map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
    }
  }

  function recover() {
    const previousAttempt = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Date.now() - previousAttempt < RECOVERY_WINDOW_MS) return;

    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    clearAppCaches().finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("sb-reload", Date.now().toString(36));
      window.location.replace(url.toString());
    });
  }

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const failedAsset = target instanceof HTMLLinkElement
        ? target.href
        : target instanceof HTMLScriptElement
          ? target.src
          : "";

      if (isLocalBuildAsset(failedAsset)) recover();
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const message = String(event.reason?.message || event.reason || "");
    if (/dynamically imported module|module script failed|failed to fetch/i.test(message)) recover();
  });

  window.setTimeout(() => sessionStorage.removeItem(RECOVERY_KEY), RECOVERY_WINDOW_MS);
})();
