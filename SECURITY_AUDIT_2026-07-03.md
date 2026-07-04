# Auditoria de Segurança e Prontidão de Lançamento - StudiosBook

**Data:** 3 de julho de 2026
**Alvo autorizado:** `studiosbook.com.br` e backend oficial do projeto
**Método:** OWASP Top 10, OWASP API Security, PTES e checklist SaaS com assinatura
**Modalidade:** caixa-cinza, revisão de código e testes públicos não destrutivos

## 1. Resumo executivo

O StudiosBook possui uma base de segurança adequada para evoluir para produção: autenticação Firebase, isolamento por UID, regras Firestore implantadas, backend com Firebase Admin, Stripe com webhook assinado, valores definidos no servidor, painel administrativo separado e ausência de secrets de produção no histórico Git analisado.

Foram confirmadas duas falhas de lógica de cobrança de severidade alta: um mesmo Pix poderia conceder dois períodos de 30 dias quando chegasse por tipos diferentes de evento Stripe, e um status antigo `approved/active` poderia manter acesso após o fim do período pago. Ambas foram corrigidas localmente, com idempotência atômica por PaymentIntent e política de acesso baseada em datas confirmadas.

**Decisão atual: NÃO LIBERAR O LANÇAMENTO AINDA.** O código corrigido precisa ser publicado e retestado. A proteção contra exclusão, o PITR e o backup diário do Firestore estão ativos, e a restauração isolada por PITR foi aprovada. Também é obrigatório rotacionar a credencial administrativa divulgada anteriormente. Após os bloqueadores da seção 7, o sistema pode seguir para um lançamento controlado.

### Contagem dos achados

| Severidade | Quantidade | Situação |
|---|---:|---|
| Crítica | 0 | - |
| Alta | 4 | 2 corrigidas localmente; 1 corrigida em produção; 1 depende de ação externa |
| Média | 8 | 5 corrigidas localmente; 2 dependem de configuração externa; 1 em monitoramento |
| Baixa | 4 | 4 corrigidas localmente ou documentadas |

## 2. Arquitetura mapeada

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Frontend | React 18, Vite, Tailwind | App, catálogo, clientes, agenda, procedimentos, backups e cobrança |
| Autenticação | Firebase Authentication | Google para usuários; e-mail/senha e claim `platform_admin` para admin |
| Banco | Cloud Firestore | Dados separados em `/users/{uid}/{entidade}` |
| Arquivos | Firebase Storage | Código preparado, porém bucket/produção em espera |
| Backend | Node.js, Express, Firebase Admin | Autorização, assinatura, sincronização e administração |
| Pagamentos | Stripe Checkout, Portal e Webhooks | Cartão recorrente e estrutura de Pix avulso |
| Hospedagem | Firebase Hosting + Railway | Frontend e API |

### Endpoints principais

- Públicos: `GET /`, `GET /health`, `POST /functions/stripe-webhook`.
- Usuário autenticado: conta de cobrança, checkout, portal, Pix e sincronização.
- Admin com claim e e-mail verificado: sessão, visão geral, diagnóstico, exportação, sincronização e bloqueio de usuário.
- Métodos não implementados passam a retornar JSON `404`; não existem rotas genéricas de `PUT`, `PATCH` ou `DELETE` no backend.

## 3. Tabela de vulnerabilidades e riscos

