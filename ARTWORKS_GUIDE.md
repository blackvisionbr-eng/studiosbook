# StudiosBook Artwork System

Sistema oficial para gerar capas de tutoriais, peças para dispositivos, aberturas, encerramentos e capturas demonstrativas do StudiosBook.

## Resultado atual

O comando completo gera 231 arquivos PNG:

| Tipo | Quantidade |
| --- | ---: |
| Capas de 36 tutoriais em 5 formatos | 180 |
| Peças Android, iPhone, tablet e multiplataforma | 20 |
| Aberturas horizontais e verticais | 6 |
| Encerramentos horizontais e verticais | 12 |
| Telas demonstrativas sanitizadas | 11 |
| Foto de perfil e banner do YouTube | 2 |

Os arquivos finais ficam em `artworks/`. Essa pasta não é versionada para evitar aumentar o repositório com centenas de PNGs; todo o conteúdo pode ser regenerado pelo código.

A foto de perfil e o banner oficiais do canal também possuem cópias versionadas em `public/brand/exports/studiosbook-youtube-profile.png` e `public/brand/exports/studiosbook-youtube-banner.png`.

## Instalação

```bash
npm install
```

Dependências de geração:

- `playwright-core`: controla o Chrome local e exporta os artboards.
- `@fontsource/dm-sans`: arquivos locais da fonte principal.
- `@fontsource/dm-serif-display`: arquivos locais da fonte editorial.
- `lucide-react`: ícones oficiais, já utilizado pelo StudiosBook.

O gerador procura o Chrome nos caminhos padrão do Windows. Para usar outro executável, defina `CHROME_PATH`.

## Comandos

```bash
npm run artworks:generate
npm run artworks:youtube
npm run artworks:horizontal
npm run artworks:vertical
npm run artworks:square
npm run artworks:feed
npm run artworks:youtube-channel
npm run artworks:all
npm run artworks:validate
```

`artworks:generate` e `artworks:all` geram o pacote completo. `artworks:validate` confere assinatura PNG, integridade, tamanho mínimo e dimensões.

### Gerar uma categoria

```bash
npm run artworks:generate -- --format youtube --category clientes
```

Categorias disponíveis:

- `clientes`
- `agendamentos`
- `servicos`
- `equipe`
- `configuracoes`
- `financeiro`

### Gerar apenas uma peça

```bash
npm run artworks:generate -- --format vertical --id como-agendar-horario
```

## Formatos

| Nome do comando | Dimensão | Uso |
| --- | ---: | --- |
| `youtube` | 1280 x 720 | Thumbnail do YouTube |
| `horizontal` | 1920 x 1080 | Tutorial, abertura e encerramento Full HD |
| `vertical` | 1080 x 1920 | Shorts, Reels e Stories |
| `square` | 1080 x 1080 | Feed quadrado |
| `feed` | 1080 x 1350 | Feed vertical |
| `youtube-channel` | 800 x 800 e 2560 x 1440 | Perfil e banner do canal |

Cada proporção possui composição própria. A versão vertical não é um recorte da versão horizontal.

## Estrutura gerada

```text
artworks/
|-- youtube/
|   |-- clientes/
|   |-- agendamentos/
|   |-- servicos/
|   |-- equipe/
|   |-- configuracoes/
|   `-- financeiro/
|-- horizontal/
|-- vertical/
|-- square/
|-- feed/
|-- devices/
|-- openings/
|-- endings/
|-- screenshots/
|-- youtube-channel/
`-- manifest.json
```

O `manifest.json` registra cada arquivo, tipo, categoria, formato e dimensão.

## Alterar textos e cadastrar tutoriais

Edite `src/data/tutorial-artworks.js`. Todos os textos, episódios, categorias, telas e dispositivos estão nesse arquivo.

Exemplo:

```js
[
  "como-confirmar-cliente",
  "Como confirmar um cliente",
  "Confirme um cliente",
  "Atualize o status do atendimento com clareza.",
  "clients-list",
]
```

Para adicionar uma peça, inclua o item na categoria correta. O episódio é calculado pela ordem da lista.

Campos principais:

- `id`: nome único, sem acentos e em kebab-case.
- `title`: título completo do tutorial.
- `shortTitle`: texto principal da capa.
- `description`: apoio curto.
- `screen`: interface demonstrativa usada no mockup.
- `device`: `android`, `iphone`, `tablet`, `desktop` ou `multiplatform`.
- `screenshot`: caminho opcional para uma captura real.

## Substituir um mockup por captura real

1. Grave o StudiosBook usando uma conta de demonstração.
2. Remova nomes, telefones, e-mails, endereços, valores sensíveis e qualquer dado real.
3. Salve a captura em PNG, JPEG ou WebP dentro do projeto, por exemplo `public/brand/screenshots/agenda.png`.
4. Adicione o campo `screenshot` no item:

```js
{
  id: "como-visualizar-agenda",
  screenshot: "public/brand/screenshots/agenda.png",
}
```

O gerador incorpora a imagem no PNG final. Sem esse campo, utiliza uma interface demonstrativa claramente identificada como `DADOS DEMONSTRATIVOS`.

Use uma captura vertical para smartphone e uma captura horizontal para tablet ou computador. O enquadramento utiliza o topo da imagem como referência.

## Alterar cores, fontes e layout

- Cores e regras visuais: `public/brand/tokens.json`, `public/brand/tokens.css` e `public/brand/BRAND-GUIDE.md`.
- Catálogo de conteúdo: `src/data/tutorial-artworks.js`.
- Templates e CSS de exportação: `tools/artworks/render-artwork.mjs`.
- Automação, filtros e diretórios: `tools/artworks/generate-artworks.mjs`.

O logotipo é carregado diretamente de `public/brand/studiosbook-logo.svg` e `public/brand/studiosbook-logo-reversed.svg`. Não altere proporções, cores internas ou disposição do símbolo.

## Componentes reutilizáveis

O renderer possui os componentes funcionais:

- `ThumbnailTemplate`
- `DeviceShowcase`
- `TutorialOpening`
- `TutorialEnding`
- `CategoryBadge`
- `DeviceMockup`
- `ScreenshotFrame`
- `BrandLogo`

Não existe uma página duplicada por tutorial. O catálogo alimenta todos os formatos.

## Validação antes de publicar

```bash
npm run artworks:all
npm run artworks:validate
```

Depois, revise ao menos:

1. Uma capa curta e uma capa com título longo.
2. Uma peça horizontal, vertical, quadrada e de feed.
3. Uma abertura e um encerramento.
4. Android, iPhone, tablet e multiplataforma.
5. Ortografia, área segura, contraste e dados exibidos.

As telas demonstrativas usam nomes e contatos fictícios. Nunca publique capturas de uma conta real sem sanitização.
