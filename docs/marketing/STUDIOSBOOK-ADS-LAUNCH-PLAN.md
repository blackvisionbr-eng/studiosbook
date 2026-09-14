# StudiosBook - Plano de mídia paga e mensuração

## Estado executivo

Data da revisão: 11/08/2026.

- Produto: StudiosBook, produto BlackVision para profissionais da beleza.
- Oferta Agenda: 7 dias de uso gratuito; depois, R$ 26,90/mês no cartão, sem fidelidade.
- Oferta recomendada Recebimentos: R$ 59,90/mês, mais 0,79% por pagamento aprovado, com comissão limitada a R$ 59,90 por mês. Inclui tudo do Agenda, agendamento on-line, Pix, cartão, sinal configurável e confirmação automática.
- Pix: comunicar somente depois de um pagamento real aprovado e de a conciliação por webhook estar validada em produção.
- Campanhas: planejamento concluído; criação externa e veiculação bloqueadas até orçamento, permissões de mensuração e criativos aprovados.
- Regra de segurança: toda campanha deve permanecer em rascunho ou pausada. Nenhuma verba pode ser consumida sem aprovação expressa.

## 1. Auditoria da página e da oferta

### Aprovado

- Domínio oficial, HTTPS, título, canonical, sitemap e páginas públicas de privacidade e termos.
- Preço, período gratuito, ausência de fidelidade e forma de cobrança apresentados antes do cadastro.
- CTA de cadastro e acesso às videoaulas.
- Linguagem compatível com PWA/web app, sem alegação de disponibilidade em lojas de aplicativos.
- Política atualizada para mensuração de marketing baseada em consentimento.

### Corrigido nesta entrega

- Criada a rota pública `/gestao-para-studios` com título e canonical próprios.
- Adicionada demonstração visual com dados explicitamente fictícios.
- Implementado Consent Mode v2 e bloqueio de GA4/Meta antes da autorização.
- Padronizados os eventos de funil e a deduplicação da primeira compra aprovada.

### Bloqueios antes da mídia

- Inserir no ambiente de produção os IDs de GTM/GA4/Meta e os segredos server-side.
- Criar e validar as ações de conversão na conta Google Ads `Black Vision` antes de vincular qualquer campanha.
- Ativar a verificação em duas etapas na Conta do Google responsável pelo Google Ads.
- Conceder perfil de administrador ou desenvolvedor no portfólio Meta para gerar o token CAPI.
- Desativar a correspondência avançada automática do Pixel antes de instalar o código no site, ou atualizar formalmente consentimento e política para a coleta pretendida.
- Validar o Pix de ponta a ponta antes de anunciá-lo.
- Definir razão social/nome empresarial, cidade/UF e identificador empresarial quando disponíveis; não inventar dados jurídicos.
- Aprovar orçamento e segmentação geográfica.
- Revisar vídeos quadro a quadro para excluir nomes, telefones, e-mails, agendas, fotos e dados de clientes.

## 2. Inventário de ativos

O inventário detalhado está em `ASSET-INVENTORY.csv`.

- Aprovados: logotipo, símbolo, Open Graph, banner, perfil e templates gráficos sem dados pessoais.
- Em espera: gravações de tela e tutoriais locais. Não usar em anúncios até revisão visual integral.
- Proibido: depoimentos inventados, resultados sem evidência, telas com clientes reais ou promessa de ganho.

## 3. KPIs e modelo de decisão

### KPIs primários

1. Primeira assinatura paga e aprovada, confirmada no webhook.
2. Conversão de início do período gratuito para primeira assinatura paga.
3. CAC da primeira assinatura paga.

### Métricas direcionadoras

- Visita qualificada para cadastro concluído.
- Cadastro concluído para início do período gratuito.
- Início do período gratuito para início de checkout.
- Início de checkout para primeira assinatura paga.
- CTR, CPC e custo por início do período gratuito, sempre como diagnóstico, não como objetivo final.

### Guardrails

- Reembolsos, chargebacks e cancelamento inicial.
- Zero compras duplicadas entre navegador e servidor.
- Zero conversões de administrador, teste ou pagamento não real.
- Divergência entre provedor de pagamento e analytics deve ser investigada antes de otimizar campanhas.

Não há meta comercial de CPA ou ROAS sem histórico confiável. A primeira janela deve formar baseline, não prometer resultado.

## 4. Eventos implementados

| Etapa | GA4 | Meta | Fonte de verdade | Deduplicação |
| --- | --- | --- | --- | --- |
| Visita | `page_view` | `ViewContent` | Navegador com consentimento | Sessão/página |
| Cadastro | `sign_up` | `CompleteRegistration` | Novo usuário confirmado | Evento de autenticação |
| Período gratuito | `start_trial` | `StartTrial` | Backend com status `trialing` | Novo usuário + estado |
| Checkout | `begin_checkout` | `InitiateCheckout` | Ação do usuário | `event_id` por tentativa |
| Compra | `purchase` | `Purchase` | Webhook de primeiro pagamento aprovado | Mesmo `event_id` no navegador e servidor |

