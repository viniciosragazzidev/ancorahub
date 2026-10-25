/**
 * Modelo do Assistente (/assistente): comandos de atalho, contextos de lead de exemplo e a resposta simulada das
 * ferramentas MCP. Compartilhado pela tela atual e pela versão Lite, para as duas responderem igual.
 */

export interface McpToolCall {
  id: string;
  toolName: string;
  displayName: string;
  args: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: Record<string, unknown>;
  executionTimeMs?: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
  mcpToolCall?: McpToolCall;
}

export type PresetCommandData = {
  command: string;
  label: string;
  description: string;
  prompt: string;
  mcpTool: string;
};

// -----------------------------------------------------------------------------
// PRESET SLASH COMMANDS
// -----------------------------------------------------------------------------
export const PRESET_COMMAND_DATA: PresetCommandData[] = [
  {
    command: "/cotacao-express",
    label: "Cotação Express",
    description: "Calcula estudo comparativo de planos PME / Adesão",
    prompt: "Calcule uma cotação comparativa de planos PME para 4 pessoas (42, 38, 12 e 8 anos) entre Bradesco, Amil e SulAmérica.",
    mcpTool: "mcp:quote_calculator",
  },
  {
    command: "/lead-resumo",
    label: "Resumo do Lead",
    description: "Analisa a ficha 360º, qualificação e linha do tempo",
    prompt: "Gere o resumo completo do lead selecionado, incluindo qualificação por IA, score comercial e recomendação de próxima ação.",
    mcpTool: "mcp:leads_query",
  },
  {
    command: "/distribuir-plantao",
    label: "Auditoria de SLA & Plantão",
    description: "Verifica leads parados e aciona redistribuição",
    prompt: "Verifique os leads estagnados no plantão há mais de 15 minutos sem primeiro contato e execute a redistribuição automática.",
    mcpTool: "mcp:sla_checker",
  },
  {
    command: "/metricas-filial",
    label: "Métricas de Filiais",
    description: "Consulta taxa de conversão e SLA por unidade",
    prompt: "Mostre o desempenho comercial e tempo médio de resposta das filiais da Âncora Saúde neste mês.",
    mcpTool: "mcp:get_executive_analytics",
  },
  {
    command: "/cadencia-waha",
    label: "Agendar Cadência WAHA",
    description: "Ativa régua comercial em VPS própria no WhatsApp",
    prompt: "Programe a cadência automatizada de acompanhamento no WhatsApp via VPS WAHA para o lead de cotação enviada.",
    mcpTool: "mcp:waha_cadence",
  },
  {
    command: "/auditoria-lgpd",
    label: "Auditoria de Acessos",
    description: "Consulta registros imutáveis de documentos e RLS",
    prompt: "Exiba os últimos registros de auditoria de visualização de documentos de beneficiários para verificação de LGPD.",
    mcpTool: "mcp:audit_logger",
  },
];

// -----------------------------------------------------------------------------
// MOCK LEADS FOR CONTEXT SELECTOR
// -----------------------------------------------------------------------------
export const MOCK_LEAD_CONTEXTS = [
  { id: "none", name: "Sem contexto de lead específico", details: "Consulta geral da operação" },
  { id: "lead_carlos_01", name: "Carlos Eduardo Silva", details: "Bradesco PME • 4 Vidas • R$ 3.840/mês" },
  { id: "lead_ana_02", name: "Ana Paula Ribeiro", details: "SulAmérica Adesão • 2 Vidas • R$ 1.950/mês" },
  { id: "lead_empresa_03", name: "TechMed Soluções PME", details: "Amil Saúde PME • 18 Vidas • R$ 14.200/mês" },
];

/** O comando reconhecido na mensagem (pelo /atalho ou pelo nome), como a tela atual faz. */
export function matchPresetCommand(text: string): PresetCommandData | undefined {
  return PRESET_COMMAND_DATA.find(
    (c) => text.toLowerCase().includes(c.command) || text.toLowerCase().includes(c.label.toLowerCase())
  );
}