| ID | Falha | Severidade | Local | Evidência e reprodução segura | Impacto | Correção/status | Prioridade |
|---|---|---|---|---|---|---|---|
| SB-01 | Crédito Pix duplicado entre eventos | Alta | `applyStripePixPayment` | Dois eventos Stripe válidos e distintos para o mesmo PaymentIntent, como `checkout.session.completed` e `payment_intent.succeeded`, executavam nova soma de 30 dias | Acesso concedido em excesso, perda de receita e divergência financeira | Corrigido localmente com transação Firestore e marcador `access_granted` por PaymentIntent | P0 |
| SB-02 | Acesso indefinido por status antigo | Alta | `billingAccess` e frontend | `last_payment_status=approved` ou provider `active`, sem período futuro, retornava acesso permitido | Usuário poderia permanecer premium após vencimento | Corrigido localmente; somente trial/período futuro ou override admin permite acesso | P0 |
| SB-03 | Credencial administrativa divulgada | Alta | Operação/admin | A senha foi compartilhada em conversa anterior; não foi localizada no Git | Tomada completa do painel se a credencial for reutilizada ou a conversa for exposta | **Pendente:** trocar senha, revogar sessões e ativar MFA | P0 |
| SB-04 | Recuperação de desastre incompleta | Alta | Firestore | Proteção contra exclusão, PITR e agenda de backup precisavam ser ativados | Exclusão lógica, alteração em massa ou perda do database teria recuperação limitada | **Corrigido remotamente:** delete protection e PITR ativos; backup diário com retenção de 14 dias; clone PITR validado e removido após conferência | P0 |
| SB-05 | Subcoleções arbitrárias no Firestore | Média | `firestore.rules` | Regra anterior aceitava qualquer `entityName`, exceto duas coleções de cobrança | Abuso de armazenamento e dados fora do modelo | Corrigido localmente com allowlist explícita | P0 |
| SB-06 | CSP ausente | Média | Firebase Hosting | Produção não enviava `Content-Security-Policy` | Aumenta o impacto de eventual injeção de conteúdo | Corrigido localmente para app, admin e privacidade | P0 |
| SB-07 | Sessão admin persistente e sem reautenticação recente | Média | Admin/backend | Persistência local sobrevivia ao fechamento; ações sensíveis aceitavam token antigo | Maior janela de abuso em dispositivo comprometido | Corrigido localmente: sessão por aba e autenticação de até 15 minutos para exportar/bloquear/sincronizar | P0 |
| SB-08 | Rate limit antes da autenticação e cobertura incompleta | Média | API de cobrança/admin | Requisições anônimas podiam consumir cota compartilhada; Pix/portal/sync não tinham limite específico | Negação de serviço seletiva e abuso operacional | Corrigido localmente com limites por UID após autenticação | P0 |
| SB-09 | CSV Formula Injection | Média | Exportação de clientes/agenda | Campo iniciado por `=`, `+`, `-` ou `@` era aberto como fórmula em planilhas | Execução de fórmulas maliciosas ao abrir exportação | Corrigido localmente e coberto por testes | P0 |
| SB-10 | App Check e restrições da chave não confirmados | Média | Firebase | SDK não inicializa App Check; restrições da chave pública não foram confirmadas no console | Facilita automação abusiva contra recursos Firebase | **Pendente:** monitorar e habilitar App Check gradualmente; revisar restrições de API | P1 |
| SB-11 | Permissão Stripe insuficiente para detectar Pix | Média | Stripe restricted key | Log operacional indicou ausência de `payment_method_configurations_read` | Pix pode aparecer indisponível apesar de habilitado | **Pendente:** ajustar permissão da chave ou manter Pix oculto | P1 |
| SB-12 | Dependência transitiva `uuid` com alerta moderado | Média | Backend npm | `npm audit` aponta 6 ocorrências transitivas via Firebase Admin/Google Cloud Storage; correção automática força downgrade incompatível | Risco baixo no caminho atual, mas dívida de supply chain | Monitorar atualização upstream; não aplicar `--force` | P1 |
| SB-13 | CORS negado retornava erro 500 | Baixa | Middleware Express | Preflight de origem não permitida retornava HTML 500 | Ruído operacional e enumeração de implementação | Corrigido localmente para JSON 403 | P1 |
| SB-14 | Health/webhook expunham modo e prontidão | Baixa | API pública | Respostas mostravam Stripe live e estado de secrets | Fingerprinting desnecessário | Corrigido localmente; health agora é mínimo e falha com 503 quando incompleto | P1 |
| SB-15 | Rotas desconhecidas, robots e sitemap incorretos | Baixa | Firebase Hosting | Catch-all servia o app com 200 para arquivos inexistentes | SEO ruim e falsa aparência de arquivos expostos | Corrigido localmente com 404 real, `robots.txt`, `sitemap.xml` e `security.txt` | P2 |
| SB-16 | Domínio próprio da API não resolve | Baixa | DNS/infra | `api.studiosbook.com.br` não resolve; frontend usa URL Railway | Dependência visível do fornecedor e troca futura mais difícil | Configurar domínio da API após estabilização | P2 |

## 4. Controles aprovados

- HTTPS ativo no domínio raiz e em `www`; HTTP redireciona para HTTPS.
- Firestore rejeitou leitura não autenticada com `403`.
- Regras implantadas antes da correção já impediam acesso cruzado entre UIDs e escrita direta em cobrança.
- Webhook Stripe rejeitou assinatura inválida com `400` e usa corpo bruto antes do parser JSON.
- Valores e produto da assinatura são definidos no backend; o cliente não envia preço livre.
- Sincronização por `session_id` valida vínculo com o UID.
- Admin exige claim `platform_admin` e e-mail verificado.
- Sem `dangerouslySetInnerHTML`, `eval` ou interpolação HTML encontrada no React.
- Sem `.env`, chave Stripe, segredo de webhook, private key ou sourcemap publicados nos testes realizados.
- Frontend: `npm audit --omit=dev` sem vulnerabilidades conhecidas.
- Service worker não armazena dados privados; navegações usam rede e fallback offline.
- Payload JSON limitado a 256 KB; webhook limitado a 256 KB.
- Projeto identificado como `StudiosBook Production`; dados legados BlackVision isolados em database fechado e protegido.
- Orçamento mensal de R$ 30 com alertas de 50%, 80% e 100% restrito ao projeto StudiosBook.

