import { artworkCategories, tutorialArtworks } from "./tutorial-artworks.js";

export const youtubeCategoryConfig = {
  clientes: {
    playlist: "Clientes que Voltam",
    playlistDescription: "Tutoriais para cadastrar, encontrar e acompanhar clientes, mantendo histórico e relacionamento organizados.",
    hashtags: ["#StudiosBook", "#GestãoDeClientes", "#ProfissionaisDaBeleza"],
    tags: ["cadastro de clientes", "gestão de clientes", "ficha de cliente", "crm para salão", "software para beleza"],
  },
  agendamentos: {
    playlist: "Domine sua Agenda",
    playlistDescription: "Aprenda a organizar horários, confirmações, encaixes, bloqueios e disponibilidade no StudiosBook.",
    hashtags: ["#StudiosBook", "#AgendaOnline", "#GestãoDeAgenda"],
    tags: ["agenda para salão", "agenda para lash designer", "agendamento online", "agenda profissional", "gestão de horários"],
  },
  servicos: {
    playlist: "Catálogo Organizado",
    playlistDescription: "Configure serviços, categorias, preços e duração dos atendimentos para tornar sua operação mais clara.",
    hashtags: ["#StudiosBook", "#GestãoDeServiços", "#NegócioDaBeleza"],
    tags: ["catálogo de serviços", "preço de serviço", "serviços de beleza", "gestão de salão", "sistema para studio"],
  },
  equipe: {
    playlist: "Gestão de Equipe",
    playlistDescription: "Organize profissionais, horários, serviços e agendas para administrar sua equipe com mais controle.",
    hashtags: ["#StudiosBook", "#GestãoDeEquipe", "#SalãoDeBeleza"],
    tags: ["gestão de equipe", "agenda de profissionais", "equipe de salão", "gestão de studio", "software para salão"],
  },
  configuracoes: {
    playlist: "Primeiros Passos no StudiosBook",
    playlistDescription: "Configure o perfil, a identidade, os horários e a segurança da sua conta StudiosBook.",
    hashtags: ["#StudiosBook", "#TutorialStudiosBook", "#GestãoProfissional"],
    tags: ["configurar StudiosBook", "sistema de gestão", "aplicativo para salão", "segurança de conta", "gestão profissional"],
  },
  financeiro: {
    playlist: "Studio Lucrativo",
    playlistDescription: "Tutoriais para registrar pagamentos, acompanhar receitas e entender o desempenho do seu negócio.",
    hashtags: ["#StudiosBook", "#GestãoFinanceira", "#StudioLucrativo"],
    tags: ["gestão financeira", "faturamento do salão", "controle de pagamentos", "relatório de atendimentos", "indicadores de negócio"],
  },
};