Regras:

- Renovação mensal não conta como nova aquisição.
- Reembolso não cria compra e deve alimentar o guardrail financeiro.
- Identificadores de clique e UTMs só são persistidos depois do consentimento.
- O backend não envia e-mail, telefone ou IP para as plataformas nesta implementação.

## 5. Consentimento e LGPD

- Estado padrão: `ad_storage`, `analytics_storage`, `ad_user_data` e `ad_personalization` negados.
- Aceite: habilita tags e atribuição permitida.
- Recusa: mantém as tags de marketing bloqueadas.
- O rodapé permite reabrir o gerenciador de cookies quando a mensuração estiver configurada.
- Política pública informa finalidade, fornecedores, dados de atribuição, base legal e revogação.

## 6. Matriz de campanhas

Arquivo operacional: `CAMPAIGN-MATRIX.csv`.

Estrutura recomendada, sempre inicialmente pausada:

- Google Search de marca.
- Google Search sem marca, com correspondência exata e de frase.
- Meta prospecção por profissão e dor operacional.
- Meta remarketing somente após audiência elegível e consentida.
- Meta vídeo somente com material aprovado sem dados pessoais.
- Google e Meta para o plano Recebimentos, com criativos centrados em faltas, cobrança de sinal e confirmação automática.

## 7. Palavras-chave

### Sistema e gestão

- `[sistema para studio de beleza]`
- `"sistema para studio de beleza"`
- `[sistema para salão de beleza]`
- `"gestão para profissionais da beleza"`

### Agenda e clientes

- `[agenda para profissionais da beleza]`
- `"agenda online para beleza"`
- `[app agenda salão]`
- `"controle de clientes salão"`

### Lash e sobrancelhas

- `[agenda para lash designer]`
- `"sistema para lash designer"`
- `[agenda design de sobrancelhas]`

### Nails

- `[agenda para manicure]`
- `"sistema para nail designer"`
- `[app para manicure]`

### Cabelo e massoterapia

- `[agenda para cabeleireira]`
- `"sistema para cabeleireira"`
- `[agenda para massoterapeuta]`

### Ficha e retorno

- `[ficha técnica estética]`
- `"controle de retorno clientes"`
- `[ficha de clientes salão]`

### Marca

- `[studiosbook]`
- `[studios book]`
- `"studiosbook app"`
- `"studiosbook blackvision"`

## 8. Palavras-chave negativas

Aplicar e revisar o relatório de termos de pesquisa diariamente na primeira semana:

- emprego, vaga, salário, faculdade, curso, certificado, apostila, PDF.
- crack, pirata, grátis para sempre, APK, APK modificado, download mod.
- salão perto, manicure perto, sobrancelha perto, massagem perto.
- marcar horário salão, agendar unha, agendar cabelo, preço cílios, telefone salão.

As negativas evitam busca de emprego, formação, pirataria e intenção do consumidor final.

## 9. Anúncios de pesquisa responsivos

Arquivo operacional: `RSA-COPY.csv`. Fixação de títulos deve ser evitada no início para preservar aprendizado; preço e período gratuito permanecem consistentes na página.

## 10. Criativos Meta

Arquivo operacional: `CREATIVE-MATRIX.csv`.

Pilares:

- Agenda sem conflito.
- Cliente e histórico organizados.
- Ficha técnica e retorno.
- Catálogo editável.
- Backup e exportação.
- Gestão para diferentes profissões da beleza.

## 11. Públicos

### Prospecção

- Brasil, maior de 18 anos, idioma português.
- Conjuntos separados por agrupamento: cílios/sobrancelhas, unhas, cabelo e massoterapia.
- Teste amplo controlado em paralelo, sem segmentações sensíveis.

### Remarketing

- Visitou página pública e consentiu com marketing.
- Iniciou cadastro e não concluiu.
- Iniciou checkout e não houve primeira compra aprovada.
- Excluir assinantes ativos, administradores, usuários de teste e pagamentos reembolsados quando a audiência permitir.

## 12. Orçamento

O orçamento final não foi definido pelo responsável e não deve ser inventado. Cenários de referência para decisão, sem promessa de resultado:

| Diário | Meta prospecção | Meta remarketing | Meta vídeo | Google sem marca | Google marca | 30 dias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| R$ 60 | R$ 27 | R$ 6 | R$ 6 | R$ 18 | R$ 3 | R$ 1.800 |
| R$ 100 | R$ 45 | R$ 10 | R$ 10 | R$ 30 | R$ 5 | R$ 3.000 |
| R$ 200 | R$ 90 | R$ 20 | R$ 20 | R$ 60 | R$ 10 | R$ 6.000 |

