import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import {
  artworkCategories,
  artworkFormats,
  deviceShowcases,
  tutorialArtworks,
  tutorialEndings,
  tutorialOpenings,
} from "../../src/data/tutorial-artworks.js";
import {
  DeviceShowcase,
  ScreenshotFrame,
  ThumbnailTemplate,
  TutorialEnding,
  TutorialOpening,
  YouTubeBanner,
  YouTubeProfile,
  renderArtworkDocument,
} from "./render-artwork.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const outputRoot = path.join(projectRoot, "artworks");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

function parseArgs(argv) {
  const result = { format: "all", category: null, id: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--format") result.format = argv[index + 1] || "all";
    if (value === "--category") result.category = argv[index + 1] || null;
    if (value === "--id") result.id = argv[index + 1] || null;
  }
  return result;
}

function fileDataUri(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function loadOptionalScreenshot(artwork) {
  if (!artwork.screenshot) return artwork;
  const absolutePath = path.resolve(projectRoot, artwork.screenshot);
  const extension = path.extname(absolutePath).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".webp" ? "image/webp" : "image/png";
  const content = await readFile(absolutePath);
  return { ...artwork, screenshotDataUri: fileDataUri(content, mimeType) };
}

async function loadAssets() {
  const files = {
    logo: ["public/brand/studiosbook-logo.svg", "image/svg+xml"],
    logoReversed: ["public/brand/studiosbook-logo-reversed.svg", "image/svg+xml"],
    markReversed: ["public/brand/studiosbook-mark-reversed.svg", "image/svg+xml"],
    dmSans400: ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2", "font/woff2"],
    dmSans500: ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2", "font/woff2"],
    dmSans600: ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2", "font/woff2"],
    dmSans700: ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2", "font/woff2"],
    dmSerif400: ["node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2", "font/woff2"],
  };

  const entries = await Promise.all(
    Object.entries(files).map(async ([key, [relativePath, mimeType]]) => {
      const content = await readFile(path.join(projectRoot, relativePath));
      return [key, fileDataUri(content, mimeType)];
    }),
  );
  return Object.fromEntries(entries);
}

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Continue until a local Chrome installation is found.
    }
  }
  throw new Error("Google Chrome não foi encontrado. Defina CHROME_PATH antes de gerar as artes.");
}

function selectedFormats(formatName) {
  if (formatName === "channel") return [];
  if (formatName === "all") return Object.entries(artworkFormats);
  if (!artworkFormats[formatName]) {
    throw new Error(`Formato inválido: ${formatName}. Use youtube, horizontal, vertical, square, feed, channel ou all.`);
  }
  return [[formatName, artworkFormats[formatName]]];
}

async function exportArtwork(page, { html, outputPath, width, height, metadata }, manifest) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            }),
      ),
    );
  });
  const artboard = page.locator("#artboard");
  const bounds = await artboard.boundingBox();
  if (!bounds || Math.round(bounds.width) !== width || Math.round(bounds.height) !== height) {
    throw new Error(`Dimensão inesperada em ${outputPath}: ${JSON.stringify(bounds)}`);
  }
  await artboard.screenshot({ path: outputPath, type: "png", animations: "disabled" });
  manifest.files.push({
    path: path.relative(projectRoot, outputPath).replaceAll("\\", "/"),
    width,
    height,
    ...metadata,
  });
}

const screenExports = [
  "dashboard",
  "clients-list",
  "client-form",
  "client-history",
  "schedule",
  "new-appointment",
  "services",
  "team",
  "settings",
  "finance",
  "reports",
];

