/** Início da área Atendimento IA na moldura real (?tela=ia), com dados de exemplo. Só desenvolvimento, montado no servidor. */
import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { buildAiHubSummary, type AiHubSection } from "@/features/ai-qualification/ai-area-hub";
import { AiHubView } from "@/app/(dashboard)/ia/_components/ai-hub-view";

const SECTIONS: AiHubSection[] = [
  { id: "acompanhar", title: "Acompanhar", description: "O que a IA está fazendo agora e o que precisa de você.", rows: [
    { id: "leads-qualificacao", label: "Leads na qualificação", description: "Leads que a IA está qualificando agora", href: "/qualificacao/leads", count: "32 agora" },
    { id: "alertas", label: "Alertas", description: "O que a IA não conseguiu resolver sozinha", href: "/ia/alertas", count: "3 ativos" },
    { id: "execucoes", label: "Execuções", description: "Cada resposta da IA e por que ela agiu assim", href: "/ia/execucoes", count: null },
  ] },
  { id: "configurar", title: "Configurar", description: "Como a IA conversa e o que ela pode fazer sem perguntar.", rows: [
    { id: "comportamento", label: "Prompt e comportamento", description: "O prompt e o jeito de a IA conversar", href: "/qualificacao", count: null },
    { id: "permissoes", label: "Permissões", description: "O que a IA pode fazer sem perguntar", href: "/qualificacao?tab=agent_triggers", count: null },
    { id: "follow-up", label: "Follow-up", description: "Quando a IA volta a chamar quem parou de responder", href: "/qualificacao?tab=followup_rules", count: null },
  ] },
  { id: "ensinar", title: "Ensinar", description: "Respostas, mensagens e as perguntas da qualificação.", rows: [
    { id: "situacoes", label: "Situações", description: "Situações de atendimento e o que fazer em cada uma", href: "/atendimento/situacoes", count: null },
    { id: "mensagens", label: "Mensagens", description: "Mensagens prontas que a IA e a equipe usam", href: "/atendimento/mensagens", count: null },
    { id: "perguntas", label: "Fluxo de atendimento", description: "As perguntas da qualificação e a ordem delas", href: "/atendimento/fluxo", count: null },
  ] },
];

export function IaShellScreen() {
  const summary = buildAiHubSummary({ enabled: true, activeQualifications: 32, activeAlerts: 3, failures24h: 0 });
  return (
    <>
      <DashboardHeader breadcrumb="Atendimento IA" title="Atendimento IA" />
      <main className={page.stack}>
        <AiHubView summary={summary} sections={SECTIONS} />
      </main>
    </>
  );
}
