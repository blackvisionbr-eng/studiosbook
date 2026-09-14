import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Clipboard,
  ExternalLink,
  Link2,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  Save,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { base44 } from "@/api/base44Client.js";

const DAYS = [
  ["1", "Segunda"], ["2", "Terça"], ["3", "Quarta"], ["4", "Quinta"],
  ["5", "Sexta"], ["6", "Sábado"], ["0", "Domingo"],
];

const DEFAULT_HOURS = Object.fromEntries(DAYS.map(([id]) => [id, {
  enabled: id !== "0",
  start: "09:00",
  end: id === "6" ? "13:00" : "18:00",
}]));

function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function money(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(cents) || 0) / 100);
}

const BOOKING_LABELS = {
  pending_payment: "Aguardando pagamento",
  confirmed: "Confirmado",
  payment_review: "Em análise",
  cancelled: "Cancelado",
  expired: "Expirado",
  completed: "Concluído",
  no_show: "Não compareceu",
};

function initialForm(profile, settings) {
  const sourceServices = settings?.services?.length ? settings.services : (profile?.services || []).filter((item) => item.active !== false).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price_cents: Math.round(Number(item.price || 0) * 100),
    duration_minutes: Number(item.duration_minutes || 60),
    active: true,
    payment_required: true,
  }));
  return {
    business_name: settings?.business_name || profile?.business_name || "Meu Studio",
    slug: settings?.slug || slugify(profile?.business_name || "meu-studio"),
    description: settings?.description || "",
    city: settings?.city || "",
    whatsapp: settings?.whatsapp || profile?.whatsapp || "",
    booking_enabled: settings?.booking_enabled === true,
    payment_required: settings?.payment_required !== false,
    payment_mode: settings?.payment_mode || "deposit",
    deposit_percent: Number(settings?.deposit_percent || 30),
    hold_minutes: Number(settings?.hold_minutes || 10),
    slot_interval_minutes: Number(settings?.slot_interval_minutes || 15),
    cancellation_policy: settings?.cancellation_policy || "Cancelamentos e reembolsos seguem a política informada pelo studio.",
    services: sourceServices,
    professionals: settings?.professionals?.length ? settings.professionals : [{ id: "owner", name: profile?.owner_name || "Profissional", active: true, service_ids: [] }],
    weekly_hours: settings?.weekly_hours || DEFAULT_HOURS,
  };
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#8e3158]" : "bg-zinc-300"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function Field({ label, id, children, hint }) {
  return <div className="min-w-0"><label htmlFor={id} className="block text-sm font-bold text-zinc-800">{label}</label>{children}{hint && <p className="mt-1.5 text-xs leading-5 text-zinc-500">{hint}</p>}</div>;
}

