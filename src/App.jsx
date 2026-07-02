import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Cloud,
  Copy,
  CreditCard,
  Crown,
  Database,
  Download,
  DollarSign,
  ExternalLink,
  FileText,
  Gem,
  HeartPulse,
  Hand,
  LifeBuoy,
  Lock,
  LogOut,
  MessageCircle,
  Paintbrush,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Scissors,
  Send,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

const Client = base44.entities.Client;
const ServiceRecord = base44.entities.ServiceRecord;
const Appointment = base44.entities.Appointment;
const StudioProfile = base44.entities.StudioProfile;
const BackupSnapshot = base44.entities.BackupSnapshot;
const BillingSubscription = base44.entities.BillingSubscription;

const PRODUCT_NAME = "StudiosBook";
const PRODUCT_COMPANY = "BlackVision";
const PRODUCT_PRICE = "R$ 26,90/mês";
const OFFICIAL_APP_URL = "https://studiosbook.com.br";
const SUPPORT_EMAIL = "getblackvision.br@gmail.com";
const SUPPORT_PHONE = "73981068594";
const WHATSAPP_DEFAULT = "";
const INSTALL_DISMISS_KEY = "studiosbook_install_dismissed_until";

const PROFESSIONAL_CATEGORIES = [
  {
    id: "lash_design",
    label: "Lash design",
    short: "Cílios",
    icon: Sparkles,
    defaultServices: [
      ["Efeito Shine", 120, 120, 20],
      ["Foxy Eyes", 155, 120, 20],
      ["Volume Power", 160, 120, 20],
      ["Volume Brasileiro", 130, 120, 20],
      ["Volume Egípcio", 140, 120, 20],
      ["Mega Brasileiro", 160, 120, 20],
      ["Volume Express", 90, 60, 0],
      ["Remoção de cílios", 40, 40, 0],
    ],
  },
  {
    id: "nails_design",
    label: "Nails design",
    short: "Unhas",
    icon: Paintbrush,
    defaultServices: [
      ["Manicure", 30, 60, 15],
      ["Pedicure", 35, 70, 15],
      ["Esmaltação em gel", 60, 90, 20],
      ["Banho de gel", 95, 120, 20],
      ["Alongamento em fibra", 140, 180, 20],
      ["Manutenção de alongamento", 95, 120, 20],
      ["Nail art", 25, 30, 0],
    ],
  },
  {
    id: "brow_design",
    label: "Design de sobrancelha",
    short: "Sobrancelhas",
    icon: Crown,
    defaultServices: [
      ["Design natural", 25, 30, 20],
      ["Design com henna", 40, 45, 20],
      ["Brow lamination", 110, 70, 30],
      ["Tintura de sobrancelhas", 50, 45, 25],
      ["Depilação de buço", 20, 20, 20],
      ["Revitalização de sobrancelhas", 80, 60, 30],
    ],
  },
  {
    id: "hairdresser",
    label: "Cabeleireira",
    short: "Cabelo",
    icon: Scissors,
    defaultServices: [
      ["Corte feminino", 70, 60, 45],
      ["Escova", 50, 60, 7],
      ["Hidratação", 90, 75, 30],
      ["Cronograma capilar", 140, 90, 30],
      ["Coloração", 180, 150, 45],
      ["Mechas", 350, 240, 60],
      ["Progressiva", 250, 180, 60],
      ["Penteado", 120, 90, 0],
    ],
  },
  {
    id: "massage_therapy",
    label: "Massoterapeuta",
    short: "Massagem",
    icon: Hand,
    defaultServices: [
      ["Massagem relaxante", 120, 60, 15],
      ["Drenagem linfática", 130, 60, 7],
      ["Massagem modeladora", 140, 60, 7],
      ["Ventosaterapia", 100, 45, 15],
      ["Reflexologia", 80, 40, 15],
      ["Massagem terapêutica", 150, 75, 15],
    ],
  },
];

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: Sparkles },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "schedule", label: "Agenda", icon: CalendarDays },
  { id: "service", label: "Atendimentos", icon: ShieldCheck },
  { id: "returns", label: "Retornos", icon: Bell },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "billing", label: "Assinatura", icon: CreditCard },
  { id: "security", label: "Segurança", icon: Lock },
  { id: "privacy", label: "Privacidade", icon: FileText },
  { id: "settings", label: "Configurações", icon: Settings },
];


const emptyClient = {
  full_name: "",
  whatsapp: "",
  instagram: "",
  status: "active",
  vip: false,
  preferred_category: "",
  preferred_service: "",
  allergies: "",
  notes: "",
};

const emptyService = {
  client_id: "",
  procedure_date: todayISO(),
  service_type: "other",
  service_category: "",
  service_name: "",
  effect: "",
  technique: "",
  curl: "",
  thickness: "",
  lengths: "",
  mapping_notes: "",
  adhesive: "",
  duration_minutes: "",
  maintenance_days: 20,
  retention_percent: "",
  amount: "",
  payment_status: "paid",
  next_maintenance_date: addDays(todayISO(), 20),
  notes: "",
  before_photo_url: "",
  after_photo_url: "",
};

const emptyAppointment = {
  client_id: "",
  client_name: "",
  appointment_date: todayISO(),
  appointment_time: "09:00",
  service_name: "",
  status: "scheduled",
  is_blocked: false,
  private_note: "",
};

function createServiceItem(categoryId, service, index = 0) {
  const [name, price, duration, maintenanceDays] = service;
  return {
    id: `${categoryId}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    category: categoryId,
    name,
    price,
    duration_minutes: duration,
    maintenance_days: maintenanceDays,
    active: true,
  };
}

function defaultServicesForCategories(categories = []) {
  return categories.flatMap((categoryId) => {
    const category = PROFESSIONAL_CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return [];
    return category.defaultServices.map((service, index) => createServiceItem(categoryId, service, index));
  });
}

function normalizeServices(services = [], categories = []) {
  const selected = new Set(categories);
  return (services || [])
    .filter((service) => service?.name)
    .map((service, index) => ({
      id: service.id || `custom-${index}-${Date.now()}`,
      category: selected.has(service.category) ? service.category : categories[0] || "lash_design",
      name: String(service.name || "").trim(),
      price: Number(service.price || 0),
      duration_minutes: Number(service.duration_minutes || 60),
      maintenance_days: Number(service.maintenance_days ?? 20),
      active: service.active !== false,
    }));
}

function createProfileForm(user) {
  const categories = ["lash_design"];
  return {
    business_name: "Meu Studio",
    owner_name: user?.full_name || "",
    whatsapp: "",
    user_email: user?.email || "",
    categories,
    services: defaultServicesForCategories(categories),
    notes: "",
  };
}

function normalizeProfile(profile, user) {
  if (!profile) return null;
  const categories = profile.categories?.length ? profile.categories : ["lash_design"];
  const services = profile.services?.length
    ? normalizeServices(profile.services, categories)
    : defaultServicesForCategories(categories);
  return {
    ...profile,
    business_name: profile.business_name || "Meu Studio",
    owner_name: profile.owner_name || user?.full_name || "",
    whatsapp: profile.whatsapp || "",
    user_email: profile.user_email || user?.email || "",
    categories,
    services,
  };
}

function categoryLabel(categoryId) {
  if (categoryId === "lash_extension") return "Lash design";
  if (categoryId === "face_care") return "Estética facial";
  if (categoryId === "maintenance") return "Manutenção";
  return PROFESSIONAL_CATEGORIES.find((category) => category.id === categoryId)?.label || "Outro";
}

function activeServicesFromProfile(profile) {
  const categories = profile?.categories?.length ? profile.categories : ["lash_design"];
  const services = profile?.services?.length ? profile.services : defaultServicesForCategories(categories);
  return normalizeServices(services, categories).filter((service) => service.active !== false);
}

function buildServiceFormFromService(service, clientId = "", procedureDate = todayISO()) {
  const maintenanceDays = Number(service?.maintenance_days ?? 20);
  return {
    ...emptyService,
    client_id: clientId,
    procedure_date: procedureDate,
    service_type: service?.category || "other",
    service_category: service?.category || "",
    service_name: service?.name || "",
    effect: service?.name || "",
    duration_minutes: service?.duration_minutes || "",
    maintenance_days: maintenanceDays,
    amount: service?.price ? String(service.price) : "",
    next_maintenance_date: maintenanceDays > 0 ? addDays(procedureDate, maintenanceDays) : "",
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end = todayISO()) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  return Math.round((endDate - startDate) / 86400000);
}

function daysUntil(dateString) {
  if (!dateString) return null;
  return daysBetween(todayISO(), dateString);
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isAppleMobile() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isMobileBrowser() {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent) || window.innerWidth < 768;
}

function shouldShowInstallBanner() {
  if (typeof window === "undefined") return false;
  const dismissedUntil = Number(window.localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
  return Date.now() > dismissedUntil && !isStandaloneApp();
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function cleanPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return WHATSAPP_DEFAULT;
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

function supportWhatsAppLink(message) {
  return `https://wa.me/${cleanPhone(SUPPORT_PHONE)}?text=${encodeURIComponent(message)}`;
}

function authErrorMessage(error) {
  const code = error?.code || "";
  const raw = error?.message || "";
  if (code.includes("configuration-not-found") || raw.includes("CONFIGURATION_NOT_FOUND")) {
    return "O login está temporariamente indisponível. Tente novamente ou fale com o suporte.";
  }
  if (code.includes("operation-not-allowed") || raw.includes("OPERATION_NOT_ALLOWED")) {
    return "O login está temporariamente indisponível. Tente novamente ou fale com o suporte.";
  }
  if (code.includes("unauthorized-domain")) {
    return "Não foi possível validar este acesso. Entre pelo endereço oficial studiosbook.com.br.";
  }
  return "Não foi possível entrar agora. Tente novamente ou fale com o suporte.";
}

function whatsappLink(client, message) {
  const phone = cleanPhone(client?.whatsapp);
  if (!phone) return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function billingStatusLabel(status) {
  const labels = {
    not_started: "Não iniciada",
    trialing: "Teste grátis",
    pending: "Pendente",
    authorized: "Autorizada",
    active: "Ativa",
    past_due: "Pagamento atrasado",
    unpaid: "Não paga",
    incomplete: "Pagamento incompleto",
    incomplete_expired: "Tentativa expirada",
    processing: "Processando",
    requires_action: "Ação necessária",
    paused: "Pausada",
    cancelled: "Cancelada",
    canceled: "Cancelada",
    expired: "Expirada",
    payment_failed: "Pagamento falhou",
    approved: "Aprovado",
    rejected: "Recusado",
    refunded: "Estornado",
    charged_back: "Contestado",
    setup_required: "Configuração necessária",
  };
  return labels[status] || status || "Não iniciada";
}

function billingStatusTone(status) {
  if (status === "authorized" || status === "active" || status === "trialing" || status === "approved") return "green";
  if (["pending", "processing", "requires_action", "incomplete"].includes(status)) return "amber";
  if (["cancelled", "canceled", "expired", "payment_failed", "rejected", "refunded", "charged_back", "past_due", "unpaid", "incomplete_expired"].includes(status)) return "red";
  if (status === "setup_required") return "violet";
  return "slate";
}

function hasBillingAccessNow(subscription, access, now = Date.now()) {
  if (!access) return true;
  const periodEnd = new Date(subscription?.current_period_end || 0).getTime();
  if (Number.isFinite(periodEnd) && periodEnd > now) return true;
  const trialEnd = new Date(subscription?.trial_end_date || 0).getTime();
  if (Number.isFinite(trialEnd) && trialEnd > now) return true;
  return access.allowed === true;
}

function downloadBlob(filename, content, type = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  return [
    headers.map((header) => csvValue(header.label)).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(header.value(row))).join(",")),
  ].join("\n");
}

function buildBackupPayload({ profile, clients, records, appointments }) {
  return {
    product: PRODUCT_NAME,
    exported_at: new Date().toISOString(),
    cloud_storage: "Dados principais salvos na nuvem por conta autenticada.",
    profile,
    clients,
    records,
    appointments,
  };
}

