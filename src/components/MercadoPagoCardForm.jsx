import { useEffect, useRef, useState } from "react";
import { loadMercadoPago } from "@mercadopago/sdk-js";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MERCADO_PAGO_PUBLIC_KEY =
  import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || "APP_USR-7cc776f0-9567-4e53-978e-630a0ec34b6c";

const secureFieldClass =
  "h-12 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 px-3 transition focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100";

function readableSdkError(error) {
  if (!error) return "Não foi possível validar os dados do cartão.";
  if (typeof error === "string") return error;
  return error.message || "Não foi possível validar os dados do cartão.";
}

export function MercadoPagoCardForm({ userEmail, disabled = false, onAuthorize }) {
  const authorizeRef = useRef(onAuthorize);
  const disabledRef = useRef(disabled);
  const formRef = useRef(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    authorizeRef.current = onAuthorize;
  }, [onAuthorize]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    let disposed = false;
    let cardForm = null;

    async function mountCardForm() {
      try {
        await loadMercadoPago();
        if (disposed || !window.MercadoPago) return;

        const mercadoPago = new window.MercadoPago(MERCADO_PAGO_PUBLIC_KEY, { locale: "pt-BR" });
        cardForm = mercadoPago.cardForm({
          amount: "26.90",
          iframe: true,
          form: {
            id: "studiosbook-card-form",
            cardNumber: { id: "studiosbook-card-number", placeholder: "Número do cartão" },
            expirationDate: { id: "studiosbook-card-expiration", placeholder: "MM/AA" },
            securityCode: { id: "studiosbook-card-security-code", placeholder: "CVV" },
            cardholderName: { id: "studiosbook-cardholder-name", placeholder: "Nome impresso no cartão" },
            issuer: { id: "studiosbook-card-issuer", placeholder: "Banco emissor" },
            installments: { id: "studiosbook-card-installments", placeholder: "Parcelas" },
            identificationType: { id: "studiosbook-identification-type", placeholder: "Documento" },
            identificationNumber: { id: "studiosbook-identification-number", placeholder: "CPF" },
            cardholderEmail: { id: "studiosbook-cardholder-email", placeholder: "E-mail" },
          },
          callbacks: {
            onFormMounted(error) {
              if (disposed) return;
              if (error) {
                setFormError(readableSdkError(error));
                return;
              }
              setSdkReady(true);
            },
            async onSubmit(event) {
              event.preventDefault();
              if (disposed || disabledRef.current || formRef.current?.dataset.submitting === "true") return;

              const { token } = cardForm.getCardFormData();
              if (!token) {
                setFormError("Confira os dados do cartão antes de continuar.");
                return;
              }

              formRef.current.dataset.submitting = "true";
              setSubmitting(true);
              setFormError("");
              try {
                await authorizeRef.current({ card_token_id: token });
              } catch (error) {
                setFormError(readableSdkError(error));
              } finally {
                if (formRef.current) formRef.current.dataset.submitting = "false";
                if (!disposed) setSubmitting(false);
              }
            },
            onFetching() {
              if (!disposed) setFetching(true);
              return () => {
                if (!disposed) setFetching(false);
              };
            },
          },
        });
      } catch (error) {
        if (!disposed) setFormError(readableSdkError(error));
      }
    }

    mountCardForm();
    return () => {
      disposed = true;
      if (typeof cardForm?.unmount === "function") cardForm.unmount();
    };
  }, [userEmail]);

  const busy = disabled || submitting || fetching;

  return (
    <form ref={formRef} id="studiosbook-card-form" data-submitting="false" className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <p id="studiosbook-card-number-label" className="text-sm font-black text-zinc-700">
          Número do cartão
        </p>
        <div id="studiosbook-card-number" role="group" aria-labelledby="studiosbook-card-number-label" className={secureFieldClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-2">
          <p id="studiosbook-card-expiration-label" className="text-sm font-black text-zinc-700">
            Validade
          </p>
          <div id="studiosbook-card-expiration" role="group" aria-labelledby="studiosbook-card-expiration-label" className={secureFieldClass} />
        </div>
        <div className="grid min-w-0 gap-2">
          <p id="studiosbook-card-security-code-label" className="text-sm font-black text-zinc-700">
            Código de segurança
          </p>
          <div id="studiosbook-card-security-code" role="group" aria-labelledby="studiosbook-card-security-code-label" className={secureFieldClass} />
        </div>
      </div>

      <label className="grid gap-2 text-sm font-black text-zinc-700">
        Nome no cartão
        <Input id="studiosbook-cardholder-name" autoComplete="cc-name" className="h-12 rounded-2xl bg-zinc-50" />
      </label>

      <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
        <label className="grid min-w-0 gap-2 text-sm font-black text-zinc-700">
          Documento
          <select id="studiosbook-identification-type" className="h-12 min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 px-3" />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-black text-zinc-700">
          Número
          <Input
            id="studiosbook-identification-number"
            inputMode="numeric"
            autoComplete="off"
            className="h-12 rounded-2xl bg-zinc-50"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-black text-zinc-700">
        E-mail da assinatura
        <Input
          id="studiosbook-cardholder-email"
          type="email"
          value={userEmail || ""}
          readOnly
          className="h-12 rounded-2xl bg-zinc-100 text-zinc-500"
        />
      </label>

      <select id="studiosbook-card-issuer" className="hidden" aria-hidden="true" />
      <select id="studiosbook-card-installments" className="hidden" aria-hidden="true" />

      {formError && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{formError}</p>}

      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <p>Os dados sensíveis são tokenizados pelo Mercado Pago e não são armazenados pelo StudiosBook.</p>
      </div>

      <Button
        id="studiosbook-card-submit"
        type="submit"
        disabled={busy || !sdkReady}
        className="h-12 w-full rounded-full bg-zinc-950 px-4 text-white hover:bg-zinc-800"
      >
        <CreditCard className="mr-2 h-4 w-4" />
        {submitting ? "Autorizando assinatura..." : fetching || !sdkReady ? "Carregando pagamento..." : "Autorizar R$ 26,90/mês"}
      </Button>
    </form>
  );
}
