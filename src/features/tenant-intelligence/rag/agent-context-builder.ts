import "server-only";

import type { TenantContext } from "@/shared/auth/types";
import { getCompanyProfile, getUnitProfiles } from "../service";
import { executeHybridKnowledgeSearch, type HybridSearchResult } from "./hybrid-retrieval";
import { getMcpToolsForRole, type McpToolDefinition } from "@/features/agent-drawer/mcp-tools";

export type AgentContextPayload = {
  structuredCrmContext: {
    company: any;
    units: any[];
  };
  retrievedKnowledge: HybridSearchResult[];
  policies: string[];
  mcpTools: McpToolDefinition[];
  formattedSystemPromptBlock: string;
};

/**
 * AgentContextBuilder Central:
 * Unified context builder for all AI Agents in the system (Agent Drawer, Qualification AI, Sales AI, Workflow Nodes).
 * Prevents any agent from implementing manual RAG or un-isolated database queries.
 */
export async function buildAgentContext(params: {
  tenantContext: TenantContext;
  queryText?: string;
  minAuthorityLevel?: number;
}): Promise<AgentContextPayload> {
  const { tenantId, role, branchId } = params.tenantContext;

  // 1. Fetch Structured CRM Context
  const company = await getCompanyProfile(tenantId);
  const units = await getUnitProfiles(tenantId);

  // 2. Perform Hybrid RAG Search if query is provided
  let retrievedKnowledge: HybridSearchResult[] = [];
  if (params.queryText && params.queryText.trim().length > 0) {
    retrievedKnowledge = await executeHybridKnowledgeSearch({
      tenantId,
      query: params.queryText,
      minAuthorityLevel: params.minAuthorityLevel || 1,
      limit: 5,
    });
  }

  // 3. Filter Allowed MCP Tools by Role
  const mcpTools = getMcpToolsForRole(role);

  // 4. Strict Operational Policies
  const policies = [
    "A IA nunca deve prometer valores de mensalidade não verificados.",
    "A IA deve respeitar a autoridade das políticas oficiais da corretora.",
    "Toda alteração de estado no CRM exige confirmação ou aprovação via ferramenta MCP.",
  ];

  // 5. Format Unified Prompt Block
  const knowledgeBlock = retrievedKnowledge.length > 0
    ? retrievedKnowledge
        .map((k) => `[Fonte: ${k.title} | Categoria: ${k.category} | Autoridade: ${k.authorityLevel}★]\n${k.text}`)
        .join("\n\n")
    : "Nenhum documento adicional recuperado.";

  const formattedSystemPromptBlock = `
=== DADOS ESTRUTURADOS DA CORRETORA (FONTE DE VERDADE CRM) ===
Nome Fantasia: ${company.tradeName || company.companyName || "Corretora Âncora"}
CNPJ: ${company.cnpj || "Não informado"}
Segmento: ${company.segment || "Planos de Saúde"}
Horário de Atendimento: ${(company.serviceConfig as any)?.businessHours || "08:00 às 18:00"}
Unidades/Filiais: ${units.map((u) => u.unitName).join(", ") || "Matriz"}

=== CONHECIMENTO RETORNADO DA BASE (RAG) ===
${knowledgeBlock}

=== POLÍTICAS & DIRETRIZES DA CORRETORA ===
${policies.map((p, idx) => `${idx + 1}. ${p}`).join("\n")}
`;

  return {
    structuredCrmContext: {
      company,
      units,
    },
    retrievedKnowledge,
    policies,
    mcpTools,
    formattedSystemPromptBlock,
  };
}
