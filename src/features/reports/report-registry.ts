import type { ComponentType } from "react";
import { ChartBar, ClipboardText, CurrencyCircleDollar, SlidersHorizontal, UserList, UsersThree } from "@/components/huge-icons";

export type ReportFormat = "xlsx" | "csv";
export type ReportId = "leads" | "qualification" | "sales" | "broker-performance" | "distribution" | "tasks";

export type ReportDefinition = {
  id: ReportId;
  category: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  formats: readonly ReportFormat[];
  includes: string;
  allowsSupervisor: boolean;
};

export const reportRegistry: readonly ReportDefinition[] = [
  { id: "leads", category: "Comercial", title: "Leads", description: "Captação, origem, qualificação, estágio e responsável.", icon: SlidersHorizontal, formats: ["xlsx", "csv"], includes: "Dados operacionais e origem do lead.", allowsSupervisor: true },
  { id: "qualification", category: "Comercial", title: "Qualificação", description: "Score, etapa, resultado e pendências de qualificação.", icon: ChartBar, formats: ["xlsx", "csv"], includes: "Não inclui respostas livres do cliente.", allowsSupervisor: true },
  { id: "sales", category: "Resultados", title: "Vendas e conversão", description: "Fechamentos, produto, responsável e conversão comercial.", icon: CurrencyCircleDollar, formats: ["xlsx", "csv"], includes: "Supervisor não visualiza valores ou comissões.", allowsSupervisor: true },
  { id: "broker-performance", category: "Equipe", title: "Performance de corretores", description: "Volume, atendimento, qualificação e conversão por corretor.", icon: UsersThree, formats: ["xlsx", "csv"], includes: "Consolidado por responsável no escopo autorizado.", allowsSupervisor: true },
  { id: "distribution", category: "Operação", title: "Distribuição de leads", description: "Atribuições, estratégia, primeiro contato e redistribuições.", icon: UserList, formats: ["xlsx", "csv"], includes: "Somente eventos ligados ao escopo autorizado.", allowsSupervisor: true },
  { id: "tasks", category: "Operação", title: "Tarefas", description: "Volume, prioridade, prazo e conclusão da operação.", icon: ClipboardText, formats: ["xlsx", "csv"], includes: "Sem conteúdo livre de anotações.", allowsSupervisor: true },
] as const;

export function getReportDefinition(id: string): ReportDefinition | undefined {
  return reportRegistry.find((definition) => definition.id === id);
}