/** Resposta simulada de um comando (exceto /cotacao-express, que consulta o servidor). */
export function mockAssistantReply(command: string | undefined, textToSend: string, selectedLeadId: string): { content: string; mcpToolCall: McpToolCall } {
  if (command) {
    let mcpToolCall: McpToolCall;
    let responseContent = "";

    if (command === "/lead-resumo") {
      mcpToolCall = {
        id: `mcp_${Date.now()}`,
        toolName: "mcp:leads_query",
        displayName: "mcp:summarize_lead_profile",
        args: {
          lead_id: selectedLeadId,
          include_timeline: true,
          include_family: true,
          include_conversations: true,
        },
        status: "completed",
        executionTimeMs: 98,
        result: {
          name: "Carlos Eduardo Silva",
          qualification_score: "94/100 (Lead Quente)",
          stage: "Cotação Enviada",
          operator_preference: "Bradesco ou SulAmérica PME",
          family_members: "4 vidas (Titular 42y, Cônjuge 38y, Filhos 12y e 8y)",
          sla_status: "Dentro do prazo (Atendido há 12 min)",
          next_recommended_action: "Agendar ligação de fechamento até quinta-feira 14h",
        },
      };
      responseContent = `Aqui está a ficha sintetizada 360º do lead **Carlos Eduardo Silva**. A IA pré-qualificou a família com alta intenção de fechamento no segmento PME.`;
    } else if (command === "/distribuir-plantao") {
      mcpToolCall = {
        id: `mcp_${Date.now()}`,
        toolName: "mcp:sla_checker",
        displayName: "mcp:audit_and_reassign_duty",
        args: {
          max_unattended_minutes: 15,
          branch_filter: "Filial Jardins",
          auto_reassign: true,
        },
        status: "completed",
        executionTimeMs: 215,
        result: {
          audited_leads: 18,
          stale_leads_found: 2,
          reassigned_brokers: [
            { lead: "Lead #8942 (Marcos)", from: "Corretor A (Ausente)", to: "Corretor B (Em Plantão)" },
            { lead: "Lead #8945 (Juliana)", from: "Fila Geral", to: "Corretora C (Em Plantão)" },
          ],
          status: "Fila de atendimento 100% normalizada",
        },
      };
      responseContent = `Concluí a auditoria de SLA no plantão da **Filial Jardins**. 2 leads que aguardavam há mais de 15 minutos foram redistribuídos automaticamente via MCP para corretores ativos.`;
    } else if (command === "/metricas-filial") {
      mcpToolCall = {
        id: `mcp_${Date.now()}`,
        toolName: "mcp:get_executive_analytics",
        displayName: "mcp:branch_performance_analytics",
        args: {
          period: "2026-08",
          metrics: ["conversion_rate", "response_time_seconds", "top_operator"],
        },
        status: "completed",
        executionTimeMs: 180,
        result: {
          matriz_sp: { conversion: "34.2%", avg_response: "1m 45s", top: "Bradesco" },
          filial_jardins: { conversion: "38.6%", avg_response: "58s", top: "SulAmérica" },
          filial_campinas: { conversion: "29.8%", avg_response: "2m 10s", top: "Amil" },
        },
      };
      responseContent = `Consultei as métricas executivas consolidadas de vendas e tempo de resposta das filiais da **Âncora Saúde** no mês atual.`;
    } else if (command === "/cadencia-waha") {
      mcpToolCall = {
        id: `mcp_${Date.now()}`,
        toolName: "mcp:waha_cadence",
        displayName: "mcp:schedule_whatsapp_cadence",
        args: {
          lead_id: selectedLeadId,
          cadence_template: "pos_cotacao_pme_v1",
          vps_engine: "waha_node_01 (R$ 77,99/mês)",
          business_hours_only: true,
        },
        status: "completed",
        executionTimeMs: 165,
        result: {
          scheduled_steps: [
            { step: 1, delay: "+24h", text: "Envio de resumo com opção de agendamento" },
            { step: 2, delay: "+48h", text: "Material explicativo sobre rede credenciada" },
            { step: 3, delay: "+72h", text: "Alerta de vigência da tabela promocional" },
          ],
          auto_stop_condition: "Qualquer resposta do cliente pausa a cadência imediatamente",
        },
      };
      responseContent = `Programada a cadência comercial de 3 etapas no WhatsApp via motor WAHA em nossa VPS dedicada. Se o cliente responder, a automação para e avisa o corretor.`;
    } else {
      mcpToolCall = {
        id: `mcp_${Date.now()}`,
        toolName: "mcp:audit_logger",
        displayName: "mcp:query_security_audit_logs",
        args: {
          resource: "beneficiary_documents",
          limit: 5,
          tenant_isolation: "enforced",
        },
        status: "completed",
        executionTimeMs: 85,
        result: {
          logs_count: 5,
          all_compliant: true,
          last_event: "Documento RG/CPF acessado por gestor autorizado com log de IP",
        },
      };
      responseContent = `Consultei o registro imutável de auditoria de acessos aos documentos dos beneficiários. Todas as operações estão em conformidade com as regras de segurança e LGPD.`;
    }

    return { content: responseContent, mcpToolCall };
  }
  // Resposta inteligente genérica com simulação de MCP query
  const genericMcpToolCall: McpToolCall = {
    id: `mcp_${Date.now()}`,
    toolName: "mcp:general_query",
    displayName: "mcp:ancora_crm_engine",
    args: { prompt: textToSend, lead_context: selectedLeadId },
    status: "completed",
    executionTimeMs: 110,
    result: { status: "processed", context: "Âncora CRM Multi-tenant Safe" },
  };
  return {
    content: `Entendido! Processei sua solicitação via **MCP Engine** utilizando os dados em tempo real da Âncora Saúde. Como posso ajudá-lo a avançar com o atendimento do lead?`,
    mcpToolCall: genericMcpToolCall,
  };
}