const details = {
  "como-cadastrar-novo-cliente": {
    title: "Como cadastrar um cliente no StudiosBook | Passo a passo",
    hook: "Aprenda a cadastrar clientes no StudiosBook e mantenha todas as informações importantes organizadas desde o primeiro atendimento.",
    bullets: ["Criar uma nova ficha de cliente", "Preencher contato e observações importantes", "Salvar o cadastro com segurança"],
    question: "Você já mantém todos os dados dos seus clientes em um único lugar?",
  },
  "como-editar-dados-cliente": {
    title: "Como editar dados de um cliente no StudiosBook",
    hook: "Veja como atualizar os dados de um cliente no StudiosBook sem perder o histórico dos atendimentos.",
    bullets: ["Localizar a ficha correta", "Atualizar telefone e informações do cliente", "Confirmar as alterações realizadas"],
    question: "Qual informação dos seus clientes você mais precisa atualizar no dia a dia?",
  },
  "como-consultar-historico-cliente": {
    title: "Como consultar o histórico de um cliente | StudiosBook",
    hook: "Consulte o histórico completo do cliente e use informações reais para oferecer um atendimento mais personalizado.",
    bullets: ["Acessar atendimentos anteriores", "Consultar serviços e valores registrados", "Identificar o melhor momento para o retorno"],
    question: "Você costuma consultar o histórico antes de receber uma cliente novamente?",
  },
  "como-excluir-cliente": {
    title: "Como excluir um cliente com segurança | StudiosBook",
    hook: "Aprenda a remover um cadastro de cliente com confirmação e mantenha sua base organizada.",
    bullets: ["Encontrar o cadastro que será removido", "Revisar os dados antes da exclusão", "Confirmar a ação com segurança"],
    question: "Sua lista de clientes possui cadastros duplicados ou desatualizados?",
  },
  "como-encontrar-cliente": {
    title: "Como encontrar clientes rapidamente | StudiosBook",
    hook: "Encontre qualquer cliente em poucos segundos e ganhe agilidade antes, durante e depois do atendimento.",
    bullets: ["Usar a busca de clientes", "Localizar por nome ou contato", "Abrir rapidamente a ficha completa"],
    question: "Quanto tempo você perde hoje procurando informações de clientes?",
  },
  "como-agendar-horario": {
    title: "Como agendar um horário no StudiosBook | Tutorial completo",
    hook: "Aprenda a agendar um horário no StudiosBook e organize cliente, serviço, data e horário em um único fluxo.",
    bullets: ["Escolher o cliente e o serviço", "Definir data e horário", "Salvar o agendamento na agenda"],
    question: "Qual parte do agendamento mais consome seu tempo atualmente?",
  },
  "como-reagendar-atendimento": {
    title: "Como reagendar um atendimento sem perder informações",
    hook: "Reagende atendimentos no StudiosBook sem apagar ou recriar todas as informações do horário anterior.",
    bullets: ["Abrir o agendamento existente", "Alterar data ou horário", "Confirmar a nova organização da agenda"],
    question: "Reagendamentos costumam desorganizar sua rotina?",
  },
  "como-cancelar-agendamento": {
    title: "Como cancelar um agendamento no StudiosBook",
    hook: "Veja como cancelar um horário corretamente e mantenha a agenda atualizada para novos atendimentos.",
    bullets: ["Localizar o compromisso", "Registrar o cancelamento", "Liberar o horário na agenda"],
    question: "Você registra os cancelamentos ou apenas apaga as conversas do WhatsApp?",
  },
  "como-confirmar-horario": {
    title: "Como confirmar um atendimento e reduzir faltas",
    hook: "Confirme os atendimentos no StudiosBook e tenha uma visão mais clara dos horários realmente garantidos.",
    bullets: ["Identificar horários pendentes", "Atualizar o status do atendimento", "Acompanhar confirmações na agenda"],
    question: "Quantas faltas poderiam ser evitadas com uma rotina de confirmação?",
  },
  "como-visualizar-agenda": {
    title: "Como visualizar e organizar sua agenda no StudiosBook",
    hook: "Tenha uma visão clara dos compromissos do dia e encontre rapidamente horários livres no StudiosBook.",
    bullets: ["Navegar pelos dias da agenda", "Visualizar horários ocupados", "Identificar espaços disponíveis"],
    question: "Você prefere organizar sua agenda por dia, semana ou mês?",
  },
  "como-bloquear-horario": {
    title: "Como bloquear um horário na agenda | StudiosBook",
    hook: "Bloqueie pausas, folgas e compromissos pessoais para evitar agendamentos em horários indisponíveis.",
    bullets: ["Escolher a data do bloqueio", "Definir o período indisponível", "Manter o bloqueio visível na agenda"],
    question: "Você reserva pausas na agenda ou percebe que trabalha sem intervalo?",
  },
  "como-cadastrar-encaixe": {
    title: "Como adicionar um encaixe na agenda | StudiosBook",
    hook: "Adicione um encaixe sem perder o controle dos outros horários e mantenha o dia organizado.",
    bullets: ["Escolher o melhor espaço disponível", "Cadastrar os dados do encaixe", "Revisar o impacto na agenda"],
    question: "Os encaixes ajudam seu faturamento ou acabam atrasando todo o dia?",
  },
  "como-verificar-horarios-disponiveis": {
    title: "Como encontrar horários disponíveis rapidamente",
    hook: "Responda clientes com mais agilidade encontrando horários disponíveis diretamente na agenda do StudiosBook.",
    bullets: ["Consultar a disponibilidade", "Comparar dias e horários", "Escolher a melhor opção para o cliente"],
    question: "Quanto tempo você leva para responder quando uma cliente pergunta por horários?",
  },
  "como-adicionar-novo-servico": {
    title: "Como adicionar um serviço ao catálogo | StudiosBook",
    hook: "Cadastre um novo serviço com nome, preço, categoria e duração para manter seu catálogo profissional.",
    bullets: ["Criar um novo serviço", "Definir categoria e descrição", "Informar preço e duração"],
    question: "Seu catálogo já apresenta todos os serviços que você oferece hoje?",
  },
  "como-editar-servico": {
    title: "Como editar um serviço no StudiosBook",
    hook: "Atualize preços, nomes e duração dos serviços sem precisar recriar seu catálogo.",
    bullets: ["Localizar o serviço", "Alterar as informações necessárias", "Salvar o catálogo atualizado"],
    question: "Qual serviço do seu catálogo precisa ser atualizado agora?",
  },
  "como-excluir-servico": {
    title: "Como excluir um serviço do catálogo com segurança",
    hook: "Remova serviços antigos ou que não são mais oferecidos e deixe seu catálogo mais simples para consultar.",
    bullets: ["Encontrar o serviço inativo", "Revisar antes de excluir", "Confirmar a remoção do catálogo"],
    question: "Existem serviços no seu catálogo que você não oferece mais?",
  },
  "como-definir-valor-servico": {
    title: "Como definir o preço de um serviço | StudiosBook",
    hook: "Registre o valor correto de cada serviço e evite dúvidas no momento de cobrar ou analisar o faturamento.",
    bullets: ["Acessar o cadastro do serviço", "Definir ou atualizar o preço", "Confirmar o valor no catálogo"],
    question: "Você revisa os preços dos seus serviços com que frequência?",
  },
  "como-configurar-duracao-atendimento": {
    title: "Como configurar a duração de um atendimento",
    hook: "Defina a duração real de cada serviço para criar uma agenda mais precisa e reduzir atrasos.",
    bullets: ["Avaliar o tempo necessário", "Registrar a duração do serviço", "Usar o tempo correto nos agendamentos"],
    question: "Qual serviço mais costuma ultrapassar o tempo previsto?",
  },
  "como-organizar-servicos-categoria": {
    title: "Como organizar serviços por categoria | StudiosBook",
    hook: "Separe seus serviços por categoria e deixe o catálogo mais rápido de editar, consultar e utilizar.",
    bullets: ["Criar uma organização lógica", "Vincular cada serviço à categoria correta", "Revisar a lista ativa"],
    question: "Seu catálogo está organizado de uma forma que qualquer pessoa entende?",
  },
  "como-cadastrar-profissional": {
    title: "Como cadastrar sua equipe no StudiosBook",
    hook: "Cadastre profissionais no StudiosBook e comece a organizar responsabilidades, serviços e horários da equipe.",
    bullets: ["Criar o perfil do profissional", "Adicionar informações de trabalho", "Preparar a configuração da agenda"],
    question: "Quantas pessoas precisam compartilhar a organização do seu negócio?",
  },
  "como-editar-profissional": {
    title: "Como editar os dados de um profissional",
    hook: "Mantenha as informações da equipe atualizadas para evitar conflitos de agenda e serviços.",
    bullets: ["Localizar o profissional", "Atualizar dados e disponibilidade", "Salvar as alterações"],
    question: "As informações da sua equipe estão atualizadas hoje?",
  },
  "como-definir-horarios-profissional": {
    title: "Como definir horários de atendimento da equipe",
    hook: "Configure a disponibilidade de cada profissional e tenha uma agenda mais previsível para toda a equipe.",
    bullets: ["Definir dias de trabalho", "Configurar horários de atendimento", "Revisar a disponibilidade final"],
    question: "Sua equipe possui horários fixos ou uma rotina variável?",
  },
  "como-vincular-servicos-profissional": {
    title: "Como vincular serviços a cada profissional",
    hook: "Defina quais serviços cada profissional realiza e evite agendamentos incompatíveis com a equipe.",
    bullets: ["Selecionar o profissional", "Escolher os serviços realizados", "Confirmar os vínculos"],
    question: "Todos os profissionais da sua equipe realizam os mesmos serviços?",
  },
  "como-acompanhar-agenda-equipe": {
    title: "Como acompanhar a agenda da equipe | StudiosBook",
    hook: "Visualize os compromissos da equipe e encontre rapidamente quem está disponível para atender.",
    bullets: ["Consultar os horários por profissional", "Identificar conflitos", "Distribuir atendimentos com mais clareza"],
    question: "Você consegue visualizar a disponibilidade de toda a equipe em poucos segundos?",
  },
  "como-configurar-perfil-negocio": {
    title: "Como configurar o perfil do seu negócio | StudiosBook",
    hook: "Configure as informações principais do seu negócio e deixe o StudiosBook preparado para sua operação.",
    bullets: ["Informar o nome do negócio", "Preencher contato e endereço", "Salvar a configuração inicial"],
    question: "Seu perfil já representa corretamente o seu negócio?",
  },
  "como-adicionar-logotipo": {
    title: "Como adicionar o logotipo da empresa no StudiosBook",
    hook: "Adicione o logotipo do seu negócio e fortaleça sua identidade dentro do StudiosBook.",
    bullets: ["Preparar o arquivo da marca", "Enviar o logotipo", "Confirmar a aplicação no perfil"],
    question: "Seu negócio já possui um logotipo profissional?",
  },
  "como-alterar-telefone-endereco": {
    title: "Como atualizar telefone e endereço do seu negócio",
    hook: "Mantenha telefone e endereço atualizados para que as informações do seu negócio permaneçam corretas.",
    bullets: ["Acessar o perfil do negócio", "Alterar os dados de contato", "Salvar e revisar as informações"],
    question: "Quando foi a última vez que você revisou os dados públicos do seu negócio?",
  },
  "como-configurar-horarios-funcionamento": {
    title: "Como configurar os horários de funcionamento",
    hook: "Defina os dias e horários em que seu negócio atende e organize a disponibilidade da operação.",
    bullets: ["Escolher os dias de funcionamento", "Definir horários de abertura e encerramento", "Revisar a configuração semanal"],
    question: "Seu horário de funcionamento está claro para clientes e equipe?",
  },
  "como-personalizar-studiosbook": {
    title: "Como personalizar o StudiosBook para sua rotina",
    hook: "Ajuste o StudiosBook às categorias, serviços e necessidades reais do seu negócio.",
    bullets: ["Selecionar as áreas de atuação", "Revisar serviços e configurações", "Salvar um ambiente adequado à sua rotina"],
    question: "Qual configuração faria o StudiosBook funcionar melhor para você?",
  },
  "como-alterar-senha": {
    title: "Como alterar sua senha no StudiosBook com segurança",
    hook: "Atualize sua senha de acesso e mantenha os dados do seu negócio protegidos.",
    bullets: ["Acessar as configurações de segurança", "Definir uma nova senha forte", "Confirmar a alteração"],
    question: "Você utiliza uma senha exclusiva para o StudiosBook?",
  },
  "como-recuperar-acesso": {
    title: "Como recuperar o acesso à sua conta StudiosBook",
    hook: "Recupere o acesso à sua conta StudiosBook usando o fluxo seguro de redefinição de senha.",
    bullets: ["Solicitar a recuperação por e-mail", "Localizar a mensagem de redefinição", "Criar uma nova senha de acesso"],
    question: "Você sabe onde procurar caso o e-mail de recuperação não apareça na caixa de entrada?",
  },
  "como-registrar-pagamento": {
    title: "Como registrar um pagamento no StudiosBook",
    hook: "Registre pagamentos ligados aos atendimentos e mantenha seu controle financeiro mais confiável.",
    bullets: ["Selecionar o atendimento", "Informar a forma e o valor do pagamento", "Confirmar o recebimento"],
    question: "Você registra cada pagamento no momento em que recebe?",
  },
  "como-acompanhar-faturamento": {
    title: "Como acompanhar o faturamento do seu negócio",
    hook: "Acompanhe o faturamento no StudiosBook e entenda melhor o resultado gerado pelos seus atendimentos.",
    bullets: ["Consultar receitas do período", "Comparar resultados", "Usar os dados para tomar decisões"],
    question: "Você sabe exatamente quanto seu negócio faturou neste mês?",
  },
  "como-visualizar-atendimentos-realizados": {
    title: "Como consultar atendimentos realizados | StudiosBook",
    hook: "Consulte os atendimentos concluídos e encontre rapidamente informações sobre serviços, clientes e valores.",
    bullets: ["Acessar o histórico de atendimentos", "Filtrar os registros", "Revisar informações financeiras e operacionais"],
    question: "Você consegue encontrar um atendimento antigo sem procurar em várias conversas?",
  },
  "como-consultar-resumo-dia": {
    title: "Como visualizar o resumo do dia no StudiosBook",
    hook: "Veja os principais números do dia e acompanhe agenda, atendimentos e receitas em uma única visão.",
    bullets: ["Consultar os compromissos do dia", "Acompanhar atendimentos realizados", "Revisar a movimentação diária"],
    question: "Você encerra o dia sabendo exatamente o que aconteceu no negócio?",
  },
  "como-acompanhar-desempenho-negocio": {
    title: "Como analisar o desempenho do seu negócio",
    hook: "Use os relatórios do StudiosBook para acompanhar retorno de clientes, faturamento e evolução do negócio.",
    bullets: ["Interpretar os principais indicadores", "Identificar oportunidades de melhoria", "Tomar decisões com base em dados"],
    question: "Qual indicador é mais importante para o crescimento do seu negócio hoje?",
  },
};