export default function ReceivablesApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [dashboard, setDashboard] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!(await base44.auth.isAuthenticated())) {
        setUser(null);
        return;
      }
      const [me, profiles, currentStatus] = await Promise.all([
        base44.auth.me(),
        base44.entities.StudioProfile.list("-updated_date", 1),
        base44.functions.invoke("booking-settings-status"),
      ]);
      const profile = profiles[0] || null;
      setUser(me);
      setStatus(currentStatus);
      setForm(initialForm(profile, currentStatus.settings));
      if (currentStatus.entitled) {
        setDashboard(await base44.functions.invoke("booking-dashboard"));
      } else {
        setDashboard(null);
      }
      const configuredSlug = currentStatus.settings?.slug || slugify(profile?.business_name || "");
      if (configuredSlug) setPublicUrl(`${window.location.origin}/agendar/${configuredSlug}`);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const connection = new URLSearchParams(window.location.search).get("connection");
    if (!connection) return;
    setNotice(connection === "success" ? "Mercado Pago conectado com sucesso." : "A conexão com o Mercado Pago não foi concluída.");
    window.history.replaceState({}, "", "/recebimentos");
  }, []);

  const activeServices = useMemo(() => form?.services?.filter((item) => item.active !== false) || [], [form?.services]);
  const paymentConnected = status?.payment_connection?.status === "connected";

  function patch(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function patchService(id, field, value) {
    setForm((current) => ({
      ...current,
      services: current.services.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
  }

  async function signIn() {
    setError("");
    try {
      await base44.auth.loginWithProvider("google");
      await load();
    } catch (authError) {
      setError(authError.message || "Não foi possível entrar.");
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await base44.functions.invoke("save-booking-settings", {
        ...form,
        slug: slugify(form.slug),
        services: form.services.map((item) => ({ ...item, price_cents: Math.round(Number(item.price_cents) || 0) })),
      });
      setForm((current) => ({ ...current, ...payload.settings, weekly_hours: current.weekly_hours }));
      setPublicUrl(payload.public_url);
      setNotice("Configurações salvas. Sua página pública está atualizada.");
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function connectPayment() {
    setConnecting(true);
    setError("");
    try {
      const payload = await base44.functions.invoke("booking-payment-connect");
      window.location.assign(payload.url);
    } catch (connectError) {
      setError(connectError.message);
      setConnecting(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setNotice("Link de agendamento copiado.");
  }

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-[#fffafb] text-[#35152c]"><LoaderCircle className="animate-spin" /></div>;

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-10">
        <section className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-[0_18px_60px_rgba(53,21,44,0.10)] sm:p-8">
          <img src="/brand/studiosbook-logo.svg" alt="StudiosBook" className="h-10 w-auto" />
          <h1 className="mt-8 font-serif text-3xl leading-tight">Gerencie agenda e recebimentos em uma única operação.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Entre com a mesma conta do StudiosBook para configurar sua página de agendamento.</p>
          {error && <p className="mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
          <button type="button" onClick={signIn} className="mt-6 min-h-12 w-full rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01]">Entrar no StudiosBook</button>
          <a href="/" className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-zinc-600"><ArrowLeft size={17} /> Voltar ao site</a>
        </section>
      </main>
    );
  }

  if (!status?.entitled) {
    return (
      <div className="min-h-dvh bg-[#fffafb]">
        <header className="border-b border-zinc-200 bg-white px-4 py-4"><div className="mx-auto flex max-w-4xl items-center justify-between gap-4"><img src="/brand/studiosbook-logo.svg" alt="StudiosBook" className="h-8 w-auto" /><a href="/" className="text-sm font-bold text-zinc-700">Meu Studio</a></div></header>
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a63d68]">StudiosBook Recebimentos</p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">Confirme horários somente após o pagamento.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">Agendamento on-line, Pix e cartão, sinal configurável, baixa automática e relatório financeiro.</p>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            <div className="border-t-2 border-[#a63d68] pt-4"><WalletCards className="text-[#8e3158]" /><strong className="mt-3 block">R$ 59,90/mês</strong><span className="mt-1 block text-sm text-zinc-600">Sem fidelidade.</span></div>
            <div className="border-t-2 border-[#a63d68] pt-4"><CircleDollarSign className="text-[#8e3158]" /><strong className="mt-3 block">0,79% por pagamento</strong><span className="mt-1 block text-sm text-zinc-600">Comissão limitada a R$ 59,90/mês.</span></div>
            <div className="border-t-2 border-[#a63d68] pt-4"><ShieldCheck className="text-[#8e3158]" /><strong className="mt-3 block">Pagamento validado</strong><span className="mt-1 block text-sm text-zinc-600">Confirmação consultada no provedor.</span></div>
          </div>
          <a href="https://wa.me/5573981068594?text=Oi%2C%20quero%20ativar%20o%20StudiosBook%20Recebimentos." target="_blank" rel="noreferrer" className="mt-9 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-6 text-sm font-extrabold text-white transition hover:scale-[1.01] sm:w-auto"><Smartphone size={18} /> Solicitar ativação</a>
          {error && <p className="mt-5 rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#fffafb] text-[#24111f]">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3"><img src="/brand/studiosbook-mark.svg" alt="" className="h-9 w-9" /><div className="min-w-0"><p className="truncate text-sm font-extrabold">StudiosBook Recebimentos</p><p className="truncate text-xs text-zinc-500">Configuração da agenda pública</p></div></div>
          <a href="/" className="shrink-0 text-sm font-bold text-zinc-700">Meu Studio</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a63d68]">Agendamento e pagamento</p><h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">Configure como seus clientes reservam.</h1></div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold ${paymentConnected ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><span className={`h-2 w-2 rounded-full ${paymentConnected ? "bg-emerald-500" : "bg-amber-500"}`} />{paymentConnected ? "Mercado Pago conectado" : "Conexão pendente"}</div>
        </div>

        {notice && <div role="status" className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
        {error && <div role="alert" className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

        {!paymentConnected && (
          <section className="mt-7 flex flex-col justify-between gap-5 border-y border-zinc-200 bg-white px-4 py-6 sm:flex-row sm:items-center sm:px-6">
            <div><h2 className="font-extrabold">Conecte a conta que receberá os pagamentos</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">A conexão é feita pelo Mercado Pago. O StudiosBook não acessa sua senha e armazena os tokens criptografados.</p></div>
            <button type="button" disabled={connecting || !status.marketplace_ready} onClick={connectPayment} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white disabled:opacity-50">{connecting ? <LoaderCircle size={18} className="animate-spin" /> : <Link2 size={18} />} Conectar Mercado Pago</button>
          </section>
        )}

        {publicUrl && (
          <section className="mt-7 flex flex-col justify-between gap-4 rounded-lg border border-[#dfbdcc] bg-[#fff3f7] p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0"><p className="text-xs font-extrabold uppercase text-[#8e3158]">Seu link de agendamento</p><p className="mt-1 truncate text-sm font-bold">{publicUrl}</p></div>
            <div className="flex shrink-0 gap-2"><button type="button" onClick={copyLink} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#c7829f] bg-white px-4 text-sm font-bold"><Clipboard size={17} /> Copiar</button><a href={publicUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-md bg-[#35152c] px-3 text-white" aria-label="Abrir página"><ExternalLink size={18} /></a></div>
          </section>
        )}

        {dashboard && (
          <section className="mt-8">
            <div className="border-b border-zinc-200 pb-4"><p className="text-xs font-extrabold text-[#a63d68]">Operação</p><h2 className="mt-1 text-xl font-extrabold">Reservas e recebimentos</h2></div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">Reservas</p><p className="mt-1 text-2xl font-extrabold">{dashboard.metrics.total || 0}</p></div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">Confirmadas</p><p className="mt-1 text-2xl font-extrabold">{dashboard.metrics.confirmed || 0}</p></div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">Recebido</p><p className="mt-1 break-words text-xl font-extrabold">{money(dashboard.metrics.approved_amount_cents)}</p></div>
              <div className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">Comissão no mês</p><p className="mt-1 break-words text-xl font-extrabold">{money(dashboard.commission.approved_cents)}</p><p className="mt-1 text-[11px] text-zinc-500">Limite {money(dashboard.commission.cap_cents)}</p></div>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-4 py-3 text-sm font-extrabold">Últimas reservas</div>
              {dashboard.appointments.length ? <div className="divide-y divide-zinc-100">{dashboard.appointments.slice(0, 10).map((item) => (
                <article key={item.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_140px_150px] sm:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-extrabold">{item.customer_name}</p><p className="mt-1 truncate text-xs text-zinc-500">{item.service_name} · {item.professional_name}</p></div>
                  <div className="text-xs"><strong className="block">{item.appointment_date}</strong><span className="text-zinc-500">{item.appointment_time}</span></div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-bold">{BOOKING_LABELS[item.status] || item.status}</span><strong className="text-sm sm:mt-2 sm:block">{money(item.amount_cents)}</strong></div>
                </article>
              ))}</div> : <p className="px-4 py-8 text-center text-sm text-zinc-500">As reservas aparecerão aqui após a publicação do link.</p>}
            </div>
          </section>
        )}

        <form onSubmit={save} className="mt-8 space-y-10">
          <section>
            <div className="border-b border-zinc-200 pb-4"><p className="text-xs font-extrabold text-[#a63d68]">01</p><h2 className="mt-1 text-xl font-extrabold">Página pública</h2></div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Nome exibido" id="business-name"><input id="business-name" required value={form.business_name} onChange={(event) => patch("business_name", event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" /></Field>
              <Field label="Endereço do link" id="slug" hint={`studiosbook.com.br/agendar/${slugify(form.slug)}`}><input id="slug" required value={form.slug} onChange={(event) => patch("slug", event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" /></Field>
              <Field label="Cidade" id="city"><input id="city" value={form.city} onChange={(event) => patch("city", event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" /></Field>
              <Field label="WhatsApp" id="whatsapp"><input id="whatsapp" inputMode="tel" value={form.whatsapp} onChange={(event) => patch("whatsapp", event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" /></Field>
            </div>
            <label className="mt-5 flex items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white p-4"><span><strong className="block text-sm">Agenda pública ativa</strong><span className="mt-1 block text-xs text-zinc-500">Permite que clientes consultem e reservem horários.</span></span><Toggle checked={form.booking_enabled} onChange={(value) => patch("booking_enabled", value)} label="Ativar agenda pública" /></label>
          </section>

          <section>
            <div className="border-b border-zinc-200 pb-4"><p className="text-xs font-extrabold text-[#a63d68]">02</p><h2 className="mt-1 text-xl font-extrabold">Regra de pagamento</h2></div>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <Field label="Cobrança antecipada" id="payment-mode"><select id="payment-mode" value={form.payment_mode} onChange={(event) => patch("payment_mode", event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base"><option value="deposit">Sinal</option><option value="full">Valor integral</option><option value="optional">Sem pagamento antecipado</option></select></Field>
              <Field label="Percentual do sinal" id="deposit"><input id="deposit" type="number" min="1" max="100" disabled={form.payment_mode !== "deposit"} value={form.deposit_percent} onChange={(event) => patch("deposit_percent", Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base disabled:bg-zinc-100" /></Field>
              <Field label="Prazo para pagar" id="hold"><select id="hold" value={form.hold_minutes} onChange={(event) => patch("hold_minutes", Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base"><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="15">15 minutos</option></select></Field>
            </div>
            <Field label="Política de cancelamento e reembolso" id="policy"><textarea id="policy" rows="4" value={form.cancellation_policy} onChange={(event) => patch("cancellation_policy", event.target.value)} className="mt-2 w-full rounded-md border border-zinc-300 bg-white p-3 text-base" /></Field>
          </section>

          <section>
            <div className="border-b border-zinc-200 pb-4"><p className="text-xs font-extrabold text-[#a63d68]">03</p><h2 className="mt-1 text-xl font-extrabold">Serviços publicados</h2><p className="mt-1 text-sm text-zinc-600">Selecione os serviços que podem ser agendados e quais exigem pagamento antecipado.</p></div>
            <div className="mt-5 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              {form.services.map((item) => (
                <div key={item.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto] sm:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-extrabold">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.duration_minutes} minutos</p></div>
                  <Field label="Preço" id={`price-${item.id}`}><div className="relative mt-2"><span className="absolute left-3 top-3 text-sm text-zinc-500">R$</span><input id={`price-${item.id}`} type="number" min="0" step="0.01" value={(Number(item.price_cents || 0) / 100).toFixed(2)} onChange={(event) => patchService(item.id, "price_cents", Math.round(Number(event.target.value) * 100))} className="min-h-11 w-full rounded-md border border-zinc-300 pl-10 pr-2 text-sm" /></div></Field>
                  <label className="flex items-center justify-between gap-3 text-xs font-bold"><span>Exigir pagamento</span><Toggle checked={item.payment_required !== false} onChange={(value) => patchService(item.id, "payment_required", value)} label={`Exigir pagamento em ${item.name}`} /></label>
                  <label className="flex items-center justify-between gap-3 text-xs font-bold"><span>Publicado</span><Toggle checked={item.active !== false} onChange={(value) => patchService(item.id, "active", value)} label={`Publicar ${item.name}`} /></label>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">{activeServices.length} serviço(s) publicado(s). Novos serviços são gerenciados no Catálogo do StudiosBook.</p>
          </section>

          <section>
            <div className="border-b border-zinc-200 pb-4"><p className="text-xs font-extrabold text-[#a63d68]">04</p><h2 className="mt-1 text-xl font-extrabold">Disponibilidade semanal</h2></div>
            <div className="mt-5 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white px-4">
              {DAYS.map(([id, label]) => {
                const hours = form.weekly_hours[id] || DEFAULT_HOURS[id];
                return <div key={id} className="grid gap-3 py-4 sm:grid-cols-[130px_auto_1fr] sm:items-center"><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={hours.enabled} onChange={(event) => patch("weekly_hours", { ...form.weekly_hours, [id]: { ...hours, enabled: event.target.checked } })} className="h-4 w-4 accent-[#8e3158]" />{label}</label><div className="grid grid-cols-2 gap-2"><input type="time" disabled={!hours.enabled} value={hours.start} onChange={(event) => patch("weekly_hours", { ...form.weekly_hours, [id]: { ...hours, start: event.target.value } })} className="min-h-11 rounded-md border border-zinc-300 px-2 disabled:bg-zinc-100" /><input type="time" disabled={!hours.enabled} value={hours.end} onChange={(event) => patch("weekly_hours", { ...form.weekly_hours, [id]: { ...hours, end: event.target.value } })} className="min-h-11 rounded-md border border-zinc-300 px-2 disabled:bg-zinc-100" /></div></div>;
              })}
            </div>
          </section>

          <div className="sticky bottom-3 z-10 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-[0_12px_40px_rgba(53,21,44,0.16)] backdrop-blur">
            <button type="submit" disabled={saving || !activeServices.length || (form.booking_enabled && !paymentConnected && form.payment_mode !== "optional")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.005] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <><LoaderCircle size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar configurações</>}</button>
            {form.booking_enabled && !paymentConnected && form.payment_mode !== "optional" && <p className="mt-2 text-center text-xs font-semibold text-amber-700">Conecte o Mercado Pago antes de publicar uma agenda com pagamento.</p>}
          </div>
        </form>

        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-zinc-200 py-7 text-xs text-zinc-500"><span className="flex items-center gap-1"><LockKeyhole size={14} /> Tokens criptografados</span><span className="flex items-center gap-1"><QrCode size={14} /> Pix e cartão</span><span className="flex items-center gap-1"><Check size={14} /> Confirmação automática</span></footer>
      </main>
    </div>
  );
}
