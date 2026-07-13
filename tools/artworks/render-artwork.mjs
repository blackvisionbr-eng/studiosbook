import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  BarChart3,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  ChartNoAxesCombined,
  Check,
  ClipboardCheck,
  Clock3,
  ContactRound,
  Eye,
  History,
  ImagePlus,
  KeyRound,
  Laptop,
  Link2,
  ListFilter,
  LockKeyhole,
  MapPin,
  Menu,
  PanelTop,
  Pencil,
  Play,
  Plus,
  Scissors,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Timer,
  Trash2,
  TrendingUp,
  UserCog,
  UserPlus,
  UserRoundCog,
  Users,
  WalletCards,
} from "lucide-react";

const palette = {
  plum: "#402239",
  plumDark: "#2B1827",
  rose: "#A84D68",
  dusty: "#C77D94",
  coral: "#E97F91",
  blush: "#F7E7EB",
  ivory: "#FFF9FA",
  white: "#FFFFFF",
  ink: "#171417",
  muted: "#6F666C",
  line: "#E8E1E4",
  focus: "#2E7D72",
};

const iconComponents = {
  "arrow-right": ArrowRight,
  "badge-check": BadgeCheck,
  "badge-dollar-sign": BadgeDollarSign,
  "bar-chart-3": BarChart3,
  "bell-ring": BellRing,
  "calendar-clock": CalendarClock,
  "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus,
  "calendar-x": CalendarX2,
  "chart-no-axes-combined": ChartNoAxesCombined,
  check: Check,
  "clipboard-check": ClipboardCheck,
  "clock-3": Clock3,
  "contact-round": ContactRound,
  eye: Eye,
  history: History,
  "image-plus": ImagePlus,
  "key-round": KeyRound,
  laptop: Laptop,
  "link-2": Link2,
  "list-filter": ListFilter,
  "lock-keyhole": LockKeyhole,
  "map-pin": MapPin,
  menu: Menu,
  "panel-top": PanelTop,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  "rotate-key": KeyRound,
  scissors: Scissors,
  search: Search,
  settings: Settings,
  "shield-check": ShieldCheck,
  sliders: SlidersHorizontal,
  smartphone: Smartphone,
  tablet: Tablet,
  timer: Timer,
  trash: Trash2,
  trending: TrendingUp,
  "user-cog": UserCog,
  "user-plus": UserPlus,
  "user-round-cog": UserRoundCog,
  users: Users,
  wallet: WalletCards,
};

