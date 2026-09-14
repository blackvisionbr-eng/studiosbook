import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URLS || import.meta.env.VITE_API_BASE_URL || "https://studiosbook-api-production.up.railway.app")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

function money(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(cents) || 0) / 100);
}

function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function maxDate() {
  const value = new Date();
  value.setDate(value.getDate() + 90);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function bookingSlug() {
  const match = window.location.pathname.match(/^\/agendar\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : new URLSearchParams(window.location.search).get("studio") || "";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Não foi possível concluir esta operação.");
  return payload;
}

const STATUS_COPY = {
  pending_payment: ["Aguardando pagamento", "Conclua o pagamento dentro do prazo para manter este horário."],
  confirmed: ["Agendamento confirmado", "O pagamento foi aprovado e o horário está reservado para você."],
  payment_review: ["Pagamento em análise", "O pagamento foi recebido e o studio está validando a disponibilidade."],
  cancelled: ["Agendamento cancelado", "O pagamento foi reembolsado ou o agendamento foi cancelado."],
  expired: ["Reserva expirada", "O prazo terminou. Escolha um novo horário para continuar."],
  completed: ["Atendimento concluído", "Seu atendimento foi concluído pelo studio."],
};

function Progress({ current }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do agendamento">
      {["Serviço", "Horário", "Dados", "Confirmar"].map((label, index) => (
        <li key={label} className="min-w-0">
          <div className={`h-1 rounded-full ${index + 1 <= current ? "bg-[#a63d68]" : "bg-[#eadfe5]"}`} />
          <span className={`mt-2 block truncate text-[11px] font-bold ${index + 1 === current ? "text-[#35152c]" : "text-zinc-500"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusScreen({ booking, onRestart }) {
  const [title, description] = STATUS_COPY[booking.status] || STATUS_COPY.pending_payment;
  const confirmed = booking.status === "confirmed";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-[0_18px_60px_rgba(53,21,44,0.10)] sm:p-8">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${confirmed ? "bg-emerald-50 text-emerald-700" : "bg-[#faedf2] text-[#8e3158]"}`}>
          {confirmed ? <Check size={28} /> : <Clock3 size={27} />}
        </div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-[#a63d68]">Status do agendamento</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-[#24111f] sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
        <dl className="mt-7 divide-y divide-zinc-100 border-y border-zinc-100 text-sm">
          <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Serviço</dt><dd className="text-right font-bold text-zinc-900">{booking.service_name}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Profissional</dt><dd className="text-right font-bold text-zinc-900">{booking.professional_name}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Data e horário</dt><dd className="text-right font-bold text-zinc-900">{booking.appointment_date} às {booking.appointment_time}</dd></div>
          {booking.amount_cents > 0 && <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Valor on-line</dt><dd className="text-right font-bold text-zinc-900">{money(booking.amount_cents)}</dd></div>}
        </dl>
        {booking.checkout_url && booking.status === "pending_payment" && (
          <a href={booking.checkout_url} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01] hover:bg-[#4c203f]">
            <CreditCard size={18} /> Continuar pagamento
          </a>
        )}
        {["cancelled", "expired"].includes(booking.status) && (
          <button type="button" onClick={onRestart} className="mt-6 min-h-12 w-full rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01]">Escolher outro horário</button>
        )}
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-500"><ShieldCheck size={15} /> Confirmação validada pelo servidor do StudiosBook.</p>
      </section>
    </main>
  );
}

export default function BookingApp() {
  const slug = useMemo(bookingSlug, []);
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  const service = studio?.services?.find((item) => item.id === serviceId);
  const professional = studio?.professionals?.find((item) => item.id === professionalId);
  const eligibleProfessionals = (studio?.professionals || []).filter((item) => !item.service_ids?.length || item.service_ids.includes(serviceId));

  useEffect(() => {
    let active = true;
    if (!slug) {
      setError("Endereço de agendamento inválido.");
      setLoading(false);
      return undefined;
    }
    api(`/public/booking/studios/${encodeURIComponent(slug)}`)
      .then(({ studio: value }) => {
        if (!active) return;
        setStudio(value);
        if (value.services?.length === 1) setServiceId(value.services[0].id);
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!studio?.studio_id) return undefined;
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking");
    const token = params.get("token");
    if (!bookingId || !token) return undefined;
    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const payload = await api(`/public/booking/bookings/${encodeURIComponent(bookingId)}/status?studio_id=${encodeURIComponent(studio.studio_id)}&token=${encodeURIComponent(token)}`);
        if (!active) return;
        setBooking(payload.booking);
        if (["pending_payment", "payment_review"].includes(payload.booking.status)) timer = window.setTimeout(refresh, 4000);
      } catch (statusError) {
        if (active) setError(statusError.message);
      }
    };
    refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [studio?.studio_id]);

  useEffect(() => {
    setProfessionalId(eligibleProfessionals.some((item) => item.id === professionalId) ? professionalId : eligibleProfessionals[0]?.id || "");
  }, [serviceId, studio]);

  useEffect(() => {
    if (!studio || !serviceId || !professionalId || !date) return;
    let active = true;
    setSlotsLoading(true);
    setTime("");
    api(`/public/booking/studios/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(date)}&service_id=${encodeURIComponent(serviceId)}&professional_id=${encodeURIComponent(professionalId)}`)
      .then((payload) => active && setSlots(payload.slots || []))
      .catch((slotError) => active && setError(slotError.message))
      .finally(() => active && setSlotsLoading(false));
    return () => { active = false; };
  }, [studio, slug, serviceId, professionalId, date]);

  const estimatedCharge = service
    ? studio.payment_required === false
      ? 0
      : studio.payment_mode === "full"
      ? service.price_cents
      : studio.payment_mode === "optional" || service.payment_required === false
        ? 0
        : Math.round(service.price_cents * studio.deposit_percent / 100)
    : 0;

  async function submitBooking(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const hold = await api(`/public/booking/studios/${encodeURIComponent(slug)}/holds`, {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          professional_id: professionalId,
          appointment_date: date,
          appointment_time: time,
          customer,
        }),
      });
      if (hold.booking.amount_cents <= 0) {
        setBooking(hold.booking);
        return;
      }
      const checkout = await api(`/public/booking/bookings/${encodeURIComponent(hold.booking.id)}/checkout`, {
        method: "POST",
        body: JSON.stringify({ token: hold.token, studio_id: hold.booking.studio_id }),
      });
      window.location.assign(checkout.checkout_url);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-[#fffafb] text-[#35152c]"><LoaderCircle className="animate-spin" /></div>;
  if (booking) return <StatusScreen booking={booking} onRestart={() => { setBooking(null); setStep(1); window.history.replaceState({}, "", `/agendar/${slug}`); }} />;
  if (!studio) return <main className="mx-auto max-w-lg px-5 py-20 text-center"><h1 className="font-serif text-3xl">Agenda indisponível</h1><p className="mt-3 text-zinc-600">{error || "Esta página não está disponível no momento."}</p></main>;

  return (
    <div className="min-h-dvh bg-[#fffafb] text-[#24111f]">
      <header className="border-b border-[#eadfe5] bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/brand/studiosbook-mark.svg" alt="" className="h-9 w-9 shrink-0" />
            <div className="min-w-0"><p className="truncate text-sm font-extrabold">{studio.business_name}</p><p className="truncate text-xs text-zinc-500">Agendamento on-line</p></div>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-zinc-500"><LockKeyhole size={14} /> Seguro</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a63d68]">Reserve seu horário</p>
        <h1 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">Escolha o melhor momento para cuidar de você.</h1>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-600">
          {studio.city && <span className="flex items-center gap-2"><MapPin size={16} /> {studio.city}</span>}
          <span className="flex items-center gap-2"><CalendarDays size={16} /> Confirmação on-line</span>
        </div>

        <div className="mt-8"><Progress current={step} /></div>
        {error && <div role="alert" className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

        {step === 1 && (
          <section className="mt-8">
            <h2 className="text-lg font-extrabold">Qual serviço você deseja?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {studio.services.map((item) => (
                <button key={item.id} type="button" onClick={() => setServiceId(item.id)} className={`min-h-24 rounded-lg border p-4 text-left transition hover:scale-[1.01] ${serviceId === item.id ? "border-[#a63d68] bg-[#fff3f7] shadow-sm" : "border-zinc-200 bg-white hover:border-[#d79ab4]"}`}>
                  <span className="flex items-start justify-between gap-4"><strong className="text-sm leading-5">{item.name}</strong>{serviceId === item.id && <Check size={18} className="shrink-0 text-[#a63d68]" />}</span>
                  <span className="mt-2 block text-xs text-zinc-500">{item.duration_minutes} min</span>
                  <span className="mt-1 block text-base font-extrabold">{money(item.price_cents)}</span>
                </button>
              ))}
            </div>
            <button type="button" disabled={!serviceId} onClick={() => setStep(2)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40">Escolher horário <ChevronRight size={18} /></button>
          </section>
        )}

        {step === 2 && (
          <section className="mt-8">
            <button type="button" onClick={() => setStep(1)} className="mb-5 flex items-center gap-2 text-sm font-bold text-zinc-600"><ArrowLeft size={17} /> Voltar</button>
            <h2 className="text-lg font-extrabold">Profissional, data e horário</h2>
            <label className="mt-4 block text-sm font-bold" htmlFor="professional">Profissional</label>
            <select id="professional" value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base">
              {eligibleProfessionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label className="mt-4 block text-sm font-bold" htmlFor="booking-date">Data</label>
            <input id="booking-date" type="date" min={today()} max={maxDate()} value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" />
            <p className="mt-5 text-sm font-bold">Horários disponíveis</p>
            {slotsLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle size={18} className="animate-spin" /> Consultando agenda...</div> : slots.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.map((slot) => <button type="button" key={slot.start} onClick={() => setTime(slot.start)} className={`min-h-11 rounded-md border text-sm font-bold transition ${time === slot.start ? "border-[#35152c] bg-[#35152c] text-white" : "border-zinc-200 bg-white hover:border-[#a63d68]"}`}>{slot.start}</button>)}
              </div>
            ) : <p className="mt-3 rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-600">Não há horários livres nesta data.</p>}
            <button type="button" disabled={!time} onClick={() => setStep(3)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40">Informar meus dados <ChevronRight size={18} /></button>
          </section>
        )}

        {step === 3 && (
          <form className="mt-8" onSubmit={(event) => { event.preventDefault(); setStep(4); }}>
            <button type="button" onClick={() => setStep(2)} className="mb-5 flex items-center gap-2 text-sm font-bold text-zinc-600"><ArrowLeft size={17} /> Voltar</button>
            <h2 className="text-lg font-extrabold">Seus dados para confirmação</h2>
            <label className="mt-4 block text-sm font-bold" htmlFor="customer-name">Nome completo</label>
            <input id="customer-name" required autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" />
            <label className="mt-4 block text-sm font-bold" htmlFor="customer-phone">WhatsApp</label>
            <input id="customer-phone" required inputMode="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="(73) 99999-9999" className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" />
            <label className="mt-4 block text-sm font-bold" htmlFor="customer-email">E-mail <span className="font-normal text-zinc-500">(opcional)</span></label>
            <input id="customer-email" type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base" />
            <button type="submit" className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01]">Revisar agendamento <ChevronRight size={18} /></button>
          </form>
        )}

        {step === 4 && (
          <form className="mt-8" onSubmit={submitBooking}>
            <button type="button" onClick={() => setStep(3)} className="mb-5 flex items-center gap-2 text-sm font-bold text-zinc-600"><ArrowLeft size={17} /> Voltar</button>
            <h2 className="text-lg font-extrabold">Confira antes de confirmar</h2>
            <dl className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white px-4 text-sm">
              <div className="flex justify-between gap-4 py-4"><dt className="text-zinc-500">Serviço</dt><dd className="text-right font-bold">{service?.name}</dd></div>
              <div className="flex justify-between gap-4 py-4"><dt className="text-zinc-500">Profissional</dt><dd className="text-right font-bold">{professional?.name}</dd></div>
              <div className="flex justify-between gap-4 py-4"><dt className="text-zinc-500">Data e horário</dt><dd className="text-right font-bold">{date} às {time}</dd></div>
              <div className="flex justify-between gap-4 py-4"><dt className="text-zinc-500">Serviço</dt><dd className="text-right font-bold">{money(service?.price_cents)}</dd></div>
              <div className="flex justify-between gap-4 py-4"><dt className="text-zinc-500">Pagamento agora</dt><dd className="text-right font-extrabold text-[#8e3158]">{estimatedCharge > 0 ? money(estimatedCharge) : "Não exigido"}</dd></div>
            </dl>
            {estimatedCharge > 0 && <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-600"><CreditCard size={16} className="mt-0.5 shrink-0" /> Você poderá pagar por Pix ou cartão no ambiente seguro do Mercado Pago. O horário será confirmado após a aprovação.</p>}
            <p className="mt-4 text-xs leading-5 text-zinc-500">Ao confirmar, você autoriza o uso dos dados informados para organizar esta reserva e declara que leu a <a href="/privacy.html" target="_blank" rel="noreferrer" className="font-bold text-[#8e3158] underline">Política de Privacidade</a> e os <a href="/terms.html" target="_blank" rel="noreferrer" className="font-bold text-[#8e3158] underline">Termos de Uso</a>.</p>
            <button type="submit" disabled={submitting} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#35152c] px-5 text-sm font-extrabold text-white transition hover:scale-[1.01] disabled:opacity-60">{submitting ? <><LoaderCircle size={18} className="animate-spin" /> Processando...</> : estimatedCharge > 0 ? <><CreditCard size={18} /> Reservar e pagar</> : <><Check size={18} /> Confirmar agendamento</>}</button>
          </form>
        )}

        <footer className="mt-12 border-t border-zinc-200 pt-6 text-center text-xs leading-5 text-zinc-500">
          Agendamento protegido pelo <strong className="text-zinc-700">StudiosBook</strong>. Seus dados são usados apenas para esta reserva.
        </footer>
      </main>
    </div>
  );
}
