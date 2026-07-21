# StudiosBook

Sistema privado para agenda, clientes, atendimentos, retornos, controle de acesso e assinatura mensal para profissionais da beleza.

## Stack

- Frontend/PWA: React, Vite e Tailwind CSS.
- Hospedagem: Firebase Hosting.
- Login e dados: Firebase Auth e Firestore.
- Backend de cobrança: Express em ambiente Railway.
- Pagamentos: cartão recorrente e Pix.
- Painel administrativo para gestão operacional e suporte.

## Desenvolvimento local

Instale as dependências do frontend:

```bash
npm install
npm run dev
```

Instale as dependências do backend:

```bash
cd railway-backend
npm install
npm start
```

Crie os arquivos `.env` locais a partir dos exemplos:

```bash
cp .env.example .env
cp railway-backend/.env.example railway-backend/.env
```

Use URLs locais durante o desenvolvimento:

```txt
VITE_API_BASE_URLS=http://localhost:8080
PUBLIC_API_URL=http://localhost:8080
PUBLIC_APP_URL=http://localhost:5173
```

## Validação local

Antes de publicar uma alteração, execute:

```bash
npm test
npm run build
npm run backend:test
```

Ou rode a sequência completa:

```bash
npm run verify
```

## Deploy

O deploy de produção depende de projetos, domínios, credenciais e webhooks específicos. Esses dados não devem ficar no README público.

Mantenha as instruções operacionais completas em documentação privada, incluindo:

- IDs de projeto Firebase.
- IDs de projeto Railway.
- Domínios oficiais.
- URLs de webhook.
- E-mails administrativos.
- Telefones de suporte.
- Chaves, secrets, service accounts e tokens de pagamento.

## Variáveis de ambiente

Os arquivos `.env.example` mostram apenas nomes de variáveis e placeholders. Nunca publique `.env`, chaves reais, secrets, service accounts ou tokens de gateway de pagamento.

## Segurança operacional

- Secrets de produção ficam somente nos provedores de infraestrutura.
- Contas administrativas devem usar autenticação forte e acesso mínimo necessário.
- Webhooks devem validar assinatura antes de atualizar acesso ou pagamentos.
- Exportações de dados devem proteger contra CSV injection.
- Alterações de cobrança e acesso precisam passar por testes antes de deploy.

## Documentação interna

Documentos de DNS, Firebase, Railway, OAuth, cobrança e recuperação de produção devem ficar em ambiente privado ou em repositório interno com controle de acesso.
