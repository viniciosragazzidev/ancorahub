import type { LiteGoalView } from "@/features/goals/lite-goals-queries";
import type { LiteGoalType } from "@/features/goals/lite-goals-policy";

/** Rótulos e formatação das metas do Lite (puro). */

export const TYPE_LABEL: Record<LiteGoalType, string> = {
  quotes_count: "Cotações criadas",
  sales_count: "Vendas",
  leads_contacted: "Leads contatados",
  sla_rate: "SLA no prazo (%)",
  response_minutes: "Tempo para aceitar (min)",
};

const TYPE_UNIT: Record<LiteGoalType, string> = {
  quotes_count: "cotações",
  sales_count: "vendas",
  leads_contacted: "leads",
  sla_rate: "% no prazo",
  response_minutes: "min",
};

export function periodFormat(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const text = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, 1)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "6 de 8 cotações · 75%". Tempo de resposta: menor é melhor, então a frase fala em "até". */
export function goalLine(goal: LiteGoalView): string {
  const type = goal.targetType as LiteGoalType;
  const unit = TYPE_UNIT[type] ?? "";
  if (type === "response_minutes") return `Agora ${goal.current} min · meta até ${goal.targetValue} min · ${goal.percentage}%`;
  return `${goal.current} de ${goal.targetValue} ${unit} · ${goal.percentage}%`;
}
