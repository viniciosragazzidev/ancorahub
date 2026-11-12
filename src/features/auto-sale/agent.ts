import "server-only";

import { runGateway } from "@/features/ai-gateway/gateway";

import { buildSystemPrompt } from "./playbook";
import { agentTurnSchema, buildTurnContext, normalizeDecision, type AgentTurnDecision } from "./turn-engine";

export type AgentModel = (input: { system: string; context: string }) => Promise<{ decision: AgentTurnDecision | null; model: string | null }>;

/**
 * O modelo da venda (§6, D13): `chat-smart` pelo gateway, só provedores pagos que não treinam
 * (`sensitive`), saída validada por zod. Falhou: null, e o turno chama o gestor (nunca improvisa).
 */
export function gatewayAgentModel(input: { tenantId: string; userId: string; leadId: string }): AgentModel {
  return async ({ system, context }) => {
    // "interpreter" (o mesmo da qualificação): o Claude direto recebe o formato da resposta (json_schema);
    // os modelos de reserva seguem o formato descrito no prompt. 12/11: com "chat-smart" o formato não ia ao
    // modelo, a resposta era recusada e a assistente chamava o gestor ("duas mensagens sem entender").
    const result = await runGateway({
      profile: "interpreter",
      purpose: "auto_sale_turn",
      tenantId: input.tenantId,
      userId: input.userId,
      leadId: input.leadId,
      messages: [{ role: "system", content: system }, { role: "user", content: context }],
      schema: agentTurnSchema,
      maxTokens: 1_200,
      temperature: 0.3,
      timeoutMs: 25_000,
      totalTimeoutMs: 50_000,
      retryAnthropicHaikuOnTransient: true,
      sensitive: true,
    });
    if (!result.ok) console.warn("[auto-sale] model_failed", { leadId: input.leadId, reason: result.reason, attempts: result.attempts, error: result.lastError?.slice(0, 200) });
    return result.ok ? { decision: normalizeDecision(result.value), model: `${result.model.provider}/${result.model.model}` } : { decision: null, model: null };
  };
}

export async function decideTurn(model: AgentModel, input: Parameters<typeof buildTurnContext>[0] & { brokerageName: string; mode: string }) {
  const system = buildSystemPrompt({ brokerageName: input.brokerageName, hasActivePromotion: input.promotions.length > 0, mode: input.mode });
  return model({ system, context: buildTurnContext(input) });
}
