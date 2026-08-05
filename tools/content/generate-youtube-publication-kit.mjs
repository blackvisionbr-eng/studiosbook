import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  youtubeAllPublicationContent,
  youtubeCategoryConfig,
  youtubeInstallationConfig,
} from "../../src/data/youtube-publication-content.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../..");
const outputDir = path.join(projectRoot, "content", "youtube");

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function validate(items) {
  const errors = [];
  const titleSet = new Set();
  if (items.length !== 39) errors.push(`Esperados 39 tutoriais, encontrados ${items.length}.`);

  for (const item of items) {
    if (item.title.length > 100) errors.push(`${item.id}: título com ${item.title.length} caracteres.`);
    if (titleSet.has(item.title)) errors.push(`${item.id}: título duplicado.`);
    titleSet.add(item.title);
    if (item.description.length > 5_000) errors.push(`${item.id}: descrição acima de 5.000 caracteres.`);
    if (!item.description.includes("https://studiosbook.com.br")) errors.push(`${item.id}: CTA sem domínio oficial.`);
    if (!item.description.includes("grátis por 7 dias")) errors.push(`${item.id}: oferta de teste ausente.`);
    if (item.hashtags.length !== 3) errors.push(`${item.id}: use exatamente três hashtags principais.`);
    if (item.tags.length > 10) errors.push(`${item.id}: excesso de tags.`);
  }

  if (errors.length) throw new Error(errors.join("\n"));
}

function renderVideoSections(videos) {
  return videos.map((item) => `### ${String(item.episode).padStart(2, "0")}. ${item.thumbnailText}

**Título para publicação**

\`\`\`text
${item.title}
\`\`\`

**Descrição pronta**

\`\`\`text
${item.description}
\`\`\`

**Comentário fixado**

\`\`\`text
${item.pinnedComment}
\`\`\`

**Tags do campo “Mostrar mais”**

\`\`\`text
${item.tags.join(", ")}
\`\`\`

**Texto da thumbnail:** ${item.thumbnailText}
`).join("\n---\n\n");
}

function buildMarkdown(items) {
  const installationSection = `## Playlist: ${youtubeInstallationConfig.playlist}

**Descrição da playlist**

${youtubeInstallationConfig.playlistDescription}

${renderVideoSections(items.filter((item) => item.category === "instalacao"))}`;

  const categories = Object.entries(youtubeCategoryConfig);
  const sections = categories.map(([categoryId, category]) => {
    const videos = items.filter((item) => item.category === categoryId);

    return `## Playlist: ${category.playlist}

**Descrição da playlist**

${category.playlistDescription}

${renderVideoSections(videos)}`;
  }).join("\n\n---\n\n");

  return `# Kit de Publicação para YouTube — StudiosBook

Conteúdo oficial para os 39 tutoriais do StudiosBook.

## Objetivo editorial

- Atrair profissionais da beleza que procuram organização, agenda e gestão.
- Entregar uma resposta clara para uma busca específica em cada vídeo.
- Converter a audiência para o teste gratuito de 7 dias.
- Criar continuidade por meio de playlists e próximos tutoriais.

## Descrição sugerida para o canal

\`\`\`text
Tutoriais oficiais do StudiosBook para profissionais da beleza que querem organizar clientes, agenda, serviços, equipe e financeiro em um único lugar.

Aprenda com passos simples, aplique no seu negócio e tenha mais controle para atender, fidelizar e crescer.

Comece seu teste grátis por 7 dias: https://studiosbook.com.br

StudiosBook — Seu talento em foco. Seu studio sob controle.
\`\`\`

## Ordem recomendada para o lançamento

1. Como instalar o StudiosBook no Android.
2. Como instalar o StudiosBook no iPhone.
3. Como instalar o StudiosBook no tablet ou iPad.
4. Como configurar o perfil do seu negócio.
5. Como personalizar o StudiosBook.
6. Como adicionar um serviço ao catálogo.
7. Como cadastrar um cliente.
8. Como agendar um horário.
9. Como visualizar sua agenda.
10. Como confirmar um atendimento.
11. Como registrar um pagamento.
12. Como visualizar o resumo do dia.
13. Como acompanhar o faturamento.

Depois dos dez vídeos iniciais, publique os demais dentro das respectivas playlists. Mantenha consistência de dois vídeos completos e dois Shorts derivados por semana.

${installationSection}

---

${sections}
`;
}

function buildCsv(items) {
  const headers = ["id", "categoria", "playlist", "episodio", "titulo", "texto_thumbnail", "descricao", "comentario_fixado", "hashtags", "tags"];
  const rows = items.map((item) => [
    item.id,
    item.categoryLabel,
    item.playlist,
    item.episode,
    item.title,
    item.thumbnailText,
    item.description,
    item.pinnedComment,
    item.hashtags,
    item.tags,
  ]);
  return `${headers.map(csvCell).join(",")}\n${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function buildInstallationMarkdown(items) {
  const installationItems = items.filter((item) => item.category === "instalacao");
  return `# Tutoriais de Instalação — StudiosBook

## Playlist: ${youtubeInstallationConfig.playlist}

${youtubeInstallationConfig.playlistDescription}

${renderVideoSections(installationItems)}
`;
}

async function generate() {
  validate(youtubeAllPublicationContent);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "YOUTUBE_PUBLICATION_KIT.md"), buildMarkdown(youtubeAllPublicationContent), "utf8"),
    writeFile(path.join(outputDir, "INSTALLATION_TUTORIALS.md"), buildInstallationMarkdown(youtubeAllPublicationContent), "utf8"),
    writeFile(path.join(outputDir, "youtube-publication-kit.csv"), `\uFEFF${buildCsv(youtubeAllPublicationContent)}`, "utf8"),
  ]);
  console.log(`Kit do YouTube gerado: ${youtubeAllPublicationContent.length} tutoriais em ${outputDir}`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
