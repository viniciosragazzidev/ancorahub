/** Dados fictícios da prévia de desenvolvimento (/dev/venda-automatizada-preview). Nenhum dado real. */
import type { EligibleLead } from "./service";
import type { AutoSaleOverview, DealDetail } from "./queries";

const iso = (minutesAgo: number) => new Date(Date.UTC(2026, 10, 12, 15, 0) - minutesAgo * 60_000).toISOString();

export function autoSaleOverviewFixture(): AutoSaleOverview {
  return {
    state: "ready",
    openDealId: "deal-1",
    autopilotAllowed: false,
    globalEnabled: true,
    catalogReady: true,
    watchingSince: null,
    robot: { health: "ok" as const, lastRunAt: null },
    summary: { total: 3, documentsRequested: 1, managerCalls: 2 },
    deals: [
      { id: "deal-1", leadId: "lead-1", leadName: "Joana Ribeiro", stage: "manager_called", status: "waiting_manager", mode: "copilot", channel: "meta", managerCallReason: "Cliente pediu para falar com uma pessoa", pendingApprovals: 2, updatedAt: iso(4), createdAt: iso(52), costUsd: 0.0312 },
      { id: "deal-2", leadId: "lead-2", leadName: "Marcos Tavares", stage: "documents", status: "handed_off", mode: "copilot", channel: "meta", managerCallReason: null, pendingApprovals: 0, updatedAt: iso(60 * 26), createdAt: iso(60 * 28), costUsd: 0.0441 },
      { id: "deal-3", leadId: "lead-3", leadName: "Patrícia Souza", stage: "quoted", status: "cancelled", mode: "simulation", channel: "waha", managerCallReason: null, pendingApprovals: 0, updatedAt: iso(60 * 50), createdAt: iso(60 * 52), costUsd: 0.0105 },
    ],
  };
}

export function eligibleLeadsFixture(): EligibleLead[] {
  return [
    { id: "lead-9", nome: "Carla Mendes", telefone: "21900000001", status: "new", qualificationStatus: "hot", createdAt: new Date(iso(18)), reasons: [] },
    { id: "lead-8", nome: "Rafael Lima", telefone: "21900000002", status: "distributed", qualificationStatus: "hot", createdAt: new Date(iso(40)), reasons: ["has_broker"] },
    { id: "lead-7", nome: "Beatriz Nunes", telefone: "21900000003", status: "new", qualificationStatus: "hot", createdAt: new Date(iso(75)), reasons: ["no_consent"] },
  ];
}

export function dealDetailFixture(): NonNullable<DealDetail> {
  return {
    deal: { id: "deal-1", leadId: "lead-1", stage: "manager_called", status: "waiting_manager", mode: "copilot", channel: "meta", managerCallReason: "Cliente pediu para falar com uma pessoa", createdAt: iso(52), endedReason: null, handedTo: null, facts: { firstName: "Joana", ages: [34, 31], city: "Niterói" } },
    lead: { name: "Joana Ribeiro", phone: "21900000000", status: "quote_sent" },
    conversation: [
      { id: "t1", direction: "out", kind: "opening", body: "Oi, Joana! Aqui é a assistente virtual da Âncora Saúde.", at: iso(50) },
      { id: "t2", direction: "in", kind: "message", body: "oi! isso, eu e meu marido, Niterói", at: iso(48) },
      { id: "t3", direction: "out", kind: "message", body: "Separei 3 opções para 2 pessoas em Niterói:", at: iso(40) },
      { id: "t4", direction: "in", kind: "audio", body: "gostei do segundo, mas queria falar com alguém antes de fechar", at: iso(6) },
    ],
    decisions: [
      { id: "d1", kind: "decision", intent: "answer", objection: null, decision: { action: "quote" }, guard: null, model: "anthropic/claude-haiku-5-5", body: null, at: iso(41) },
      { id: "d2", kind: "manager_called", intent: null, objection: null, decision: { reason: "asked_human" }, guard: null, model: null, body: "Cliente pediu para falar com uma pessoa", at: iso(5) },
    ],
    outbox: [
      { id: "o1", kind: "text", body: "Vou confirmar isso e já te retorno.", status: "draft", holdReason: null, mediaFilename: null, offerId: null, at: iso(5), sentAt: null },
      { id: "o2", kind: "document", body: "Te mandei o PDF com as opções, a rede e o que precisa para contratar.", status: "held", holdReason: "Fora da janela de 24 h da Meta: precisa de template aprovado.", mediaFilename: "cotacao-ancora-saude-1.pdf", offerId: "offer-1", at: iso(39), sentAt: null },
      { id: "o3", kind: "text", body: "Oi, Joana! Aqui é a assistente virtual da Âncora Saúde.", status: "sent", holdReason: null, mediaFilename: null, offerId: null, at: iso(51), sentAt: iso(50) },
    ],
    offers: [
      { id: "offer-1", version: 1, plans: [
        { id: "p1", operator: "Assim", name: "Essencial", totalCents: 71980, state: "ready" },
        { id: "p2", operator: "Klini", name: "200", totalCents: 83960, state: "ready" },
        { id: "p3", operator: "Leve", name: "Top 400", totalCents: 95420, state: "pending" },
      ], recommendedPlanId: "p2", reason: "Eu indicaria o Klini 200 porque não tem coparticipação e cabe no seu orçamento.", relaxed: null, hasPdf: true, linkViews: 2, at: iso(40) },
    ],
    metrics: { minutesToFirstMessage: 2, minutesToFirstQuote: 12, hoursToDocuments: null, documentsRequested: false, proposalSigned: false, customerReplies: 2, offers: 1, pdfsSent: 0, managerCalls: 1, managerCallReasons: ["Cliente pediu para falar com uma pessoa"], costUsd: 0.0312 },
  };
}