function iconMarkup(name, size = 24, strokeWidth = 2) {
  const Icon = iconComponents[name] || PanelTop;
  return renderToStaticMarkup(
    React.createElement(Icon, {
      size,
      strokeWidth,
      "aria-hidden": true,
    }),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function BrandLogo({ logoDataUri, reversed = false, compact = false }) {
  const className = ["brand-logo", reversed ? "is-reversed" : "", compact ? "is-compact" : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="${className}"><img src="${logoDataUri}" alt="StudiosBook" /></div>`;
}

function CategoryBadge({ category }) {
  return `<div class="category-badge" style="--category:${category.accent}">
    <span class="category-icon">${iconMarkup(category.icon, 24, 2.25)}</span>
    <span>${escapeHtml(category.label)}</span>
  </div>`;
}

function demoRows(screen) {
  const rows = {
    "clients-list": [
      ["Marina Alves", "Lash designer", "Hoje, 14:00"],
      ["Camila Santos", "Design de sobrancelhas", "Amanhã, 10:30"],
      ["Julia Ferreira", "Massoterapia", "18 jul., 16:00"],
    ],
    services: [
      ["Volume brasileiro", "Cílios", "R$ 130"],
      ["Design com henna", "Sobrancelhas", "R$ 35"],
      ["Massagem relaxante", "Massoterapia", "R$ 120"],
    ],
    team: [
      ["Ana Martins", "Lash designer", "5 serviços"],
      ["Beatriz Lima", "Nail designer", "8 serviços"],
      ["Carla Souza", "Massoterapeuta", "4 serviços"],
    ],
    finance: [
      ["Atendimento #128", "Pix", "+ R$ 160"],
      ["Atendimento #127", "Cartão", "+ R$ 95"],
      ["Atendimento #126", "Dinheiro", "+ R$ 130"],
    ],
  };
  return rows[screen] || rows["clients-list"];
}

function DemoScreen({ screen = "dashboard", compact = false }) {
  const metricCards = `
    <div class="demo-metrics">
      <div class="demo-metric"><span>Hoje</span><strong>6</strong><small>agendamentos</small></div>
      <div class="demo-metric"><span>Clientes</span><strong>248</strong><small>ativos</small></div>
      <div class="demo-metric"><span>Receita</span><strong>R$ 1,4 mil</strong><small>esta semana</small></div>
    </div>`;

  const list = (title, rows, action = "Novo") => `
    <section class="demo-panel">
      <div class="demo-panel-head"><div><span class="demo-eyebrow">Organização</span><h3>${title}</h3></div><button>${iconMarkup("plus", 15)} ${action}</button></div>
      <div class="demo-search">${iconMarkup("search", 15)} <span>Buscar por nome ou telefone</span></div>
      <div class="demo-list">
        ${rows.map(([name, detail, value]) => `<div class="demo-row"><span class="demo-avatar">${escapeHtml(name[0])}</span><span class="demo-row-main"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></span><b>${escapeHtml(value)}</b></div>`).join("")}
      </div>
    </section>`;

  const form = (title, fields, action) => `
    <section class="demo-panel demo-form-panel">
      <div class="demo-panel-head"><div><span class="demo-eyebrow">Cadastro</span><h3>${title}</h3></div><span class="demo-step">Etapa 1 de 2</span></div>
      <div class="demo-form-grid">
        ${fields.map(([label, value, wide]) => `<label class="${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><div>${escapeHtml(value)}</div></label>`).join("")}
      </div>
      <div class="demo-form-actions"><button class="secondary">Cancelar</button><button>${iconMarkup("check", 15)} ${escapeHtml(action)}</button></div>
    </section>`;

  const schedule = `
    <section class="demo-panel demo-schedule">
      <div class="demo-panel-head"><div><span class="demo-eyebrow">Agenda privada</span><h3>Julho de 2026</h3></div><button>${iconMarkup("calendar-plus", 15)} Novo horário</button></div>
      <div class="week-head"><b>Seg</b><b>Ter</b><b>Qua</b><b>Qui</b><b>Sex</b></div>
      <div class="week-grid">
        <div><strong>13</strong><span class="slot rose">09:00 · Marina</span><span class="slot teal">14:30 · Julia</span></div>
        <div><strong>14</strong><span class="slot plum">10:00 · Camila</span></div>
        <div class="today"><strong>15</strong><span class="slot teal">11:30 · Bruna</span><span class="slot rose">16:00 · Luiza</span></div>
        <div><strong>16</strong><span class="slot muted">13:00 · Bloqueado</span></div>
        <div><strong>17</strong><span class="slot plum">08:30 · Paula</span></div>
      </div>
    </section>`;

  const dashboard = `
    ${metricCards}
    <div class="demo-split">
      <section class="demo-panel"><div class="demo-panel-head"><div><span class="demo-eyebrow">Agenda</span><h3>Próximos atendimentos</h3></div><span class="demo-link">Ver agenda</span></div>
        <div class="demo-list compact-list">
          <div class="demo-row"><span class="time">09:00</span><span class="demo-row-main"><strong>Marina Alves</strong><small>Volume brasileiro</small></span><em>Confirmado</em></div>
          <div class="demo-row"><span class="time">11:30</span><span class="demo-row-main"><strong>Camila Santos</strong><small>Design com henna</small></span><em>Confirmado</em></div>
          <div class="demo-row"><span class="time">14:00</span><span class="demo-row-main"><strong>Julia Ferreira</strong><small>Massagem relaxante</small></span><em class="pending">Pendente</em></div>
        </div>
      </section>
      <section class="demo-panel"><div class="demo-panel-head"><div><span class="demo-eyebrow">Crescimento</span><h3>Receita semanal</h3></div><b>+18%</b></div>
        <div class="demo-chart"><i style="height:42%"></i><i style="height:55%"></i><i style="height:47%"></i><i style="height:72%"></i><i style="height:88%"></i><i style="height:66%"></i><i style="height:93%"></i></div>
      </section>
    </div>`;

  const historyScreen = `
    <section class="demo-panel">
      <div class="profile-head"><span class="profile-avatar">M</span><div><span class="demo-eyebrow">Cliente desde 2025</span><h3>Marina Alves</h3><p>Cliente recorrente · 8 atendimentos</p></div><button>${iconMarkup("pencil", 15)} Editar</button></div>
      <div class="history-grid"><div><span>Último atendimento</span><strong>Volume brasileiro</strong><small>08 jul. 2026 · R$ 130</small></div><div><span>Próximo retorno</span><strong>28 jul. 2026</strong><small>Prazo ideal de manutenção</small></div></div>
      <div class="timeline"><div><i></i><span><strong>08 jul.</strong><small>Atendimento concluído</small></span><b>R$ 130</b></div><div><i></i><span><strong>16 jun.</strong><small>Manutenção</small></span><b>R$ 100</b></div><div><i></i><span><strong>24 mai.</strong><small>Atendimento concluído</small></span><b>R$ 130</b></div></div>
    </section>`;

  const settingsScreen = `
    <div class="demo-settings-layout">
      <aside><b>Perfil do negócio</b><span>Catálogo</span><span>Horários</span><span>Equipe</span><span>Segurança</span></aside>
      ${form("Perfil do seu studio", [["Nome do negócio", "Studio Aurora"], ["Telefone", "(00) 00000-0000"], ["Endereço", "Centro · Cidade/UF", true]], "Salvar alterações")}
    </div>`;

  const securityScreen = `
    <div class="security-cards"><section class="demo-panel"><span class="security-icon">${iconMarkup("key-round", 24)}</span><h3>Alterar senha</h3><p>Use uma senha forte e exclusiva para proteger sua conta.</p><button>Atualizar senha</button></section><section class="demo-panel"><span class="security-icon">${iconMarkup("shield-check", 24)}</span><h3>Conta protegida</h3><p>Seu acesso utiliza autenticação segura e recuperação por e-mail.</p><b>Proteção ativa</b></section></div>`;

  const reportsScreen = `
    ${metricCards}
    <section class="demo-panel"><div class="demo-panel-head"><div><span class="demo-eyebrow">Desempenho</span><h3>Visão dos últimos 30 dias</h3></div><span class="demo-filter">Últimos 30 dias</span></div><div class="report-layout"><div class="line-chart"><svg viewBox="0 0 500 180" aria-hidden="true"><path d="M10 145 C80 130 90 85 150 105 S250 45 310 70 S400 20 490 38" fill="none" stroke="#A84D68" stroke-width="7" stroke-linecap="round"/><path d="M10 160H490" stroke="#E8E1E4" stroke-width="2"/></svg></div><div class="report-list"><div><span>Taxa de retorno</span><strong>72%</strong></div><div><span>Ticket médio</span><strong>R$ 118</strong></div><div><span>Novos clientes</span><strong>24</strong></div></div></div></section>`;

  const contentByScreen = {
    dashboard,
    "clients-list": list("Clientes", demoRows("clients-list"), "Novo cliente"),
    "client-form": form("Novo cliente", [["Nome completo", "Marina Alves"], ["Telefone", "(00) 00000-0000"], ["Observações", "Preferências e informações importantes", true]], "Salvar cliente"),
    "client-history": historyScreen,
    schedule,
    "new-appointment": form("Novo agendamento", [["Cliente", "Marina Alves"], ["Serviço", "Volume brasileiro"], ["Data", "15/07/2026"], ["Horário", "14:00"]], "Salvar horário"),
    services: list("Catálogo de serviços", demoRows("services"), "Novo serviço"),
    team: list("Profissionais", demoRows("team"), "Novo profissional"),
    settings: settingsScreen,
    security: securityScreen,
    finance: `${metricCards}${list("Recebimentos recentes", demoRows("finance"), "Registrar")}`,
    reports: reportsScreen,
  };

  return `<div class="demo-app ${compact ? "is-compact" : ""}">
    <header class="demo-topbar"><div class="demo-mini-brand"><span class="mini-mark"></span><b>Studios<span>Book</span></b></div><div class="demo-badge">DADOS DEMONSTRATIVOS</div><div class="demo-user">Studio Aurora</div></header>
    <div class="demo-body">
      <nav class="demo-nav"><span>${iconMarkup("panel-top", 17)} <b>Dashboard</b></span><span>${iconMarkup("users", 17)} Clientes</span><span>${iconMarkup("calendar-days", 17)} Agenda</span><span>${iconMarkup("clipboard-check", 17)} Atendimentos</span><span>${iconMarkup("bar-chart-3", 17)} Relatórios</span><span>${iconMarkup("settings", 17)} Configurações</span></nav>
      <main class="demo-content">${contentByScreen[screen] || dashboard}</main>
    </div>
  </div>`;
}

function DeviceMockup({ device = "iphone", screen = "dashboard", screenshotDataUri = null, compact = false }) {
  const screenContent = (fallbackScreen) =>
    screenshotDataUri
      ? `<img class="real-screenshot" src="${screenshotDataUri}" alt="Captura do StudiosBook" />`
      : DemoScreen({ screen: fallbackScreen, compact: true });

  if (device === "multiplatform") {
    return `<div class="device-cluster">
      <div class="cluster-laptop"><div class="device device-laptop"><div class="device-camera"></div><div class="device-screen">${screenContent(screen)}</div></div><div class="laptop-base"></div></div>
      <div class="device device-tablet cluster-tablet"><div class="device-camera"></div><div class="device-screen">${screenContent("schedule")}</div></div>
      <div class="device device-phone cluster-phone"><div class="device-camera"></div><div class="device-screen">${screenContent("clients-list")}</div></div>
    </div>`;
  }

  const type = device === "desktop" ? "laptop" : device === "tablet" ? "tablet" : "phone";
  const frame = `<div class="device device-${type} ${device === "android" ? "is-android" : ""}"><div class="device-camera"></div><div class="device-screen">${screenContent(screen)}</div></div>`;
  return type === "laptop" ? `<div class="single-laptop">${frame}<div class="laptop-base"></div></div>` : frame;
}

function artboardClasses(format, kind) {
  const portrait = format.height > format.width;
  const square = format.height === format.width;
  return ["artboard", `kind-${kind}`, `size-${format.width}x${format.height}`, portrait ? "is-portrait" : "is-landscape", square ? "is-square" : ""]
    .filter(Boolean)
    .join(" ");
}

function titleClass(title) {
  const length = String(title).length;
  if (length > 31) return "title-long";
  if (length > 22) return "title-medium";
  return "title-short";
}

export function ThumbnailTemplate({ artwork, category, format, assets }) {
  return `<div id="artboard" class="${artboardClasses(format, "tutorial")}" style="--accent:${category.accent};--w:${format.width}px;--h:${format.height}px">
    <div class="texture-lines"></div><div class="brand-petal petal-a"></div><div class="brand-petal petal-b"></div>
    <header class="art-header">${BrandLogo({ logoDataUri: assets.logo, compact: true })}<div class="tutorial-label"><span>${iconMarkup("play", 16, 2.5)}</span>TUTORIAL</div></header>
    <section class="tutorial-copy">
      <div class="copy-meta">${CategoryBadge({ category })}<span class="episode">${String(artwork.episode).padStart(2, "0")}</span></div>
      <h1 class="${titleClass(artwork.shortTitle)}">${escapeHtml(artwork.shortTitle)}</h1>
      <p>${escapeHtml(artwork.description)}</p>
      <div class="tutorial-cta"><span>Veja o passo a passo</span>${iconMarkup("arrow-right", 22, 2.4)}</div>
    </section>
    <section class="tutorial-visual"><div class="device-halo"></div>${DeviceMockup({ device: artwork.device, screen: artwork.screen, screenshotDataUri: artwork.screenshotDataUri })}<div class="action-marker">${iconMarkup(artwork.icon, 30, 2.1)}</div></section>
    <footer class="art-footer"><span>${escapeHtml(category.series)}</span><strong>studiosbook.com.br</strong></footer>
  </div>`;
}

export function DeviceShowcase({ artwork, format, assets }) {
  return `<div id="artboard" class="${artboardClasses(format, "device-showcase")}" style="--accent:${palette.rose};--w:${format.width}px;--h:${format.height}px">
    <div class="texture-lines"></div><div class="brand-petal petal-a"></div>
    <header class="art-header">${BrandLogo({ logoDataUri: assets.logo, compact: true })}<div class="tutorial-label">MULTIPLATAFORMA</div></header>
    <section class="showcase-copy"><span class="showcase-kicker">GESTÃO PROFISSIONAL ONDE VOCÊ ESTIVER</span><h1 class="${titleClass(artwork.title)}">${escapeHtml(artwork.title)}</h1><p>${escapeHtml(artwork.description)}</p><div class="platforms"><span>${iconMarkup("smartphone", 22)} Celular</span><span>${iconMarkup("tablet", 22)} Tablet</span><span>${iconMarkup("laptop", 22)} Computador</span></div></section>
    <section class="showcase-visual">${DeviceMockup({ device: artwork.device, screen: artwork.screen, screenshotDataUri: artwork.screenshotDataUri })}</section>
    <footer class="art-footer"><span>Seu talento em foco. Seu studio sob controle.</span><strong>studiosbook.com.br</strong></footer>
  </div>`;
}

export function TutorialOpening({ artwork, format, assets }) {
  return `<div id="artboard" class="${artboardClasses(format, "opening")}" style="--accent:${palette.coral};--w:${format.width}px;--h:${format.height}px">
    <div class="opening-field"><div class="opening-mark">${BrandLogo({ logoDataUri: assets.logoReversed })}</div><span class="opening-kicker">APRENDA · ORGANIZE · CRESÇA</span><h1 class="${titleClass(artwork.title)}">${escapeHtml(artwork.title)}</h1><p>${escapeHtml(artwork.description)}</p></div>
    <footer class="opening-footer"><span>Tutorial oficial StudiosBook</span><strong>studiosbook.com.br</strong></footer>
  </div>`;
}

export function TutorialEnding({ artwork, format, assets }) {
  return `<div id="artboard" class="${artboardClasses(format, "ending")}" style="--accent:${palette.rose};--w:${format.width}px;--h:${format.height}px">
    <div class="texture-lines"></div><header class="art-header">${BrandLogo({ logoDataUri: assets.logo, compact: true })}<div class="tutorial-label">CONTINUE APRENDENDO</div></header>
    <section class="ending-copy"><span class="ending-icon">${iconMarkup("badge-check", 38, 2)}</span><h1 class="${titleClass(artwork.title)}">${escapeHtml(artwork.title)}</h1><p>${escapeHtml(artwork.description)}</p><div class="subscribe-button">${iconMarkup("bell-ring", 22)} Inscreva-se no canal</div></section>
    <section class="youtube-slots"><div class="youtube-slot"><span>${iconMarkup("play", 28)}</span><b>Vídeo recomendado</b></div><div class="youtube-slot"><span>${iconMarkup("list-filter", 28)}</span><b>Playlist de tutoriais</b></div></section>
    <footer class="art-footer"><span>StudiosBook · Tutorial oficial</span><strong>studiosbook.com.br</strong></footer>
  </div>`;
}

export function ScreenshotFrame({ screen, format, assets }) {
  return `<div id="artboard" class="artboard kind-screenshot" style="--w:${format.width}px;--h:${format.height}px"><div class="screenshot-chrome"><header>${BrandLogo({ logoDataUri: assets.logo, compact: true })}<span>Demonstração oficial · sem dados reais</span></header><div class="full-demo">${DemoScreen({ screen })}</div></div></div>`;
}

function baseStyles(assets) {
  return `
    @font-face{font-family:"DM Sans";src:url(${assets.dmSans400}) format("woff2");font-weight:400;font-style:normal;font-display:block}
    @font-face{font-family:"DM Sans";src:url(${assets.dmSans500}) format("woff2");font-weight:500;font-style:normal;font-display:block}
    @font-face{font-family:"DM Sans";src:url(${assets.dmSans600}) format("woff2");font-weight:600;font-style:normal;font-display:block}
    @font-face{font-family:"DM Sans";src:url(${assets.dmSans700}) format("woff2");font-weight:700;font-style:normal;font-display:block}
    @font-face{font-family:"DM Serif Display";src:url(${assets.dmSerif400}) format("woff2");font-weight:400;font-style:normal;font-display:block}
    :root{--plum:#402239;--plum-dark:#2B1827;--rose:#A84D68;--dusty:#C77D94;--coral:#E97F91;--blush:#F7E7EB;--ivory:#FFF9FA;--ink:#171417;--muted:#6F666C;--line:#E8E1E4;--focus:#2E7D72;--white:#fff}
    *{box-sizing:border-box}html,body{margin:0;background:transparent}body{font-family:"DM Sans",Arial,sans-serif;color:var(--ink)}svg{display:block}.artboard{position:relative;width:var(--w);height:var(--h);overflow:hidden;background:var(--ivory);isolation:isolate}.artboard h1,.artboard p{margin:0}.texture-lines{position:absolute;inset:0;z-index:-2;background-image:linear-gradient(rgba(64,34,57,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(64,34,57,.045) 1px,transparent 1px);background-size:56px 56px;mask-image:linear-gradient(90deg,#000,transparent 70%)}
    .brand-petal{position:absolute;z-index:-1;width:34%;aspect-ratio:1;border-radius:68% 18% 68% 18%;background:var(--blush);transform:rotate(18deg)}.petal-a{right:-9%;top:-18%}.petal-b{left:43%;bottom:-35%;background:#f3e3e8;transform:rotate(52deg)}
    .brand-logo img{display:block;width:330px;height:auto}.brand-logo.is-compact img{width:248px}.art-header{position:absolute;z-index:5;left:5.4%;right:5.4%;top:5.5%;display:flex;align-items:center;justify-content:space-between}.tutorial-label{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.92);padding:11px 18px;color:var(--plum);font-size:15px;font-weight:800;letter-spacing:1.1px}.tutorial-label span{color:var(--accent)}
    .tutorial-copy{position:absolute;z-index:4;left:5.4%;top:24%;width:47%;display:flex;flex-direction:column;align-items:flex-start}.copy-meta{display:flex;align-items:center;gap:14px;margin-bottom:24px}.category-badge{display:flex;align-items:center;gap:10px;border-radius:8px;background:color-mix(in srgb,var(--category) 10%,#fff);padding:10px 14px;color:var(--category);font-size:16px;font-weight:800}.category-icon{display:grid;place-items:center}.episode{display:grid;place-items:center;min-width:44px;height:44px;border:1px solid color-mix(in srgb,var(--accent) 26%,#fff);border-radius:8px;color:var(--accent);font-size:16px;font-weight:800}.tutorial-copy h1,.showcase-copy h1,.ending-copy h1{max-width:100%;font-family:"DM Serif Display",Georgia,serif;font-weight:400;letter-spacing:0;line-height:.98;color:var(--plum-dark)}.tutorial-copy h1.title-short{font-size:82px}.tutorial-copy h1.title-medium{font-size:74px}.tutorial-copy h1.title-long{font-size:66px}.tutorial-copy p{max-width:590px;margin-top:24px;color:var(--muted);font-size:25px;line-height:1.42}.tutorial-cta{display:flex;align-items:center;gap:14px;margin-top:30px;color:var(--accent);font-size:20px;font-weight:800}.art-footer{position:absolute;left:5.4%;right:5.4%;bottom:4.5%;display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:16px}.art-footer strong{color:var(--plum)}
    .tutorial-visual{position:absolute;right:3.7%;top:18%;width:45%;height:70%;display:grid;place-items:center}.device-halo{position:absolute;inset:8% 5% 4%;border:1px solid color-mix(in srgb,var(--accent) 26%,transparent);border-radius:48% 18% 48% 18%;background:color-mix(in srgb,var(--accent) 7%,white);transform:rotate(-4deg)}.action-marker{position:absolute;right:2%;bottom:12%;display:grid;place-items:center;width:68px;height:68px;border:7px solid white;border-radius:50%;background:var(--accent);color:white;box-shadow:0 16px 34px rgba(64,34,57,.2)}
    .device{position:relative;z-index:2;border:8px solid #211d21;background:#211d21;box-shadow:0 28px 70px rgba(23,20,23,.28);overflow:hidden}.device-screen{width:100%;height:100%;overflow:hidden;background:#fff}.real-screenshot{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}.device-phone{width:318px;height:602px;border-radius:46px}.device-phone.is-android{border-radius:34px}.device-tablet{width:530px;height:690px;border-radius:32px}.device-laptop{width:720px;height:456px;border-radius:22px 22px 10px 10px}.single-laptop{position:relative;z-index:2;transform:scale(.84)}.laptop-base{height:22px;margin:-1px -42px 0;border-radius:0 0 48px 48px;background:#3a3439;box-shadow:0 18px 30px rgba(23,20,23,.22)}.device-camera{position:absolute;z-index:8;left:50%;top:10px;width:9px;height:9px;border-radius:50%;background:#554c53;transform:translateX(-50%)}
    .demo-app{width:100%;height:100%;background:#fbf8f9;color:#272226;font-family:"DM Sans",Arial,sans-serif}.demo-topbar{height:10%;min-height:38px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee7ea;background:#fff;padding:0 3%;font-size:12px}.demo-mini-brand{display:flex;align-items:center;gap:7px}.demo-mini-brand b{font-size:14px}.demo-mini-brand b span{color:var(--rose);font-weight:500}.mini-mark{width:16px;height:16px;border-radius:62% 18% 62% 18%;background:var(--plum);box-shadow:9px 0 0 var(--coral),0 9px 0 var(--dusty),9px 9px 0 var(--plum);transform:scale(.68);transform-origin:left top}.demo-badge{border-radius:4px;background:#f4eff1;padding:4px 7px;color:#7b7077;font-size:8px;font-weight:800;letter-spacing:.45px}.demo-user{font-weight:700}.demo-body{display:grid;grid-template-columns:20% 1fr;height:90%}.demo-nav{display:flex;flex-direction:column;gap:7px;border-right:1px solid #eee7ea;background:#fff;padding:5% 4%;color:#726971;font-size:9px}.demo-nav span{display:flex;align-items:center;gap:6px;border-radius:6px;padding:7px}.demo-nav span:first-child{background:#f7e7eb;color:#8f3f59}.demo-content{min-width:0;overflow:hidden;padding:4%;background:#fbf8f9}.demo-app.is-compact .demo-content{padding:3%}.demo-app.is-compact .demo-nav{font-size:7px}.demo-app.is-compact .demo-nav svg{width:12px}.demo-app.is-compact .demo-badge{display:none}
    .demo-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:2.2%;margin-bottom:3%}.demo-metric{min-width:0;border:1px solid #ece5e8;border-radius:8px;background:#fff;padding:8%}.demo-metric span{display:block;color:#7b7277;font-size:9px}.demo-metric strong{display:block;margin:5% 0 2%;color:#402239;font-size:17px;line-height:1}.demo-metric small{color:#8a8187;font-size:7px}.demo-panel{min-width:0;border:1px solid #ece5e8;border-radius:9px;background:#fff;padding:3%;box-shadow:0 5px 16px rgba(64,34,57,.045)}.demo-panel-head,.profile-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.demo-eyebrow{color:#a84d68;font-size:7px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}.demo-panel h3,.profile-head h3{margin:2px 0 0;color:#302a2f;font-size:13px}.demo-panel-head button,.demo-form-actions button,.profile-head button,.security-cards button{display:flex;align-items:center;gap:5px;border:0;border-radius:6px;background:#402239;padding:7px 9px;color:#fff;font-size:7px;font-weight:800}.demo-step,.demo-filter{border:1px solid #e8e1e4;border-radius:5px;padding:5px 7px;color:#716870;font-size:7px;font-weight:700}.demo-search{display:flex;align-items:center;gap:6px;margin:3% 0;border:1px solid #e8e1e4;border-radius:6px;padding:7px 9px;color:#938a90;font-size:7px}.demo-list{display:grid;gap:1px}.demo-row{display:flex;align-items:center;gap:8px;border-top:1px solid #f0ebed;padding:2.5% 1%;font-size:8px}.demo-avatar,.profile-avatar{display:grid;place-items:center;flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:#f7e7eb;color:#a84d68;font-weight:800}.demo-row-main{display:grid;gap:2px;flex:1}.demo-row-main strong{font-size:8px}.demo-row-main small{color:#898087;font-size:6px}.demo-row b{color:#514a4f;font-size:7px}.demo-row em{border-radius:4px;background:#e7f4ee;padding:3px 5px;color:#2f7a5f;font-size:6px;font-style:normal;font-weight:800}.demo-row em.pending{background:#fff3df;color:#b56b15}.time{color:#a84d68;font-weight:800}.demo-split{display:grid;grid-template-columns:1.35fr .9fr;gap:3%}.demo-link{color:#a84d68;font-size:7px;font-weight:700}.demo-chart{display:flex;align-items:flex-end;gap:5%;height:80px;padding-top:10px}.demo-chart i{flex:1;border-radius:3px 3px 0 0;background:#c77d94}.compact-list{margin-top:4%}
    .demo-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:5%}.demo-form-grid label{display:grid;gap:4px;color:#6f666c;font-size:7px;font-weight:700}.demo-form-grid label.wide{grid-column:1/-1}.demo-form-grid label div{min-height:30px;border:1px solid #e3dadd;border-radius:6px;background:#fff;padding:8px;color:#312b30;font-size:8px;font-weight:500}.demo-form-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:5%}.demo-form-actions button.secondary{border:1px solid #e3dadd;background:#fff;color:#514a4f}.week-head,.week-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1%}.week-head{margin:4% 0 2%;color:#81777e;font-size:7px;text-align:center}.week-grid>div{min-height:105px;border:1px solid #eee7ea;border-radius:6px;background:#fff;padding:6px}.week-grid>div.today{border-color:#c77d94;background:#fff9fa}.week-grid strong{display:block;margin-bottom:8px;color:#514a4f;font-size:8px}.slot{display:block;margin-bottom:4px;border-left:2px solid #a84d68;border-radius:3px;background:#f7e7eb;padding:4px;color:#6d3347;font-size:5px}.slot.teal{border-color:#2e7d72;background:#e9f4f2;color:#2e6a63}.slot.plum{border-color:#402239;background:#eee7ec;color:#402239}.slot.muted{border-color:#9b9398;background:#f3f0f1;color:#6f666c}.profile-head{padding-bottom:4%;border-bottom:1px solid #eee7ea}.profile-avatar{width:38px;height:38px}.profile-head>div{flex:1}.profile-head p{margin:3px 0 0;color:#7f767c;font-size:7px}.history-grid{display:grid;grid-template-columns:1fr 1fr;gap:3%;margin:4% 0}.history-grid>div{display:grid;gap:3px;border-radius:6px;background:#faf6f8;padding:8px}.history-grid span{color:#8b8188;font-size:6px}.history-grid strong{font-size:8px}.history-grid small{color:#7d737a;font-size:6px}.timeline{display:grid}.timeline>div{display:flex;align-items:center;gap:8px;border-top:1px solid #f0ebed;padding:7px}.timeline i{width:7px;height:7px;border-radius:50%;background:#a84d68}.timeline span{display:grid;flex:1}.timeline strong{font-size:7px}.timeline small{color:#81777e;font-size:6px}.timeline b{font-size:7px}.demo-settings-layout{display:grid;grid-template-columns:27% 1fr;gap:3%}.demo-settings-layout aside{display:flex;flex-direction:column;gap:9px;border:1px solid #ece5e8;border-radius:9px;background:#fff;padding:12px;color:#776e74;font-size:7px}.demo-settings-layout aside b{border-radius:5px;background:#f7e7eb;padding:7px;color:#8f3f59}.security-cards{display:grid;grid-template-columns:1fr 1fr;gap:3%}.security-cards .demo-panel{padding:8%}.security-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:8px;background:#f7e7eb;color:#a84d68}.security-cards h3{margin:10px 0 5px}.security-cards p{margin:0 0 12px;color:#7f767c;font-size:7px;line-height:1.5}.security-cards b{color:#2f7a5f;font-size:7px}.report-layout{display:grid;grid-template-columns:2fr 1fr;gap:5%;margin-top:4%}.line-chart svg{width:100%;height:auto}.report-list{display:grid;align-content:center;gap:8px}.report-list>div{display:flex;justify-content:space-between;border-bottom:1px solid #eee7ea;padding-bottom:7px;font-size:7px}.report-list span{color:#776e74}.report-list strong{color:#402239}
    .showcase-copy{position:absolute;z-index:4;left:5.4%;top:25%;width:45%}.showcase-kicker{display:block;margin-bottom:22px;color:var(--rose);font-size:16px;font-weight:800;letter-spacing:1.3px}.showcase-copy h1.title-short{font-size:82px}.showcase-copy h1.title-medium{font-size:72px}.showcase-copy h1.title-long{font-size:64px}.showcase-copy p{max-width:600px;margin-top:26px;color:var(--muted);font-size:25px;line-height:1.45}.platforms{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}.platforms span{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px 15px;color:var(--plum);font-size:16px;font-weight:800}.showcase-visual{position:absolute;right:2%;top:17%;width:49%;height:71%;display:grid;place-items:center}.device-cluster{position:relative;width:760px;height:620px;transform:scale(.8)}.cluster-laptop{position:absolute;right:0;top:40px}.cluster-tablet{position:absolute;left:0;bottom:0;width:330px;height:460px}.cluster-phone{position:absolute;right:32px;bottom:0;width:210px;height:400px}
    .kind-opening{background:var(--plum-dark);color:#fff}.kind-opening:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,transparent 58%,rgba(233,127,145,.13) 58% 72%,transparent 72%)}.opening-field{position:absolute;inset:10% 8% 14%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.opening-mark{min-height:130px;display:grid;place-items:center;filter:brightness(0) invert(1)}.opening-mark img{width:370px}.opening-kicker{margin:36px 0 24px;color:#f3bdc7;font-size:18px;font-weight:800;letter-spacing:2px}.opening-field h1{max-width:1200px;font-family:"DM Serif Display",Georgia,serif;font-weight:400;line-height:1;color:white}.opening-field h1.title-short{font-size:102px}.opening-field h1.title-medium{font-size:92px}.opening-field h1.title-long{font-size:78px}.opening-field p{max-width:920px;margin-top:30px;color:#f4e9ed;font-size:34px;line-height:1.4}.motion-guide{display:flex;align-items:center;gap:16px;margin-top:42px;color:#d5bdc8;font-size:13px;font-weight:700;letter-spacing:1px}.motion-guide i{display:block;width:90px;height:1px;background:#76566d}.opening-footer{position:absolute;left:6%;right:6%;bottom:5%;display:flex;justify-content:space-between;color:#e5d5dc;font-size:16px}.opening-footer strong{color:white}
    .ending-copy{position:absolute;left:5.4%;top:24%;width:41%}.ending-icon{display:grid;place-items:center;width:72px;height:72px;border-radius:12px;background:#f7e7eb;color:#a84d68}.ending-copy h1{margin-top:24px;font-size:74px;line-height:1}.ending-copy p{max-width:610px;margin-top:24px;color:var(--muted);font-size:25px;line-height:1.42}.subscribe-button{display:inline-flex;align-items:center;gap:10px;margin-top:30px;border-radius:8px;background:var(--plum);padding:14px 20px;color:#fff;font-size:17px;font-weight:800}.youtube-slots{position:absolute;right:5.4%;top:24%;width:44%;display:grid;grid-template-columns:1fr 1fr;gap:22px}.youtube-slot{aspect-ratio:16/9;display:grid;place-items:center;align-content:center;gap:14px;border:2px dashed #cbbec5;border-radius:12px;background:#fff;color:#756a72}.youtube-slot span{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;background:#f7e7eb;color:#a84d68}.youtube-slot b{font-size:16px}
    .kind-screenshot{background:#f4eff1;padding:42px}.screenshot-chrome{height:100%;border:1px solid #dcd2d7;border-radius:18px;background:#fff;padding:18px;box-shadow:0 28px 80px rgba(64,34,57,.16)}.screenshot-chrome>header{height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 16px}.screenshot-chrome>header img{width:230px}.screenshot-chrome>header span{border-radius:6px;background:#f4eff1;padding:8px 12px;color:#6f666c;font-size:14px;font-weight:800;letter-spacing:.5px}.full-demo{height:calc(100% - 74px);overflow:hidden;border:1px solid #e8e1e4;border-radius:12px}.full-demo .demo-topbar{font-size:16px}.full-demo .demo-mini-brand b{font-size:18px}.full-demo .demo-nav{font-size:13px}.full-demo .demo-nav svg{width:20px;height:20px}.full-demo .demo-content{padding:3%}.full-demo .demo-metric span{font-size:13px}.full-demo .demo-metric strong{font-size:30px}.full-demo .demo-metric small{font-size:11px}.full-demo .demo-eyebrow{font-size:10px}.full-demo .demo-panel h3,.full-demo .profile-head h3{font-size:20px}.full-demo .demo-panel-head button,.full-demo .demo-form-actions button,.full-demo .profile-head button,.full-demo .security-cards button{font-size:11px;padding:10px 14px}.full-demo .demo-search,.full-demo .demo-row-main strong,.full-demo .history-grid strong{font-size:12px}.full-demo .demo-row-main small,.full-demo .demo-row b,.full-demo .history-grid small,.full-demo .timeline small{font-size:10px}.full-demo .demo-row{padding:2%}.full-demo .demo-avatar{width:34px;height:34px}.full-demo .demo-chart{height:150px}.full-demo .week-grid>div{min-height:180px}.full-demo .slot{font-size:9px;padding:7px}.full-demo .demo-form-grid label{font-size:11px}.full-demo .demo-form-grid label div{font-size:13px;min-height:46px}.full-demo .security-cards p{font-size:12px}.full-demo .report-list>div{font-size:12px}
    .is-portrait .art-header{top:4.5%;left:7%;right:7%}.is-portrait .brand-logo.is-compact img{width:270px}.is-portrait .tutorial-copy{left:7%;top:14%;width:86%}.is-portrait .copy-meta{margin-bottom:28px}.is-portrait .tutorial-copy h1.title-short{font-size:110px}.is-portrait .tutorial-copy h1.title-medium{font-size:98px}.is-portrait .tutorial-copy h1.title-long{font-size:86px}.is-portrait .tutorial-copy p{max-width:820px;font-size:34px}.is-portrait .tutorial-cta{font-size:24px}.is-portrait .tutorial-visual{left:7%;right:7%;top:47%;width:86%;height:43%}.is-portrait .device-phone{width:440px;height:830px}.is-portrait .device-tablet{width:720px;height:940px}.is-portrait .single-laptop{transform:scale(.9)}.is-portrait .art-footer{left:7%;right:7%;bottom:4%;font-size:20px}.is-portrait .action-marker{right:12%;bottom:4%;width:90px;height:90px}.is-portrait .showcase-copy{left:7%;top:15%;width:86%;text-align:center}.is-portrait .showcase-copy h1.title-short{font-size:104px}.is-portrait .showcase-copy h1.title-medium{font-size:92px}.is-portrait .showcase-copy h1.title-long{font-size:82px}.is-portrait .showcase-copy p{max-width:860px;margin:28px auto 0;font-size:34px}.is-portrait .platforms{justify-content:center}.is-portrait .showcase-visual{left:5%;right:5%;top:44%;width:90%;height:48%}.is-portrait .device-cluster{transform:scale(.95)}.is-portrait .opening-field{inset:10% 8% 12%}.is-portrait .opening-mark img{width:430px}.is-portrait .opening-kicker{font-size:20px}.is-portrait .opening-field h1.title-short{font-size:116px}.is-portrait .opening-field h1.title-medium{font-size:104px}.is-portrait .opening-field h1.title-long{font-size:90px}.is-portrait .opening-field p{font-size:38px}.is-portrait .ending-copy{left:7%;top:15%;width:86%;text-align:center}.is-portrait .ending-icon{margin:auto}.is-portrait .ending-copy h1{font-size:98px}.is-portrait .ending-copy p{max-width:850px;margin:28px auto 0;font-size:34px}.is-portrait .youtube-slots{left:7%;right:7%;top:51%;width:86%;grid-template-columns:1fr}.is-portrait .youtube-slot{aspect-ratio:16/8}.is-portrait .youtube-slot:nth-child(2){display:none}.is-portrait .subscribe-button{font-size:24px}.is-portrait .kind-screenshot{padding:30px}
    .is-square .tutorial-copy{top:18%;width:48%}.is-square .tutorial-copy h1.title-short{font-size:76px}.is-square .tutorial-copy h1.title-medium{font-size:68px}.is-square .tutorial-copy h1.title-long{font-size:58px}.is-square .tutorial-copy p{font-size:22px}.is-square .tutorial-visual{right:2%;top:22%;width:47%;height:67%}.is-square .showcase-copy{top:20%}.is-square .showcase-visual{top:22%;height:67%}.is-square .device-cluster{transform:scale(.68)}
    .kind-tutorial.is-landscape .art-footer{right:auto;width:47%;justify-content:flex-start;gap:28px}
    .size-1080x1350.kind-device-showcase .showcase-visual{top:50%;height:42%}.size-1080x1350.kind-device-showcase .device-cluster{transform:scale(.72);transform-origin:center top}.size-1080x1350.kind-device-showcase .device-phone{width:320px;height:605px}.size-1080x1350.kind-device-showcase .device-tablet{width:470px;height:610px}.size-1080x1350.kind-device-showcase .single-laptop{transform:scale(.66)}
    @media (min-width:1700px){.kind-tutorial .tutorial-copy h1.title-short{font-size:112px}.kind-tutorial .tutorial-copy h1.title-medium{font-size:102px}.kind-tutorial .tutorial-copy h1.title-long{font-size:92px}.kind-tutorial .tutorial-copy p{font-size:34px}.kind-tutorial .device-phone{width:430px;height:814px}.kind-tutorial .device-tablet{width:700px;height:900px}.kind-tutorial .single-laptop{transform:scale(1.1)}.kind-tutorial .art-footer{font-size:22px}.kind-device-showcase .showcase-copy h1.title-short{font-size:112px}.kind-device-showcase .showcase-copy h1.title-medium{font-size:102px}.kind-device-showcase .showcase-copy h1.title-long{font-size:90px}.kind-device-showcase .showcase-copy p{font-size:34px}.kind-device-showcase .device-cluster{transform:scale(1)}.kind-ending .ending-copy h1{font-size:96px}.kind-ending .ending-copy p{font-size:34px}}
  `;
}

export function renderArtworkDocument({ body, assets }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudiosBook Artwork</title><style>${baseStyles(assets)}</style></head><body>${body}</body></html>`;
}

export const artworkPalette = palette;
