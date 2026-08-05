import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const manifestPath = path.join(projectRoot, "artworks", "manifest.json");

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error("Arquivo não possui assinatura PNG válida.");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function validate() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const errors = [];
  const paths = new Set();

  for (const item of manifest.files) {
    const absolutePath = path.join(projectRoot, item.path);
    if (paths.has(item.path)) errors.push(`Arquivo duplicado no manifesto: ${item.path}`);
    paths.add(item.path);

    try {
      const info = await stat(absolutePath);
      if (info.size < 8_000) errors.push(`PNG possivelmente vazio: ${item.path} (${info.size} bytes)`);
      const dimensions = pngDimensions(await readFile(absolutePath));
      if (dimensions.width !== item.width || dimensions.height !== item.height) {
        errors.push(`${item.path}: esperado ${item.width}x${item.height}, encontrado ${dimensions.width}x${dimensions.height}`);
      }
    } catch (error) {
      errors.push(`${item.path}: ${error.message}`);
    }
  }

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }

  const totals = manifest.files.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {});
  console.log(`Validação concluída: ${manifest.files.length} PNGs íntegros.`);
  console.log(JSON.stringify(totals, null, 2));
}

validate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

