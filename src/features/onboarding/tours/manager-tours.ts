import type { Tour } from "nextstepjs";

export const managerTours: Tour[] = [
  {
    tour: "manager-welcome",
    steps: [
      {
        icon: "👔",
        title: "Gestão Operacional Âncora CRM",
        content: "Acompanhe a distribuição de novos leads, produtividade da equipe e gargalos de atendimento.",
        showControls: true,
        showSkip: true,
        pointerRadius: 12,
      },
      {
        icon: "📊",
        title: "Monitoramento de SLA",
        content: "Identifique em tempo real atendimentos que estão próximos do limite do tempo de resposta.",
        selector: '[data-onboarding="manager-sla-monitoring"]',
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "🔄",
        title: "Redistribuição de Leads",
        content: "Remaneje leads parados ou não atendidos para corretores disponíveis no plantão.",
        selector: '[data-onboarding="manager-redistribute-lead"]',
        side: "right",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "👥",
        title: "Desempenho da Equipe",
        content: "Acompanhe taxas de conversão, volume de vendas e cumprimento de tarefas por corretor.",
        selector: '[data-onboarding="manager-team-performance"]',
        side: "left",
        showControls: true,
        showSkip: true,
      },
    ],
  },
];