async function generate() {
  const options = parseArgs(process.argv.slice(2));
  const assets = await loadAssets();
  const chromePath = await findChrome();
  const formats = selectedFormats(options.format);
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-gpu", "--font-render-hinting=none"],
  });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  page.setDefaultTimeout(30_000);
  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: "StudiosBook Artwork System 1.0",
    formats: Object.fromEntries(formats),
    filters: options,
    files: [],
  };

  try {
    if (options.format === "all" && !options.category && !options.id) {
      await rm(outputRoot, { recursive: true, force: true });
    }

    const tutorials = tutorialArtworks.filter(
      (item) => (!options.category || item.category === options.category) && (!options.id || item.id === options.id),
    );

    for (const [formatName, format] of formats) {
      for (const artwork of tutorials) {
        const resolvedArtwork = await loadOptionalScreenshot(artwork);
        const category = artworkCategories[artwork.category];
        const body = ThumbnailTemplate({ artwork: resolvedArtwork, category, format, assets });
        const outputPath = path.join(outputRoot, formatName, artwork.category, `${artwork.id}-${formatName}.png`);
        await exportArtwork(
          page,
          {
            html: renderArtworkDocument({ body, assets }),
            outputPath,
            width: format.width,
            height: format.height,
            metadata: { type: "tutorial", format: formatName, category: artwork.category, id: artwork.id },
          },
          manifest,
        );
      }

      if (!options.category && !options.id) {
        for (const artwork of deviceShowcases) {
          const resolvedArtwork = await loadOptionalScreenshot(artwork);
          const body = DeviceShowcase({ artwork: resolvedArtwork, format, assets });
          const outputPath = path.join(outputRoot, "devices", formatName, `${artwork.id}-${formatName}.png`);
          await exportArtwork(
            page,
            {
              html: renderArtworkDocument({ body, assets }),
              outputPath,
              width: format.width,
              height: format.height,
              metadata: { type: "device", format: formatName, id: artwork.id },
            },
            manifest,
          );
        }
      }
    }

    if (!options.category && !options.id) {
      if (["all", "channel"].includes(options.format)) {
        const channelArtworks = [
          {
            id: "studiosbook-youtube-profile",
            width: 800,
            height: 800,
            body: YouTubeProfile({ assets }),
          },
          {
            id: "studiosbook-youtube-banner",
            width: 2560,
            height: 1440,
            body: YouTubeBanner({ assets }),
          },
        ];

        for (const artwork of channelArtworks) {
          const outputPath = path.join(outputRoot, "youtube-channel", `${artwork.id}.png`);
          await exportArtwork(
            page,
            {
              html: renderArtworkDocument({ body: artwork.body, assets }),
              outputPath,
              width: artwork.width,
              height: artwork.height,
              metadata: { type: "youtube-channel", format: "youtube-channel", id: artwork.id },
            },
            manifest,
          );
        }
      }

      const editorialFormats = formats.filter(([name]) => ["horizontal", "vertical"].includes(name));
      for (const [formatName, format] of editorialFormats) {
        for (const artwork of tutorialOpenings) {
          const body = TutorialOpening({ artwork, format, assets });
          const outputPath = path.join(outputRoot, "openings", formatName, `${artwork.id}-${formatName}.png`);
          await exportArtwork(
            page,
            {
              html: renderArtworkDocument({ body, assets }),
              outputPath,
              width: format.width,
              height: format.height,
              metadata: { type: "opening", format: formatName, id: artwork.id },
            },
            manifest,
          );
        }

        for (const artwork of tutorialEndings) {
          const body = TutorialEnding({ artwork, format, assets });
          const outputPath = path.join(outputRoot, "endings", formatName, `${artwork.id}-${formatName}.png`);
          await exportArtwork(
            page,
            {
              html: renderArtworkDocument({ body, assets }),
              outputPath,
              width: format.width,
              height: format.height,
              metadata: { type: "ending", format: formatName, id: artwork.id },
            },
            manifest,
          );
        }
      }

      if (options.format === "all") {
        const screenshotFormat = { width: 1440, height: 900 };
        for (const screen of screenExports) {
          const body = ScreenshotFrame({ screen, format: screenshotFormat, assets });
          const outputPath = path.join(outputRoot, "screenshots", `demo-${screen}.png`);
          await exportArtwork(
            page,
            {
              html: renderArtworkDocument({ body, assets }),
              outputPath,
              width: screenshotFormat.width,
              height: screenshotFormat.height,
              metadata: { type: "demo-screenshot", format: "desktop", id: screen },
            },
            manifest,
          );
        }
      }
    }

    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    process.stdout.write(`StudiosBook: ${manifest.files.length} artes exportadas em ${pathToFileURL(outputRoot).href}\n`);
  } finally {
    await page.close();
    await browser.close();
  }
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
