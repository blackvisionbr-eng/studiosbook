const makeTutorials = (category, icon, items) =>
  items.map(([id, title, shortTitle, description, screen], index) => ({
    id,
    category,
    icon,
    title,
    shortTitle,
    description,
    screen,
    episode: index + 1,
    device: category === "financeiro" ? "desktop" : "iphone",
  }));

export const artworkCategories = {
  clientes: {
    label: "Clientes",
    icon: "users",
    accent: "#2B6CB0",
    series: "Clientes que Voltam",
  },
  agendamentos: {
    label: "Agendamentos",
    icon: "calendar-days",
    accent: "#2E7D72",
    series: "Domine sua Agenda",
  },
  servicos: {
    label: "Serviços",
    icon: "scissors",
    accent: "#A84D68",
    series: "StudiosBook em 1 Minuto",
  },
  equipe: {
    label: "Profissionais e equipe",
    icon: "user-round-cog",
    accent: "#6D4BA5",
    series: "Gestão de Equipe",
  },
  configuracoes: {
    label: "Configurações",
    icon: "settings",
    accent: "#B56B15",
    series: "Primeiros Passos",
  },
  financeiro: {
    label: "Financeiro e gestão",
    icon: "chart-no-axes-combined",
    accent: "#2F7A5F",
    series: "Studio Lucrativo",
  },
};

export const tutorialArtworks = [
  ...makeTutorials("clientes", "users", [
    ["como-cadastrar-novo-cliente", "Como cadastrar um novo cliente", "Cadastre um cliente", "Crie uma ficha organizada em poucos passos.", "client-form"],
    ["como-editar-dados-cliente", "Como editar os dados de um cliente", "Edite um cliente", "Mantenha telefone, observações e preferências atualizados.", "client-form"],
    ["como-consultar-historico-cliente", "Como consultar o histórico de um cliente", "Histórico do cliente", "Acesse atendimentos, retornos e informações importantes.", "client-history"],
    ["como-excluir-cliente", "Como excluir um cliente", "Exclua um cliente", "Remova registros com confirmação e segurança.", "clients-list"],
    ["como-encontrar-cliente", "Como encontrar um cliente rapidamente", "Encontre clientes", "Use a busca para localizar qualquer ficha em segundos.", "clients-list"],
  ]),
  ...makeTutorials("agendamentos", "calendar-days", [
    ["como-agendar-horario", "Como agendar um horário", "Agende um horário", "Cadastre o cliente, serviço, data e horário do atendimento.", "new-appointment"],
    ["como-reagendar-atendimento", "Como reagendar um atendimento", "Reagende um horário", "Altere data e hora sem perder os dados do agendamento.", "schedule"],
    ["como-cancelar-agendamento", "Como cancelar um agendamento", "Cancele um horário", "Atualize a agenda e mantenha o histórico organizado.", "schedule"],
    ["como-confirmar-horario", "Como confirmar um horário", "Confirme o atendimento", "Registre a confirmação e reduza faltas na agenda.", "schedule"],
    ["como-visualizar-agenda", "Como visualizar sua agenda", "Visualize sua agenda", "Acompanhe compromissos e horários livres em uma única tela.", "schedule"],
    ["como-bloquear-horario", "Como bloquear um horário na agenda", "Bloqueie um horário", "Reserve pausas, folgas e compromissos particulares.", "schedule"],
    ["como-cadastrar-encaixe", "Como cadastrar um encaixe", "Adicione um encaixe", "Inclua um atendimento extra com controle e clareza.", "new-appointment"],
    ["como-verificar-horarios-disponiveis", "Como verificar os horários disponíveis", "Horários disponíveis", "Encontre rapidamente a melhor opção para o cliente.", "schedule"],
  ]),
  ...makeTutorials("servicos", "scissors", [
    ["como-adicionar-novo-servico", "Como adicionar um novo serviço", "Adicione um serviço", "Cadastre nome, categoria, preço e duração.", "services"],
    ["como-editar-servico", "Como editar um serviço", "Edite um serviço", "Atualize as informações do catálogo sem complicação.", "services"],
    ["como-excluir-servico", "Como excluir um serviço", "Exclua um serviço", "Remova itens antigos mantendo o catálogo limpo.", "services"],
    ["como-definir-valor-servico", "Como definir o valor de um serviço", "Defina o valor", "Organize preços e mantenha seu posicionamento atualizado.", "services"],
    ["como-configurar-duracao-atendimento", "Como configurar a duração do atendimento", "Defina a duração", "Reserve o tempo correto para cada procedimento.", "services"],
    ["como-organizar-servicos-categoria", "Como organizar os serviços por categoria", "Organize os serviços", "Deixe o catálogo simples de consultar e editar.", "services"],
  ]),
  ...makeTutorials("equipe", "user-round-cog", [
    ["como-cadastrar-profissional", "Como cadastrar um profissional", "Cadastre sua equipe", "Inclua profissionais e organize responsabilidades.", "team"],
    ["como-editar-profissional", "Como editar os dados de um profissional", "Edite um profissional", "Atualize informações e disponibilidade da equipe.", "team"],
    ["como-definir-horarios-profissional", "Como definir os horários de atendimento", "Defina os horários", "Configure a disponibilidade de cada profissional.", "team"],
    ["como-vincular-servicos-profissional", "Como vincular serviços a um profissional", "Vincule os serviços", "Defina quais atendimentos cada pessoa realiza.", "team"],
    ["como-acompanhar-agenda-equipe", "Como acompanhar a agenda da equipe", "Agenda da equipe", "Visualize compromissos e disponibilidade em conjunto.", "team"],
  ]),
  ...makeTutorials("configuracoes", "settings", [
    ["como-configurar-perfil-negocio", "Como configurar o perfil do seu negócio", "Configure seu negócio", "Personalize as informações principais do seu studio.", "settings"],
    ["como-adicionar-logotipo", "Como adicionar o logotipo da empresa", "Adicione seu logotipo", "Fortaleça sua marca dentro do StudiosBook.", "settings"],
    ["como-alterar-telefone-endereco", "Como alterar telefone e endereço", "Atualize seus dados", "Mantenha os canais de contato sempre corretos.", "settings"],
    ["como-configurar-horarios-funcionamento", "Como configurar os horários de funcionamento", "Horários de funcionamento", "Defina quando seu negócio atende.", "settings"],
    ["como-personalizar-studiosbook", "Como personalizar o StudiosBook", "Personalize o sistema", "Ajuste o aplicativo para a rotina do seu negócio.", "settings"],
    ["como-alterar-senha", "Como alterar sua senha", "Altere sua senha", "Atualize sua credencial de acesso com segurança.", "security"],
    ["como-recuperar-acesso", "Como recuperar o acesso à conta", "Recupere seu acesso", "Redefina sua senha e volte ao sistema.", "security"],
  ]),
  ...makeTutorials("financeiro", "chart-no-axes-combined", [
    ["como-registrar-pagamento", "Como registrar um pagamento", "Registre um pagamento", "Mantenha os recebimentos ligados aos atendimentos.", "finance"],
    ["como-acompanhar-faturamento", "Como acompanhar o faturamento", "Acompanhe o faturamento", "Visualize receitas e evolução do período.", "finance"],
    ["como-visualizar-atendimentos-realizados", "Como visualizar os atendimentos realizados", "Atendimentos realizados", "Consulte procedimentos concluídos e seus valores.", "reports"],
    ["como-consultar-resumo-dia", "Como consultar o resumo do dia", "Resumo do dia", "Veja agenda, recebimentos e movimentação em uma tela.", "dashboard"],
    ["como-acompanhar-desempenho-negocio", "Como acompanhar o desempenho do negócio", "Desempenho do negócio", "Use indicadores para tomar decisões melhores.", "reports"],
  ]),
];