function exportClientsCsv(clients) {
  const csv = toCsv(
    [
      { label: "Nome", value: (client) => client.full_name },
      { label: "WhatsApp", value: (client) => client.whatsapp },
      { label: "Instagram", value: (client) => client.instagram },
      { label: "Status", value: (client) => statusLabel(client.status) },
      { label: "VIP", value: (client) => (client.vip ? "Sim" : "Não") },
      { label: "Serviço preferido", value: (client) => client.preferred_service },
      { label: "Último atendimento", value: (client) => client.last_service_date },
      { label: "Próximo retorno", value: (client) => client.next_maintenance_date },
      { label: "Observações", value: (client) => client.notes },
    ],
    clients
  );
  downloadBlob(`studiosbook-clientes-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
}

function exportAppointmentsCsv(appointments) {
  const csv = toCsv(
    [
      { label: "Data", value: (appointment) => appointment.appointment_date },
      { label: "Hora", value: (appointment) => appointment.appointment_time },
      { label: "Cliente", value: (appointment) => appointment.client_name },
      { label: "Serviço", value: (appointment) => appointment.service_name },
      { label: "Status", value: (appointment) => statusLabel(appointment.status) },
      { label: "Nota privada", value: (appointment) => appointment.private_note },
    ],
    appointments
  );
  downloadBlob(`studiosbook-agenda-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
}

function exportFullBackupJson(payload) {
  downloadBlob(
    `studiosbook-backup-completo-${todayISO()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );
}

function exportMonthlySafetyPdf({ profile, clients, records, appointments, backupSnapshots }) {
  const month = todayISO().slice(0, 7);
  const monthRecords = records.filter((record) => String(record.procedure_date || "").startsWith(month));
  const monthAppointments = appointments.filter((appointment) => String(appointment.appointment_date || "").startsWith(month));
  const revenue = monthRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const lastSnapshot = backupSnapshots?.[0];
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 210, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${PRODUCT_NAME} - Modo Segurança`, 16, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Resumo mensal para conferência e backup local", 16, 25);

  doc.setTextColor(24, 24, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(profile?.business_name || "Studio", 16, 52);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 64;
  y = addPdfLine(doc, "Mês", month, y);
  y = addPdfLine(doc, "Clientes cadastrados", clients.length, y);
  y = addPdfLine(doc, "Atendimentos do mês", monthRecords.length, y);
  y = addPdfLine(doc, "Horários do mês", monthAppointments.length, y);
  y = addPdfLine(doc, "Faturamento registrado", money(revenue), y);
  y = addPdfLine(doc, "Último snapshot em nuvem", lastSnapshot?.snapshot_date ? new Date(lastSnapshot.snapshot_date).toLocaleString("pt-BR") : "Ainda não criado", y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Garantia operacional", 16, y + 8);
  y += 18;
  doc.setFont("helvetica", "normal");
  const info = [
    "Os dados principais ficam salvos na nuvem do StudiosBook por conta autenticada.",
    "O modo segurança permite baixar CSV/JSON/PDF para uma cópia local.",
    "Use o backup mensal antes de fechar o mês ou antes de migrar a agenda completa.",
  ];
  info.forEach((line) => {
    const lines = doc.splitTextToSize(line, 176);
    doc.text(lines, 16, y);
    y += lines.length * 6 + 3;
  });

  doc.setTextColor(113, 113, 122);
  doc.setFontSize(8);
  doc.text(`Gerado pelo ${PRODUCT_NAME} by ${PRODUCT_COMPANY}.`, 16, 285);
  doc.save(`studiosbook-modo-seguranca-${month}.pdf`);
}

function safeFileName(value) {
  return String(value || "procedimento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function addPdfLine(doc, label, value, y) {
  if (!value && value !== 0) return y;
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, 16, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(String(value), 130);
  doc.text(lines, 58, y);
  return y + Math.max(lines.length, 1) * 7;
}

function buildProcedurePdf(record, client, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const studioName = profile?.business_name || PRODUCT_NAME;
  const serviceName = record.service_name || record.effect || record.service_type || "Procedimento";
  const category = record.service_category || record.service_type;

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(studioName, 16, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Resumo profissional do procedimento", 16, 24);

  doc.setTextColor(24, 24, 27);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do atendimento", 16, 48);

  doc.setFontSize(10);
  let y = 60;
  y = addPdfLine(doc, "Cliente", client?.full_name || record.client_name, y);
  y = addPdfLine(doc, "WhatsApp", client?.whatsapp, y);
  y = addPdfLine(doc, "Data", formatDate(record.procedure_date), y);
  y = addPdfLine(doc, "Categoria", categoryLabel(category), y);
  y = addPdfLine(doc, "Serviço", serviceName, y);
  y = addPdfLine(doc, "Técnica", record.technique, y);
  y = addPdfLine(doc, "Produto usado", record.adhesive, y);
  y = addPdfLine(doc, "Duração", record.duration_minutes ? `${record.duration_minutes} minutos` : "", y);
  y = addPdfLine(doc, "Valor", record.amount ? money(record.amount) : "", y);
  y = addPdfLine(doc, "Pagamento", statusLabel(record.payment_status), y);
  y = addPdfLine(doc, "Próximo retorno", formatDate(record.next_maintenance_date), y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Ficha técnica", 16, y + 8);
  y += 20;
  doc.setFontSize(10);
  y = addPdfLine(doc, "Curvatura", record.curl, y);
  y = addPdfLine(doc, "Espessura", record.thickness, y);
  y = addPdfLine(doc, "Tamanhos / numeração", record.lengths, y);
  y = addPdfLine(doc, "Mapeamento", record.mapping_notes, y);
  y = addPdfLine(doc, "Retenção", record.retention_percent ? `${record.retention_percent}%` : "", y);
  y = addPdfLine(doc, "Observações", record.notes, y);

  doc.setTextColor(113, 113, 122);
  doc.setFontSize(8);
  doc.text(`Gerado pelo ${PRODUCT_NAME} by ${PRODUCT_COMPANY}.`, 16, 285);

  return doc;
}

async function exportProcedurePdf(record, client, profile, mode = "download") {
  const doc = buildProcedurePdf(record, client, profile);
  const serviceName = record.service_name || record.effect || "procedimento";
  const filename = `${safeFileName(client?.full_name || record.client_name)}-${safeFileName(serviceName)}.pdf`;

  if (mode === "share") {
    const blob = doc.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "Procedimento em PDF",
        text: "Resumo profissional do procedimento concluído.",
        files: [file],
      });
      return "shared";
    }
    doc.save(filename);
    const message = `Oi, ${String(client?.full_name || "cliente").split(" ")[0]}! Gerei o resumo do seu procedimento em PDF. Vou te enviar o arquivo por aqui.`;
    window.open(whatsappLink(client, message), "_blank", "noopener,noreferrer");
    return "downloaded";
  }

  doc.save(filename);
  return "downloaded";
}

function statusLabel(status) {
  const labels = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    completed: "Atendido",
    cancelled: "Cancelado",
    no_show: "Faltou",
    blocked: "Bloqueado",
    active: "Ativa",
    attention: "Atenção",
    inactive: "Inativa",
    paid: "Pago",
    pending: "Pendente",
    partial: "Parcial",
  };
  return labels[status] || status || "-";
}

function maintenanceTone(dateString) {
  const diff = daysUntil(dateString);
  if (diff === null) return "slate";
  if (diff < 0) return "red";
  if (diff === 0) return "amber";
  if (diff <= 7) return "rose";
  return "green";
}

function maintenanceText(dateString) {
  const diff = daysUntil(dateString);
  if (diff === null) return "Sem data";
  if (diff < 0) return `${Math.abs(diff)} dia(s) atrasada`;
  if (diff === 0) return "Vence hoje";
  if (diff <= 7) return `Em ${diff} dia(s)`;
  return `Em ${diff} dia(s)`;
}

function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`grid min-w-0 max-w-full gap-1.5 text-sm font-semibold text-zinc-700 ${className}`}>
      <span className="break-words">{label}</span>
      {children}
      {hint && <span className="break-words text-xs font-medium text-zinc-400">{hint}</span>}
    </label>
  );
}

function Select({ className = "", ...props }) {
  return (
    <select
      className={`h-11 w-full min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${className}`}
      {...props}
    />
  );
}