function unique(values) {
  return [...new Set(values)];
}

export const youtubePublicationContent = tutorialArtworks.map((tutorial) => {
  const item = details[tutorial.id];
  const category = youtubeCategoryConfig[tutorial.category];
  if (!item || !category) throw new Error(`Conteúdo do YouTube ausente para ${tutorial.id}`);

  const description = `${item.hook}

👉 Organize seu negócio e teste o StudiosBook grátis por 7 dias:
https://studiosbook.com.br

Neste tutorial você vai aprender:
- ${item.bullets.join("\n- ")}

📌 Série: ${category.playlist}
Continue assistindo aos tutoriais desta playlist para dominar o StudiosBook e transformar sua rotina em um processo mais organizado.

Inscreva-se no canal e ative as notificações para acompanhar os próximos tutoriais.

StudiosBook — Seu talento em foco. Seu studio sob controle.

${category.hashtags.join(" ")}`;

  const pinnedComment = `${item.question}

Conte sua experiência nos comentários. Sua dúvida também pode virar um próximo tutorial.

👉 Aplique agora no seu negócio: https://studiosbook.com.br
Teste grátis por 7 dias e continue pela playlist “${category.playlist}”.`;

  return {
    id: tutorial.id,
    category: tutorial.category,
    categoryLabel: artworkCategories[tutorial.category].label,
    playlist: category.playlist,
    episode: tutorial.episode,
    thumbnailText: tutorial.shortTitle,
    title: item.title,
    description,
    pinnedComment,
    hashtags: category.hashtags,
    tags: unique(["StudiosBook", "tutorial StudiosBook", ...category.tags]),
  };
});

