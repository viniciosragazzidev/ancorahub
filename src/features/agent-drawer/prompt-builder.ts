import type { TenantContext } from "@/shared/auth/types";

export type RoleShortcut = {
  key: string;
  label: string;
  prompt: string;
};

export const ROLE_SHORTCUTS_MAP: Record<TenantContext["role"], RoleShortcut[]> = {
  broker: [
    {
      key: "Ctrl 1",
      label: "Minha fila de prioridades",
      prompt: "Quais leads na minha fila exigem atenção ou retorno agora?",
    },
    {
      key: "Ctrl 2",
      label: "Status do meu plantão",
      prompt: "Qual é o status do meu plantão ao vivo hoje?",
    },
    {
      key: "Ctrl 3",
      label: "Entrar no plantão",
      prompt: "Por favor, ative meu plantão de atendimento ao vivo agora.",
    },
  ],
  supervisor: [
    {
      key: "Ctrl 1",
      label: "Estouro de SLA na equipe",
      prompt: "Existem estouros de SLA ou leads parados na minha filial hoje?",
    },
    {
      key: "Ctrl 2",
      label: "Corretores em plantão",
      prompt: "Quem são os corretores da minha filial ativos em plantão agora?",
    },
    {
      key: "Ctrl 3",
      label: "Reatribuir lead travado",
      prompt: "Qual o resumo da fila sem atendimento e como posso distribuir esses leads?",
    },
  ],
  manager: [
    {
      key: "Ctrl 1",
      label: "Métricas do funil comercial",
      prompt: "Qual a taxa de conversão global do funil de vendas este mês?",
    },
    {
      key: "Ctrl 2",
      label: "Saúde da operação e IA",
      prompt: "Qual o status de saúde da IA, conexões e alertas de qualificação?",
    },
    {
      key: "Ctrl 3",
      label: "Corretores em plantão",
      prompt: "Listar corretores que estão de plantão e volume de atendimentos.",
    },
  ],
  director: [
    {
      key: "Ctrl 1",
      label: "Saúde geral & Robô de IA",
      prompt: "Qual o status de saúde da operação, conexões do WhatsApp e qualificação por IA?",
    },
    {
      key: "Ctrl 2",
      label: "Funil & Faturamento",
      prompt: "Apresente um resumo executivo com total de leads, qualificados e taxa de conversão em vendas.",
    },
    {
      key: "Ctrl 3",
      label: "Estouro de SLA & Filiais",
      prompt: "Existem filiais com gargalo de atendimento ou estouro de SLA ativo?",
    },
  ],
};

export function buildAgentSystemPrompt(context: TenantContext & { userName?: string; tenantName?: string }) {
  const roleNameMap: Record<TenantContext["role"], string> = {
    broker: "Corretor(a) de Planos de Saúde",
    supervisor: "Supervisor(a) Comercial de Filial",
    manager: "Gestor(a) Comercial / Operacional",
    director: "Diretor(a) Executivo(a)",
  };

  const roleTitle = roleNameMap[context.role] || context.jobTitle;

  return `Você é o Agente Virtual Operacional do CorreTop (AncoraHub), um assistente especializado e integrado ao sistema por ferramentas MCP.

CONTEXTO DO USUÁRIO LOGADO:
- Nome: ${context.userName || "Usuário"}
- Papel Operacional: ${roleTitle} (${context.role})
- ID do Usuário: ${context.userId}
- Tenant ID: ${context.tenantId} ${context.tenantName ? `(${context.tenantName})` : ""}
- Filial Atribuída: ${context.branchId || "Todas as Filiais (Global)"}

INSTRUÇÕES E DIRETRIZES:
1. Seja altamente direto, profissional e prestativo. Suas respostas devem ser claras, estruturadas e formatadas em Markdown elegante.
2. Utilize as ferramentas MCP disponíveis para consultar dados reais da operação em tempo real (leads, plantão, estatísticas, SLA, saúde da IA).
3. Respeite os limites do papel do usuário:
   - Se o usuário for Corretor, foque na fila pessoal e no plantão individual.
   - Se o usuário for Supervisor, apoie na gestão da filial, estouro de SLA e corretores em plantão.
   - Se o usuário for Gestor ou Diretor, forneça relatórios consolidados do funil, métricas de conversão e saúde da infraestrutura.
4. Quando uma ação for realizada com sucesso (ex: alteração de plantão ou reatribuição de lead), confirme com os detalhes específicos de forma concisa.
5. Se uma informação for confidencial ou exigir autorização adicional, informe com cortesia.`;
}
