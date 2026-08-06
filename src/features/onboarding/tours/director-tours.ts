import type { Tour } from "nextstepjs";

export const directorTours: Tour[] = [
  {
    tour: "director-welcome",
    steps: [
      {
        icon: "🏛️",
        title: "Visão Executiva & Estratégica",
        content: "Acompanhe faturamento global, projeções de vendas, comparativo de filiais e auditorias.",
        showControls: true,
        showSkip: true,
        pointerRadius: 12,
      },
      {
        icon: "📈",
        title: "Indicadores Gerais de Conversão",
        content: "Visualize o funil consolidados de todas as origens (Meta Lead Ads, Google e orgânico).",
        selector: '[data-onboarding="director-overview"]',
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "🏢",
        title: "Comparativo entre Unidades",
        content: "Analise a performance individual de cada filial e região atendida.",
        selector: '[data-onboarding="director-branches"]',
        side: "right",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "💰",
        title: "Gestão de Comissões",
        content: "Acompanhe valores liquidados, repasses a corretores e relatórios financeiros.",
        selector: '[data-onboarding="director-commissions"]',
        side: "left",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "🛡️",
        title: "Auditoria & Conformidade",
        content: "Consulte o histórico de acessos, alterações sensíveis e segurança LGPD.",
        selector: '[data-onboarding="director-audit"]',
        side: "top",
        showControls: true,
        showSkip: true,
      },
    ],
  },
];
