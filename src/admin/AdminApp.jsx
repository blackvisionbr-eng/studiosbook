import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  QrCode,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAuth, invokeAdmin, signInAdmin, signOutAdmin } from "./firebaseAdminClient.js";

const tabs = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "accounts", label: "Contas", icon: Users },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "system", label: "Sistema", icon: Server },
];

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const loadOverview = async (currentUser = adminAuth.currentUser) => {
    if (!currentUser) return;
    setLoading("overview");
    setError("");
    try {
      const result = await invokeAdmin("admin-overview", {}, currentUser);
      setData(result);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 || requestError.status === 403) setAuthorized(false);
    } finally {
      setLoading("");
    }
  };

  useEffect(() => {
    let active = true;
    return onAuthStateChanged(adminAuth, async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setError("");
      if (!currentUser) {
        setAuthorized(false);
        setData(null);
        setAuthLoading(false);
        return;
      }
      try {
        await currentUser.getIdToken(true);
        await invokeAdmin("admin-session", {}, currentUser);
        if (!active) return;
        setAuthorized(true);
        await loadOverview(currentUser);
      } catch (sessionError) {
        if (!active) return;
        setAuthorized(false);
        setError(
          sessionError.status === 403
            ? "Esta conta não possui permissão administrativa."
            : "Não foi possível validar a sessão administrativa."
        );
      } finally {
        if (active) setAuthLoading(false);
      }
    });
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading("login");
    setError("");
    try {
      await signInAdmin(String(form.get("email") || "").trim(), String(form.get("password") || ""));
    } catch {
      setError("E-mail, senha ou permissão administrativa inválidos.");
    } finally {
      setLoading("");
    }
  };

  const handleLogout = async () => {
    await signOutAdmin();
    window.location.replace("/admin");
  };

  const handleDiagnostics = async () => {
    setLoading("diagnostics");
    setError("");
    try {
      setDiagnostics(await invokeAdmin("admin-payment-diagnostics"));
      showNotice("Diagnóstico concluído.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const handleExport = async () => {
    if (!window.confirm("A exportação contém dados pessoais. Continuar e baixar o arquivo?")) return;
    setLoading("export");
    try {
      const payload = await invokeAdmin("admin-export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `studiosbook-admin-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showNotice("Exportação protegida baixada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const updateSubscription = async (account) => {
    if (!window.confirm("Consultar e aplicar o status confirmado diretamente pelo Mercado Pago?")) return;
    setLoading(`subscription-${account.uid}`);
    try {
      await invokeAdmin("admin-update-subscription", {
        uid: account.uid,
      });
      await loadOverview();
      showNotice("Cobrança sincronizada com o Mercado Pago.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const updateAccess = async (account) => {
    const disabled = !account.disabled;
    if (!window.confirm(`${disabled ? "Bloquear" : "Liberar"} o acesso desta conta?`)) return;
    setLoading(`access-${account.uid}`);
    try {
      await invokeAdmin("admin-set-user-access", { uid: account.uid, disabled });
      await loadOverview();
      showNotice(disabled ? "Conta bloqueada." : "Conta liberada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.users || [];
    return (data?.users || []).filter((account) =>
      [account.email, account.displayName, account.business_name, account.uid]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data?.users, search]);

  if (authLoading) return <AdminLoading />;
  if (!user || !authorized) return <AdminLogin onSubmit={handleLogin} loading={loading === "login"} error={error} />;

  return (
    <div className="min-h-dvh bg-[#f5f5f4] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white sm:bg-white/95 sm:backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          <Brand />
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-bold text-zinc-900">{user.email}</p>
              <p className="text-[11px] text-zinc-500">Administrador</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="rounded-full">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto overscroll-x-contain px-3 pb-3 sm:px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  activeTab === tab.id ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-7">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a84d68]">BlackVision Operations</p>
            <h1 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">Painel administrativo</h1>
            <p className="mt-1 text-sm text-zinc-500">Acesso separado, auditado e protegido por cargo.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button type="button" onClick={() => loadOverview()} disabled={loading === "overview"} variant="ghost" className="h-10 rounded-lg border bg-white">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading === "overview" ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button type="button" onClick={handleExport} disabled={loading === "export"} className="h-10 rounded-lg bg-zinc-950 text-white">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {activeTab === "overview" && <Overview data={data} loading={loading === "overview"} />}
        {activeTab === "accounts" && (
          <Accounts
            users={filteredUsers}
            search={search}
            setSearch={setSearch}
            loading={loading}
            onSubscription={updateSubscription}
            onAccess={updateAccess}
          />
        )}
        {activeTab === "payments" && <Payments rows={data?.recent_payments || []} />}
        {activeTab === "system" && (
          <System data={data} diagnostics={diagnostics} loading={loading} onDiagnostics={handleDiagnostics} />
        )}
      </main>
    </div>
  );
}

function AdminLogin({ onSubmit, loading, error }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="grid min-h-dvh bg-[#f5f5f4] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center px-3 py-6 sm:px-8 sm:py-10">
        <form onSubmit={onSubmit} className="w-full min-w-0 max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-xl sm:p-8">
          <Brand />
          <div className="mt-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-normal">Acesso administrativo</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Use a conta autorizada pela BlackVision.</p>
          </div>
          {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              E-mail
              <Input name="email" type="email" autoComplete="username" required className="h-12 rounded-lg" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Senha
              <div className="relative">
                <Input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="h-12 rounded-lg pr-12" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-md text-zinc-500" title={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <Button type="submit" disabled={loading} className="h-12 rounded-lg bg-zinc-950 text-white">
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {loading ? "Validando..." : "Entrar com segurança"}
            </Button>
          </div>
          <a href="/" className="mt-6 block text-center text-sm font-bold text-zinc-500 hover:text-zinc-950">Voltar ao StudiosBook</a>
        </form>
      </section>
      <section className="hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <img src="/brand/studiosbook-mark-reversed.svg" alt="" className="h-14 w-14" />
        <div className="max-w-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-200">Ambiente restrito</p>
          <h2 className="mt-5 text-5xl font-black leading-tight tracking-normal">Operação, receita e contas em um único controle.</h2>
          <p className="mt-5 text-base leading-7 text-white/60">Sessões verificadas no servidor, ações críticas auditadas e dados isolados do aplicativo dos profissionais.</p>
        </div>
        <p className="text-xs text-white/35">StudiosBook by BlackVision</p>
      </section>
    </main>
  );
}

function Overview({ data, loading }) {
  const metrics = data?.metrics || {};
  const cards = [
    ["Usuários", metrics.users || 0, Users],
    ["Acessos ativos", metrics.active_subscriptions || 0, UserCheck],
    ["Em teste", metrics.trialing_users || 0, Activity],
    ["Expirados", metrics.expired_users || 0, AlertTriangle],
    ["Pagamentos pendentes", metrics.pending_payments || 0, QrCode],
    ["Receita confirmada", money(metrics.approved_revenue), CreditCard],
  ];
  if (loading && !data) return <LoadingPanel />;
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value, Icon]) => (
        <div key={label} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><p className="text-sm font-bold text-zinc-500">{label}</p><p className="mt-3 break-words text-3xl font-black">{value}</p></div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[#a84d68]"><Icon className="h-5 w-5" /></span>
          </div>
        </div>
      ))}
    </section>
  );
}

function Accounts({ users, search, setSearch, loading, onSubscription, onAccess }) {
  return (
    <Panel title="Contas e studios" subtitle="Controle de acesso e assinatura com confirmação explícita.">
      <label className="relative mt-5 block">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou UID" className="h-11 rounded-lg pl-10" />
      </label>
      <div className="mt-4 grid gap-3">
        {users.map((account) => {
          const status = account.subscription?.status || "not_started";
          const providerStatus = account.subscription?.mercado_pago_subscription_status || "not_started";
          const paymentStatus = account.subscription?.last_payment_status || account.latest_payment?.status || "not_started";
          return (
            <article key={account.uid} className="grid min-w-0 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 xl:grid-cols-[1.2fr_0.8fr_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-black">{account.business_name || account.displayName || account.email || "Conta sem nome"}</h3><Status value={account.disabled ? "blocked" : "active"} /></div>
                <p className="mt-2 break-all text-xs font-bold text-zinc-500">{account.email || account.uid}</p>
                <p className="mt-1 text-xs text-zinc-500">Último login: {dateTime(account.lastSignInTime)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LabeledStatus label="Acesso" value={account.access?.status || status} />
                  <LabeledStatus label="Assinatura MP" value={providerStatus} />
                  <LabeledStatus label="Pagamento" value={paymentStatus} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Mini label="Clientes" value={account.counts?.Client || 0} />
                <Mini label="Atend." value={account.counts?.ServiceRecord || 0} />
                <Mini label="Agenda" value={account.counts?.Appointment || 0} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button type="button" disabled={loading === `subscription-${account.uid}`} onClick={() => onSubscription(account)} className="h-10 rounded-lg bg-zinc-950 px-3 text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading === `subscription-${account.uid}` ? "animate-spin" : ""}`} />Sincronizar</Button>
                <Button type="button" disabled={loading === `access-${account.uid}`} onClick={() => onAccess(account)} variant="ghost" className="h-10 rounded-lg border bg-white px-3">{account.disabled ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}{account.disabled ? "Liberar" : "Bloquear"}</Button>
              </div>
            </article>
          );
        })}
        {!users.length && <p className="rounded-lg bg-zinc-50 p-8 text-center text-sm text-zinc-500">Nenhuma conta encontrada.</p>}
      </div>
    </Panel>
  );
}

function Payments({ rows }) {
  return (
    <Panel title="Pagamentos recentes" subtitle="Conciliação dos eventos recebidos do Mercado Pago.">
      <div className="mt-5 grid gap-3">
        {rows.map((payment) => <div key={`${payment.uid}-${payment.mercado_pago_payment_id}`} className="grid min-w-0 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="break-words font-black">{payment.business_name || payment.user_email || "Conta StudiosBook"}</p><p className="mt-1 break-all text-xs text-zinc-500">ID {payment.mercado_pago_payment_id} · {dateTime(payment.date_last_updated)}</p></div><div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end"><Status value={payment.status} /><strong className="break-words">{money(payment.amount)}</strong></div></div>)}
        {!rows.length && <p className="rounded-lg bg-zinc-50 p-8 text-center text-sm text-zinc-500">Nenhum pagamento registrado.</p>}
      </div>
    </Panel>
  );
}

function System({ data, diagnostics, loading, onDiagnostics }) {
  const checks = [["Backend Railway", Boolean(data)], ["Firebase Admin", data?.admin_ready === true], ["Mercado Pago", data?.mercado_pago_ready === true], ["Webhook assinado", data?.webhook_ready === true]];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Saúde do sistema" subtitle="Detalhes disponíveis somente após autenticação administrativa.">
        <div className="mt-5 grid gap-2">{checks.map(([label, ok]) => <div key={label} className="flex min-w-0 flex-col gap-2 rounded-lg bg-zinc-50 px-4 py-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between"><span className="break-words text-sm font-bold">{label}</span><span className={`inline-flex shrink-0 items-center gap-2 text-xs font-black ${ok ? "text-emerald-700" : "text-amber-700"}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{ok ? "Operacional" : "Atenção"}</span></div>)}</div>
      </Panel>
      <Panel title="Pagamentos e webhooks" subtitle="Teste autenticado da integração financeira.">
        <Button type="button" onClick={onDiagnostics} disabled={loading === "diagnostics"} className="mt-5 h-11 w-full rounded-lg bg-zinc-950 text-white"><Activity className="mr-2 h-4 w-4" />{loading === "diagnostics" ? "Executando..." : "Executar diagnóstico"}</Button>
        {diagnostics && <div className="mt-4 grid grid-cols-2 gap-2"><Mini label="API" value={diagnostics.mercado_pago_api === "online" ? "Online" : "Erro"} /><Mini label="Pix" value={diagnostics.pix_available ? "Ativo" : "Indisponível"} /><Mini label="Processados" value={diagnostics.webhook_processed || 0} /><Mini label="Falhas" value={diagnostics.webhook_failed || 0} /></div>}
      </Panel>
    </div>
  );
}

function Brand() { return <div className="flex min-w-0 items-center gap-2 sm:gap-3"><img src="/brand/studiosbook-mark.svg" alt="" className="h-9 w-9 shrink-0" /><div className="min-w-0"><p className="text-lg font-black leading-none">Studios<span className="font-medium text-[#a84d68]">Book</span></p><p className="mt-1 break-words text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400 sm:text-[10px] sm:tracking-[0.12em]">Admin BlackVision</p></div></div>; }
function Panel({ title, subtitle, children }) { return <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"><h2 className="break-words text-lg font-black">{title}</h2><p className="mt-1 break-words text-sm text-zinc-500">{subtitle}</p>{children}</section>; }
function Mini({ label, value }) { return <div className="min-w-0 rounded-lg bg-white p-3 text-center"><p className="break-words text-sm font-black">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">{label}</p></div>; }
function Alert({ tone, children }) { return <div className={`min-w-0 break-words rounded-lg border px-4 py-3 text-sm font-bold ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{children}</div>; }
function LabeledStatus({ label, value }) { return <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">{label}<Status value={value} /></span>; }
function Status({ value }) { const key = String(value || ""); const label = { active: "Ativo", authorized: "Autorizado", trialing: "Em teste", paused: "Pausado", expired: "Expirado", blocked: "Bloqueado", pending: "Pendente", approved: "Aprovado", rejected: "Recusado", payment_failed: "Pagamento recusado", cancelled: "Cancelado", canceled: "Cancelado", refunded: "Estornado", charged_back: "Contestado", not_started: "Não iniciado" }[key] || key || "Não iniciado"; const good = ["active", "authorized", "approved", "trialing"].includes(key); const bad = ["rejected", "payment_failed", "expired", "blocked", "cancelled", "canceled", "refunded", "charged_back"].includes(key); return <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-center text-[11px] font-black normal-case leading-tight ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{label}</span>; }
function LoadingPanel() { return <div className="flex min-h-48 items-center justify-center rounded-lg border bg-white"><LoaderCircle className="h-6 w-6 animate-spin text-[#a84d68]" /></div>; }
function AdminLoading() { return <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f4]"><div className="text-center"><img src="/brand/studiosbook-mark.svg" alt="" className="mx-auto h-12 w-12" /><LoaderCircle className="mx-auto mt-5 h-5 w-5 animate-spin text-[#a84d68]" /></div></div>; }
function dateTime(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function money(value) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
