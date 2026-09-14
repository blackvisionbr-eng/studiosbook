# StudiosBook Recebimentos

## Produto

- StudiosBook Agenda: R$ 26,90/mês.
- StudiosBook Recebimentos: R$ 59,90/mês.
- Comissão da plataforma: 0,79% por pagamento aprovado.
- Limite mensal da comissão: R$ 59,90 por studio.
- As tarifas do Mercado Pago são cobradas separadamente pelo provedor.

## Fluxo transacional

1. A cliente acessa `/agendar/{slug}`.
2. O backend publica somente catálogo, profissionais e disponibilidade.
3. Ao escolher um horário, uma transação do Firestore cria o agendamento e bloqueia todos os intervalos de 15 minutos ocupados pelo serviço.
4. O backend reserva a comissão mensal e cria uma preferência no Mercado Pago usando a credencial OAuth criptografada do studio.
5. O navegador é redirecionado para o checkout do Mercado Pago, com Pix e cartão conforme a conta recebedora.
6. O webhook é validado por assinatura e o pagamento é consultado diretamente na API do Mercado Pago.
7. Somente um pagamento válido confirma o horário. Rejeição, expiração, estorno ou chargeback atualizam o agendamento e o financeiro.

O retorno do navegador nunca confirma um pagamento.

## Coleções

- `PublicBookingSlug/{slug}`: resolução do endereço público.
- `PublicBookingStudio/{uid}`: configuração publicável do studio.
- `PublicBookingStudio/{uid}/Private/MercadoPagoConnection`: tokens OAuth criptografados.
- `PublicBookingStudio/{uid}/Appointments/{bookingId}`: reserva e estado financeiro.
- `PublicBookingStudio/{uid}/SlotLocks/{slotId}`: exclusão mútua por profissional, data e intervalo.
- `PublicBookingStudio/{uid}/Payments/{paymentId}`: espelho verificado do pagamento.
- `PublicBookingStudio/{uid}/CommissionMonths/{YYYY-MM}`: comissão reservada e aprovada.
- `MarketplaceSeller/{mercadoPagoUserId}`: índice privado entre a conta recebedora e o studio autorizado.
- `BookingPaymentWebhookEvent/{eventId}`: idempotência do webhook.
- `BookingOAuthState/{stateHash}`: autorização OAuth de uso único.

As regras públicas do Firestore não concedem acesso direto a essas coleções. Toda leitura e escrita passa pelo backend.

## Variáveis do Railway

```env
BOOKING_PAYMENTS_ENABLED=false
MERCADO_PAGO_MARKETPLACE_CLIENT_ID=
MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET=
MERCADO_PAGO_MARKETPLACE_REDIRECT_URI=https://studiosbook-api-production.up.railway.app/functions/booking-payment-oauth/callback
MERCADO_PAGO_MARKETPLACE_WEBHOOK_SECRET=
MARKETPLACE_TOKEN_ENCRYPTION_KEY=
BOOKING_PLATFORM_FEE_PERCENT=0.79
BOOKING_PLATFORM_FEE_MONTHLY_CAP=59.90
BOOKING_MP_REQUIRE_LIVE=true
```

Gere `MARKETPLACE_TOKEN_ENCRYPTION_KEY` com 32 bytes aleatórios em Base64. Nunca envie esse valor ao frontend ou ao GitHub.

## Liberação controlada

1. Criar uma aplicação exclusiva de Marketplace no Mercado Pago da BlackVision, separada da aplicação de assinaturas do SaaS.
2. Cadastrar a URL OAuth e o webhook exatamente como definidos no Railway.
3. Configurar os segredos no Railway mantendo `BOOKING_PAYMENTS_ENABLED=false`.
4. Habilitar o plano Recebimentos somente em contas internas.
5. Validar: sinal, valor integral, Pix, cartão, expiração, tentativa duplicada, reembolso parcial, reembolso total e chargeback.
6. Conferir agendamento, pagamento e comissão no Firestore e no painel do studio.
7. Ativar `BOOKING_PAYMENTS_ENABLED=true` somente após a reconciliação financeira do ciclo completo.

## Critérios de lançamento

- Nenhum segredo no bundle do frontend.
- Webhook de produção assinado e observado no Railway.
- Checkout idempotente e bloqueio simultâneo validados.
- Política pública de cancelamento e reembolso revisada.
- Alertas para falhas de webhook, conflitos de horário e pagamentos em análise.
- Rotina de reconciliação periódica e limpeza de estados temporários ativa.
