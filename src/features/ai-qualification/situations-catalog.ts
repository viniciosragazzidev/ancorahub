import { z } from "zod";
import {
  situationalPlaybooksDomainRoot,
  type SituationalPlaybookItem,
} from "@/shared/domain-root/situational-playbooks-root";

export const SituationalPlaybookItemSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    "first_contact",
    "inquiry",
    "objection",
    "followup",
    "handoff",
    "timing",
    "custom",
  ]),
  description: z.string().min(1),
  triggerCondition: z.string().min(1),
  exampleCustomerInput: z.string().min(1),
  recommendedResponse: z.string().min(1),
  enabled: z.boolean().default(true),
  toneOverride: z.enum(["friendly", "professional", "consultative", "direct"]).optional(),
  suggestedLeadStatus: z.string().optional(),
  keywords: z.array(z.string()).default([]),
});

export interface InterpolationVariables {
  cliente_nome?: string | null;
  assistente_nome?: string | null;
  corretora_nome?: string | null;
  operadoras_principais?: string | null;
  cidade_cliente?: string | null;
  vidas_cliente?: string | number | null;
  tipo_plano?: string | null;
  horario_atendimento?: string | null;
  humanHandoffTag?: string | null;
}

/**
 * Retorna os playbooks padrão de fábrica definidos no Domain Root.
 */
export function getDefaultPlaybooks(): SituationalPlaybookItem[] {
  return [...situationalPlaybooksDomainRoot.defaults.playbooks];
}

/**
 * Substitui variáveis dinâmicas `{cliente_nome}`, `{assistente_nome}`, `{corretora_nome}`, etc.
 * no modelo de resposta.
 */
export function interpolatePlaybookVariables(
  template: string,
  variables: InterpolationVariables,
): string {
  let result = template;

  const defaults: Record<string, string> = {
    cliente_nome: variables.cliente_nome?.trim() || "cliente",
    assistente_nome: variables.assistente_nome?.trim() || "Ana",
    corretora_nome: variables.corretora_nome?.trim() || "Âncora Corretora",
    operadoras_principais: variables.operadoras_principais?.trim() || "Amil, SulAmérica, Bradesco e Porto Seguro",
    cidade_cliente: variables.cidade_cliente?.trim() || "sua cidade",
    vidas_cliente: variables.vidas_cliente ? String(variables.vidas_cliente) : "1",
    tipo_plano: variables.tipo_plano?.trim() || "Individual/Familiar",
    horario_atendimento: variables.horario_atendimento?.trim() || "08h às 18h",
    humanHandoffTag: variables.humanHandoffTag || "[SOLICITOU_HUMANO]",
  };

  // Replace standard and custom tags
  for (const [key, value] of Object.entries(defaults)) {
    const regex = new RegExp(`\\{${key}\\}`, "gi");
    result = result.replace(regex, value);
  }

  // Also support simple alias {nome} for {cliente_nome}
  result = result.replace(/\{nome\}/gi, defaults.cliente_nome);
  result = result.replace(/\{assistente\}/gi, defaults.assistente_nome);
  result = result.replace(/\{corretora\}/gi, defaults.corretora_nome);
  result = result.replace(/\{operadoras\}/gi, defaults.operadoras_principais);

  return result;
}
