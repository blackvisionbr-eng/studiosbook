# StudiosBook - Propriedade e separacao de dados

## Projeto de producao

- Nome visivel: `StudiosBook Production`.
- Project ID legado e imutavel: `blackvision-27f1c`.
- Labels: `application=studiosbook`, `environment=production` e `business_unit=blackvision`.
- O label BlackVision identifica a empresa proprietaria, nao o produto armazenado no database operacional.

## Database operacional

O app usa exclusivamente `blackvision-27f1c/(default)`.

Colecoes raiz permitidas:

- `users`: perfis e subcolecoes de operacao de cada studio.
- `AdminAuditLog`: auditoria administrativa.
- `StripeWebhookEvent`: idempotencia e auditoria Stripe.
- `MercadoPagoWebhookEvent`: historico financeiro legado do StudiosBook.

As regras do Firestore usam allowlist e negam colecoes desconhecidas.

## Arquivo BlackVision

O database `blackvision-archive` guarda somente o legado separado em 3 de julho de 2026:

- `analytics`: 1 documento.
- `events`: 82 documentos.
- `site`: 1 documento.
- `transactions`: 25 documentos.

Controles:

- delete protection: `ENABLED`.
- acesso sem autenticacao: `403`.
- nao e referenciado pelo frontend ou backend do StudiosBook.
- nao deve receber dados novos.

## Verificacao operacional

```powershell
.\ops\firestore-separate-legacy.ps1
```

Use `-Apply` somente se uma das quatro colecoes legadas reaparecer no `(default)`. O script copia, valida e apenas depois remove a origem.

## Regra de arquitetura

Novos produtos BlackVision devem usar projeto Firebase proprio. O `blackvision-archive` e uma medida de isolamento de legado, nao um banco compartilhado para novos sistemas.
