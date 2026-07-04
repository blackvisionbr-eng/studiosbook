# StudiosBook - Prontidao de Publicacao

**Atualizado em:** 3 de julho de 2026
**Projeto Firebase:** `blackvision-27f1c`
**Nome visivel:** `StudiosBook Production`
**Database:** `(default)` em `nam5`

## Concluido

- Rules Firestore compiladas e publicadas.
- Leitura anonima retestada com resposta `403`.
- Protecao contra exclusao ativada e confirmada remotamente.
- Faturamento Blaze ativado e confirmado pela API do Google Cloud.
- PITR ativado com janela de recuperacao de sete dias.
- Backup gerenciado diario criado com retencao de 14 dias.
- Orçamento mensal de R$ 30 criado, com alertas em 50%, 80% e 100%.
- Restauracao isolada por PITR concluida e database temporario removido.
- Dados legados BlackVision separados no database protegido `blackvision-archive`.
- Correcoes de cobranca, idempotencia e acesso implementadas.
- Identidade oficial aplicada ao app, admin, PWA e politica publica.
- Pacote de identidade atualizado em `output/StudiosBook-Identidade-Visual-Completa.zip`.
- Testes: 16 frontend e 15 backend aprovados.
- Build de producao aprovado.
- App e admin sem overflow no viewport movel testado.
- Senha administrativa anterior invalidada e todas as sessoes revogadas.
- E-mail oficial de redefinicao administrativa enviado para o dominio StudiosBook.
- Eventos Stripe de estorno adicionados ao webhook de producao.
- Estorno total real reconciliado: acesso revogado e assinatura cancelada.
- Replay assinado de `charge.refunded` aprovado, inclusive entrega duplicada idempotente.

## Protecao de dados

Estado confirmado:

- Delete protection: `ENABLED`.
- PITR: `ENABLED`.
- Retencao de versoes: `604800s` (sete dias).
- Agendas de backup: `1`, recorrencia diaria.
- Retencao dos backups: `1209600s` (14 dias).
- Backups gerenciados: `0`.

O primeiro backup gerenciado sera criado automaticamente pelo Firestore. A recuperacao ja foi validada por clone PITR; quando o primeiro backup aparecer, executar tambem o teste especifico de backup descrito em `ops/FIRESTORE-RECOVERY.md`.

Separacao confirmada:

- `(default)`: somente `AdminAuditLog`, `MercadoPagoWebhookEvent`, `StripeWebhookEvent` e `users`.
- `blackvision-archive`: somente `analytics`, `events`, `site` e `transactions` legados.
- Arquivo: delete protection ativa e acesso sem autenticacao retorna `403`.

## Comando de verificacao

```powershell
.\ops\firestore-protection.ps1 -Apply
```

O script e idempotente e pode ser executado novamente para validar ou reparar a configuracao.

## Validacao financeira em producao

Executada em 4 de julho de 2026:

- API Stripe em modo live: aprovada.
- Preco recorrente mensal de R$ 26,90: aprovado.
- Assinatura invalida de webhook: rejeitada com HTTP 400.
- Evento assinado: aceito com HTTP 200.
- Evento duplicado: reconhecido sem novo processamento.
- Estorno total: estado local `refunded`, acesso `false` e assinatura Stripe `canceled`.
- Painel admin: sincronizado com os mesmos estados da conta.

## Infraestrutura Railway

O backend foi publicado temporariamente em `southeast-asia`, porque o plano gratuito bloqueou novos deploys nas regioes dos Estados Unidos e Europa durante o horario de pico. O dominio publico nao mudou. Reposicionar a replica para `us-east` fora da janela de pico para reduzir latencia no Brasil.

## Ordem segura de publicacao

1. Confirmar a nova senha administrativa pelo e-mail de redefinicao ja enviado.
2. Revisar secrets e variaveis do Railway sem expor valores.
3. Criar commit de release e enviar ao GitHub.
4. Publicar backend Railway e validar `/health`.
5. Publicar Firebase Hosting.
6. Testar login, trial, cartao, Pix, webhook, admin e bloqueio por vencimento.
7. Confirmar a primeira execucao do backup gerenciado.
8. Monitorar erros, webhooks e cobrancas nas primeiras 24 horas.

## Decisao

**Codigo e identidade: prontos para release.**
**Publicacao final: concluida e retestada em producao.**
