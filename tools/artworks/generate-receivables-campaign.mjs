import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = path.join(root, "public/brand/campaigns");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const formats = [
  { id: "square", width: 1080, height: 1080 },
  { id: "feed", width: 1080, height: 1350 },
  { id: "story", width: 1080, height: 1920 },
];

function dataUri(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

const [photo, logo, dmSans, dmSerif] = await Promise.all([
  readFile(path.join(root, "public/brand/studiosbook-login-hero.jpg")),
  readFile(path.join(root, "public/brand/studiosbook-logo-reversed.svg")),
  readFile(path.join(root, "node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2")),
  readFile(path.join(root, "node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2")),
]);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });

try {
  for (const format of formats) {
    const tall = format.height > 1500;
    const html = `<!doctype html><html><head><style>
      @font-face{font-family:DMSans;src:url('${dataUri(dmSans, "font/woff2")}')}@font-face{font-family:DMSerif;src:url('${dataUri(dmSerif, "font/woff2")}')}
      *{box-sizing:border-box}html,body{margin:0;width:${format.width}px;height:${format.height}px;overflow:hidden}body{font-family:DMSans;background:#1c1119;color:#fff}
      .art{position:relative;width:100%;height:100%;overflow:hidden;background:#26131f}.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${tall ? "54% center" : "58% center"};filter:saturate(.72) contrast(1.02)}
      .veil{position:absolute;inset:0;background:rgba(28,12,23,.72)}.side{position:absolute;inset:0 38% 0 0;background:rgba(32,12,25,.68)}
      .content{position:absolute;inset:${tall ? "92px 70px" : "62px 64px"};display:flex;flex-direction:column;justify-content:space-between}.logo{width:${tall ? 390 : 330}px;height:auto}
      .badge{display:inline-block;width:max-content;margin-bottom:28px;border:2px solid #f3a7bd;padding:13px 20px;color:#ffd9e4;font-size:${tall ? 25 : 21}px;font-weight:700;text-transform:uppercase}
      h1{max-width:${tall ? 820 : 720}px;margin:0;font-family:DMSerif;font-size:${tall ? 92 : 70}px;line-height:.98;font-weight:400;letter-spacing:0}p{max-width:760px;margin:26px 0 0;color:#f7dfe7;font-size:${tall ? 35 : 27}px;line-height:1.32}
      ul{display:grid;gap:${tall ? 20 : 13}px;margin:${tall ? 52 : 34}px 0 0;padding:0;list-style:none;font-size:${tall ? 31 : 24}px}li{display:flex;align-items:center;gap:14px}li:before{content:'✓';display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#eb6f93;color:#fff;font-size:21px}
      .offer{display:flex;align-items:end;justify-content:space-between;gap:30px;border-top:2px solid rgba(255,255,255,.24);padding-top:${tall ? 38 : 25}px}.price small{display:block;color:#f3a7bd;font-size:${tall ? 22 : 18}px;text-transform:uppercase}.price strong{display:block;margin-top:5px;font-size:${tall ? 61 : 48}px}.cta{background:#fff;color:#35152c;padding:${tall ? "23px 30px" : "18px 25px"};font-size:${tall ? 26 : 21}px;font-weight:700}.legal{margin-top:14px;color:rgba(255,255,255,.66);font-size:${tall ? 18 : 14}px;line-height:1.35}
    </style></head><body><main class="art"><img class="photo" src="${dataUri(photo, "image/jpeg")}" alt=""><div class="veil"></div><div class="side"></div><div class="content"><header><img class="logo" src="${dataUri(logo, "image/svg+xml")}" alt="StudiosBook"></header><section><span class="badge">Plano recomendado</span><h1>Agendamento confirmado. Pagamento resolvido.</h1><p>Receba o sinal ou o valor integral antes de reservar o horário da cliente.</p><ul><li>Pix e cartão</li><li>Confirmação automática</li><li>Agenda e relatório financeiro</li></ul></section><footer><div class="offer"><div class="price"><small>StudiosBook Recebimentos</small><strong>R$ 59,90/mês</strong></div><div class="cta">Conheça o plano</div></div><div class="legal">0,79% por pagamento aprovado. Comissão limitada a R$ 59,90 por mês. Sem fidelidade.</div></footer></div></main></body></html>`;
    await page.setViewportSize({ width: format.width, height: format.height });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".art").screenshot({ path: path.join(outputDir, `studiosbook-recebimentos-${format.id}.png`) });
  }
} finally {
  await browser.close();
}

console.log(`Artes geradas em ${outputDir}`);