export const deviceShowcases = [
  {
    id: "studiosbook-android",
    title: "StudiosBook para Android",
    description: "Gerencie clientes, serviços e agendamentos diretamente pelo celular.",
    device: "android",
    screen: "dashboard",
  },
  {
    id: "studiosbook-iphone",
    title: "StudiosBook para iPhone",
    description: "Organize seu negócio de forma simples, rápida e profissional.",
    device: "iphone",
    screen: "schedule",
  },
  {
    id: "studiosbook-tablet",
    title: "StudiosBook para Tablets",
    description: "Tenha uma visão completa da sua agenda e gerencie seu negócio em uma tela maior.",
    device: "tablet",
    screen: "schedule",
  },
  {
    id: "studiosbook-multiplataforma",
    title: "Seu negócio na palma da sua mão",
    description: "Acesse o StudiosBook pelo celular, tablet ou computador.",
    device: "multiplatform",
    screen: "dashboard",
  },
];

export const tutorialOpenings = [
  {
    id: "abertura-bem-vindo",
    title: "Bem-vindo a mais um tutorial do StudiosBook",
    description: "Aprenda a organizar e gerenciar seu negócio de forma simples.",
  },
  {
    id: "abertura-tutorial-studiosbook",
    title: "Tutorial StudiosBook",
    description: "Confira o passo a passo desta funcionalidade.",
  },
  {
    id: "abertura-aprenda",
    title: "Aprenda com o StudiosBook",
    description: "Mais controle, organização e agilidade para o seu negócio.",
  },
];

export const tutorialEndings = [
  {
    id: "encerramento-tutorial-concluido",
    title: "Tutorial concluído!",
    description: "Agora você já sabe como utilizar esta funcionalidade no StudiosBook.",
  },
  {
    id: "encerramento-configuracao-realizada",
    title: "Configuração realizada com sucesso!",
    description: "Continue acompanhando nossos tutoriais para aprender mais.",
  },
  {
    id: "encerramento-obrigado",
    title: "Obrigado por assistir!",
    description: "Inscreva-se no canal e ative as notificações para acompanhar os próximos tutoriais.",
  },
  {
    id: "encerramento-duvidas",
    title: "Ficou com alguma dúvida?",
    description: "Deixe seu comentário ou entre em contato com a nossa equipe.",
  },
  {
    id: "encerramento-simplifique",
    title: "Simplifique a gestão do seu negócio",
    description: "Acesse studiosbook.com.br",
  },
  {
    id: "encerramento-proximo-tutorial",
    title: "Até o próximo tutorial!",
    description: "Continue evoluindo a gestão do seu negócio com o StudiosBook.",
  },
];

export const artworkFormats = {
  youtube: { width: 1280, height: 720, label: "YouTube" },
  horizontal: { width: 1920, height: 1080, label: "Horizontal Full HD" },
  vertical: { width: 1080, height: 1920, label: "Shorts, Reels e Stories" },
  square: { width: 1080, height: 1080, label: "Quadrado" },
  feed: { width: 1080, height: 1350, label: "Feed vertical" },
};

