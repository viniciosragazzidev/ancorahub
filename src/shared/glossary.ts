export type DomainGlossaryEntry = {
  term: string;
  title: string;
  description: string;
  category: "vendas" | "qualificacao" | "operacao" | "gestao" | "sistema";
};

export const DOMAIN_GLOSSARY: Record<string, DomainGlossaryEntry> = {
  sla: {
    term: "sla",
    title: "Service Level Agreement (SLA)",
    description: "Tempo máximo de resposta esperado para iniciar o atendimento de um lead. Quando o SLA estoura, o lead pode ser redistribuído automaticamente.",
    category: "vendas",
  },
  handoff: {
    term: "handoff",
    title: "Handoff para Corretor",
    description: "Momento em que o robô de IA conclui a qualificação inicial e transfere o controle da conversa diretamente para a fila de um corretor humano.",
    category: "qualificacao",
  },
  score: {
    term: "score",
    title: "Score de Qualificação",
    description: "Pontuação de 0 a 100 calculada com base na intenção de compra, perfil de urgência, renda e respostas coletadas durante o atendimento da IA.",
    category: "qualificacao",
  },
  lead_quente: {
    term: "lead_quente",
    title: "Lead Quente (Score >= 75)",
    description: "Oportunidade de alta prioridade com perfil qualificado e necessidade imediata de contratação de plano de saúde.",
    category: "vendas",
  },
  lead_morno: {
    term: "lead_morno",
    title: "Lead Morno (Score 40-74)",
    description: "Cliente com interesse real, mas que necessita de mais esclarecimentos de preço, carências ou cotação detalhada.",
    category: "vendas",
  },
  lead_frio: {
    term: "lead_frio",
    title: "Lead Frio (Score < 40)",
    description: "Contato com baixa intenção imediata ou apenas pesquisando informações gerais. Encaminhado para régua de nutrição.",
    category: "vendas",
  },
  followup: {
    term: "followup",
    title: "Regra de Follow-up",
    description: "Automação acionada após determinado tempo de inatividade do cliente para reengajá-lo e evitar perda de oportunidade.",
    category: "qualificacao",
  },
  plantao: {
    term: "plantao",
    title: "Plantão ao Vivo",
    description: "Escala em tempo real dos corretores disponíveis no momento para receber leads rodados imediatamente por round-robin ou fila.",
    category: "operacao",
  },
  opt_out: {
    term: "opt_out",
    title: "Opt-out (Descadastro)",
    description: "Solicitação expressa do cliente para interromper mensagens automáticas no WhatsApp ou telefone.",
    category: "sistema",
  },
  comissao: {
    term: "comissao",
    title: "Regra de Comissionamento",
    description: "Percentual e bonificação devidos ao corretor e supervisor com base no produto vendido e vidas cadastradas.",
    category: "gestao",
  },
  mcp: {
    term: "mcp",
    title: "Model Context Protocol (MCP)",
    description: "Protocolo de governança de ferramentas que limita as ações executadas pela IA no CRM (ex: alteração de status, envio de cotações).",
    category: "qualificacao",
  },
};