Enquanto o remarketing não tiver audiência suficiente, sua parcela deve permanecer na prospecção Meta. A distribuição será revisada por primeiras assinaturas aprovadas, não por cliques isolados.

## 13. Testes A/B

1. H1 atual versus foco explícito em agenda e retorno.
2. CTA `Começar 7 dias gratuitos` versus `Organizar meu studio`.
3. Demonstração do produto antes versus depois dos recursos.
4. Preço em bloco compacto versus faixa de decisão.
5. Mensagem geral versus mensagem por profissão usando parâmetros transparentes e a mesma oferta.

Um teste altera uma variável principal por vez. Nenhuma versão pode ocultar preço, recorrência ou cancelamento.

## 14. Evidências e QA

Exigir antes da veiculação:

- Captura desktop e mobile da página pública.
- Ausência de overflow horizontal e erros de console.
- Consentimento aceito e recusado testados separadamente.
- DebugView/Tag Assistant para eventos do navegador.
- Evento de compra de teste aprovado, deduplicado e excluído dos relatórios comerciais.
- Webhook Stripe e, se anunciado, Pix Mercado Pago conciliados.
- Eventos internos/administrativos excluídos.

## 15. IDs e status das campanhas

| Plataforma | Campanha | ID | Status |
| --- | --- | --- | --- |
| Google Ads | Marca | Não gerado | Bloqueada por orçamento e mensuração |
| Google Ads | Sem marca | Não gerado | Bloqueada por orçamento e mensuração |
| Meta Ads | Prospecção | Não gerado | Bloqueada por orçamento, mensuração e criativos |
| Meta Ads | Remarketing | Não gerado | Bloqueada por audiência consentida |
| Meta Ads | Vídeo | Não gerado | Bloqueada por revisão de privacidade |

Nenhuma campanha foi publicada ou ativada.

### Auditoria externa em 11/08/2026

- Meta Ads: conta `836781609274852`, sem campanhas publicadas.
- Meta Events Manager: conjunto de dados `pixel_principal`, ID `2163953667421721`, sem atividade ou site conectado.
- Meta: enriquecimento automático de páginas e produtos desativado nesta revisão.
- Meta: geração do token CAPI bloqueada porque o usuário atual não é administrador ou desenvolvedor do portfólio.
- Meta: correspondência avançada automática ainda aparece ativa; o Pixel permanecerá fora da produção até esse ponto ser resolvido.
- Meta: a plataforma criou um orçamento padrão de R$ 25/dia durante a tentativa de rascunho. Como não havia orçamento aprovado, o rascunho foi desativado e descartado sem publicação ou gasto.
- Google Ads: conta correta `Black Vision`, cliente `829-332-6606`, autenticada com `getblackvision.br@gmail.com`, sem sinal de suspensão.
- Google Ads: zero campanhas ativas e zero rascunhos na conta correta. Nenhuma campanha foi criada, publicada ou ativada.
- Google Ads: nenhuma ação de conversão está configurada. A criação das campanhas permanece bloqueada até a mensuração e o orçamento serem aprovados.
- Google Ads: o faturamento apresenta saldo de R$ 0,00, nenhum pagamento anterior e nenhum pagamento futuro. Nenhuma configuração de cobrança foi alterada.
- Google Ads: a plataforma recomenda ativar a verificação em duas etapas; essa proteção deve ser concluída antes da veiculação.
- Correção de auditoria: as referências anteriores a uma conta suspensa e à `Campanha Teste` pertenciam a outra conta Google Ads. Essa conta não foi alterada e foi removida do diagnóstico do StudiosBook.

## 16. Checklist de aprovação do Newton

- [ ] Aprovar orçamento diário e teto mensal.
- [ ] Aprovar Brasil inteiro ou regiões prioritárias.
- [ ] Confirmar dados empresariais públicos disponíveis.
- [ ] Aprovar títulos, descrições e criativos.
- [ ] Confirmar que nenhum vídeo exibe dados pessoais.
- [ ] Fornecer/configurar GTM, GA4 e Meta Pixel.
- [ ] Criar e validar as conversões na conta Google Ads `Black Vision` (`829-332-6606`).
- [ ] Ativar a verificação em duas etapas na Conta do Google responsável.
- [ ] Conceder permissão Meta para gerar token CAPI e desativar correspondência avançada automática.
- [ ] Configurar segredos de mensuração server-side no Railway.
- [ ] Validar primeira compra no cartão e estorno.
- [ ] Validar Pix real antes de anunciá-lo.
- [ ] Conferir deduplicação e exclusão de tráfego interno.
- [ ] Autorizar criação das campanhas pausadas.
- [ ] Autorizar publicação em mensagem separada; sem essa autorização, manter tudo pausado.
