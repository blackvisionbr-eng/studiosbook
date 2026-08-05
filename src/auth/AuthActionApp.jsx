import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  getAuth,
  verifyPasswordResetCode,
} from "firebase/auth";
import { AlertTriangle, CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDe7rzsoWuw03hN_RBvB7jgyD3CsFy3sqs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studiosbook.com.br",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blackvision-27f1c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blackvision-27f1c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "574358182772",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:574358182772:web:9796070587004f3f33aa21",
};

const auth = getAuth(initializeApp(firebaseConfig, "studiosbook-auth-action"));
auth.languageCode = "pt-BR";

function safeContinueUrl(rawValue) {
  try {
    const target = new URL(rawValue || "/", window.location.origin);
    if (target.origin !== window.location.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

function friendlyError(error) {
  const code = String(error?.code || "");
  if (code.includes("expired-action-code")) return "Este link expirou. Solicite um novo e-mail no StudiosBook.";
  if (code.includes("invalid-action-code")) return "Este link é inválido ou já foi utilizado.";
  if (code.includes("weak-password")) return "Use uma senha com pelo menos 8 caracteres.";
  return "Não foi possível concluir esta solicitação. Peça um novo link ou fale com o suporte.";
}

export default function AuthActionApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get("mode") || "";
  const code = params.get("oobCode") || "";
  const continueUrl = safeContinueUrl(params.get("continueUrl"));
  const [state, setState] = useState({ status: "loading", email: "", message: "Validando seu link..." });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function prepare() {
      if (!code) throw new Error("auth/invalid-action-code");
      if (mode === "resetPassword") {
        const email = await verifyPasswordResetCode(auth, code);
        if (active) setState({ status: "password", email, message: "Crie uma nova senha para sua conta." });
        return;
      }
      if (["verifyEmail", "verifyAndChangeEmail", "recoverEmail"].includes(mode)) {
        await checkActionCode(auth, code);
        await applyActionCode(auth, code);
        if (active) setState({ status: "success", email: "", message: "Solicitação concluída com segurança." });
        return;
      }
      throw new Error("auth/invalid-action-code");
    }
    prepare().catch((error) => active && setState({ status: "error", email: "", message: friendlyError(error) }));
    return () => {
      active = false;
    };
  }, [code, mode]);

  const submitPassword = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      setState((current) => ({ ...current, message: "Use uma senha com pelo menos 8 caracteres." }));
      return;
    }
    if (password !== confirmation) {
      setState((current) => ({ ...current, message: "A confirmação da senha não confere." }));
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, code, password);
      setPassword("");
      setConfirmation("");
      setState({ status: "success", email: "", message: "Senha atualizada. Sua conta está pronta para entrar." });
    } catch (error) {
      setState((current) => ({ ...current, message: friendlyError(error) }));
    } finally {
      setSubmitting(false);
    }
  };

  const isError = state.status === "error";
  const isSuccess = state.status === "success";

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-ivory px-4 py-8 text-brand-charcoal">
      <section className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-xl sm:p-8">
        <a href="/" className="inline-flex items-center gap-3" aria-label="Voltar ao StudiosBook">
          <img src="/brand/studiosbook-mark.svg" alt="" className="h-11 w-11" />
          <span className="text-xl font-black tracking-normal">StudiosBook</span>
        </a>

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-plum text-white">
          {state.status === "loading" && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {state.status === "password" && <LockKeyhole className="h-5 w-5" />}
          {isSuccess && <CheckCircle2 className="h-5 w-5" />}
          {isError && <AlertTriangle className="h-5 w-5" />}
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#7f3158]">Segurança da conta</p>
        <h1 className="mt-2 text-2xl font-black tracking-normal">
          {state.status === "password" ? "Redefinir senha" : isSuccess ? "Tudo certo" : isError ? "Link indisponível" : "Validando acesso"}
        </h1>
        <p className={`mt-3 text-sm leading-6 ${isError ? "text-red-700" : "text-zinc-600"}`}>{state.message}</p>
        {state.email && <p className="mt-2 break-all text-xs font-bold text-zinc-500">{state.email}</p>}

        {state.status === "password" && (
          <form onSubmit={submitPassword} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-lg border border-zinc-200 bg-white px-4 outline-none ring-[#7f3158] focus:ring-2"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Confirmar nova senha
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="h-12 rounded-lg border border-zinc-200 bg-white px-4 outline-none ring-[#7f3158] focus:ring-2"
              />
            </label>
            <button type="submit" disabled={submitting} className="mt-1 h-12 rounded-lg bg-brand-plum px-5 font-black text-white transition hover:bg-[#573048] disabled:opacity-60">
              {submitting ? "Atualizando..." : "Salvar nova senha"}
            </button>
          </form>
        )}

        {(isSuccess || isError) && (
          <a href={isSuccess ? continueUrl : "/"} className="mt-6 flex h-12 items-center justify-center rounded-lg bg-brand-plum px-5 font-black text-white transition hover:bg-[#573048]">
            {isSuccess ? "Continuar no StudiosBook" : "Voltar ao StudiosBook"}
          </a>
        )}

        <p className="mt-6 text-xs leading-5 text-zinc-500">
          Suporte: <a href="mailto:getblackvision.br@gmail.com" className="font-bold text-[#7f3158]">getblackvision.br@gmail.com</a>
        </p>
      </section>
    </main>
  );
}
