export const PLAN_CODES = Object.freeze({
  AGENDA: "studiosbook_agenda",
  RECEIVABLES: "studiosbook_receivables",
});

export const PLAN_DETAILS = Object.freeze({
  [PLAN_CODES.AGENDA]: Object.freeze({
    code: PLAN_CODES.AGENDA,
    name: "StudiosBook Agenda",
    price: "R$ 26,90/mês",
    amount: 26.9,
    description: "Gestão essencial para organizar o studio.",
    features: [
      "Agenda privada e clientes",
      "Ficha técnica e fotos",
      "Catálogo, retornos e relatórios",
      "Backup e exportação",
    ],
  }),
  [PLAN_CODES.RECEIVABLES]: Object.freeze({
    code: PLAN_CODES.RECEIVABLES,
    name: "StudiosBook Recebimentos",
    price: "R$ 59,90/mês",
    amount: 59.9,
    description: "A operação completa, do agendamento à confirmação do pagamento.",
    recommended: true,
    features: [
      "Tudo do plano Agenda",
      "Página de agendamento on-line",
      "Pix e cartão para suas clientes",
      "Pagamento integral ou sinal",
      "Confirmação e cancelamento automáticos",
      "Relatório de reservas e recebimentos",
    ],
    transactionFee: "0,79% por pagamento aprovado",
    transactionCap: "comissão limitada a R$ 59,90 por mês",
  }),
});

export function planDetails(planCode) {
  return PLAN_DETAILS[planCode] || PLAN_DETAILS[PLAN_CODES.AGENDA];
}