## 5. Checklist de lançamento

| Item | Resultado | Observação |
|---|---|---|
| HTTPS, HSTS e headers básicos | Aprovado | Ativos em produção |
| CSP | Reprovado em produção | Correção local aguardando deploy |
| Autenticação de usuário | Aprovado com reteste | Fluxo Google já opera; retestar após CSP |
| Autorização por UID | Aprovado | Regras remotas e teste anônimo confirmados |
| Allowlist de coleções | Aprovado | Regra compilada, publicada e testada remotamente |
| Admin separado e protegido | Precisa revisar | Código endurecido; senha precisa ser trocada |
| Trial de 7 dias | Aprovado por teste unitário | Baseado na criação da conta Firebase |
| Cartão recorrente | Precisa revisar | Exige E2E pós-deploy com conta de teste |
| Pix avulso | Reprovado para lançamento | Não exibir até permissão/capacidade Stripe e idempotência publicada |
| Webhook assinado | Aprovado | Rejeição de assinatura inválida confirmada |
| Idempotência financeira | Reprovado em produção | Correção atômica local aguardando deploy |
| Bloqueio após vencimento | Reprovado em produção | Correção local aguardando deploy |
| Rate limit | Precisa revisar | Correção local aguardando teste em produção |
| Política de Privacidade pública | Reprovado em produção | Página pública criada localmente |
| Backup independente | Reprovado | Snapshot interno não substitui backup externo |
| Proteção contra exclusão | Aprovado | Ativada e confirmada remotamente |
| PITR e backup gerenciado | Aprovado | PITR ativo; agenda diária com retenção de 14 dias; clone isolado validado com todas as contagens coincidentes |
| App Check | Precisa revisar | Implantar primeiro em monitoramento |
| Responsividade da entrada | Aprovado parcialmente | Desktop sem overflow; mobile autenticado precisa de reteste real |
| Upload de fotos | Fora desta liberação | Mantido em espera por ausência do bucket/plano |
| Build e testes automatizados | Aprovado | 15 frontend + 12 backend; build concluído |

## 6. Correções implementadas localmente

1. Idempotência atômica de Pix no Firestore por PaymentIntent.
2. Validação de produto, preço, moeda, ambiente e vínculo da cobrança antes de liberar acesso.
3. Acesso premium baseado em trial/período futuro, com comportamento fail-closed.
4. Allowlist de entidades nas regras Firestore.
5. Sessão administrativa por aba e reautenticação recente em operações sensíveis.
6. Rate limits por UID em checkout, Pix, portal, sincronização e admin.
7. CORS 403 JSON, request ID sanitizado, 404 JSON e health check mínimo.
8. CSP segmentada para não quebrar os materiais públicos da marca.
9. Proteção contra fórmulas em CSV.
10. Exportação administrativa completa paginada e contagens reais por aggregate query.
11. Arquivos temporários Stripe adicionados ao `.gitignore`.
12. `robots.txt`, `sitemap.xml`, `security.txt`, 404 e política pública de privacidade.
13. PDF movido para lazy loading: bundle inicial caiu de aproximadamente 871 KB para 479 KB.

## 7. Plano de ação

### Corrigir antes do lançamento

1. Rotacionar imediatamente a senha admin, revogar sessões e ativar MFA na conta administrativa.
2. Revisar o diff, criar commit e publicar backend, frontend e regras Firestore em uma janela controlada.
3. Executar o roteiro financeiro E2E da seção 8 com um usuário exclusivo de teste.
4. Liberar Pix somente após a Stripe confirmar capacidade e o webhook idempotente estar publicado.
5. Confirmar a primeira execução do backup gerenciado; o restore drill por PITR já foi aprovado.
6. Confirmar no Google Cloud as restrições da API key e iniciar App Check em modo de monitoramento.

### Corrigir logo após o lançamento

1. Configurar `api.studiosbook.com.br` para desacoplar o frontend da URL Railway.
2. Criar alertas para falha de webhook, aumento de 401/403/429/500 e health check.
3. Criar job diário de reconciliação Stripe x Firestore e relatório de divergências.
4. Atualizar Firebase Admin/Google Cloud Storage quando houver correção compatível para `uuid`.
5. Adicionar CI com testes, audit, build e verificação de secrets antes de cada deploy.

### Melhorias futuras

