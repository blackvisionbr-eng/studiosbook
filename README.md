# StudioBook

Sistema privado para agenda, clientes, atendimentos, retornos, backups e assinatura mensal para profissionais da beleza.

## Infraestrutura atual

- Frontend/PWA: React + Vite + Tailwind
- Hospedagem: Firebase Hosting
- Login e dados: Firebase Auth + Firestore
- Backend de cobrança: Railway + Express
- Cobrança recorrente: Mercado Pago
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
VITE_API_BASE_URL=http://localhost:8080
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
npx @railway/cli up --detach --yes --name studiosbook-api
```

Variáveis obrigatórias no Railway:

```txt
PUBLIC_APP_URL=https://studiosbook.com.br
FRONTEND_ORIGINS=https://studiosbook.com.br,https://www.studiosbook.com.br,https://studiosbook.web.app
FIREBASE_PROJECT_ID=blackvision-27f1c
MERCADO_PAGO_ACCESS_TOKEN=token_do_mercado_pago
```

Variável opcional:

```txt
MERCADO_PAGO_PLAN_ID=id_do_plano_assinatura
```

Por padrão, o frontend chama:

```txt
https://api.studiosbook.com.br
```

Depois de publicar o Railway, aponte esse subdomínio para o domínio gerado pelo Railway.

## Domínio

As instruções de DNS estão em `DOMAIN_SETUP.md`.
