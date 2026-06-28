# StudiosBook

Sistema privado para agenda, clientes, atendimentos, retornos, backups e assinatura mensal para profissionais da beleza.

## Infraestrutura atual

- Frontend/PWA: React + Vite + Tailwind
- Hospedagem: Firebase Hosting
- Login e dados: Firebase Auth + Firestore
- Backend de cobrança: Railway + Express
- Cobrança: cartão recorrente e Pix mensal via Mercado Pago
- Painel admin: aba `Admin` para `sobrinhonewton@gmail.com` e `getblackvision.br@gmail.com`
- Domínio oficial: `https://studiosbook.com.br`

## Desenvolvimento local

```bash
npm install
npm run dev
```

Backend Railway em desenvolvimento:

```bash
cd railway-backend
npm install
npm start
```

Crie um `.env` local a partir de `.env.example` e configure:

```bash
VITE_API_BASE_URLS=http://localhost:8080
```

## Deploy Firebase

```bash
npm run build
firebase deploy --project blackvision-27f1c --only hosting:studiosbook,firestore
```

URL Firebase:

```txt
https://studiosbook.web.app
```

## Deploy Railway

```bash
cd railway-backend
npx @railway/cli link --project ac1e0e53-ce4d-49df-a61c-3d766cfc74e1 --environment production --service studiosbook-api
npx @railway/cli up --detach --message "Deploy StudiosBook API"
```

Variáveis obrigatórias no Railway:

```txt
FIREBASE_PROJECT_ID=blackvision-27f1c
PUBLIC_APP_URL=https://studiosbook.com.br
PUBLIC_API_URL=https://studiosbook-api-production.up.railway.app
FRONTEND_ORIGINS=https://studiosbook.com.br,https://www.studiosbook.com.br,https://studiosbook.web.app
ADMIN_EMAILS=sobrinhonewton@gmail.com,getblackvision.br@gmail.com
SUPPORT_EMAIL=getblackvision.br@gmail.com
SUPPORT_PHONE=73981068594
MERCADO_PAGO_ACCESS_TOKEN=token_do_mercado_pago
MERCADO_PAGO_WEBHOOK_SECRET=chave_secreta_da_integracao
MERCADO_PAGO_WEBHOOK_URL=https://studiosbook-api-production.up.railway.app/functions/mercado-pago-webhook
FIREBASE_SERVICE_ACCOUNT_JSON=json_ou_base64_da_service_account
```

Variáveis opcionais:

```txt
FIREBASE_CLIENT_EMAIL=email_da_service_account
FIREBASE_PRIVATE_KEY=private_key_da_service_account
```

## Cobrança e webhooks

- Os 7 dias de teste começam na data de criação da conta no Firebase Auth.
- Cartão usa assinatura recorrente mensal de R$ 19,90.
- Pix usa pagamento avulso de R$ 19,90 e libera 30 dias após aprovação.
- URL do webhook: `https://studiosbook-api-production.up.railway.app/functions/mercado-pago-webhook`
- Eventos necessários no Mercado Pago: `payment`, `subscription_preapproval` e `subscription_authorized_payment`.
- A chave exibida em `Suas integrações > Webhooks` deve ser salva como `MERCADO_PAGO_WEBHOOK_SECRET` no Railway.
- O painel Admin possui diagnóstico que valida token, disponibilidade do Pix e estado do webhook sem criar cobrança.

Por padrão, o frontend chama:

```txt
https://api.studiosbook.com.br
https://studiosbook-api-production.up.railway.app
```

O domínio público atual do Railway é `https://studiosbook-api-production.up.railway.app`.
Depois de registrar o domínio customizado no Railway, aponte `api.studiosbook.com.br` para o CNAME informado pelo Railway.

## Firebase Auth

Se o botão `Entrar com Google` retornar `CONFIGURATION_NOT_FOUND`, o Firebase Authentication ainda não foi inicializado.
Se retornar `auth/operation-not-allowed`, o provedor Google existe no código, mas está desativado no Firebase.

No Firebase Console:

1. Abrir `https://console.firebase.google.com/project/blackvision-27f1c/authentication/providers`
2. Clicar em `Get started`
3. Habilitar o provedor `Google`
4. Usar `getblackvision.br@gmail.com` como e-mail de suporte do projeto
5. Em `Authentication > Settings > Authorized domains`, adicionar:
   - `studiosbook.com.br`
   - `www.studiosbook.com.br`
   - `studiosbook.web.app`
   - `blackvision-27f1c.web.app`
6. Em Google Cloud/OAuth, se aparecer `redirect_uri_mismatch`, abrir o OAuth Client abaixo:
   - Client ID: `574358182772-8253mh8lasfvvo9cu19gsor1ko4q2hjb.apps.googleusercontent.com`
   - Link direto: `https://console.cloud.google.com/apis/credentials/oauthclient/574358182772-8253mh8lasfvvo9cu19gsor1ko4q2hjb.apps.googleusercontent.com?project=blackvision-27f1c`
7. Em `Authorized JavaScript origins`, adicionar:
   - `https://studiosbook.com.br`
   - `https://www.studiosbook.com.br`
   - `https://studiosbook.web.app`
8. Em `Authorized redirect URIs`, adicionar:
   - `https://studiosbook.com.br/__/auth/handler`
   - `https://www.studiosbook.com.br/__/auth/handler`
   - `https://studiosbook.web.app/__/auth/handler`

O frontend usa `studiosbook.com.br` como `authDomain` para evitar que clientes vejam `blackvision-27f1c.firebaseapp.com` na tela de login do Google.

## Domínio

As instruções de DNS estão em `DOMAIN_SETUP.md`.
