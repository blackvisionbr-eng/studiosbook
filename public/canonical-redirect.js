if (window.location.hostname === "www.studiosbook.com.br") {
  window.location.replace(
    `https://studiosbook.com.br${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}
