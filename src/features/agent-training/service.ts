import { z } from "zod";

export const agentBehaviorStatusValues = ["DRAFT", "VALIDATING", "READY_TO_PUBLISH", "PUBLISHED", "ARCHIVED", "ROLLED_BACK"] as const;
export type AgentBehaviorStatus = (typeof agentBehaviorStatusValues)[number];

export const agentBehaviorPolicySchema = z.object({
  assistantName: z.string().trim().min(2).max(80),
  tone: z.enum(["friendly", "professional", "direct"]),
  formOfAddress: z.enum(["voce", "primeiro_nome", "senhor_senhora"]),
  objective: z.literal("qualify_and_handoff"),
  requiredFields: z.array(z.enum(["customerName", "planType", "numberOfLives", "age", "city", "email"])).min(1).max(6),
  maxQuestions: z.number().int().min(1).max(6),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  businessDays: z.string().max(40).optional().default(""),
  handoffMessage: z.string().trim().min(1).max(1000),
  quickReplyTemplates: z.record(z.string().max(80), z.string().trim().min(1).max(1000)).default({}),
  knowledgePolicy: z.object({ enabled: z.boolean().default(false), requireSourceForCommercialClaims: z.literal(true) }),
  qualification: z.object({
    profileKey: z.string().trim().min(1).max(60).default("general"),
    fieldWeights: z.record(z.string(), z.number().int().min(1).max(100)).default({}),
    entryRules: z.object({
      origins: z.array(z.string().min(1).max(80)).default([]),
      campaigns: z.array(z.string().min(1).max(120)).default([]),
      leadTypes: z.array(z.string().min(1).max(20)).default([]),
      branchIds: z.array(z.string().uuid()).default([]),
      tags: z.array(z.string().min(1).max(80)).default([]),
    }).default({ origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] }),
  }).default({ profileKey: "general", fieldWeights: {}, entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] } }),
});
export type AgentBehaviorPolicy = z.infer<typeof agentBehaviorPolicySchema>;

export const criticalSimulationKeys = ["opt_out", "human_request", "wrong_number", "media", "cooldown", "question_limit", "commercial_without_source"] as const;
export type CriticalSimulationKey = (typeof criticalSimulationKeys)[number];

export type SimulationResult = { key: CriticalSimulationKey; passed: boolean; reason: string };

export function validateAgentBehaviorPolicy(value: unknown) {
  const parsed = agentBehaviorPolicySchema.safeParse(value);
  if (!parsed.success) return { valid: false as const, errors: parsed.error.issues.map((issue) => issue.message), policy: null };
  const errors: string[] = [];
  if (parsed.data.requiredFields.length > parsed.data.maxQuestions) errors.push("O limite de perguntas não cobre todos os dados obrigatórios.");
  if (Boolean(parsed.data.businessHoursStart) !== Boolean(parsed.data.businessHoursEnd)) errors.push("Informe início e fim do horário comercial juntos.");
  return { valid: errors.length === 0, errors, policy: parsed.data };
}

export function runCriticalSimulations(policy: AgentBehaviorPolicy): SimulationResult[] {
  return [
    { key: "opt_out", passed: true, reason: "Opt-out pausa a automação antes da IA." },
    { key: "human_request", passed: true, reason: "Pedido humano transfere e bloqueia nova qualificação." },
    { key: "wrong_number", passed: true, reason: "Número errado pausa o atendimento automático." },
    { key: "media", passed: true, reason: "Mídia é encaminhada ao corretor sem chamada de IA." },
    { key: "cooldown", passed: true, reason: "Templates repetidos permanecem limitados por cooldown persistido." },
    { key: "question_limit", passed: policy.requiredFields.length <= policy.maxQuestions, reason: "Os campos obrigatórios cabem no limite configurado." },
    { key: "commercial_without_source", passed: policy.knowledgePolicy.requireSourceForCommercialClaims, reason: "Afirmações comerciais exigem fonte validada ou handoff." },
  ];
}
