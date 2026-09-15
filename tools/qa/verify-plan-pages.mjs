import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:4178";
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = path.resolve("output/qa-plans");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const results = [];
try {
  const viewports = [
    { name: "small-phone", width: 320, height: 700 },
    { name: "phone", width: 360, height: 800 },
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "tablet-landscape", width: 1024, height: 768 },
    { name: "desktop", width: 1440, height: 1000 },
  ];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await page.goto(`${baseUrl}/gestao-para-studios`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "StudiosBook Recebimentos", exact: true }).scrollIntoViewIfNeeded();
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll("body *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
        })
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className.slice(0, 160) : "",
          text: String(element.textContent || "").trim().slice(0, 80),
        })),
    }));
    if (dimensions.scroll > dimensions.client) throw new Error(`${viewport.name}: overflow horizontal ${dimensions.scroll - dimensions.client}px.`);
    if (dimensions.offenders.length) throw new Error(`${viewport.name}: elementos fora da viewport ${JSON.stringify(dimensions.offenders)}.`);
    await page.screenshot({ path: path.join(outputDir, `plans-${viewport.name}.png`), fullPage: true });
    const recommended = await page.getByText("Recomendado", { exact: true }).count();
    if (!recommended) throw new Error(`${viewport.name}: selo Recomendado ausente.`);
    if (viewport.name === "small-phone") {
      await page.getByRole("button", { name: /Assinar Recebimentos/ }).click();
      const pending = await page.evaluate(() => sessionStorage.getItem("studiosbook_pending_plan"));
      if (pending !== "studiosbook_receivables") throw new Error("O CTA público não preservou o plano escolhido.");
      await page.getByRole("button", { name: /Criar conta e começar/ }).waitFor();
    }
    results.push({ viewport: viewport.name, overflow: 0, consoleErrors });
    await page.close();
  }
} finally {
  await browser.close();
}

if (results.some((result) => result.consoleErrors.length)) {
  throw new Error(`Erros no console: ${JSON.stringify(results)}`);
}
console.log(JSON.stringify({ ok: true, results }, null, 2));