function TextArea({ className = "", ...props }) {
  return (
    <textarea
      className={`min-h-24 w-full min-w-0 max-w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${className}`}
      {...props}
    />
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-zinc-100 text-zinc-700",
    rose: "bg-rose-100 text-rose-800",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    gold: "bg-[#f4ead6] text-[#9a6b24]",
    dark: "bg-zinc-950 text-white",
    violet: "bg-violet-100 text-violet-800",
  };

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center rounded-full px-3 py-1 text-center text-xs font-black leading-tight ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Panel({ children, className = "" }) {
  return (
    <section className={`min-w-0 max-w-full overflow-hidden rounded-[1.25rem] border border-white/70 bg-white p-4 shadow-[0_18px_50px_rgba(24,24,27,0.07)] sm:rounded-[1.75rem] sm:bg-white/88 sm:p-5 sm:backdrop-blur ${className}`}>
      {children}
    </section>
  );
}

function StatCard({ label, value, helper, icon: Icon, tone = "rose" }) {
  const colors = {
    rose: "from-rose-50 to-white text-rose-700",
    dark: "from-zinc-950 to-zinc-800 text-white",
    gold: "from-[#fbf4e8] to-white text-[#9a6b24]",
    violet: "from-violet-50 to-white text-violet-700",
    green: "from-emerald-50 to-white text-emerald-700",
  };

  return (
    <div className={`min-w-0 rounded-[1.25rem] border border-white bg-gradient-to-br p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5 ${colors[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-sm font-bold ${tone === "dark" ? "text-white/70" : "text-zinc-500"}`}>
            {label}
          </p>
          <p className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{value}</p>
          {helper && (
            <p className={`mt-1 text-xs font-medium ${tone === "dark" ? "text-white/60" : "text-zinc-500"}`}>
              {helper}
            </p>
          )}
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === "dark" ? "bg-white/12" : "bg-white"}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function EmptyState({ text, action }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-zinc-50/80 p-6 text-center">
      <p className="text-sm font-semibold text-zinc-500">{text}</p>
      {action}
    </div>
  );
}

function BrandLockup({ size = "compact", tone = "dark", heading = false, subtitle = "" }) {
  const sizes = {
    compact: { mark: "h-9 w-9", text: "text-xl", gap: "gap-2.5" },
    header: { mark: "h-10 w-10", text: "text-xl sm:text-2xl", gap: "gap-3" },
    hero: { mark: "h-12 w-12 sm:h-20 sm:w-20", text: "text-3xl sm:text-6xl", gap: "gap-3 sm:gap-5" },
  };
  const current = sizes[size] || sizes.compact;
  const TextTag = heading ? "h1" : "span";
  const markSrc = tone === "light" ? "/brand/studiosbook-mark-reversed.svg" : "/brand/studiosbook-mark.svg";

  return (
    <div className={`inline-flex min-w-0 items-center ${current.gap}`} aria-label={PRODUCT_NAME}>
      <img src={markSrc} alt="" className={`${current.mark} shrink-0`} />
      <div className="min-w-0 max-w-full">
        <TextTag className={`${current.text} block whitespace-nowrap font-bold leading-none tracking-normal ${tone === "light" ? "text-[#fff9fa]" : "text-[#171417]"}`}>
          Studios<span className={`font-medium ${tone === "light" ? "text-[#f2b7c7]" : "text-[#a84d68]"}`}>Book</span>
        </TextTag>
        {subtitle && (
          <span className={`mt-1 block text-xs font-semibold tracking-normal ${tone === "light" ? "text-white/55" : "text-zinc-500"}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [backupSnapshots, setBackupSnapshots] = useState([]);
  const [billingSubscription, setBillingSubscription] = useState(null);
  const [billingAccess, setBillingAccess] = useState(null);
  const [pixPayment, setPixPayment] = useState(null);
  const [billingCapabilities, setBillingCapabilities] = useState({ card_recurring: true, pix: false });
  const [profileForm, setProfileForm] = useState(() => createProfileForm(null));
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [returnFilter, setReturnFilter] = useState("all");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientForm, setClientForm] = useState(emptyClient);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [actionLoading, setActionLoading] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIosInstall, setIsIosInstall] = useState(false);
  const [billingClock, setBillingClock] = useState(Date.now());

  const showFeedback = (message, type = "success") => {
    setFeedbackType(type);
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 4200);
  };

  const getErrorMessage = (error) =>
    error?.data?.message ||
    error?.message ||
    "Não foi possível salvar. Verifique os campos e tente novamente.";

  const loadAuth = async () => {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      if (!authenticated) {
        const redirectError = base44.auth.getLastRedirectError?.();
        if (redirectError) showFeedback(authErrorMessage(redirectError), "error");
        setUser(null);
        return;
      }
      setUser(await base44.auth.me());
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      let ensuredBilling = null;
      try {
        ensuredBilling = await base44.functions.invoke("ensure-billing-account", {});
      } catch (billingError) {
        console.error("Billing bootstrap error", billingError);
      }
      const [clientData, recordData, appointmentData, profileData, snapshotData, billingData] = await Promise.all([
        Client.list("-updated_date", 500),
        ServiceRecord.list("-procedure_date", 500),
        Appointment.list("appointment_date", 500),
        StudioProfile.list("-updated_date", 20),
        BackupSnapshot.list("-snapshot_date", 20),
        BillingSubscription.list("-updated_date", 5),
      ]);
      const normalizedProfile = normalizeProfile(profileData?.[0], user);
      setClients(clientData || []);
      setRecords(recordData || []);
      setAppointments(appointmentData || []);
      setBackupSnapshots(snapshotData || []);
      setBillingSubscription(ensuredBilling?.subscription || billingData?.[0] || null);
      setBillingAccess(ensuredBilling?.access || null);
      setPixPayment(ensuredBilling?.latest_payment || null);
      setBillingCapabilities(ensuredBilling?.payment_capabilities || { card_recurring: true, pix: false });
      setProfile(normalizedProfile);
      setProfileForm(normalizedProfile || createProfileForm(user));
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao carregar dados: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    document.title = profile?.business_name
      ? `${profile.business_name} | ${PRODUCT_NAME}`
      : PRODUCT_NAME;
  }, [profile?.business_name]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch((error) => console.error("Service worker error", error));
    }

    if (!shouldShowInstallBanner()) return;

    const appleMobile = isAppleMobile();
    if (appleMobile) {
      window.setTimeout(() => {
        if (shouldShowInstallBanner()) {
          setIsIosInstall(true);
          setShowInstallPrompt(true);
        }
      }, 1500);
    }

    const fallbackTimer = window.setTimeout(() => {
      if (!appleMobile && isMobileBrowser() && shouldShowInstallBanner()) {
        setShowInstallPrompt(true);
      }
    }, 3500);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setIsIosInstall(false);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setShowInstallPrompt(false);
      window.localStorage.removeItem(INSTALL_DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setBillingClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const billingLocked = !hasBillingAccessNow(billingSubscription, billingAccess, billingClock);

  useEffect(() => {
    if (billingLocked && !["billing", "security", "privacy"].includes(activeTab)) {
      setActiveTab("billing");
    }
  }, [activeTab, billingLocked]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled") {
      setActiveTab("billing");
      window.history.replaceState({}, "", window.location.pathname);
      showFeedback("Pagamento cancelado. Nenhuma cobrança foi realizada.", "error");
      return;
    }
    if (params.get("checkout") === "stripe" && params.has("session_id")) {
      const sessionId = params.get("session_id");
      setActiveTab("billing");
      window.history.replaceState({}, "", window.location.pathname);
      setActionLoading("billing-refresh");
      base44.functions
        .invoke("sync-billing-status", { session_id: sessionId })
        .then((result) => {
          setBillingSubscription(result?.subscription || null);
          setBillingAccess(result?.access || null);
          setPixPayment(result?.payment || result?.latest_payment || null);
          setBillingCapabilities(result?.payment_capabilities || { card_recurring: true, pix: false });
          const status = result?.subscription?.status;
          if (["trialing", "active"].includes(status)) {
            showFeedback("Cobrança confirmada com segurança pela Stripe.");
          } else if (["cancelled", "canceled", "payment_failed", "rejected", "past_due"].includes(status)) {
            showFeedback(
              "Pagamento não aprovado. Atualize o método de pagamento ou use Pix.",
              "error"
            );
          } else {
            showFeedback("Pagamento em processamento. O status será atualizado automaticamente pela Stripe.");
          }
        })
        .catch((error) => {
          console.error("Billing return sync error", error);
          showFeedback("Não foi possível confirmar o pagamento agora. Use Atualizar status.", "error");
        })
        .finally(() => setActionLoading(""));
    }
  }, [user]);

  const serviceCatalog = useMemo(() => activeServicesFromProfile(profile), [profile]);

  const serviceNames = useMemo(
    () => serviceCatalog.map((service) => service.name).filter(Boolean),
    [serviceCatalog]
  );

  const primaryService = serviceCatalog[0];

  const backupPayload = useMemo(
    () => buildBackupPayload({ profile, clients, records, appointments }),
    [profile, clients, records, appointments]
  );

  useEffect(() => {
    if (!primaryService) return;
    setClientForm((current) => ({
      ...current,
      preferred_category: current.preferred_category || primaryService.category,
      preferred_service: current.preferred_service || primaryService.name,
    }));
    setServiceForm((current) => {
      if (current.effect || current.service_name) return current;
      return buildServiceFormFromService(primaryService, current.client_id || selectedClientId);
    });
    setAppointmentForm((current) => ({
      ...current,
      service_name: current.service_name || primaryService.name,
    }));
  }, [primaryService, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) return;
    setServiceForm((current) => ({ ...current, client_id: selectedClientId }));
    setAppointmentForm((current) => ({ ...current, client_id: selectedClientId }));
  }, [selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId),
    [clients, selectedClientId]
  );

  const latestRecordByClient = useMemo(() => {
    const map = new Map();
    [...records]
      .sort((a, b) => String(b.procedure_date).localeCompare(String(a.procedure_date)))
      .forEach((record) => {
        if (!map.has(record.client_id)) map.set(record.client_id, record);
      });
    return map;
  }, [records]);

  const returnItems = useMemo(() => {
    return clients
      .map((client) => {
        const record = latestRecordByClient.get(client.id);
        const dueDate = client.next_maintenance_date || record?.next_maintenance_date;
        return {
          client,
          record,
          dueDate,
          days: dueDate ? daysUntil(dueDate) : null,
          contacted: !!client.last_whatsapp_contact_date,
        };
      })
      .filter((item) => item.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  }, [clients, latestRecordByClient]);

  const filteredClients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return clients
      .filter((client) => {
        if (!query) return true;
        return [client.full_name, client.whatsapp, client.instagram]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .filter((client) => {
        const due = client.next_maintenance_date;
        const diff = due ? daysUntil(due) : null;
        if (clientFilter === "vip") return client.vip;
        if (clientFilter === "upcoming") return diff !== null && diff >= 0 && diff <= 7;
        if (clientFilter === "late") return diff !== null && diff < 0;
        if (clientFilter === "inactive") return client.status === "inactive";
        return true;
      });
  }, [clients, clientFilter, searchTerm]);

  const filteredReturns = useMemo(() => {
    return returnItems.filter((item) => {
      if (returnFilter === "today") return item.days === 0;
      if (returnFilter === "next7") return item.days !== null && item.days >= 0 && item.days <= 7;
      if (returnFilter === "late") return item.days !== null && item.days < 0;
      if (returnFilter === "vip") return item.client.vip;
      if (returnFilter === "called") return item.contacted;
      return true;
    });
  }, [returnItems, returnFilter]);

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((item) => item.appointment_date === todayISO())
        .sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time))),
    [appointments]
  );

  const monthRecords = useMemo(() => {
    const month = todayISO().slice(0, 7);
    return records.filter((record) => String(record.procedure_date || "").startsWith(month));
  }, [records]);

  const reports = useMemo(() => {
    const revenue = monthRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const avgTicket = monthRecords.length ? revenue / monthRecords.length : 0;
    const repeatedClients = clients.filter((client) => records.filter((record) => record.client_id === client.id).length > 1);
    const serviceMap = new Map();
    records.forEach((record) => {
      const key = record.service_name || record.effect || record.service_type || "Serviço";
      serviceMap.set(key, (serviceMap.get(key) || 0) + 1);
    });
    const topServices = [...serviceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      revenue,
      avgTicket,
      attendances: monthRecords.length,
      vipClients: clients.filter((client) => client.vip).length,
      returnRate: clients.length ? Math.round((repeatedClients.length / clients.length) * 100) : 0,
      topServices,
      opportunities: returnItems.filter((item) => item.days !== null && item.days <= 7).length,
    };
  }, [clients, monthRecords, records, returnItems]);

  const metrics = useMemo(() => {
    const activeClients = clients.filter((client) => client.status !== "inactive").length;
    const lateClients = returnItems.filter((item) => item.days !== null && item.days < 0).length;
    const next7 = returnItems.filter((item) => item.days !== null && item.days >= 0 && item.days <= 7).length;
    return {
      activeClients,
      vipClients: clients.filter((client) => client.vip).length,
      lateClients,
      next7,
      todayAppointments: todayAppointments.length,
      monthRevenue: reports.revenue,
    };
  }, [clients, reports.revenue, returnItems, todayAppointments]);

  const handleLogin = async () => {
    setActionLoading("login");
    try {
      const loggedUser = await base44.auth.loginWithProvider("google", window.location.href);
      if (loggedUser) {
        setUser(loggedUser);
        return;
      }
      if (await base44.auth.isAuthenticated()) {
        setUser(await base44.auth.me());
      }
    } catch (error) {
      console.error(error);
      showFeedback(authErrorMessage(error), "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleLogout = () => {
    base44.auth.logout(window.location.origin);
  };

  const updateProfileCategories = (categories) => {
    setProfileForm((current) => {
      const selected = categories.length ? categories : current.categories;
      const retained = (current.services || []).filter((service) => selected.includes(service.category));
      const defaults = defaultServicesForCategories(selected);
      const merged = [...retained];
      defaults.forEach((service) => {
        const exists = merged.some(
          (item) =>
            item.category === service.category &&
            String(item.name || "").trim().toLowerCase() === service.name.toLowerCase()
        );
        if (!exists) merged.push(service);
      });
      return { ...current, categories: selected, services: merged };
    });
  };

  const updateProfileService = (serviceId, patch) => {
    setProfileForm((current) => ({
      ...current,
      services: (current.services || []).map((service) =>
        service.id === serviceId ? { ...service, ...patch } : service
      ),
    }));
  };

  const addProfileService = () => {
    setProfileForm((current) => {
      const category = current.categories?.[0] || "lash_design";
      return {
        ...current,
        services: [
          ...(current.services || []),
          {
            id: `custom-${Date.now()}`,
            category,
            name: "Novo serviço",
            price: 0,
            duration_minutes: 60,
            maintenance_days: 20,
            active: true,
          },
        ],
      };
    });
  };

  const removeProfileService = (serviceId) => {
    setProfileForm((current) => ({
      ...current,
      services: (current.services || []).filter((service) => service.id !== serviceId),
    }));
  };

  const saveStudioProfile = async (event) => {
    event.preventDefault();
    if (!profileForm.business_name.trim()) {
      return showFeedback("Informe o nome do studio ou profissional.", "error");
    }
    if (!profileForm.categories?.length) {
      return showFeedback("Escolha pelo menos uma área de atuação.", "error");
    }
    const services = normalizeServices(profileForm.services, profileForm.categories);
    if (!services.length) {
      return showFeedback("Mantenha pelo menos um serviço no catálogo.", "error");
    }

    setActionLoading("profile");
    try {
      const payload = {
        business_name: profileForm.business_name.trim(),
        owner_name: profileForm.owner_name?.trim() || user?.full_name || "",
        whatsapp: profileForm.whatsapp || "",
        user_email: user?.email || profileForm.user_email || "",
        categories: profileForm.categories,
        services,
        notes: profileForm.notes || "",
      };
      const saved = profile?.id
        ? await StudioProfile.update(profile.id, payload)
        : await StudioProfile.create(payload);
      const normalized = normalizeProfile({ ...profile, ...payload, id: saved?.id || profile?.id }, user);
      setProfile(normalized);
      setProfileForm(normalized);
      showFeedback(`Configuração salva. O ${PRODUCT_NAME} foi ajustado para esse perfil.`);
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao salvar configuração: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleDownloadProcedurePdf = async (record, clientOverride) => {
    try {
      const client = clientOverride || clients.find((item) => item.id === record.client_id);
      await exportProcedurePdf(record, client, profile, "download");
      showFeedback("PDF do procedimento gerado.");
    } catch (error) {
      console.error(error);
      showFeedback("Não foi possível gerar o PDF desse procedimento.", "error");
    }
  };

  const handleShareProcedurePdf = async (record, clientOverride) => {
    try {
      const client = clientOverride || clients.find((item) => item.id === record.client_id);
      await exportProcedurePdf(record, client, profile, "share");
      showFeedback("PDF preparado para envio.");
    } catch (error) {
      console.error(error);
      showFeedback("Não foi possível preparar o envio do PDF.", "error");
    }
  };

  const handleExportClientsCsv = () => {
    exportClientsCsv(clients);
    showFeedback("Arquivo CSV de clientes baixado.");
  };

  const handleExportAppointmentsCsv = () => {
    exportAppointmentsCsv(appointments);
    showFeedback("Arquivo CSV da agenda baixado.");
  };

  const handleExportFullBackup = () => {
    exportFullBackupJson(backupPayload);
    showFeedback("Backup completo em JSON baixado.");
  };

  const handleExportMonthlySafetyPdf = () => {
    exportMonthlySafetyPdf({ profile, clients, records, appointments, backupSnapshots });
    showFeedback("PDF mensal do modo segurança gerado.");
  };

  const handleCreateCloudSnapshot = async () => {
    setActionLoading("cloud-backup");
    try {
      await BackupSnapshot.create({
        snapshot_date: new Date().toISOString(),
        backup_type: "safety",
        clients_count: clients.length,
        appointments_count: appointments.length,
        records_count: records.length,
        data: backupPayload,
        notes: "Snapshot criado manualmente no modo segurança.",
      });
      await loadData();
      showFeedback("Snapshot salvo na nuvem com sucesso.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao salvar snapshot na nuvem: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  const startSubscriptionCheckout = async () => {
    setActionLoading("billing-card");
    try {
      const result = await base44.functions.invoke("create-subscription-checkout", {
        app_url: window.location.origin,
      });
      if (!result?.url) throw new Error("A Stripe não retornou o endereço do checkout.");
      window.location.assign(result.url);
      return result;
    } catch (error) {
      console.error(error);
      const missingSecret = error?.data?.missing_secret || error?.missing_secret;
      const message = missingSecret
        ? "Pagamento temporariamente indisponível. Fale com o suporte."
        : getErrorMessage(error);
      showFeedback(message, "error");
      throw error;
    } finally {
      setActionLoading("");
    }
  };

  const createPixPayment = async () => {
    setActionLoading("billing-pix");
    try {
      const result = await base44.functions.invoke("create-pix-payment", { app_url: window.location.origin });
      if (!result?.url) throw new Error("A Stripe não retornou o endereço do Pix.");
      window.location.assign(result.url);
      return result;
    } catch (error) {
      console.error(error);
      const missingSecret = error?.data?.missing_secret || error?.missing_secret;
      const message = missingSecret
        ? "Pix temporariamente indisponível. Fale com o suporte."
        : `Erro ao gerar Pix: ${getErrorMessage(error)}`;
      showFeedback(message, "error");
      return null;
    } finally {
      setActionLoading("");
    }
  };

  const openBillingPortal = async () => {
    setActionLoading("billing-portal");
    try {
      const result = await base44.functions.invoke("create-billing-portal", { app_url: window.location.origin });
      if (!result?.url) throw new Error("A Stripe não retornou o portal de cobrança.");
      window.location.assign(result.url);
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao abrir cobrança: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  const refreshBillingStatus = async () => {
    setActionLoading("billing-refresh");
    try {
      const result = await base44.functions.invoke("sync-billing-status", {});
      setBillingSubscription(result?.subscription || billingSubscription);
      setBillingAccess(result?.access || billingAccess);
      setPixPayment(result?.payment || result?.latest_payment || pixPayment);
      setBillingCapabilities(result?.payment_capabilities || billingCapabilities);
      showFeedback("Status do pagamento atualizado.");
    } catch (error) {
      console.error(error);
      const missingSecret = error?.data?.missing_secret || error?.missing_secret;
      const message = missingSecret
        ? "Não foi possível atualizar o pagamento agora. Tente novamente em instantes."
        : `Erro ao atualizar assinatura: ${getErrorMessage(error)}`;
      showFeedback(message, "error");
    } finally {
      setActionLoading("");
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstallPrompt(false);
  };

  const dismissInstallPrompt = () => {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + 1000 * 60 * 60 * 24 * 7));
    setShowInstallPrompt(false);
  };

  const installPromptNode = (
    <InstallAppPrompt
      show={showInstallPrompt && !billingLocked && activeTab !== "billing"}
      canInstall={Boolean(installPrompt)}
      isIosInstall={isIosInstall}
      onInstall={installApp}
      onDismiss={dismissInstallPrompt}
    />
  );

  const createClient = async (event) => {
    event.preventDefault();
    if (!clientForm.full_name.trim()) return showFeedback("Informe o nome completo da cliente.", "error");
    setActionLoading("client");
    try {
      const created = await Client.create({
        ...clientForm,
        full_name: clientForm.full_name.trim(),
      });
      setClientForm(emptyClient);
      setSelectedClientId(created.id);
      setActiveTab("clients");
      await loadData();
      showFeedback("Cliente cadastrada com sucesso.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao cadastrar cliente: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  const updateClientStatus = async (client, status) => {
    try {
      await Client.update(client.id, { status });
      await loadData();
      showFeedback("Status da cliente atualizado.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao atualizar cliente: ${getErrorMessage(error)}`, "error");
    }
  };

  const createServiceRecord = async (event) => {
    event.preventDefault();
    const client = clients.find((item) => item.id === serviceForm.client_id);
    if (!client) return showFeedback("Selecione uma cliente para salvar.", "error");
    setActionLoading("service");
    try {
      const selectedService = serviceCatalog.find((service) => service.name === serviceForm.effect);
      const maintenanceDays = Number(
        serviceForm.maintenance_days || selectedService?.maintenance_days || 20
      );
      const nextMaintenance =
        serviceForm.next_maintenance_date ||
        (maintenanceDays > 0 ? addDays(serviceForm.procedure_date, maintenanceDays) : "");
      await ServiceRecord.create({
        ...serviceForm,
        client_name: client.full_name,
        service_type: serviceForm.service_category || selectedService?.category || serviceForm.service_type || "other",
        service_category: serviceForm.service_category || selectedService?.category || "other",
        service_name: serviceForm.service_name || serviceForm.effect || selectedService?.name || "Serviço",
        effect: serviceForm.effect || selectedService?.name || "",
        duration_minutes: serviceForm.duration_minutes
          ? Number(serviceForm.duration_minutes)
          : selectedService?.duration_minutes,
        maintenance_days: maintenanceDays,
        amount: Number(serviceForm.amount || 0),
        retention_percent: serviceForm.retention_percent
          ? Number(serviceForm.retention_percent)
          : undefined,
        next_maintenance_date: nextMaintenance,
      });
      await Client.update(client.id, {
        last_service_date: serviceForm.procedure_date,
        next_maintenance_date: nextMaintenance,
        preferred_service: serviceForm.effect || client.preferred_service,
        preferred_category: serviceForm.service_category || selectedService?.category || client.preferred_category,
        status: "active",
      });
      setServiceForm(buildServiceFormFromService(primaryService, client.id));
      await loadData();
      showFeedback("Atendimento salvo e retorno calculado.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao salvar atendimento: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  const createAppointment = async (event) => {
    event.preventDefault();
    const client = clients.find((item) => item.id === appointmentForm.client_id);
    setActionLoading("appointment");
    try {
      await Appointment.create({
        ...appointmentForm,
        client_name: appointmentForm.is_blocked
          ? appointmentForm.client_name || "Horário bloqueado"
          : client?.full_name || appointmentForm.client_name || "Sem cliente",
        service_name: appointmentForm.service_name || primaryService?.name || "Atendimento",
        status: appointmentForm.is_blocked ? "blocked" : appointmentForm.status,
      });
      setAppointmentForm({ ...emptyAppointment, service_name: primaryService?.name || "Atendimento" });
      await loadData();
      showFeedback("Horário salvo na agenda privada.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao salvar horário: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  const updateAppointmentStatus = async (appointment, status) => {
    try {
      await Appointment.update(appointment.id, {
        status,
        is_blocked: status === "blocked" ? true : appointment.is_blocked,
      });
      await loadData();
      showFeedback("Horário atualizado.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao atualizar horário: ${getErrorMessage(error)}`, "error");
    }
  };

  const sendReminder = async (client, record) => {
    const firstName = String(client.full_name || "mana").split(" ")[0];
    const message = `Oi, ${firstName}! Tudo bem? Passando para lembrar que já está chegando o período ideal para sua manutenção. Quer que eu veja um horário disponível para você?`;
    window.open(whatsappLink(client, message), "_blank", "noopener,noreferrer");
    try {
      await Client.update(client.id, {
        last_whatsapp_contact_date: todayISO(),
        last_whatsapp_message: message,
      });
      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const seedExample = async () => {
    setActionLoading("seed");
    try {
      const service = primaryService || defaultServicesForCategories(["lash_design"])[0];
      const maintenanceDays = Number(service?.maintenance_days ?? 20);
      const procedureDate = addDays(todayISO(), maintenanceDays > 0 ? -(maintenanceDays + 1) : -21);
      const maintenanceDate = maintenanceDays > 0 ? addDays(procedureDate, maintenanceDays) : "";
      const createdClient = await Client.create({
        full_name: "Cliente Exemplo",
        whatsapp: WHATSAPP_DEFAULT,
        instagram: "@cliente.exemplo",
        status: "active",
        vip: true,
        preferred_category: service.category,
        preferred_service: service.name,
        allergies: "Sem alergias registradas",
        notes: "Cliente usada para testar o fluxo do MVP.",
        last_service_date: procedureDate,
        next_maintenance_date: maintenanceDate,
      });
      await ServiceRecord.create({
        client_id: createdClient.id,
        client_name: createdClient.full_name,
        procedure_date: procedureDate,
        service_type: service.category,
        service_category: service.category,
        service_name: service.name,
        effect: service.name,
        technique: "Técnica padrão do studio",
        curl: "",
        thickness: "",
        lengths: "",
        mapping_notes: "Exemplo para demonstrar ficha técnica e retorno.",
        adhesive: "Produto padrão",
        duration_minutes: service.duration_minutes,
        maintenance_days: maintenanceDays,
        retention_percent: 55,
        amount: service.price || 0,
        payment_status: "paid",
        next_maintenance_date: maintenanceDate,
        notes: "Exemplo para demonstrar retorno em atraso.",
      });
      await Appointment.create({
        client_id: createdClient.id,
        client_name: createdClient.full_name,
        appointment_date: todayISO(),
        appointment_time: "14:00",
        service_name: service.name,
        status: "scheduled",
        is_blocked: false,
        private_note: "Teste de horário do MVP.",
      });
      setSelectedClientId(createdClient.id);
      await loadData();
      showFeedback("Dados de exemplo criados.");
    } catch (error) {
      console.error(error);
      showFeedback(`Erro ao criar exemplo: ${getErrorMessage(error)}`, "error");
    } finally {
      setActionLoading("");
    }
  };

  if (authLoading) {
    return (
      <>
        <LoadingScreen />
        {installPromptNode}
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen
          onLogin={handleLogin}
          feedback={feedback}
          feedbackType={feedbackType}
          actionLoading={actionLoading}
        />
        {installPromptNode}
      </>
    );
  }

  if (!isLoading && billingLocked && !profile) {
    return (
      <BillingAccessScreen
        user={user}
        billingSubscription={billingSubscription}
        billingAccess={billingAccess}
        pixPayment={pixPayment}
        billingCapabilities={billingCapabilities}
        onStartSubscription={startSubscriptionCheckout}
        onCreatePix={createPixPayment}
        onManageBilling={openBillingPortal}
        onRefreshStatus={refreshBillingStatus}
        onLogout={handleLogout}
        actionLoading={actionLoading}
        feedback={feedback}
        feedbackType={feedbackType}
      />
    );
  }

  if (!isLoading && !profile) {
    return (
      <div className="min-h-dvh bg-[#f6f1ef] text-zinc-950">
        <OnboardingScreen
          user={user}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          updateProfileCategories={updateProfileCategories}
          updateProfileService={updateProfileService}
          addProfileService={addProfileService}
          removeProfileService={removeProfileService}
          onSave={saveStudioProfile}
          actionLoading={actionLoading}
          feedback={feedback}
          feedbackType={feedbackType}
        />
        {installPromptNode}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f6f1ef] text-zinc-950">
      <AppHeader
        user={user}
        profile={profile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        billingLocked={billingLocked}
      />

      <main className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-6 sm:pt-5 lg:px-8">
        {feedback && (
          <div
            className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
              feedbackType === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {feedback}
          </div>
        )}

        {isLoading ? (
          <LoadingBlock />
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardView
                user={user}
                metrics={metrics}
                reports={reports}
                clients={clients}
                returnItems={returnItems}
                todayAppointments={todayAppointments}
                profile={profile}
                serviceCatalog={serviceCatalog}
                onSeed={seedExample}
                actionLoading={actionLoading}
                onSendReminder={sendReminder}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "clients" && (
              <ClientsView
                clients={filteredClients}
                allClientsCount={clients.length}
                records={records}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                clientFilter={clientFilter}
                setClientFilter={setClientFilter}
                selectedClient={selectedClient}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
                clientForm={clientForm}
                setClientForm={setClientForm}
                serviceNames={serviceNames}
                createClient={createClient}
                actionLoading={actionLoading}
                updateClientStatus={updateClientStatus}
                setActiveTab={setActiveTab}
                profile={profile}
                onDownloadProcedurePdf={handleDownloadProcedurePdf}
                onShareProcedurePdf={handleShareProcedurePdf}
              />
            )}

            {activeTab === "schedule" && (
              <ScheduleView
                clients={clients}
                appointmentForm={appointmentForm}
                setAppointmentForm={setAppointmentForm}
                createAppointment={createAppointment}
                actionLoading={actionLoading}
                appointments={appointments}
                updateAppointmentStatus={updateAppointmentStatus}
                serviceNames={serviceNames}
              />
            )}

            {activeTab === "service" && (
              <ServiceView
                clients={clients}
                selectedClient={selectedClient}
                selectedClientId={selectedClientId}
                setSelectedClientId={setSelectedClientId}
                serviceForm={serviceForm}
                setServiceForm={setServiceForm}
                createServiceRecord={createServiceRecord}
                actionLoading={actionLoading}
                records={records}
                serviceCatalog={serviceCatalog}
                profile={profile}
                onDownloadProcedurePdf={handleDownloadProcedurePdf}
                onShareProcedurePdf={handleShareProcedurePdf}
              />
            )}

            {activeTab === "returns" && (
              <ReturnsView
                returnItems={filteredReturns}
                allReturnItems={returnItems}
                returnFilter={returnFilter}
                setReturnFilter={setReturnFilter}
                onSendReminder={sendReminder}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "reports" && (
              <ReportsView reports={reports} clients={clients} records={records} returnItems={returnItems} />
            )}

            {activeTab === "billing" && (
              <BillingView
                user={user}
                billingSubscription={billingSubscription}
                billingAccess={billingAccess}
                pixPayment={pixPayment}
                billingCapabilities={billingCapabilities}
                onStartSubscription={startSubscriptionCheckout}
                onCreatePix={createPixPayment}
                onManageBilling={openBillingPortal}
                onRefreshStatus={refreshBillingStatus}
                actionLoading={actionLoading}
              />
            )}

            {activeTab === "security" && (
              <SecurityView
                profile={profile}
                clients={clients}
                records={records}
                appointments={appointments}
                backupSnapshots={backupSnapshots}
                onExportClients={handleExportClientsCsv}
                onExportAppointments={handleExportAppointmentsCsv}
                onExportFullBackup={handleExportFullBackup}
                onExportMonthlyPdf={handleExportMonthlySafetyPdf}
                onCreateCloudSnapshot={handleCreateCloudSnapshot}
                actionLoading={actionLoading}
              />
            )}

            {activeTab === "privacy" && <PrivacyPolicyView />}

            {activeTab === "settings" && (
              <SettingsView
                user={user}
                profile={profile}
                profileForm={profileForm}
                setProfileForm={setProfileForm}
                updateProfileCategories={updateProfileCategories}
                updateProfileService={updateProfileService}
                addProfileService={addProfileService}
                removeProfileService={removeProfileService}
                onSave={saveStudioProfile}
                actionLoading={actionLoading}
              />
            )}

          </>
        )}
      </main>
      {installPromptNode}
    </div>
  );
}

function InstallAppPrompt({ show, canInstall, isIosInstall, onInstall, onDismiss }) {
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 px-3 sm:px-4">
      <div className="mx-auto max-h-[calc(100dvh-1.5rem)] max-w-md overflow-y-auto rounded-[1.25rem] border border-white/80 bg-zinc-950 p-3 text-white shadow-2xl sm:rounded-[1.5rem] sm:p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#402239]">
            <img src="/brand/studiosbook-mark-reversed.svg" alt="" className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">Baixar {PRODUCT_NAME}</p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  Acesse como aplicativo, direto pela tela inicial, sem procurar o link no navegador.
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIosInstall ? (
              <div className="mt-3 rounded-2xl bg-white/10 p-3 text-xs leading-5 text-white/75">
                <p className="font-bold text-white">No iPhone:</p>
                <p className="mt-1 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-rose-100" />
                  toque em Compartilhar e depois em Adicionar a Tela de Inicio.
                </p>
              </div>
            ) : canInstall ? (
              <Button
                type="button"
                onClick={onInstall}
                className="mt-3 h-11 w-full rounded-full bg-white text-zinc-950 hover:bg-rose-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Instalar agora
              </Button>
            ) : (
              <div className="mt-3 rounded-2xl bg-white/10 p-3 text-xs leading-5 text-white/75">
                <p className="font-bold text-white">No Android:</p>
                <p className="mt-1 flex items-center gap-2">
                  <Download className="h-4 w-4 text-rose-100" />
                  abra o menu do navegador e toque em Instalar app ou Adicionar a tela inicial.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingScreen({
  user,
  profileForm,
  setProfileForm,
  updateProfileCategories,
  updateProfileService,
  addProfileService,
  removeProfileService,
  onSave,
  actionLoading,
  feedback,
  feedbackType,
}) {
  return (
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 overflow-hidden rounded-2xl bg-zinc-950 p-5 text-white shadow-2xl sm:mb-8 sm:rounded-[2rem] sm:p-8">
        <BrandLockup size="compact" tone="light" subtitle="Gestão para profissionais da beleza" />
        <p className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-100 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
          <Sparkles className="h-4 w-4 shrink-0" />
          Primeiro acesso
        </p>
        <h1 className="mt-5 max-w-3xl break-words text-3xl font-black leading-tight tracking-normal sm:text-5xl">
          Configure o {PRODUCT_NAME} para o seu tipo de atendimento.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
          Escolha uma ou mais áreas, revise os serviços padrão e salve. Depois você pode editar tudo em Configurações.
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
            feedbackType === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback}
        </div>
      )}

      <ProfileSetupPanel
        user={user}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        updateProfileCategories={updateProfileCategories}
        updateProfileService={updateProfileService}
        addProfileService={addProfileService}
        removeProfileService={removeProfileService}
        onSave={onSave}
        actionLoading={actionLoading}
        submitLabel={`Entrar no ${PRODUCT_NAME}`}
      />
    </main>
  );
}

function ProfileSetupPanel({
  user,
  profileForm,
  setProfileForm,
  updateProfileCategories,
  updateProfileService,
  addProfileService,
  removeProfileService,
  onSave,
  actionLoading,
  submitLabel = "Salvar configuração",
}) {
  return (
    <form onSubmit={onSave} className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Perfil do negócio"
          subtitle="Essas informações substituem qualquer dado pessoal fixo no produto."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nome do studio ou profissional">
            <Input
              value={profileForm.business_name}
              onChange={(event) => setProfileForm({ ...profileForm, business_name: event.target.value })}
              className="h-11 rounded-2xl border-zinc-200"
              placeholder="Ex: Studio Beleza Premium"
              required
            />
          </Field>
          <Field label="Responsável">
            <Input
              value={profileForm.owner_name}
              onChange={(event) => setProfileForm({ ...profileForm, owner_name: event.target.value })}
              className="h-11 rounded-2xl border-zinc-200"
              placeholder={user?.full_name || "Nome da profissional"}
            />
          </Field>
          <Field label="WhatsApp comercial">
            <Input
              value={profileForm.whatsapp}
              onChange={(event) => setProfileForm({ ...profileForm, whatsapp: event.target.value })}
              className="h-11 rounded-2xl border-zinc-200"
              placeholder="DDD + número"
            />
          </Field>
          <Field label="Conta conectada">
            <Input value={profileForm.user_email || user?.email || ""} disabled className="h-11 rounded-2xl border-zinc-200 bg-zinc-50" />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Áreas de atuação"
          subtitle="A profissional pode trabalhar com uma ou várias categorias no mesmo app."
        />
        <CategorySelector value={profileForm.categories || []} onChange={updateProfileCategories} />
      </Panel>

      <Panel>
        <PanelHeader
          title="Catálogo editável"
          subtitle="Serviços padrão entram automaticamente, mas podem ser alterados antes de salvar."
          action={
            <Button type="button" onClick={addProfileService} className="rounded-full bg-zinc-950 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Novo serviço
            </Button>
          }
        />
        <ServiceCatalogEditor
          services={profileForm.services || []}
          categories={profileForm.categories || []}
          onUpdate={updateProfileService}
          onRemove={removeProfileService}
        />
      </Panel>

      <Button
        type="submit"
        disabled={actionLoading === "profile"}
        className="h-12 rounded-full bg-zinc-950 text-white"
      >
        <Save className="mr-2 h-4 w-4" />
        {actionLoading === "profile" ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

function CategorySelector({ value, onChange }) {
  const selected = new Set(value || []);
  const toggle = (categoryId) => {
    const next = selected.has(categoryId)
      ? [...selected].filter((id) => id !== categoryId)
      : [...selected, categoryId];
    onChange(next.length ? next : [categoryId]);
  };

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {PROFESSIONAL_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const active = selected.has(category.id);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category.id)}
            className={`rounded-[1.5rem] border p-4 text-left transition ${
              active
                ? "border-zinc-950 bg-zinc-950 text-white shadow-xl"
                : "border-zinc-100 bg-white text-zinc-800 hover:border-rose-200 hover:bg-rose-50"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-rose-100" : "text-rose-700"}`} />
            <p className="mt-3 text-sm font-black">{category.label}</p>
            <p className={`mt-1 text-xs ${active ? "text-white/60" : "text-zinc-500"}`}>
              {active ? "Selecionado" : "Adicionar ao app"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ServiceCatalogEditor({ services, categories, onUpdate, onRemove }) {
  const visibleCategories = PROFESSIONAL_CATEGORIES.filter((category) => categories.includes(category.id));

  return (
    <div className="mt-5 grid gap-3">
      {services.length === 0 ? (
        <EmptyState text="Escolha uma categoria para carregar serviços padrão." />
      ) : (
        services.map((service) => (
          <div key={service.id} className="grid gap-3 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 lg:grid-cols-[1.1fr_0.8fr_0.55fr_0.55fr_0.55fr_auto]">
            <Field label="Serviço">
              <Input
                value={service.name}
                onChange={(event) => onUpdate(service.id, { name: event.target.value })}
                className="h-10 rounded-2xl border-zinc-200"
              />
            </Field>
            <Field label="Categoria">
              <Select value={service.category} onChange={(event) => onUpdate(service.id, { category: event.target.value })}>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Preço">
              <Input
                type="number"
                value={service.price}
                onChange={(event) => onUpdate(service.id, { price: event.target.value })}
                className="h-10 rounded-2xl border-zinc-200"
              />
            </Field>
            <Field label="Minutos">
              <Input
                type="number"
                value={service.duration_minutes}
                onChange={(event) => onUpdate(service.id, { duration_minutes: event.target.value })}
                className="h-10 rounded-2xl border-zinc-200"
              />
            </Field>
            <Field label="Retorno">
              <Input
                type="number"
                value={service.maintenance_days}
                onChange={(event) => onUpdate(service.id, { maintenance_days: event.target.value })}
                className="h-10 rounded-2xl border-zinc-200"
              />
            </Field>
            <div className="flex items-end gap-2">
              <label className="flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-black text-zinc-600">
                <input
                  type="checkbox"
                  checked={service.active !== false}
                  onChange={(event) => onUpdate(service.id, { active: event.target.checked })}
                />
                Ativo
              </label>
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(service.id)} className="rounded-full">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LoginScreen({ onLogin, feedback, feedbackType, actionLoading }) {
  return (
    <div className="min-h-dvh bg-[#f6f1ef] px-4 py-6 text-zinc-950 sm:px-5 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-6xl items-center gap-7 sm:min-h-[calc(100dvh-5rem)] sm:gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <BrandLockup size="hero" heading subtitle="Seu talento em foco. Seu studio sob controle." />
          <div className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-800 shadow-sm sm:mt-7 sm:px-4">
            <Lock className="h-4 w-4 shrink-0" />
            Agenda privada
          </div>
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600">
            Controle premium para clientes, agenda privada, procedimentos, retornos e relacionamento via WhatsApp.
          </p>
          {feedback && (
            <div
              className={`mt-6 max-w-xl rounded-2xl border px-4 py-3 text-sm font-bold leading-6 shadow-sm ${
                feedbackType === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {feedback}
            </div>
          )}
          <Button
            onClick={onLogin}
            disabled={actionLoading === "login"}
            className="mt-8 h-12 w-full rounded-full bg-[#402239] px-5 text-white hover:bg-[#553047] sm:w-auto sm:px-7"
          >
            {actionLoading === "login" ? "Abrindo login..." : "Entrar com Google"}
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white bg-white p-4 shadow-2xl sm:rounded-[2rem] sm:bg-white/86 sm:p-6 sm:backdrop-blur">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Agenda fechada", "A profissional decide quando atende."],
              ["Ficha técnica", "Produtos, técnica, observações e retorno."],
              ["Retornos", "Clientes no prazo ideal de manutenção."],
              ["WhatsApp", "Mensagem pronta e histórico de contato."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[1.5rem] bg-rose-50 p-5">
                <p className="font-black text-zinc-950">{title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppHeader({ user, profile, activeTab, setActiveTab, onLogout, billingLocked }) {
  const accountTabs = billingLocked
    ? tabs.filter((tab) => ["billing", "security", "privacy"].includes(tab.id))
    : tabs;

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/95 sm:bg-white/80 sm:backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <BrandLockup size="header" subtitle="Central de operação" />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold text-zinc-800">{profile?.business_name || PRODUCT_NAME}</p>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="shrink-0 rounded-full" title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto overscroll-x-contain px-3 pb-3 sm:px-6 sm:pb-4 lg:px-8">
        {accountTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                active
                  ? "bg-zinc-950 text-white shadow-lg"
                  : "bg-white/90 text-zinc-600 hover:bg-rose-50 hover:text-zinc-950"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function DashboardView({
  user,
  metrics,
  reports,
  clients,
  returnItems,
  todayAppointments,
  profile,
  serviceCatalog,
  onSeed,
  actionLoading,
  onSendReminder,
  setActiveTab,
}) {
  const firstName = profile?.owner_name?.split(" ")[0] || user.full_name?.split(" ")[0] || "Profissional";
  const categories = profile?.categories || [];
  const lateReturns = returnItems.filter((item) => item.days !== null && item.days < 0);
  const nextReturns = returnItems.filter((item) => item.days !== null && item.days >= 0 && item.days <= 7);
  const heroMessage =
    lateReturns.length > 0
      ? `${lateReturns.length} cliente(s) estão com manutenção atrasada.`
      : nextReturns.length > 0
        ? `${nextReturns.length} oportunidade(s) de manutenção nos próximos dias.`
        : "Operação organizada. Nenhum alerta urgente agora.";

  return (
    <div className="grid gap-6">
      <section className="min-w-0 overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl sm:rounded-[2rem]">
        <div className="relative grid min-w-0 gap-6 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-100 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
              <WandSparkles className="h-4 w-4 shrink-0" />
              Hoje na sua operação
            </p>
            <h2 className="mt-5 break-words text-3xl font-black leading-tight tracking-normal sm:text-5xl">
              Boa operação, {firstName}.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{heroMessage}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <QuickAction label="Novo cliente" icon={UserPlus} onClick={() => setActiveTab("clients")} />
              <QuickAction label="Registrar atendimento" icon={ShieldCheck} onClick={() => setActiveTab("service")} />
              <QuickAction label="Abrir agenda" icon={CalendarDays} onClick={() => setActiveTab("schedule")} />
              <QuickAction label="Retornos" icon={MessageCircle} onClick={() => setActiveTab("returns")} />
            </div>
          </div>
          <div className="min-w-0 rounded-[1.25rem] border border-white/10 bg-white/10 p-4 sm:rounded-[1.75rem] sm:bg-white/8 sm:p-5 sm:backdrop-blur">
            <p className="text-sm font-bold text-white/60">Resumo do mês</p>
            <p className="mt-3 break-words text-3xl font-black sm:text-4xl">{money(metrics.monthRevenue)}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric label="Atendimentos" value={reports.attendances} />
              <MiniMetric label="Ticket médio" value={money(reports.avgTicket)} />
              <MiniMetric label="VIPs" value={metrics.vipClients} />
              <MiniMetric label="Retorno" value={`${reports.returnRate}%`} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Clientes ativos" value={metrics.activeClients} helper="Carteira em movimento" icon={Users} tone="rose" />
        <StatCard label="Atendimentos hoje" value={metrics.todayAppointments} helper="Agenda privada" icon={CalendarDays} tone="violet" />
        <StatCard label="Retornos próximos" value={metrics.next7} helper="Oportunidades de manutenção" icon={Bell} tone="gold" />
        <StatCard label="Faturamento" value={money(metrics.monthRevenue)} helper="Mês atual" icon={DollarSign} tone="green" />
        <StatCard label="Clientes VIP" value={metrics.vipClients} helper="Relacionamento premium" icon={Crown} tone="dark" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader
            title="Clientes que merecem atenção hoje"
            subtitle="Retornos atrasados, vencendo ou com alto valor de relacionamento."
            action={<Button variant="ghost" className="rounded-full" onClick={() => setActiveTab("returns")}>Ver retornos</Button>}
          />
          <div className="mt-5 grid gap-3">
            {returnItems.slice(0, 5).length === 0 ? (
              <EmptyState text="Nenhuma cliente no prazo de retorno agora." />
            ) : (
              returnItems.slice(0, 5).map((item) => (
                <ReturnOpportunity key={item.client.id} item={item} onSendReminder={onSendReminder} />
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Agenda visual do dia"
            subtitle="Horários internos. Nada fica exposto para a cliente."
          />
          <div className="mt-5 grid gap-3">
            {todayAppointments.length === 0 ? (
              <EmptyState
                text="Nenhum horário registrado para hoje."
                action={
                  clients.length === 0 ? (
                    <Button
                      onClick={onSeed}
                      disabled={actionLoading === "seed"}
                      className="mt-4 rounded-full bg-zinc-950 text-white"
                    >
                      {actionLoading === "seed" ? "Criando..." : "Criar dados de exemplo"}
                    </Button>
                  ) : null
                }
              />
            ) : (
              todayAppointments.map((appointment) => <AppointmentTimeline key={appointment.id} appointment={appointment} />)
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Perfil configurado" subtitle="Áreas e catálogo ativo nesse studio." />
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} tone="rose">{categoryLabel(category)}</Badge>
            ))}
          </div>
          <div className="mt-4 rounded-[1.5rem] bg-zinc-50 p-4">
            <p className="text-sm font-black">{serviceCatalog.length} serviços ativos</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Edite categorias e serviços em Configurações.
            </p>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Indicadores de performance" subtitle="Leitura rápida para decisão comercial." />
          <div className="mt-5 grid gap-4">
            <PerformanceCard title="Taxa de retorno" value={`${reports.returnRate}%`} text="Clientes com mais de um atendimento." />
            <PerformanceCard title="Ticket médio" value={money(reports.avgTicket)} text="Média por atendimento registrado." />
            <PerformanceCard title="Oportunidades" value={reports.opportunities} text="Clientes no prazo de manutenção." />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="IA BlackVision" subtitle="Espaço preparado para próximas sugestões." />
          <div className="mt-5 rounded-[1.5rem] bg-gradient-to-br from-zinc-950 to-zinc-800 p-5 text-white">
            <Sparkles className="h-5 w-5 text-rose-200" />
            <p className="mt-4 text-sm leading-6 text-white/72">
              Em breve: sugestões automáticas de ação, mensagens personalizadas e alertas de clientes com risco de sumir.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ClientsView({
  clients,
  allClientsCount,
  records,
  searchTerm,
  setSearchTerm,
  clientFilter,
  setClientFilter,
  selectedClient,
  selectedClientId,
  setSelectedClientId,
  clientForm,
  setClientForm,
  serviceNames,
  createClient,
  actionLoading,
  updateClientStatus,
  setActiveTab,
  profile,
  onDownloadProcedurePdf,
  onShareProcedurePdf,
}) {
  const clientRecords = selectedClient
    ? records.filter((record) => record.client_id === selectedClient.id)
    : [];

  return (
    <div className="grid min-w-0 max-w-full gap-5 overflow-hidden xl:grid-cols-[0.78fr_1.22fr] xl:gap-6">
      <Panel className="overflow-hidden">
        <PanelHeader title="Clientes" subtitle={`${allClientsCount} cadastrados na carteira privada.`} />
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nome, WhatsApp ou Instagram"
            className="h-12 rounded-2xl border-zinc-200 bg-white pl-11"
          />
        </div>
        <FilterChips
          className="mt-4"
          value={clientFilter}
          onChange={setClientFilter}
          options={[
            ["all", "Todas"],
            ["vip", "VIP"],
            ["upcoming", "Retorno próximo"],
            ["late", "Atrasadas"],
            ["inactive", "Inativas"],
          ]}
        />
        <div className="mt-5 grid min-w-0 max-h-[38rem] gap-3 overflow-y-auto pr-1">
          {clients.length === 0 ? (
            <EmptyState text="Nenhuma cliente encontrada." />
          ) : (
            clients.map((client) => (
              <ClientListCard
                key={client.id}
                client={client}
                selected={selectedClientId === client.id}
                onClick={() => setSelectedClientId(client.id)}
              />
            ))
          )}
        </div>
      </Panel>

      <div className="grid min-w-0 gap-5 xl:gap-6">
        <NewClientPanel
          clientForm={clientForm}
          setClientForm={setClientForm}
          serviceNames={serviceNames}
          createClient={createClient}
          actionLoading={actionLoading}
        />
        <ClientProntuario
          selectedClient={selectedClient}
          clientRecords={clientRecords}
          updateClientStatus={updateClientStatus}
          setActiveTab={setActiveTab}
          profile={profile}
          onDownloadProcedurePdf={onDownloadProcedurePdf}
          onShareProcedurePdf={onShareProcedurePdf}
        />
      </div>
    </div>
  );
}

function NewClientPanel({ clientForm, setClientForm, serviceNames, createClient, actionLoading }) {
  return (
    <Panel>
      <PanelHeader title="Nova cliente" subtitle="Cadastro rápido para iniciar o histórico profissional." />
      <form onSubmit={createClient} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Nome completo">
          <Input
            value={clientForm.full_name}
            onChange={(event) => setClientForm({ ...clientForm, full_name: event.target.value })}
            className="h-11 rounded-2xl border-zinc-200"
            required
          />
        </Field>
        <Field label="WhatsApp">
          <Input
            value={clientForm.whatsapp}
            onChange={(event) => setClientForm({ ...clientForm, whatsapp: event.target.value })}
            className="h-11 rounded-2xl border-zinc-200"
            placeholder="73982409029"
          />
        </Field>
        <Field label="Instagram">
          <Input
            value={clientForm.instagram}
            onChange={(event) => setClientForm({ ...clientForm, instagram: event.target.value })}
            className="h-11 rounded-2xl border-zinc-200"
          />
        </Field>
        <Field label="Serviço preferido">
          <Select
            value={clientForm.preferred_service}
            onChange={(event) => setClientForm({ ...clientForm, preferred_service: event.target.value })}
          >
            <option value="">Selecione</option>
            {serviceNames.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>
        </Field>
        <Field label="Alergias ou sensibilidades" className="md:col-span-2">
          <Input
            value={clientForm.allergies}
            onChange={(event) => setClientForm({ ...clientForm, allergies: event.target.value })}
            className="h-11 rounded-2xl border-zinc-200"
          />
        </Field>
        <Field label="Observações importantes" className="md:col-span-2">
          <TextArea
            value={clientForm.notes}
            onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })}
            placeholder="Preferências, comportamento, restrições ou detalhes privados."
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-black text-zinc-700">
          <input
            type="checkbox"
            checked={clientForm.vip}
            onChange={(event) => setClientForm({ ...clientForm, vip: event.target.checked })}
            className="h-4 w-4 rounded border-zinc-300 text-rose-700"
          />
          Cliente VIP
        </label>
        <Button
          type="submit"
          disabled={actionLoading === "client"}
          className="h-11 rounded-full bg-zinc-950 text-white md:col-span-2"
        >
          <Plus className="mr-2 h-4 w-4" />
          {actionLoading === "client" ? "Cadastrando..." : "Cadastrar cliente"}
        </Button>
      </form>
    </Panel>
  );
}

function ClientProntuario({
  selectedClient,
  clientRecords,
  updateClientStatus,
  setActiveTab,
  profile,
  onDownloadProcedurePdf,
  onShareProcedurePdf,
}) {
  if (!selectedClient) {
    return (
      <Panel>
        <EmptyState text="Selecione uma cliente para abrir o prontuário profissional." />
      </Panel>
    );
  }

  const latestRecord = clientRecords[0];
  const businessName = profile?.business_name || PRODUCT_NAME;
  const message = `Oi, ${String(selectedClient.full_name || "cliente").split(" ")[0]}! Tudo bem? Passando para falar do seu atendimento no ${businessName}.`;

  return (
    <Panel className="overflow-hidden">
      <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-xl font-black tracking-tight sm:text-2xl">{selectedClient.full_name}</h2>
            {selectedClient.vip && <Badge tone="gold">Cliente VIP</Badge>}
            <Badge tone={selectedClient.status === "inactive" ? "slate" : selectedClient.status === "attention" ? "amber" : "green"}>
              {statusLabel(selectedClient.status)}
            </Badge>
          </div>
          <p className="mt-2 break-words text-sm text-zinc-500">
            {selectedClient.whatsapp || "Sem WhatsApp"} {selectedClient.instagram ? `| ${selectedClient.instagram}` : ""}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <a
            href={whatsappLink(selectedClient, message)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-black text-white transition hover:bg-emerald-600 sm:w-auto sm:px-5"
          >
            <MessageCircle className="h-4 w-4" />
            Chamar no WhatsApp
          </a>
          <Button onClick={() => setActiveTab("service")} className="w-full rounded-full bg-zinc-950 text-white sm:w-auto">
            Registrar atendimento
          </Button>
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-3">
        <InfoCard title="Próxima manutenção" value={formatDate(selectedClient.next_maintenance_date)} badge={maintenanceText(selectedClient.next_maintenance_date)} />
        <InfoCard title="Último atendimento" value={formatDate(selectedClient.last_service_date)} />
        <InfoCard title="Serviço preferido" value={selectedClient.preferred_service || "-"} />
      </div>

      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
        <ProntuarioBlock title="Dados da cliente" icon={Users}>
          <InfoLine label="WhatsApp" value={selectedClient.whatsapp || "-"} />
          <InfoLine label="Instagram" value={selectedClient.instagram || "-"} />
          <InfoLine label="Status" value={statusLabel(selectedClient.status)} />
        </ProntuarioBlock>
        <ProntuarioBlock title="Alergias e sensibilidades" icon={HeartPulse}>
          <p className="text-sm leading-6 text-zinc-600">{selectedClient.allergies || "Nenhuma informação registrada."}</p>
        </ProntuarioBlock>
        <ProntuarioBlock title="Último procedimento" icon={ShieldCheck}>
          {latestRecord ? (
            <>
              <InfoLine label="Serviço" value={latestRecord.service_name || latestRecord.effect || "-"} />
              <InfoLine label="Categoria" value={categoryLabel(latestRecord.service_category || latestRecord.service_type)} />
              <InfoLine label="Retenção" value={latestRecord.retention_percent ? `${latestRecord.retention_percent}%` : "-"} />
              <InfoLine label="Produto" value={latestRecord.adhesive || "-"} />
            </>
          ) : (
            <p className="text-sm text-zinc-500">Nenhum atendimento registrado.</p>
          )}
        </ProntuarioBlock>
        <ProntuarioBlock title="Observações privadas" icon={Lock}>
          <p className="text-sm leading-6 text-zinc-600">{selectedClient.notes || "Sem observações privadas."}</p>
        </ProntuarioBlock>
      </div>

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
        <PhotoPlaceholder label="Foto antes" />
        <PhotoPlaceholder label="Foto depois" />
      </div>

      <div className="mt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-lg font-black">Histórico inteligente</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => updateClientStatus(selectedClient, "active")} className="rounded-full">Ativa</Button>
            <Button variant="ghost" onClick={() => updateClientStatus(selectedClient, "attention")} className="rounded-full">Atenção</Button>
            <Button variant="ghost" onClick={() => updateClientStatus(selectedClient, "inactive")} className="rounded-full">Inativa</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {clientRecords.length === 0 ? (
            <EmptyState text="Nenhum atendimento registrado ainda." />
          ) : (
            clientRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                client={selectedClient}
                profile={profile}
                onDownloadProcedurePdf={onDownloadProcedurePdf}
                onShareProcedurePdf={onShareProcedurePdf}
              />
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

function ServiceView({
  clients,
  selectedClient,
  selectedClientId,
  setSelectedClientId,
  serviceForm,
  setServiceForm,
  createServiceRecord,
  actionLoading,
  records,
  serviceCatalog,
  profile,
  onDownloadProcedurePdf,
  onShareProcedurePdf,
}) {
  const recentRecords = records.slice(0, 5);

  const updateProcedureDate = (value) => {
    const selectedService = serviceCatalog.find((service) => service.name === serviceForm.effect);
    const maintenanceDays = Number(serviceForm.maintenance_days || selectedService?.maintenance_days || 20);
    setServiceForm({
      ...serviceForm,
      procedure_date: value,
      next_maintenance_date: maintenanceDays > 0 ? addDays(value, maintenanceDays) : "",
    });
  };

  const selectService = (serviceName) => {
    const selectedService = serviceCatalog.find((service) => service.name === serviceName);
    if (!selectedService) {
      setServiceForm({ ...serviceForm, effect: serviceName, service_name: serviceName });
      return;
    }
    setServiceForm({
      ...serviceForm,
      service_type: selectedService.category,
      service_category: selectedService.category,
      service_name: selectedService.name,
      effect: selectedService.name,
      amount: selectedService.price ? String(selectedService.price) : serviceForm.amount,
      duration_minutes: selectedService.duration_minutes || serviceForm.duration_minutes,
      maintenance_days: selectedService.maintenance_days,
      next_maintenance_date:
        Number(selectedService.maintenance_days) > 0
          ? addDays(serviceForm.procedure_date, Number(selectedService.maintenance_days))
          : "",
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel>
        <PanelHeader
          title="Registrar novo procedimento"
          subtitle="Formulário por blocos para salvar a memória técnica da cliente."
        />
        <form onSubmit={createServiceRecord} className="mt-6 grid gap-5">
          <FormStep number="01" title="Cliente">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cliente atendida">
                <Select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} required>
                  <option value="">Selecione</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data do procedimento">
                <Input
                  type="date"
                  value={serviceForm.procedure_date}
                  onChange={(event) => updateProcedureDate(event.target.value)}
                  className="h-11 rounded-2xl border-zinc-200"
                  required
                />
              </Field>
            </div>
          </FormStep>

          <FormStep number="02" title="Serviço realizado">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Categoria">
                <Select
                  value={serviceForm.service_category}
                  onChange={(event) => setServiceForm({ ...serviceForm, service_category: event.target.value, service_type: event.target.value })}
                >
                  <option value="">Selecione</option>
                  {PROFESSIONAL_CATEGORIES
                    .filter((category) => serviceCatalog.some((service) => service.category === category.id))
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Efeito / serviço">
                <Select
                  value={serviceForm.effect}
                  onChange={(event) => selectService(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {serviceCatalog
                    .filter((service) => !serviceForm.service_category || service.category === serviceForm.service_category)
                    .map((service) => (
                    <option key={service.id} value={service.name}>{service.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Técnica">
                <Input
                  value={serviceForm.technique}
                  onChange={(event) => setServiceForm({ ...serviceForm, technique: event.target.value })}
                  className="h-11 rounded-2xl border-zinc-200"
                  placeholder="Fios tecnológicos, volume..."
                />
              </Field>
            </div>
          </FormStep>

          <FormStep number="03" title="Ficha técnica e produtos">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Curvatura / detalhe técnico">
                <Input value={serviceForm.curl} onChange={(event) => setServiceForm({ ...serviceForm, curl: event.target.value })} className="h-11 rounded-2xl border-zinc-200" />
              </Field>
              <Field label="Espessura / medida">
                <Input value={serviceForm.thickness} onChange={(event) => setServiceForm({ ...serviceForm, thickness: event.target.value })} className="h-11 rounded-2xl border-zinc-200" />
              </Field>
              <Field label="Tamanhos / numeração">
                <Input value={serviceForm.lengths} onChange={(event) => setServiceForm({ ...serviceForm, lengths: event.target.value })} className="h-11 rounded-2xl border-zinc-200" placeholder="9-10-11-12" />
              </Field>
              <Field label="Cola / produto usado">
                <Input value={serviceForm.adhesive} onChange={(event) => setServiceForm({ ...serviceForm, adhesive: event.target.value })} className="h-11 rounded-2xl border-zinc-200" />
              </Field>
              <Field label="Mapeamento / detalhes do procedimento" className="md:col-span-2">
                <TextArea value={serviceForm.mapping_notes} onChange={(event) => setServiceForm({ ...serviceForm, mapping_notes: event.target.value })} placeholder="Ex: técnica, combinações, regiões trabalhadas, produtos e cuidados..." />
              </Field>
            </div>
          </FormStep>

          <FormStep number="04" title="Valor, pagamento e retorno">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Valor cobrado">
                <Input type="number" value={serviceForm.amount} onChange={(event) => setServiceForm({ ...serviceForm, amount: event.target.value })} className="h-11 rounded-2xl border-zinc-200" placeholder="130" />
              </Field>
              <Field label="Duração (min)">
                <Input type="number" value={serviceForm.duration_minutes} onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: event.target.value })} className="h-11 rounded-2xl border-zinc-200" placeholder="60" />
              </Field>
              <Field label="Prazo retorno (dias)">
                <Input
                  type="number"
                  value={serviceForm.maintenance_days}
                  onChange={(event) => {
                    const days = Number(event.target.value || 0);
                    setServiceForm({
                      ...serviceForm,
                      maintenance_days: event.target.value,
                      next_maintenance_date: days > 0 ? addDays(serviceForm.procedure_date, days) : "",
                    });
                  }}
                  className="h-11 rounded-2xl border-zinc-200"
                  placeholder="20"
                />
              </Field>
              <Field label="Retenção (%)">
                <Input type="number" min="0" max="100" value={serviceForm.retention_percent} onChange={(event) => setServiceForm({ ...serviceForm, retention_percent: event.target.value })} className="h-11 rounded-2xl border-zinc-200" placeholder="55" />
              </Field>
              <Field label="Próxima manutenção">
                <Input type="date" value={serviceForm.next_maintenance_date} onChange={(event) => setServiceForm({ ...serviceForm, next_maintenance_date: event.target.value })} className="h-11 rounded-2xl border-zinc-200" />
              </Field>
            </div>
          </FormStep>

          <FormStep number="05" title="Observações e fotos futuras">
            <div className="grid gap-4">
              <Field label="Observações técnicas">
                <TextArea value={serviceForm.notes} onChange={(event) => setServiceForm({ ...serviceForm, notes: event.target.value })} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <PhotoPlaceholder label="Foto antes - estrutura preparada" />
                <PhotoPlaceholder label="Foto depois - estrutura preparada" />
              </div>
            </div>
          </FormStep>

          <Button type="submit" disabled={actionLoading === "service"} className="h-12 rounded-full bg-zinc-950 text-white">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {actionLoading === "service" ? "Salvando..." : "Salvar atendimento"}
          </Button>
        </form>
      </Panel>

      <div className="grid gap-6">
        <Panel>
          <PanelHeader title="Contexto da cliente" subtitle="Resumo antes de salvar o procedimento." />
          {selectedClient ? (
            <div className="mt-5 rounded-[1.5rem] bg-rose-50 p-5">
              <p className="font-black">{selectedClient.full_name}</p>
              <p className="mt-2 text-sm text-zinc-600">Preferido: {selectedClient.preferred_service || "-"}</p>
              <p className="mt-1 text-sm text-zinc-600">Retorno: {formatDate(selectedClient.next_maintenance_date)}</p>
            </div>
          ) : (
            <EmptyState text="Selecione uma cliente para ver contexto." />
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Últimos atendimentos" subtitle="Histórico recente para conferência." />
          <div className="mt-5 grid gap-3">
            {recentRecords.length === 0 ? (
              <EmptyState text="Nenhum atendimento registrado." />
            ) : (
              recentRecords.map((record) => {
                const client = clients.find((item) => item.id === record.client_id);
                return (
                  <RecordCard
                    key={record.id}
                    record={record}
                    client={client}
                    profile={profile}
                    compact
                    onDownloadProcedurePdf={onDownloadProcedurePdf}
                    onShareProcedurePdf={onShareProcedurePdf}
                  />
                );
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ScheduleView({
  clients,
  appointmentForm,
  setAppointmentForm,
  createAppointment,
  actionLoading,
  appointments,
  updateAppointmentStatus,
  serviceNames,
}) {
  const ordered = [...appointments].sort((a, b) =>
    `${a.appointment_date || ""} ${a.appointment_time || ""}`.localeCompare(`${b.appointment_date || ""} ${b.appointment_time || ""}`)
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <Panel>
        <PanelHeader title="Agenda privada" subtitle="Controle manual. A agenda não fica exposta para clientes." />
        <form onSubmit={createAppointment} className="mt-5 grid gap-4">
          <Field label="Cliente">
            <Select
              value={appointmentForm.client_id}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, client_id: event.target.value })}
              disabled={appointmentForm.is_blocked}
            >
              <option value="">Selecione</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" value={appointmentForm.appointment_date} onChange={(event) => setAppointmentForm({ ...appointmentForm, appointment_date: event.target.value })} className="h-11 rounded-2xl border-zinc-200" required />
            </Field>
            <Field label="Hora">
              <Input type="time" value={appointmentForm.appointment_time} onChange={(event) => setAppointmentForm({ ...appointmentForm, appointment_time: event.target.value })} className="h-11 rounded-2xl border-zinc-200" required />
            </Field>
          </div>
          <Field label="Serviço ou motivo">
            <Input
              list="appointment-service-options"
              value={appointmentForm.service_name}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, service_name: event.target.value })}
              className="h-11 rounded-2xl border-zinc-200"
            />
            <datalist id="appointment-service-options">
              {serviceNames.map((service) => (
                <option key={service} value={service} />
              ))}
            </datalist>
          </Field>
          <label className="flex items-center gap-2 text-sm font-black text-zinc-700">
            <input
              type="checkbox"
              checked={appointmentForm.is_blocked}
              onChange={(event) =>
                setAppointmentForm({
                  ...appointmentForm,
                  is_blocked: event.target.checked,
                  client_id: event.target.checked ? "" : appointmentForm.client_id,
                  service_name: event.target.checked ? "Bloqueio privado" : serviceNames[0] || "Atendimento",
                })
              }
            />
            Bloquear horário privado
          </label>
          <Field label="Nota privada">
            <TextArea value={appointmentForm.private_note} onChange={(event) => setAppointmentForm({ ...appointmentForm, private_note: event.target.value })} />
          </Field>
          <Button type="submit" disabled={actionLoading === "appointment"} className="h-11 rounded-full bg-zinc-950 text-white">
            {actionLoading === "appointment" ? "Salvando..." : "Salvar horário"}
          </Button>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Linha do tempo da agenda" subtitle="Visual claro para celular, tablet e notebook." />
        <div className="mt-5 grid gap-3">
          {ordered.length === 0 ? (
            <EmptyState text="Nenhum horário registrado." />
          ) : (
            ordered.map((appointment) => (
              <div key={appointment.id} className="rounded-[1.5rem] border border-zinc-100 bg-white p-4">
                <AppointmentTimeline appointment={appointment} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {["confirmed", "completed", "cancelled", "no_show"].map((status) => (
                    <Button key={status} variant="ghost" onClick={() => updateAppointmentStatus(appointment, status)} className="h-8 rounded-full text-xs">
                      {statusLabel(status)}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function ReturnsView({ returnItems, allReturnItems, returnFilter, setReturnFilter, onSendReminder, setActiveTab }) {
  return (
    <Panel>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <PanelHeader
          title="Central de oportunidades"
          subtitle="Retornos organizados por urgência, VIP e contato recente no WhatsApp."
        />
        <Button onClick={() => setActiveTab("service")} className="rounded-full bg-zinc-950 text-white">
          Registrar novo atendimento
        </Button>
      </div>
      <FilterChips
        className="mt-5"
        value={returnFilter}
        onChange={setReturnFilter}
        options={[
          ["all", `Todos (${allReturnItems.length})`],
          ["today", "Hoje"],
          ["next7", "Próximos 7 dias"],
          ["late", "Atrasados"],
          ["vip", "VIP"],
          ["called", "Ja chamados"],
        ]}
      />
      <div className="mt-6 grid gap-3">
        {returnItems.length === 0 ? (
          <EmptyState text="Nenhum retorno nessa categoria." />
        ) : (
          returnItems.map((item) => <ReturnOpportunity key={item.client.id} item={item} onSendReminder={onSendReminder} expanded />)
        )}
      </div>
    </Panel>
  );
}

function ReportsView({ reports, clients, records, returnItems }) {
  const repeatedClients = clients
    .map((client) => ({
      client,
      count: records.filter((record) => record.client_id === client.id).length,
    }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento do mês" value={money(reports.revenue)} helper="Registros do mês atual" icon={DollarSign} tone="green" />
        <StatCard label="Atendimentos" value={reports.attendances} helper="Procedimentos registrados" icon={ShieldCheck} tone="rose" />
        <StatCard label="Ticket médio" value={money(reports.avgTicket)} helper="Valor médio por atendimento" icon={TrendingUp} tone="violet" />
        <StatCard label="Taxa de retorno" value={`${reports.returnRate}%`} helper="Clientes que voltaram" icon={Activity} tone="gold" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Serviços mais realizados" subtitle="Base para campanhas e ofertas." />
          <div className="mt-5 grid gap-3">
            {reports.topServices.length === 0 ? (
              <EmptyState text="Ainda não há dados suficientes." />
            ) : (
              reports.topServices.map(([service, count], index) => (
                <RankRow key={service} index={index + 1} label={service} value={`${count} atendimento(s)`} />
              ))
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Clientes que mais retornam" subtitle="Mini CRM de relacionamento." />
          <div className="mt-5 grid gap-3">
            {repeatedClients.length === 0 ? (
              <EmptyState text="Quando clientes retornarem, elas aparecerão aqui." />
            ) : (
              repeatedClients.map((item, index) => (
                <RankRow key={item.client.id} index={index + 1} label={item.client.full_name} value={`${item.count} atendimentos`} />
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel>
        <PanelHeader title="Próximas oportunidades de manutenção" subtitle="Receita potencial escondida na carteira." />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {returnItems.slice(0, 6).length === 0 ? (
            <EmptyState text="Sem oportunidades próximas." />
          ) : (
            returnItems.slice(0, 6).map((item) => (
              <div key={item.client.id} className="rounded-[1.5rem] bg-zinc-50 p-4">
                <p className="font-black">{item.client.full_name}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {maintenanceText(item.dueDate)} | {formatDate(item.dueDate)}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function BillingAccessScreen({
  user,
  billingSubscription,
  billingAccess,
  pixPayment,
  billingCapabilities,
  onStartSubscription,
  onCreatePix,
  onManageBilling,
  onRefreshStatus,
  onLogout,
  actionLoading,
  feedback,
  feedbackType,
}) {
  return (
    <div className="min-h-dvh bg-[#f6f1ef] text-zinc-950">
      <header className="border-b border-white/70 bg-white sm:bg-white/85 sm:backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <BrandLockup size="header" subtitle="Regularização de acesso" />
          <Button variant="ghost" onClick={onLogout} className="h-10 shrink-0 rounded-full px-3 sm:px-4" title="Sair">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6">
        {feedback && (
          <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${feedbackType === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {feedback}
          </div>
        )}
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          O período gratuito terminou. Seus dados continuam salvos; regularize o pagamento para voltar a editar agenda, clientes e atendimentos.
        </div>
        <BillingView
          user={user}
          billingSubscription={billingSubscription}
          billingAccess={billingAccess}
          pixPayment={pixPayment}
          billingCapabilities={billingCapabilities}
          onStartSubscription={onStartSubscription}
          onCreatePix={onCreatePix}
          onManageBilling={onManageBilling}
          onRefreshStatus={onRefreshStatus}
          actionLoading={actionLoading}
        />
      </main>
    </div>
  );
}

function BillingView({
  user,
  billingSubscription,
  billingAccess,
  pixPayment,
  billingCapabilities,
  onStartSubscription,
  onCreatePix,
  onManageBilling,
  onRefreshStatus,
  actionLoading,
}) {
  const status = billingSubscription?.status || "not_started";
  const providerSubscriptionStatus =
    billingSubscription?.stripe_subscription_status ||
    (["trialing", "active", "past_due", "unpaid", "incomplete", "paused", "canceled"].includes(status)
      ? status
      : "not_started");
  const recurringPaymentStatus =
    (pixPayment?.billing_flow === "subscription" ? pixPayment?.status : "") ||
    billingSubscription?.last_payment_status ||
    "not_started";
  const recurringPaymentFailed = ["rejected", "payment_failed", "past_due", "unpaid", "charged_back", "refunded"].includes(
    recurringPaymentStatus
  );
  const hasStripeSubscription = Boolean(billingSubscription?.stripe_subscription_id);
  const recurringActive =
    hasStripeSubscription &&
    ["trialing", "active"].includes(providerSubscriptionStatus) &&
    !recurringPaymentFailed;
  const statusTone = billingStatusTone(status);
  const trialEnd = billingSubscription?.trial_end_date;
  const trialDaysLeft =
    billingAccess?.daysLeft ??
    (trialEnd ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86400000)) : 7);
  const supportHref = supportWhatsAppLink("Oi, preciso de suporte para ativar minha assinatura do StudiosBook.");
  const hasStripeCustomer = Boolean(billingSubscription?.stripe_customer_id);
  const pixAvailable = billingCapabilities?.pix === true;

  return (
    <div className="grid gap-6">
      <section className="min-w-0 overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl sm:rounded-[2rem]">
        <div className="relative grid min-w-0 gap-6 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-100 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
              <CreditCard className="h-4 w-4 shrink-0" />
              Assinatura StudiosBook
            </p>
            <h2 className="mt-5 max-w-3xl break-words text-3xl font-black leading-tight tracking-normal sm:text-5xl">
              7 dias grátis desde o cadastro. Depois {PRODUCT_PRICE}.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              {pixAvailable
                ? "Checkout protegido pela Stripe, com cartão recorrente ou Pix avulso para 30 dias de acesso."
                : "Checkout protegido pela Stripe para assinatura mensal recorrente no cartão."}
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              {!recurringActive && (
                <Button
                  type="button"
                  onClick={onStartSubscription}
                  disabled={actionLoading === "billing-card"}
                  className="h-12 w-full rounded-full bg-rose-500 px-4 text-white hover:bg-rose-600 sm:w-auto sm:px-6"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {actionLoading === "billing-card" ? "Abrindo Stripe..." : "Assinar com cartão"}
                </Button>
              )}
              {hasStripeCustomer && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onManageBilling}
                  disabled={actionLoading === "billing-portal"}
                  className="h-12 w-full rounded-full bg-white/10 px-4 text-white hover:bg-white/15 sm:w-auto sm:px-6"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {actionLoading === "billing-portal" ? "Abrindo..." : "Gerenciar cobrança"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={onRefreshStatus}
                disabled={actionLoading === "billing-refresh"}
                className="h-12 w-full rounded-full bg-white/10 px-4 text-white hover:bg-white/15 sm:w-auto sm:px-6"
              >
                <Activity className="mr-2 h-4 w-4" />
                {actionLoading === "billing-refresh" ? "Atualizando..." : "Atualizar status"}
              </Button>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 sm:rounded-[1.75rem] sm:p-5 sm:backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white/55">Status da conta</p>
                <p className="mt-2 break-words text-2xl font-black sm:text-3xl">{billingStatusLabel(status)}</p>
              </div>
              <Badge tone={statusTone}>{billingStatusLabel(status)}</Badge>
            </div>
            <div className="mt-5 grid gap-3">
              <MiniMetric label="Profissional" value={user?.email || "-"} />
              <MiniMetric label="Plano" value={billingSubscription?.plan_name || "StudiosBook Intermediário"} />
              <MiniMetric label="Assinatura Stripe" value={billingStatusLabel(providerSubscriptionStatus)} />
              <MiniMetric label="Último pagamento" value={billingStatusLabel(recurringPaymentStatus)} />
              <MiniMetric label="Teste grátis" value={trialEnd ? `${trialDaysLeft} dia(s) restantes` : "7 dias desde o cadastro"} />
              <MiniMetric label="Mensalidade" value={PRODUCT_PRICE} />
            </div>
          </div>
        </div>
      </section>

      <section className={`grid min-w-0 gap-4 sm:gap-6 ${pixAvailable ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
        <Panel>
          <PanelHeader
            title="Cartão recorrente"
            subtitle="A Stripe processa R$ 26,90 por mês e trata autenticação bancária com segurança."
          />
          <div className="mt-5 grid gap-4">
            {[
              ["Teste preservado", "Os 7 dias continuam contados desde a criação da conta.", Sparkles],
              ["Controle completo", "Troque o cartão, consulte faturas ou cancele pelo portal da Stripe.", CreditCard],
            ].map(([title, text, Icon]) => (
              <div key={title} className="flex items-start gap-3 rounded-[1.25rem] bg-zinc-50 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                <div className="min-w-0">
                  <p className="font-black text-zinc-950">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p>
                </div>
              </div>
            ))}
            {recurringActive ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                <p className="font-black">
                  {recurringPaymentStatus === "approved" ? "Pagamento confirmado" : "Assinatura protegida pela Stripe"}
                </p>
                <p className="mt-1 text-emerald-900/75">
                  A situação financeira é atualizada automaticamente pelos eventos assinados da Stripe.
                </p>
              </div>
            ) : (
              <Button
                id="studiosbook-card-form"
                type="button"
                onClick={onStartSubscription}
                disabled={actionLoading === "billing-card"}
                className="h-12 w-full rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {actionLoading === "billing-card" ? "Abrindo checkout..." : "Continuar para a Stripe"}
              </Button>
            )}
          </div>
        </Panel>

        {pixAvailable && <Panel>
          <PanelHeader
            title="Pagamento por Pix"
            subtitle="Pagamento avulso de R$ 26,90, sem renovação automática, para liberar 30 dias."
          />
          <div className="mt-5 grid gap-4">
            <div className="flex min-w-0 items-start gap-3 rounded-[1.25rem] bg-emerald-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p className="min-w-0 text-sm leading-6 text-emerald-950">
                O QR Code e a confirmação são exibidos no ambiente protegido da Stripe.
              </p>
            </div>
            <Button
              type="button"
              onClick={onCreatePix}
              disabled={actionLoading === "billing-pix"}
              className="h-12 w-full rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700"
            >
              <QrCode className="mr-2 h-4 w-4" />
              {actionLoading === "billing-pix" ? "Abrindo Stripe..." : "Pagar R$ 26,90 por Pix"}
            </Button>
          </div>
        </Panel>}
      </section>

      <Panel>
        <PanelHeader
          title="Resumo da assinatura"
          subtitle="Acompanhe período gratuito, vencimento e situação financeira."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <InfoCard title="Início do teste" value={formatDateTime(billingSubscription?.trial_start_date)} />
          <InfoCard title="Fim do teste" value={formatDateTime(billingSubscription?.trial_end_date)} />
          <InfoCard title="Acesso válido até" value={formatDateTime(billingSubscription?.current_period_end)} />
          <InfoCard title="Próxima cobrança" value={formatDateTime(billingSubscription?.next_payment_date)} />
          <InfoCard title="Última sincronização" value={formatDateTime(billingSubscription?.last_sync_date)} />
          <InfoCard title="Assinatura Stripe" value={billingStatusLabel(providerSubscriptionStatus)} />
          <InfoCard title="Último pagamento" value={billingStatusLabel(recurringPaymentStatus)} />
        </div>

        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
          {hasStripeCustomer && (
            <Button type="button" onClick={onManageBilling} className="h-11 w-full rounded-full bg-zinc-950 px-5 text-white sm:w-auto">
              <Settings className="mr-2 h-4 w-4" />
              Gerenciar na Stripe
            </Button>
          )}
          <a
            href={supportHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-black text-white transition hover:bg-emerald-600 sm:w-auto sm:px-5"
          >
            <MessageCircle className="h-4 w-4" />
            Suporte no WhatsApp
          </a>
        </div>
      </Panel>
    </div>
  );
}

function PrivacyPolicyView() {
  const supportMailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Privacidade e LGPD - ${PRODUCT_NAME}`
  )}&body=${encodeURIComponent("Oi, preciso falar sobre privacidade, dados ou LGPD no StudiosBook.")}`;
  const supportWhatsappHref = supportWhatsAppLink("Oi, preciso falar sobre privacidade, dados ou LGPD no StudiosBook.");

  return (
    <div className="grid gap-6">
      <section className="min-w-0 overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl sm:rounded-[2rem]">
        <div className="relative min-w-0 p-5 sm:p-8">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-100 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
            <FileText className="h-4 w-4 shrink-0" />
            Política de Privacidade
          </p>
          <h2 className="mt-5 max-w-3xl break-words text-3xl font-black leading-tight tracking-normal sm:text-5xl">
            Transparência sobre dados e LGPD.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
            Esta política descreve como o {PRODUCT_NAME}, produto da {PRODUCT_COMPANY}, coleta, utiliza,
            armazena e protege dados dentro do sistema de gestão para profissionais da beleza.
          </p>
          <p className="mt-4 break-words text-[11px] font-bold uppercase tracking-[0.1em] text-white/45 sm:text-xs sm:tracking-[0.18em]">
            Última atualização: 12/06/2026
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="1. Dados coletados" subtitle="Informações necessárias para operar o sistema." />
          <PolicyList
            items={[
              "Dados da conta: nome, e-mail e autenticação da profissional.",
              "Dados do negócio: nome do studio, categorias, serviços, agenda e configurações.",
              "Dados de clientes cadastradas pela profissional: nome, WhatsApp, preferências, histórico de atendimento e observações operacionais.",
              "Dados de cobrança: status de assinatura, referência de checkout e identificadores retornados pela Stripe.",
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader title="2. Finalidade de uso" subtitle="Por que esses dados são tratados." />
          <PolicyList
            items={[
              "Permitir cadastro de clientes, agenda, atendimentos, retornos e relatórios.",
              "Gerar backups, exportações CSV/JSON/PDF e documentos de procedimento.",
              "Processar assinatura mensal e suporte financeiro via Stripe.",
              "Melhorar segurança, estabilidade, experiência do produto e atendimento de suporte.",
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader title="3. Armazenamento e segurança" subtitle="Como os dados ficam protegidos." />
          <PolicyList
            items={[
              "Os dados operacionais ficam salvos em nuvem vinculada à conta autenticada.",
              "Cada profissional acessa os registros criados pela própria conta.",
              "O sistema oferece exportação local para controle, backup e auditoria da profissional.",
              "A BlackVision não solicita senha pessoal por WhatsApp, e-mail ou suporte externo.",
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader title="4. Compartilhamento" subtitle="Quando dados podem ser enviados a terceiros." />
          <PolicyList
            items={[
              "Dados de pagamento são processados pela Stripe para assinatura, Pix e cobrança recorrente.",
              "Prestadores de infraestrutura podem processar dados apenas para hospedagem, autenticação e funcionamento do app.",
              "Dados podem ser apresentados quando houver obrigação legal, ordem de autoridade competente ou defesa de direitos.",
              "A BlackVision não vende listas de clientes cadastradas pelas profissionais.",
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader title="5. Direitos pela LGPD" subtitle="Solicitações que podem ser feitas pelo titular." />
          <PolicyList
            items={[
              "Confirmar se existe tratamento de dados pessoais.",
              "Solicitar acesso, correção, atualização ou exclusão de dados.",
              "Solicitar portabilidade, informações sobre compartilhamento e revisão de decisões automatizadas, quando aplicável.",
              "Revogar consentimentos e pedir orientação sobre retenção ou descarte de dados.",
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader title="6. Retenção e exclusão" subtitle="Ciclo de vida das informações." />
          <PolicyList
            items={[
              "Dados são mantidos enquanto a conta estiver ativa ou enquanto forem necessários para operação, suporte, cobrança e obrigações legais.",
              "A profissional pode exportar seus dados antes de solicitar exclusão da conta.",
              "Backups operacionais podem permanecer por período técnico limitado para segurança, auditoria e recuperação.",
              "Solicitações de exclusão serão avaliadas conforme obrigações legais e contratuais aplicáveis.",
            ]}
          />
        </Panel>
      </section>

      <Panel>
        <PanelHeader title="Contato oficial" subtitle="Canal para suporte, privacidade e solicitações de dados." />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InfoCard title="E-mail" value={SUPPORT_EMAIL} />
          <InfoCard title="WhatsApp" value={`+55 ${SUPPORT_PHONE}`} />
          <InfoCard title="Produto" value={`${PRODUCT_NAME} by ${PRODUCT_COMPANY}`} />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href={supportMailHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-zinc-800"
          >
            <LifeBuoy className="h-4 w-4" />
            Enviar e-mail
          </a>
          <a
            href={supportWhatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-600"
          >
            <MessageCircle className="h-4 w-4" />
            Chamar no WhatsApp
          </a>
        </div>
      </Panel>
    </div>
  );
}

function PolicyList({ items }) {
  return (
    <div className="mt-5 grid gap-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 rounded-[1.25rem] bg-zinc-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <p className="text-sm leading-6 text-zinc-600">{item}</p>
        </div>
      ))}
    </div>
  );
}

function SecurityView({
  profile,
  clients,
  records,
  appointments,
  backupSnapshots,
  onExportClients,
  onExportAppointments,
  onExportFullBackup,
  onExportMonthlyPdf,
  onCreateCloudSnapshot,
  actionLoading,
}) {
  const lastSnapshot = backupSnapshots?.[0];
  const currentMonth = todayISO().slice(0, 7);
  const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Suporte ${PRODUCT_NAME}`
  )}&body=${encodeURIComponent("Oi, preciso de suporte no StudiosBook.")}`;
  const supportWhatsappHref = supportWhatsAppLink("Oi, preciso de suporte no StudiosBook.");

  return (
    <div className="grid gap-6">
      <section className="min-w-0 overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl sm:rounded-[2rem]">
        <div className="relative min-w-0 p-5 sm:p-8">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-100 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
            <Lock className="h-4 w-4 shrink-0" />
            Modo segurança
          </p>
          <h2 className="mt-5 max-w-3xl break-words text-3xl font-black leading-tight tracking-normal sm:text-5xl">
            Seus dados ficam salvos na nuvem.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
            Clientes, agenda, atendimentos, catálogo e configurações ficam vinculados à conta conectada.
            Cada profissional acessa os registros criados pela própria conta, com opção de baixar cópias locais
            sempre que precisar.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="Clientes salvos" value={clients.length} />
            <MiniMetric label="Horários salvos" value={appointments.length} />
            <MiniMetric label="Atendimentos" value={records.length} />
            <MiniMetric
              label="Último backup"
              value={lastSnapshot?.snapshot_date ? formatDate(String(lastSnapshot.snapshot_date).slice(0, 10)) : "Pendente"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader
            title="Backup e exportação"
            subtitle="Baixe dados em CSV, JSON ou PDF mensal antes de fechar o mês."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onExportClients}
              className="flex min-h-28 items-start gap-3 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50"
            >
              <Download className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <span>
                <span className="block font-black text-zinc-950">Exportar clientes</span>
                <span className="mt-1 block text-sm leading-6 text-zinc-500">CSV com nome, WhatsApp, status, serviço e retorno.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onExportAppointments}
              className="flex min-h-28 items-start gap-3 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50"
            >
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <span>
                <span className="block font-black text-zinc-950">Exportar agenda</span>
                <span className="mt-1 block text-sm leading-6 text-zinc-500">CSV com data, horário, cliente, serviço e status.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onExportFullBackup}
              className="flex min-h-28 items-start gap-3 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50"
            >
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <span>
                <span className="block font-black text-zinc-950">Backup completo</span>
                <span className="mt-1 block text-sm leading-6 text-zinc-500">JSON com perfil, clientes, agenda e atendimentos.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onExportMonthlyPdf}
              className="flex min-h-28 items-start gap-3 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50"
            >
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <span>
                <span className="block font-black text-zinc-950">PDF mensal</span>
                <span className="mt-1 block text-sm leading-6 text-zinc-500">Resumo do modo segurança para o mês {currentMonth}.</span>
              </span>
            </button>
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-black text-emerald-950">Snapshot em nuvem</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Salve uma cópia operacional dentro do próprio {PRODUCT_NAME}. Use junto com os downloads mensais
                  para ter redundância local e online.
                </p>
                <Button
                  type="button"
                  onClick={onCreateCloudSnapshot}
                  disabled={actionLoading === "cloud-backup"}
                  className="mt-4 h-11 rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                >
                  <Cloud className="mr-2 h-4 w-4" />
                  {actionLoading === "cloud-backup" ? "Salvando..." : "Salvar snapshot na nuvem"}
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel>
            <PanelHeader
              title="Plano intermediário"
              subtitle="Etapa beta paga, com segurança operacional sem grande mudança visual."
            />
            <div className="mt-5 rounded-[1.5rem] bg-zinc-950 p-5 text-white">
              <p className="text-sm font-bold text-white/55">StudiosBook Beta</p>
              <p className="mt-2 text-4xl font-black">{PRODUCT_PRICE}</p>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Inclui agenda, clientes, atendimentos, retorno por WhatsApp, exportação, PDF mensal e backup em nuvem.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Status e suporte" subtitle="Canal direto para acompanhar operação e suporte." />
            <div className="mt-5 grid gap-3">
              {[
                ["Sistema online", "App publicado e acessível pelo navegador/PWA.", CheckCircle2, "green"],
                ["Nuvem ativa", "Dados salvos pela conta conectada e protegidos por usuário.", Cloud, "rose"],
                ["Backup manual", "Downloads CSV/PDF/JSON disponíveis quando precisar.", Database, "violet"],
              ].map(([title, text, Icon, tone]) => (
                <div key={title} className="flex items-start gap-3 rounded-[1.25rem] bg-zinc-50 p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                  <div>
                    <p className="font-black text-zinc-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={supportHref}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-zinc-800 sm:w-auto"
              >
                <LifeBuoy className="h-4 w-4" />
                E-mail suporte
              </a>
              <a
                href={supportWhatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-600 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp suporte
              </a>
            </div>
          </Panel>
        </div>
      </section>

      <Panel>
        <PanelHeader
          title="Política clara de dados"
          subtitle="Mensagem pronta para posicionar segurança e controle com as profissionais."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <InfoCard title="Onde salva" value="Firestore no Firebase vinculado à conta logada." />
          <InfoCard title="Quem acessa" value="A profissional acessa apenas os dados criados pela própria conta." />
          <InfoCard title="Como recuperar" value="Exportação local em CSV, JSON e PDF mensal." />
        </div>
        <div className="mt-5 rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm leading-6 text-amber-900">
              Recomendação operacional: baixar o PDF mensal e o backup JSON no fechamento de cada mês. Isso reduz
              risco de perda operacional, facilita auditoria interna e aumenta a confiança no produto.
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Histórico de snapshots" subtitle="Últimas cópias operacionais salvas na nuvem." />
        <div className="mt-5 grid gap-3">
          {!backupSnapshots?.length ? (
            <EmptyState text="Nenhum snapshot em nuvem criado ainda." />
          ) : (
            backupSnapshots.slice(0, 5).map((snapshot) => (
              <div key={snapshot.id || snapshot.snapshot_date} className="flex flex-col justify-between gap-3 rounded-[1.25rem] bg-zinc-50 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-black text-zinc-950">
                    {snapshot.snapshot_date ? new Date(snapshot.snapshot_date).toLocaleString("pt-BR") : "Snapshot"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {snapshot.clients_count || 0} clientes | {snapshot.appointments_count || 0} horários | {snapshot.records_count || 0} atendimentos
                  </p>
                </div>
                <Badge tone="green">Nuvem</Badge>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function SettingsView({
  user,
  profile,
  profileForm,
  setProfileForm,
  updateProfileCategories,
  updateProfileService,
  addProfileService,
  removeProfileService,
  onSave,
  actionLoading,
}) {
  return (
    <div className="grid gap-6">
      <ProfileSetupPanel
        user={user}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        updateProfileCategories={updateProfileCategories}
        updateProfileService={updateProfileService}
        addProfileService={addProfileService}
        removeProfileService={removeProfileService}
        onSave={onSave}
        actionLoading={actionLoading}
      />
      <Panel>
        <PanelHeader title={`${PRODUCT_NAME} by ${PRODUCT_COMPANY}`} subtitle="A mesma base agora atende vários nichos de beleza." />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <InfoCard title="Conta conectada" value={user.email} />
          <InfoCard title="Negócio" value={profile?.business_name || "Não configurado"} />
          <InfoCard title="Áreas ativas" value={(profile?.categories || []).map(categoryLabel).join(", ") || "-"} />
        </div>
        <div className="mt-5 grid gap-3">
          {[
            "IA para sugerir mensagem por perfil de cliente",
            "Upload de fotos antes/depois",
            "Relatório semanal automático",
            "PDF técnico do procedimento para enviar a cliente",
            "Templates comerciais por categoria profissional",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-[1.25rem] bg-zinc-50 p-4">
              <Gem className="mt-0.5 h-4 w-4 text-rose-700" />
              <p className="text-sm font-semibold text-zinc-700">{item}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ReturnOpportunity({ item, onSendReminder, expanded = false }) {
  const { client, record, dueDate, days, contacted } = item;
  const tone = maintenanceTone(dueDate);

  return (
    <div className="flex min-w-0 flex-col justify-between gap-4 rounded-[1.25rem] border border-zinc-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:rounded-[1.5rem] sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black">{client.full_name}</p>
          {client.vip && <Badge tone="gold">VIP</Badge>}
          <Badge tone={tone}>{maintenanceText(dueDate)}</Badge>
          {contacted && <Badge tone="violet">Já chamada</Badge>}
        </div>
        <p className="mt-1 break-words text-sm text-zinc-500">
          Retorno: {formatDate(dueDate)} {record?.service_name || record?.effect ? `| ${record.service_name || record.effect}` : ""}
        </p>
        {expanded && (
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Sugestão: chamar no WhatsApp e oferecer uma janela de agenda que preserve o controle da profissional.
          </p>
        )}
      </div>
      <Button onClick={() => onSendReminder(client, record)} className="h-11 w-full rounded-full bg-emerald-500 px-5 text-white hover:bg-emerald-600 sm:w-auto sm:shrink-0">
        <MessageCircle className="mr-2 h-4 w-4" />
        Chamar cliente
      </Button>
    </div>
  );
}

function ClientListCard({ client, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full min-w-0 max-w-full rounded-[1.5rem] border p-4 text-left transition ${
        selected ? "border-rose-300 bg-rose-50 shadow-sm" : "border-zinc-100 bg-white hover:border-rose-200 hover:bg-rose-50/50"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-black text-zinc-950">{client.full_name}</p>
          <p className="mt-1 break-words text-sm text-zinc-500">{client.whatsapp || "Sem WhatsApp"}</p>
        </div>
        {client.vip && <Badge tone="gold">VIP</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={client.status === "inactive" ? "slate" : client.status === "attention" ? "amber" : "green"}>
          {statusLabel(client.status)}
        </Badge>
        <Badge tone={maintenanceTone(client.next_maintenance_date)}>
          {maintenanceText(client.next_maintenance_date)}
        </Badge>
      </div>
      <p className="mt-3 break-words text-xs font-semibold text-zinc-500">
        Último: {formatDate(client.last_service_date)} | Próximo: {formatDate(client.next_maintenance_date)}
      </p>
    </button>
  );
}

function AppointmentTimeline({ appointment }) {
  return (
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
      <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-xs font-black text-white sm:h-12 sm:w-16 sm:rounded-2xl sm:text-sm">
        {appointment.appointment_time}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-black">{appointment.client_name || "Sem cliente"}</p>
          <Badge tone={appointment.status === "blocked" ? "dark" : appointment.status === "completed" ? "green" : "rose"}>
            {statusLabel(appointment.status)}
          </Badge>
        </div>
        <p className="mt-1 break-words text-sm text-zinc-500">
          {formatDate(appointment.appointment_date)} | {appointment.service_name || "-"}
        </p>
        {appointment.private_note && <p className="mt-1 break-words text-xs text-zinc-500">{appointment.private_note}</p>}
      </div>
    </div>
  );
}

function RecordCard({
  record,
  client,
  profile,
  compact = false,
  onDownloadProcedurePdf,
  onShareProcedurePdf,
}) {
  const serviceName = record.service_name || record.effect || record.service_type;
  return (
    <div className="min-w-0 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/80 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-black">{serviceName}</p>
          <p className="mt-1 break-words text-sm text-zinc-500">
            {formatDate(record.procedure_date)} | Retorno {formatDate(record.next_maintenance_date)}
          </p>
          <p className="mt-1 text-xs font-bold text-zinc-400">{categoryLabel(record.service_category || record.service_type)}</p>
        </div>
        <Badge tone="rose">{money(record.amount)}</Badge>
      </div>
      {!compact && (
        <div className="mt-4 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
          <InfoLine label="Curvatura" value={record.curl || "-"} />
          <InfoLine label="Espessura" value={record.thickness || "-"} />
          <InfoLine label="Tamanhos" value={record.lengths || "-"} />
          <InfoLine label="Produto" value={record.adhesive || "-"} />
          <InfoLine label="Duração" value={record.duration_minutes ? `${record.duration_minutes} min` : "-"} />
          <p className="sm:col-span-2"><strong>Mapa:</strong> {record.mapping_notes || "-"}</p>
        </div>
      )}
      {(onDownloadProcedurePdf || onShareProcedurePdf) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onDownloadProcedurePdf && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDownloadProcedurePdf(record, client)}
              className="h-9 rounded-full text-xs"
            >
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
          )}
          {onShareProcedurePdf && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onShareProcedurePdf(record, client)}
              className="h-9 rounded-full text-xs"
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar PDF
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function PanelHeader({ title, subtitle, action }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-black tracking-tight text-zinc-950">{title}</h2>
        {subtitle && <p className="mt-1 break-words text-sm leading-6 text-zinc-500">{subtitle}</p>}
      </div>
      {action && <div className="w-full min-w-0 [&>*]:w-full sm:w-auto sm:shrink-0 sm:[&>*]:w-auto">{action}</div>}
    </div>
  );
}

function QuickAction({ label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-white px-4 py-2 text-center text-sm font-black leading-tight text-zinc-950 transition hover:scale-[1.02] hover:bg-rose-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-rose-700" />
      {label}
    </button>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/10 p-3 sm:p-4">
      <p className="break-words text-xs font-bold text-white/50">{label}</p>
      <p className="mt-1 break-all text-base font-black sm:text-lg">{value}</p>
    </div>
  );
}

function PerformanceCard({ title, value, text }) {
  return (
    <div className="rounded-[1.5rem] bg-zinc-50 p-5">
      <p className="text-sm font-bold text-zinc-500">{title}</p>
      <p className="mt-2 break-words text-2xl font-black sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}

function FilterChips({ value, onChange, options, className = "" }) {
  return (
    <div className={`flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 ${className}`}>
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${
            value === id ? "bg-zinc-950 text-white" : "bg-white text-zinc-600 hover:bg-rose-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function InfoCard({ title, value, badge }) {
  return (
    <div className="min-w-0 rounded-[1.5rem] bg-zinc-50 p-4">
      <p className="break-words text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{title}</p>
      <p className="mt-2 break-words text-base font-black text-zinc-950">{value}</p>
      {badge && <p className="mt-2 text-xs font-bold text-rose-700">{badge}</p>}
    </div>
  );
}

function ProntuarioBlock({ title, icon: Icon, children }) {
  return (
    <div className="min-w-0 rounded-[1.5rem] border border-zinc-100 bg-white p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 break-words font-black">{title}</h3>
      </div>
      <div className="min-w-0 break-words text-sm leading-6 text-zinc-600">{children}</div>
    </div>
  );
}

function PhotoPlaceholder({ label }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center">
      <div>
        <Camera className="mx-auto h-6 w-6 text-zinc-400" />
        <p className="mt-2 text-sm font-black text-zinc-600">{label}</p>
        <p className="mt-1 text-xs text-zinc-400">Preparado para upload futuro</p>
      </div>
    </div>
  );
}

function FormStep({ number, title, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[1.25rem] border border-zinc-100 bg-white p-4 sm:rounded-[1.5rem] sm:p-5">
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-black text-white">
          {number}
        </span>
        <h3 className="min-w-0 break-words font-black">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function RankRow({ index, label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[1.25rem] bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-zinc-500">
          {index}
        </span>
        <p className="min-w-0 break-words font-black">{label}</p>
      </div>
      <p className="break-words text-sm font-bold text-zinc-500 sm:text-right">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f6f1ef]">
      <div className="grid justify-items-center gap-5">
        <img src="/brand/studiosbook-mark.svg" alt="StudiosBook" className="h-16 w-16 animate-pulse" />
        <div className="h-1 w-20 overflow-hidden rounded-full bg-[#eadde3]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#a84d68]" />
        </div>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex min-h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-700" />
    </div>
  );
}
