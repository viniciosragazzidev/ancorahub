/**
 * Rótulos das etapas no visual Lite (sentence case). O `LEAD_STATUS_LABELS` segue igual para o resto do app;
 * só a camada Lite de /leads (lista e kanban) usa este mapa.
 */
const LITE_STAGE_LABELS: Record<string, string> = {
  new: "Novo",
  distributed: "Distribuído",
  in_contact: "Em atendimento",
  quote_sent: "Cotação enviada",
  negotiation: "Negociação",
  documentation_pending: "Documentação pendente",
  under_analysis: "Em análise",
  converted: "Convertido",
  lost: "Perdido",
};

export function liteStageLabel(status: string) {
  return LITE_STAGE_LABELS[status] ?? status;
}
