/** Resumo para o gestor quando o agente o chama (§11). Puro. */
import { formatCents, MANAGER_CALL_REASONS, type DealFacts, type ManagerCallReason, type OfferSnapshot } from "./contracts";
import { OBJECTIONS } from "./playbook";

const OBJECTION_LABEL: Record<string, string> = {
  expensive: "achou caro", pays_today: "compara com o que paga hoje", hospital: "perguntou de hospital", coparticipation: "dúvida sobre coparticipação",
  waiting_period: "dúvida sobre carência", spouse: "vai falar com a família", ad_price: "viu outro valor no anúncio", age: "dúvida de idade",
  scam: "desconfiou de golpe", think: "vai pensar", other: "outra objeção",
};

const NEXT_STEP: Partial<Record<ManagerCallReason, string>> = {
  documents_received: "Conferir os documentos e seguir para a assinatura.",
  accepted: "Seguir para a assinatura com quem você escolher.",
  asked_human: "Assumir a conversa ou entregar a um corretor.",
  health_question: "Responder com cuidado (sem diagnóstico) ou entregar a um corretor.",
  scam_suspicion: "Ligar ou convidar para ir à unidade.",
  irritation: "Assumir a conversa com calma.",
  legal_threat: "Assumir a conversa e registrar o ocorrido.",
};

export function managerSummary(input: { customerName: string; facts: DealFacts; offers: readonly OfferSnapshot[]; objections: readonly string[]; reason: ManagerCallReason }) {
  const lines: string[] = [];
  const who = [input.facts.ages?.length ? `${input.facts.ages.length} ${input.facts.ages.length === 1 ? "vida" : "vidas"} (${input.facts.ages.join(", ")} anos)` : null, input.facts.city].filter(Boolean).join(", ");
  lines.push(`Cliente: ${input.customerName}${who ? `, ${who}` : ""}.`);
  if (input.facts.budgetCents) lines.push(`Orçamento: ${formatCents(input.facts.budgetCents)}${input.facts.budgetBasis === "per_person" ? " por pessoa" : ""}.`);
  const current = input.offers.at(-1);
  if (current) {
    lines.push(`Ofertas enviadas: ${input.offers.length} (PDF em cada uma). Vigente: ${current.plans.map((plan) => `${plan.operator} ${plan.name} ${formatCents(plan.totalCents)}`).join("; ")}.`);
  } else lines.push("Ainda sem cotação enviada.");
  const objections = [...new Set(input.objections)].filter((key) => key in OBJECTIONS || key === "other").map((key) => OBJECTION_LABEL[key] ?? key);
  if (objections.length) lines.push(`Objeções: ${objections.join(", ")}.`);
  lines.push(`Motivo da chamada: ${MANAGER_CALL_REASONS[input.reason]}.`);
  lines.push(`Próximo passo: ${NEXT_STEP[input.reason] ?? "Devolver ao agente, assumir ou entregar a um corretor."}`);
  return lines.join("\n");
}
