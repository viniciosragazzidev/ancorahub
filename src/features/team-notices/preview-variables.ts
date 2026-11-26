/** Example values for the preview of each notice's built-in versions (same order as the outbox variables). */
export const PREVIEW_VARIABLES: Record<string, string[]> = {
  brokerLeadNotification: ["Corretor", "Ana", "Maria Souza", "Plano de saúde", "exemplo"],
  newLeadAssignment: ["Corretor", "Ana", "Maria Souza", "Plano de saúde", "exemplo"],
  leadAssignmentConfirmed: ["Ana", "Maria Souza", "(21) 99999-0000", "Plano de saúde", "Individual", "2", "Rio de Janeiro", "exemplo"],
  leadAssignmentUnavailable: ["Ana"],
  leadAssignmentExpired: ["Ana"],
  leadFeedbackReminder: ["Ana", "Maria Souza"],
  leadClosingStage: ["Ana", "Maria Souza", "exemplo"],
  leadClientReturned: ["Ana", "Maria Souza", "03/11", "exemplo"],
  dailyLeadsReport: ["05/11", "*Fila PME Rio*: 12 leads · 🔥 4 quentes · 🌤️ 5 mornos · ❄️ 3 frios\n*Fila Familiar*: 8 leads · 🔥 2 quentes · 🌤️ 3 mornos · ❄️ 3 frios\n\n*Total*: 20 leads · 🔥 6 · 🌤️ 8 · ❄️ 6"],
  leadClosingDirectorAlert: ["Maria Souza", "(21) 99999-0000", "Pessoa física · 2 vidas · Amil 400 · R$ 890,00/mês", "Ana Lima", "Documentação", "Cliente quer começar no dia 10, já mandou RG e comprovante. Falta a declaração de saúde do dependente.", "exemplo"],
  leadConvertedDirectorAlert: ["Maria Souza", "(21) 99999-0000", "Pessoa física · 2 vidas · Amil 400 · R$ 890,00/mês", "Ana Lima", "8 dias no fechamento (entrou em 03/11)", "adesão paga e contrato assinado.", "-", "Já fiz o pagamento via pix", "confirmação da operadora.", "exemplo"],
  taskReminder: ["Ana", "Ligar para Maria Souza", "Hoje, 15:00"],
  brokerAccountActivated: ["Ana", "Âncora"],
  dutyPresenceConfirmation: ["Ana", "08:00", "exemplo"],
};
