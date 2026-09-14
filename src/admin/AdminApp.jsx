import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Crown,
  Download,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
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
import {
  adminAuth,
  changeAdminPassword,
  invokeAdmin,
  reauthenticateAdmin,
  sendAdminPasswordResetEmail,
  signInAdmin,
  signOutAdmin,
} from "./firebaseAdminClient.js";

const tabs = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "accounts", label: "Contas", icon: Users },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "system", label: "Sistema", icon: Server },
  { id: "security", label: "Segurança", icon: ShieldCheck },
];

const ACCOUNT_PAGE_SIZES = [20, 50, 100];

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
  const [auditEvents, setAuditEvents] = useState([]);
  const [adminRole, setAdminRole] = useState("");
  const [reauthRequest, setReauthRequest] = useState(null);
  const [reauthError, setReauthError] = useState("");

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
        setAdminRole("");
        setData(null);
        setAuthLoading(false);
        return;
      }
      try {
        await currentUser.getIdToken(true);
        const session = await invokeAdmin("admin-session", {}, currentUser);
        if (!active) return;
        setAdminRole(session.admin?.role || "platform_admin");
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

  const handleLoginPasswordReset = async (email) => {
    if (!email) {
      setError("Informe o e-mail administrativo.");
      return;
    }
    setLoading("login-reset");
    setError("");
    try {
      await sendAdminPasswordResetEmail(email);
      showNotice("Se houver uma conta ativa para este e-mail, o link será enviado. Confira também Spam ou Lixo eletrônico.");
    } catch {
      setError("Não foi possível enviar a redefinição de senha.");
    } finally {
      setLoading("");
    }
  };

  const loadAudit = async () => {
    setLoading("audit");
    setError("");
    try {
      const result = await invokeAdmin("admin-audit-log");
      setAuditEvents(result.events || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "security") loadAudit();
  };

  const handlePasswordChange = async ({ currentPassword, newPassword, confirmation }) => {
    if (newPassword !== confirmation) {
      setError("A confirmação da nova senha não confere.");
      return;
    }
    if (newPassword.length < 12) {
      setError("Use uma nova senha com pelo menos 12 caracteres.");
      return;
    }
    setLoading("password");
    setError("");
    try {
      await changeAdminPassword(currentPassword, newPassword);
      await signOutAdmin();
      window.location.replace("/admin?password=changed");
    } catch {
      setError("A senha atual não foi confirmada ou a nova senha não atende aos requisitos.");
    } finally {
      setLoading("");
    }
  };

  const sendAccountPasswordReset = async (account) => {
    if (!account.email) return setError("Esta conta não possui e-mail cadastrado.");
    if (!window.confirm(`Enviar redefinição de senha para ${account.email}?`)) return;
    setLoading(`password-reset-${account.uid}`);
    setError("");
    try {
      await invokeAdmin("admin-send-password-reset", { uid: account.uid });
      await loadAudit();
      showNotice("E-mail de redefinição enviado. Oriente o usuário a conferir também Spam ou Lixo eletrônico.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const revokeAccountSessions = async (account) => {
    if (!window.confirm(`Encerrar todas as sessões de ${account.email || account.uid}?`)) return;
    setLoading(`sessions-${account.uid}`);
    setError("");
    try {
      const result = await invokeAdmin("admin-revoke-user-sessions", { uid: account.uid });
      if (result.self) {
        await signOutAdmin();
        window.location.replace("/admin?sessions=revoked");
        return;
      }
      await loadAudit();
      showNotice("Sessões da conta encerradas.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
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
    if (!window.confirm("Consultar e aplicar o status confirmado diretamente pela Stripe?")) return;
    setLoading(`subscription-${account.uid}`);
    try {
      await invokeAdmin("admin-update-subscription", {
        uid: account.uid,
      });
      await loadOverview();
      showNotice("Cobrança sincronizada com a Stripe.");
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

  const updateSubscriptionOverride = async (account, control, options = {}) => {
    const actionLabel = {
      grant: `conceder acesso manual por ${control.days} dias`,
      suspend: "suspender a assinatura imediatamente",
      automatic: "devolver a assinatura ao controle automático",
    }[control.action];
    if (!options.skipConfirmation && !window.confirm(`Deseja ${actionLabel} para ${account.email || account.uid}?`)) return;

    setLoading(`subscription-control-${account.uid}`);
    setError("");
    try {
      const result = await invokeAdmin("admin-set-subscription-override", {
        uid: account.uid,
        action: control.action,
        days: Number(control.days || 30),
        reason: control.reason || "Ajuste realizado pelo painel mestre",
      });
      if (result?.action !== control.action) throw new Error("O servidor não confirmou a alteração solicitada.");
      await loadOverview();
      const successMessage = {
        grant: `Acesso autorizado até ${dateTime(result.subscription?.admin_override_until)}.`,
        suspend: "Acesso suspenso imediatamente.",
        automatic: `Controle automático aplicado: ${statusText(result.access?.status)}.`,
      }[control.action];
      showNotice(successMessage || "Controle de assinatura atualizado.");
    } catch (requestError) {
      if (requestError.payload?.code === "recent_auth_required") {
        setReauthError("");
        setReauthRequest({ type: "subscription", account, control });
        return;
      }
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const handleReauthentication = async (event) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    const pending = reauthRequest;
    if (!pending) return;
    setLoading("reauth");
    setReauthError("");
    try {
      await reauthenticateAdmin(password);
      setReauthRequest(null);
      setLoading("");
      if (pending.type === "subscription") {
        await updateSubscriptionOverride(pending.account, pending.control, { skipConfirmation: true });
      } else if (pending.type === "receivables") {
        await updateReceivablesAccess(pending.account, pending.enabled, { skipConfirmation: true });
      }
    } catch {
      setReauthError("Senha administrativa incorreta. Tente novamente.");
      setLoading("");
    }
  };

  const updateStripeRenewal = async (account) => {
    const cancelAtPeriodEnd = !Boolean(account.subscription?.cancel_at_period_end);
    const verb = cancelAtPeriodEnd ? "cancelar a renovação ao fim do período pago" : "retomar a renovação automática";
    if (!window.confirm(`Deseja ${verb} para ${account.email || account.uid}?`)) return;

    setLoading(`renewal-${account.uid}`);
    setError("");
    try {
      await invokeAdmin("admin-set-stripe-renewal", {
        uid: account.uid,
        cancel_at_period_end: cancelAtPeriodEnd,
      });
      await loadOverview();
      showNotice(cancelAtPeriodEnd ? "Renovação programada para cancelamento." : "Renovação automática retomada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading("");
    }
  };

  const updateReceivablesAccess = async (account, enabled, options = {}) => {
    const action = enabled ? "ativar" : "desativar";
    if (!options.skipConfirmation && !window.confirm(`Deseja ${action} o StudiosBook Recebimentos para ${account.email || account.uid}?`)) return;
    setLoading(`receivables-${account.uid}`);
    setError("");
    try {
      const result = await invokeAdmin("admin-set-receivables-plan", { uid: account.uid, enabled });
      if (result?.enabled !== enabled) throw new Error("O servidor não confirmou a alteração do plano Recebimentos.");
      await loadOverview();
      showNotice(enabled ? "StudiosBook Recebimentos ativado." : "StudiosBook Recebimentos desativado.");
    } catch (requestError) {
      if (requestError.payload?.code === "recent_auth_required") {
        setReauthError("");
        setReauthRequest({ type: "receivables", account, enabled });
        return;
      }
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
  if (!user || !authorized) return <AdminLogin onSubmit={handleLogin} onResetPassword={handleLoginPasswordReset} loading={loading} error={error} notice={notice} />;

  return (
    <div className="min-h-dvh bg-brand-ivory text-brand-charcoal">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white sm:bg-white/95 sm:backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          <Brand />
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-bold text-zinc-900">{user.email}</p>
              <p className="text-[11px] text-zinc-500">{adminRole === "master_admin" ? "Administrador mestre" : "Administrador"}</p>
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
                onClick={() => selectTab(tab.id)}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  activeTab === tab.id ? "bg-brand-plum text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
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
            <Button type="button" onClick={handleExport} disabled={loading === "export"} className="h-10 rounded-lg bg-brand-plum text-white">
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
            onPasswordReset={sendAccountPasswordReset}
            onSessions={revokeAccountSessions}
            adminRole={adminRole}
            onSubscriptionOverride={updateSubscriptionOverride}
            onStripeRenewal={updateStripeRenewal}
            onReceivables={updateReceivablesAccess}
          />
        )}
        {activeTab === "payments" && <Payments rows={data?.recent_payments || []} />}
        {activeTab === "system" && (
          <System data={data} diagnostics={diagnostics} loading={loading} onDiagnostics={handleDiagnostics} />
        )}
        {activeTab === "security" && (
          <Security
            user={user}
            events={auditEvents}
            users={data?.users || []}
            loading={loading}
            onPasswordChange={handlePasswordChange}
            onRevokeSessions={() => revokeAccountSessions({ uid: user.uid, email: user.email })}
            onRefreshAudit={loadAudit}
          />
        )}
      </main>
      {reauthRequest && (
        <AdminReauthDialog
          loading={loading === "reauth"}
          error={reauthError}
          onSubmit={handleReauthentication}
          onCancel={() => {
            setReauthRequest(null);
            setReauthError("");
          }}
        />
      )}
    </div>
  );
}

function AdminReauthDialog({ loading, error, onSubmit, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/60 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-[#a84d68]"><KeyRound className="h-5 w-5" /></div>
        <h2 id="reauth-title" className="mt-4 text-xl font-black">Confirme sua identidade</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Por segurança, confirme a senha administrativa. A alteração pendente será aplicada automaticamente.</p>
        {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
        <label className="mt-5 grid gap-2 text-sm font-bold text-zinc-700">
          Senha administrativa
          <Input name="password" type="password" autoComplete="current-password" required autoFocus className="h-12 rounded-lg" />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="h-11 rounded-lg border">Cancelar</Button>
          <Button type="submit" disabled={loading} className="h-11 rounded-lg bg-brand-plum text-white">{loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{loading ? "Confirmando..." : "Confirmar e aplicar"}</Button>
        </div>
      </form>
    </div>
  );
}

function AdminLogin({ onSubmit, onResetPassword, loading, error, notice }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const query = new URLSearchParams(window.location.search);
  const queryNotice = query.get("password") === "changed"
    ? "Senha alterada. Entre novamente."
    : query.get("sessions") === "revoked"
      ? "Sessões encerradas. Entre novamente."
      : "";
  return (
    <main className="grid min-h-dvh bg-brand-ivory lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center px-3 py-6 sm:px-8 sm:py-10">
        <form onSubmit={onSubmit} className="w-full min-w-0 max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-xl sm:p-8">
          <Brand />
          <div className="mt-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-plum text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-normal">Acesso administrativo</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Use a conta autorizada pela BlackVision.</p>
          </div>
          {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}
          {(notice || queryNotice) && <div className="mt-5"><Alert tone="success">{notice || queryNotice}</Alert></div>}
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              E-mail
              <Input name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-lg" />
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
            <Button type="submit" disabled={loading === "login"} className="h-12 rounded-lg bg-brand-plum text-white">
              {loading === "login" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {loading === "login" ? "Validando..." : "Entrar com segurança"}
            </Button>
            <button type="button" disabled={loading === "login-reset"} onClick={() => onResetPassword(email.trim())} className="min-h-10 text-sm font-bold text-[#7f3158] disabled:opacity-50">
              {loading === "login-reset" ? "Enviando redefinição..." : "Esqueci minha senha"}
            </button>
            <p className="text-center text-xs leading-5 text-zinc-500">Não recebeu? Verifique Spam ou Lixo eletrônico e marque a mensagem como “Não é spam”.</p>
          </div>
          <a href="/" className="mt-6 block text-center text-sm font-bold text-zinc-500 hover:text-zinc-950">Voltar ao StudiosBook</a>
        </form>
      </section>
      <section className="hidden bg-brand-plum p-10 text-white lg:flex lg:flex-col lg:justify-between">
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
    ["Acessos manuais", metrics.manual_access_users || 0, Crown],
    ["Suspensões manuais", metrics.suspended_subscriptions || 0, UserX],
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

function Accounts({ users, search, setSearch, loading, onSubscription, onAccess, onPasswordReset, onSessions, adminRole, onSubscriptionOverride, onStripeRenewal, onReceivables }) {
  const [expandedUid, setExpandedUid] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const filteredAccounts = useMemo(() => users.filter((account) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "blocked") return account.disabled;
    if (statusFilter === "manual") return account.subscription?.admin_access_override === "active";
    if (statusFilter === "suspended") return account.subscription?.admin_access_override === "suspended";
    return String(account.access?.status || account.subscription?.status || "not_started") === statusFilter;
  }), [statusFilter, users]);
  const pageCount = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageUsers = filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
    setExpandedUid("");
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <Panel title="Contas e studios" subtitle="Lista compacta com paginação e controles sob demanda.">
      <div className="mt-5 grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_13rem_8rem]">
        <label className="relative block min-w-0">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou UID" className="h-11 rounded-lg pl-10" />
        </label>
        <label className="sr-only" htmlFor="account-status-filter">Filtrar status</label>
        <select id="account-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 outline-none focus:border-[#a84d68]">
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="trialing">Em teste</option>
          <option value="manual">Acesso manual</option>
          <option value="suspended">Suspensos</option>
          <option value="expired">Expirados</option>
          <option value="refunded">Estornados</option>
          <option value="blocked">Contas bloqueadas</option>
        </select>
        <label className="sr-only" htmlFor="account-page-size">Itens por página</label>
        <select id="account-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-11 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 outline-none focus:border-[#a84d68]">
          {ACCOUNT_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} por página</option>)}
        </select>
      </div>

      <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-zinc-500">{filteredAccounts.length} conta(s) encontrada(s)</p>
        <p className="text-xs text-zinc-400">Exibindo {(currentPage - 1) * pageSize + (filteredAccounts.length ? 1 : 0)}–{Math.min(currentPage * pageSize, filteredAccounts.length)}</p>
      </div>

      <div className="mt-3 grid gap-2">
        {pageUsers.map((account) => {
          const status = account.subscription?.status || "not_started";
          const providerStatus = account.subscription?.stripe_subscription_status || "not_started";
          const paymentStatus = account.subscription?.last_payment_status || account.latest_payment?.status || "not_started";
          const expanded = expandedUid === account.uid;
          return (
            <article key={account.uid} className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="grid min-w-0 gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1.5fr)_auto_auto_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2"><h3 className="truncate font-black">{account.business_name || account.displayName || account.email || "Conta sem nome"}</h3>{account.platform_admin && <Status value={account.platform_role === "master_admin" ? "master_admin" : "admin"} />}</div>
                  <p className="mt-1 truncate text-xs font-bold text-zinc-500" title={account.email || account.uid}>{account.email || account.uid}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end"><Status value={account.disabled ? "blocked" : account.access?.status || status} />{account.subscription?.admin_access_override && <Status value={account.subscription.admin_access_override === "active" ? "manual_access" : "suspended"} />}</div>
                <p className="text-xs font-bold text-zinc-500 lg:text-right">{account.counts?.Client || 0} clientes · {account.counts?.Appointment || 0} agenda</p>
                <Button type="button" onClick={() => setExpandedUid(expanded ? "" : account.uid)} variant="ghost" aria-expanded={expanded} className="h-9 w-full rounded-lg border bg-white px-3 lg:w-auto">{expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}{expanded ? "Fechar" : "Detalhes"}</Button>
              </div>
              {expanded && (
                <div className="grid min-w-0 gap-4 border-t border-zinc-200 bg-zinc-50 p-3 sm:p-4 xl:grid-cols-[1.1fr_0.9fr_auto] xl:items-start">
                  <div className="min-w-0 text-xs text-zinc-500"><p>Último login: {dateTime(account.lastSignInTime)}</p><p className="mt-1">Métodos: {providerLabels(account.providers)}</p><p className="mt-1 break-all">UID: {account.uid}</p>{account.subscription?.admin_access_override === "active" && <p className="mt-2 font-bold text-[#7f3158]">Acesso manual até {dateTime(account.subscription.admin_override_until)}</p>}</div>
                  <div className="flex min-w-0 flex-wrap gap-2"><LabeledStatus label="Acesso" value={account.access?.status || status} /><LabeledStatus label="Stripe" value={providerStatus} /><LabeledStatus label="Pagamento" value={paymentStatus} /></div>
                  <div className="grid grid-cols-2 gap-2 xl:w-72">
                    <Button type="button" disabled={loading === `subscription-${account.uid}`} onClick={() => onSubscription(account)} className="h-10 rounded-lg bg-brand-plum px-3 text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading === `subscription-${account.uid}` ? "animate-spin" : ""}`} />Sincronizar</Button>
                    <Button type="button" disabled={loading === `access-${account.uid}`} onClick={() => onAccess(account)} variant="ghost" className="h-10 rounded-lg border bg-white px-3">{account.disabled ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}{account.disabled ? "Liberar" : "Bloquear"}</Button>
                    <Button type="button" disabled={loading === `password-reset-${account.uid}` || !account.email} onClick={() => onPasswordReset(account)} variant="ghost" className="h-10 rounded-lg border bg-white px-3"><Mail className="mr-2 h-4 w-4" />Senha</Button>
                    <Button type="button" disabled={loading === `sessions-${account.uid}`} onClick={() => onSessions(account)} variant="ghost" className="h-10 rounded-lg border bg-white px-3"><LogOut className="mr-2 h-4 w-4" />Sessões</Button>
                  </div>
                  {adminRole === "master_admin" && <SubscriptionControls account={account} loading={loading} onOverride={onSubscriptionOverride} onStripeRenewal={onStripeRenewal} onReceivables={onReceivables} />}
                </div>
              )}
            </article>
          );
        })}
        {!filteredAccounts.length && <p className="rounded-lg bg-zinc-50 p-8 text-center text-sm text-zinc-500">Nenhuma conta encontrada.</p>}
      </div>

      {filteredAccounts.length > 0 && (
        <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-zinc-100 pt-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <p className="text-center text-xs font-bold text-zinc-500 min-[420px]:text-left">Página {currentPage} de {pageCount}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-10 rounded-lg border bg-white"><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
            <Button type="button" variant="ghost" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="h-10 rounded-lg border bg-white">Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function SubscriptionControls({ account, loading, onOverride, onStripeRenewal, onReceivables }) {
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const hasStripeSubscription = Boolean(account.subscription?.stripe_subscription_id);
  const renewalCancelled = Boolean(account.subscription?.cancel_at_period_end);
  const busy = loading === `subscription-control-${account.uid}` || loading === `renewal-${account.uid}` || loading === `receivables-${account.uid}`;
  const override = String(account.subscription?.admin_access_override || "");
  const appliedStatus = override === "active" ? "manual_access" : override === "suspended" ? "suspended" : "automatic";
  const validDays = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 3650;

  return (
    <div className="grid min-w-0 gap-4 border-t border-zinc-200 pt-4 xl:col-span-3">
      <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-white px-3 py-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-zinc-400">Estado realmente aplicado</p><p className="mt-1 break-words text-xs text-zinc-500">Última alteração: {dateTime(account.subscription?.admin_override_updated_at)}</p></div>
        <Status value={appliedStatus} />
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[7rem_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-1.5 text-xs font-black text-zinc-600">Dias<Input type="number" min="1" max="3650" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} className="h-10 rounded-lg bg-white" /></label>
        <label className="grid min-w-0 gap-1.5 text-xs font-black text-zinc-600">Motivo da alteração<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="Ex.: cortesia ou suporte" className="h-10 min-w-0 rounded-lg bg-white" /></label>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-3">
        <Button type="button" disabled={busy || !validDays} onClick={() => onOverride(account, { action: "grant", days, reason })} className="h-11 min-w-0 rounded-lg bg-brand-plum px-3 text-white"><Crown className="mr-2 h-4 w-4 shrink-0" />Liberar por {validDays ? days : "-"} dias</Button>
        <Button type="button" disabled={busy} onClick={() => onOverride(account, { action: "suspend", days, reason })} variant="ghost" className="h-11 min-w-0 rounded-lg border border-red-200 bg-red-50 px-3 text-red-800 hover:bg-red-100"><UserX className="mr-2 h-4 w-4 shrink-0" />Suspender agora</Button>
        <Button type="button" disabled={busy} onClick={() => onOverride(account, { action: "automatic", days, reason })} variant="ghost" className="h-11 min-w-0 rounded-lg border bg-white px-3"><RefreshCw className="mr-2 h-4 w-4 shrink-0" />Usar automático</Button>
      </div>
      <div className="grid min-w-0 gap-2 min-[420px]:grid-cols-2">
        {hasStripeSubscription && (
          <Button type="button" disabled={busy} onClick={() => onStripeRenewal(account)} variant="ghost" className="h-10 min-w-0 rounded-lg border bg-white px-3 text-xs">
            <CreditCard className="mr-2 h-4 w-4 shrink-0" />{renewalCancelled ? "Retomar renovação" : "Cancelar renovação"}
          </Button>
        )}
        <Button type="button" disabled={busy} onClick={() => onReceivables(account, !account.receivables_access_allowed)} variant="ghost" className={`h-10 min-w-0 rounded-lg border px-3 text-xs ${account.receivables_access_allowed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white"}`}>
          <QrCode className="mr-2 h-4 w-4 shrink-0" />{account.receivables_access_allowed ? "Desativar Recebimentos" : "Ativar Recebimentos"}
        </Button>
      </div>
    </div>
  );
}

function Payments({ rows }) {
  return (
    <Panel title="Pagamentos recentes" subtitle="Conciliação dos eventos assinados recebidos da Stripe e do Mercado Pago.">
      <div className="mt-5 grid gap-3">
        {rows.map((payment) => { const paymentId = payment.stripe_invoice_id || payment.stripe_payment_intent_id || payment.mercado_pago_payment_id || payment.id; return <div key={`${payment.uid}-${paymentId}`} className="grid min-w-0 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="break-words font-black">{payment.business_name || payment.user_email || "Conta StudiosBook"}</p><p className="mt-1 break-all text-xs text-zinc-500">{payment.provider || "provedor"} · ID {paymentId} · {dateTime(payment.date_last_updated)}</p></div><div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end"><Status value={payment.status} /><strong className="break-words">{money(payment.amount)}</strong></div></div>; })}
        {!rows.length && <p className="rounded-lg bg-zinc-50 p-8 text-center text-sm text-zinc-500">Nenhum pagamento registrado.</p>}
      </div>
    </Panel>
  );
}

function System({ data, diagnostics, loading, onDiagnostics }) {
  const checks = [["Backend Railway", Boolean(data)], ["Firebase Admin", data?.admin_ready === true], ["Stripe", data?.stripe_ready === true], ["Mercado Pago", data?.mercado_pago_ready === true], ["Webhook Stripe", data?.webhook_ready === true], ["Webhook Pix", data?.mercado_pago_webhook_ready === true]];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Saúde do sistema" subtitle="Detalhes disponíveis somente após autenticação administrativa.">
        <div className="mt-5 grid gap-2">{checks.map(([label, ok]) => <div key={label} className="flex min-w-0 flex-col gap-2 rounded-lg bg-zinc-50 px-4 py-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between"><span className="break-words text-sm font-bold">{label}</span><span className={`inline-flex shrink-0 items-center gap-2 text-xs font-black ${ok ? "text-emerald-700" : "text-amber-700"}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{ok ? "Operacional" : "Atenção"}</span></div>)}</div>
      </Panel>
      <Panel title="Pagamentos e webhooks" subtitle="Teste autenticado da integração financeira.">
        <Button type="button" onClick={onDiagnostics} disabled={loading === "diagnostics"} className="mt-5 h-11 w-full rounded-lg bg-brand-plum text-white"><Activity className="mr-2 h-4 w-4" />{loading === "diagnostics" ? "Executando..." : "Executar diagnóstico"}</Button>
        {diagnostics && <div className="mt-4 grid grid-cols-2 gap-2"><Mini label="API Stripe" value={diagnostics.stripe_api === "online" ? "Online" : "Erro"} /><Mini label="Modo Stripe" value={diagnostics.stripe_mode === "live" ? "Produção" : "Teste"} /><Mini label="API Mercado Pago" value={diagnostics.mercado_pago_api === "online" ? "Online" : diagnostics.mercado_pago_api === "unconfigured" ? "Sem token" : "Erro"} /><Mini label="Modo Pix" value={diagnostics.mercado_pago_mode === "live" ? "Produção" : diagnostics.mercado_pago_mode === "test" ? "Teste" : "Configurar"} /><Mini label="Stripe OK" value={diagnostics.webhook_processed || 0} /><Mini label="Stripe Falhas" value={diagnostics.webhook_failed || 0} /><Mini label="Pix OK" value={diagnostics.mercado_pago_webhook_processed || 0} /><Mini label="Pix Falhas" value={diagnostics.mercado_pago_webhook_failed || 0} /></div>}
      </Panel>
    </div>
  );
}

function Security({ user, events, users, loading, onPasswordChange, onRevokeSessions, onRefreshAudit }) {
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmation: "" });
  const userByUid = new Map(users.map((account) => [account.uid, account.email || account.business_name || account.uid]));
  const submitPassword = (event) => {
    event.preventDefault();
    onPasswordChange(passwords);
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Panel title="Trocar senha administrativa" subtitle={`Conta atual: ${user.email || "administrador"}`}>
        <form onSubmit={submitPassword} className="mt-5 grid min-w-0 gap-4">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-700">
            Senha atual
            <Input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} className="h-11 rounded-lg" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-700">
            Nova senha
            <Input type="password" autoComplete="new-password" minLength={12} required value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} className="h-11 rounded-lg" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-zinc-700">
            Confirmar nova senha
            <Input type="password" autoComplete="new-password" minLength={12} required value={passwords.confirmation} onChange={(event) => setPasswords((current) => ({ ...current, confirmation: event.target.value }))} className="h-11 rounded-lg" />
          </label>
          <Button type="submit" disabled={loading === "password"} className="h-11 rounded-lg bg-brand-plum text-white">
            <KeyRound className="mr-2 h-4 w-4" />
            {loading === "password" ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </Panel>

      <Panel title="Controle de sessões" subtitle="Invalide acessos abertos em outros aparelhos e navegadores.">
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="break-all text-sm font-black text-zinc-900">{user.email}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">A ação exige login recente e desconecta esta sessão após concluir.</p>
          </div>
          <Button type="button" onClick={onRevokeSessions} disabled={loading.startsWith("sessions-")} variant="ghost" className="h-11 rounded-lg border border-red-200 bg-red-50 text-red-800 hover:bg-red-100">
            <LogOut className="mr-2 h-4 w-4" />Encerrar todas as sessões
          </Button>
        </div>
      </Panel>

      <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 sm:p-5 lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-black">Histórico de auditoria</h2>
            <p className="mt-1 break-words text-sm text-zinc-500">Últimas ações administrativas registradas pelo backend.</p>
          </div>
          <Button type="button" onClick={onRefreshAudit} disabled={loading === "audit"} variant="ghost" className="h-10 shrink-0 rounded-lg border bg-white">
            <History className={`mr-2 h-4 w-4 ${loading === "audit" ? "animate-spin" : ""}`} />Atualizar histórico
          </Button>
        </div>
        <div className="mt-5 grid gap-2">
          {events.map((event) => (
            <div key={event.id} className="grid min-w-0 gap-2 border-b border-zinc-100 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="break-words text-sm font-black">{auditLabel(event.action)}</p>
                <p className="mt-1 break-all text-xs text-zinc-500">{event.target_uid ? userByUid.get(event.target_uid) || event.target_uid : event.admin_email || "StudiosBook"}</p>
              </div>
              <time className="text-xs font-bold text-zinc-400">{dateTime(event.created_at)}</time>
            </div>
          ))}
          {!events.length && <p className="rounded-lg bg-zinc-50 p-8 text-center text-sm text-zinc-500">Nenhuma ação registrada.</p>}
        </div>
      </section>
    </div>
  );
}

function auditLabel(action) {
  return {
    "admin.session.validated": "Sessão administrativa validada",
    "admin.overview.viewed": "Painel administrativo consultado",
    "admin.payments.diagnostics": "Diagnóstico financeiro executado",
    "admin.data.exported": "Dados administrativos exportados",
    "admin.subscription.updated": "Assinatura sincronizada",
    "admin.subscription.grant": "Acesso manual concedido",
    "admin.subscription.suspend": "Assinatura suspensa pelo administrador mestre",
    "admin.subscription.automatic": "Assinatura devolvida ao controle automático",
    "admin.subscription.renewal_changed": "Renovação Stripe alterada",
    "admin.user.access_changed": "Acesso de conta alterado",
    "admin.user.password_reset_sent": "Redefinição de senha enviada",
    "admin.user.sessions_revoked": "Sessões de conta encerradas",
  }[action] || action || "Ação administrativa";
}

function providerLabels(providers = []) {
  if (!providers.length) return "Não identificado";
  return providers.map((provider) => ({
    "google.com": "Google",
    "password": "E-mail e senha",
    "apple.com": "Apple",
    "facebook.com": "Facebook",
    "microsoft.com": "Microsoft",
  }[provider] || provider)).join(", ");
}

function Brand() { return <div className="min-w-0"><img src="/brand/studiosbook-logo.svg" alt="StudiosBook" className="h-9 w-auto max-w-[176px]" /><p className="mt-1 break-words text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400 sm:text-[10px] sm:tracking-[0.12em]">Admin BlackVision</p></div>; }
function Panel({ title, subtitle, children }) { return <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"><h2 className="break-words text-lg font-black">{title}</h2><p className="mt-1 break-words text-sm text-zinc-500">{subtitle}</p>{children}</section>; }
function Mini({ label, value }) { return <div className="min-w-0 rounded-lg bg-white p-3 text-center"><p className="break-words text-sm font-black">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">{label}</p></div>; }
function Alert({ tone, children }) { return <div className={`min-w-0 break-words rounded-lg border px-4 py-3 text-sm font-bold ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{children}</div>; }
function LabeledStatus({ label, value }) { return <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">{label}<Status value={value} /></span>; }
function statusText(value) { const key = String(value || ""); return { active: "Ativo", automatic: "Automático", manual_access: "Acesso manual", master_admin: "Administrador mestre", admin: "Administrador", authorized: "Autorizado", suspended: "Suspenso", trialing: "Em teste", paused: "Pausado", past_due: "Em atraso", unpaid: "Não pago", incomplete: "Incompleto", incomplete_expired: "Expirado", expired: "Expirado", blocked: "Bloqueado", pending: "Pendente", approved: "Aprovado", rejected: "Recusado", payment_failed: "Pagamento recusado", cancelled: "Cancelado", canceled: "Cancelado", refunded: "Estornado", partially_refunded: "Parcialmente estornado", charged_back: "Contestado", not_started: "Não iniciado" }[key] || key || "Não iniciado"; }
function Status({ value }) { const key = String(value || ""); const label = statusText(key); const good = ["active", "approved", "trialing", "admin", "master_admin", "authorized", "manual_access"].includes(key); const bad = ["rejected", "payment_failed", "past_due", "unpaid", "incomplete", "incomplete_expired", "expired", "blocked", "suspended", "cancelled", "canceled", "refunded", "charged_back"].includes(key); return <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-center text-[11px] font-black normal-case leading-tight ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{label}</span>; }
function LoadingPanel() { return <div className="flex min-h-48 items-center justify-center rounded-lg border bg-white"><LoaderCircle className="h-6 w-6 animate-spin text-[#a84d68]" /></div>; }
function AdminLoading() { return <div className="flex min-h-dvh items-center justify-center bg-brand-ivory"><div className="text-center"><img src="/brand/studiosbook-mark.svg" alt="" className="mx-auto h-12 w-12" /><LoaderCircle className="mx-auto mt-5 h-5 w-5 animate-spin text-[#a84d68]" /></div></div>; }
function dateTime(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function money(value) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