1. Página pública de status e histórico de incidentes.
2. Exportação criptografada e backup multi-projeto/multi-provedor.
3. Trilha de auditoria visível para ações críticas do próprio usuário.
4. SAST, DAST seguro e verificação automática de dependências em cada pull request.

## 8. Roteiro de validação final

### Autenticação e isolamento

1. Criar duas contas de teste A e B.
2. Cadastrar um cliente em A e tentar consultar/alterar o ID usando B.
3. Resultado esperado: Firestore nega acesso; nenhum dado de A aparece em B.
4. Tentar criar subcoleção não permitida sob o próprio UID.
5. Resultado esperado: `permission-denied`.

### Trial e vencimento

1. Criar conta nova e confirmar trial com sete dias contados desde `creationTime`.
2. Usar relógio/dados de teste para deixar trial e período pagos no passado.
3. Resultado esperado: backend e UI bloqueiam escrita e área premium; admin override continua explícito.

### Cartão e Pix

1. Testar checkout de cartão aprovado, recusado, cancelado e sessão abandonada.
2. Confirmar que webhook e sincronização convergem para o mesmo status.
3. Reenviar o mesmo evento Stripe e eventos diferentes do mesmo PaymentIntent Pix.
4. Resultado esperado: um único período de 30 dias, sem soma duplicada.
5. Cancelar assinatura e confirmar acesso apenas até `current_period_end`.
6. Simular `invoice.payment_failed` durante período já pago; acesso permanece até o fim e bloqueia depois.

### Admin e API

1. Token comum em rota admin: esperar `403`.
2. Token admin antigo em exportação/bloqueio: esperar `401 recent_auth_required`.
3. Reautenticar e repetir: esperar sucesso e registro em `AdminAuditLog`.
4. Origem CORS não permitida: esperar `403` JSON.
5. Exceder limites em conta de teste: esperar `429`, sem afetar outro UID.

### Frontend e infraestrutura

1. Validar CSP no domínio publicado e testar login Google após o deploy.
2. Testar 360x800, 390x844, 768x1024 e 1440x900 em login, clientes, catálogo, procedimento, assinatura e admin.
3. Confirmar `scrollWidth === clientWidth` em cada tela.
4. Validar `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`, `/privacy.html` e um caminho inexistente com 404.
5. Simular backend dormindo/indisponível; UI deve falhar fechada para cobrança e exibir erro recuperável.

## 9. Evidências de QA

- Testes frontend: **15 aprovados, 0 falhas**.
- Testes backend: **12 aprovados, 0 falhas**.
- Build Vite: aprovado; bundle inicial principal ~479 KB, gzip ~122 KB.
- Sintaxe Node e JSON: aprovada.
- `git diff --check`: aprovado.
- Teste local HTTP: health incompleto `503`, CORS negado `403`, rota inexistente `404`.
- Produção: Firestore anônimo `403`, webhook inválido `400`, arquivos sensíveis e sourcemaps não expostos.
- Dependências: frontend limpo; backend com alerta transitivo moderado sem correção compatível automática.

## 10. Limitações do teste

- Nenhuma cobrança real, cancelamento real ou mutação destrutiva foi executada durante esta auditoria.
- Não foi fornecida uma segunda conta autenticada de teste para validar IDOR dinamicamente; as regras e o código foram revisados e a negação anônima foi testada.
- O fluxo mobile autenticado precisa ser repetido após deploy. A automação isolada permaneceu no splash enquanto aguardava Firebase.
- Upload de fotos não foi testado porque a ativação do Firebase Storage permanece em espera.
- As correções deste relatório estão no workspace local e **não representam o estado atual da produção até serem implantadas**.

## 11. Referências operacionais

- O Firebase recomenda PITR e backups programados para recuperação de exclusões ou modificações acidentais: [Firestore PITR](https://firebase.google.com/docs/firestore/pitr) e [Disaster recovery](https://firebase.google.com/docs/firestore/disaster-recovery).
- App Check ajuda a restringir o acesso aos recursos Firebase ao aplicativo registrado e deve ser ativado após monitoramento: [Firebase App Check para web](https://firebase.google.com/docs/app-check/web/recaptcha-provider).
- Chaves restritas Stripe devem receber apenas as permissões necessárias: [Stripe API keys](https://docs.stripe.com/keys).
- O modo Serverless da Railway pode gerar atraso no primeiro acesso após inatividade: [Railway Serverless](https://docs.railway.com/deployments/serverless).

## 12. Oportunidade estratégica

Segurança e continuidade podem virar diferencial comercial do StudiosBook. Um plano superior pode incluir backup externo automatizado, histórico de auditoria, status público e relatório mensal de integridade. Isso transforma custo operacional em recurso recorrente, aumenta confiança e cria barreira competitiva sem depender do fundador para conferência manual.
