import "server-only";

import { generateLateralAnswer, isCustomerQuestion } from "@/features/ai-agent/lateral-answer";
import type { ConversationMemory } from "@/features/ai-agent/memory";
import { loadQuickReplyTemplates, resolveQuickReply } from "@/features/ai-agent/quick-reply";
import { renderConversationVariables } from "@/features/qualification-engine/reply-composer";
import { builtinSituation, detectLateralSituation, quickReplyTuning, SITUATION_ACTION_LABEL, type SituationAction } from "./catalog";
import { loadTenantSituations } from "./service";

/** The example customer every test uses for {{nome}} and {{resumo}}. */
export const EXAMPLE_CUSTOMER: ConversationMemory = {
  customerFirstName: { value: "Torquato", confidence: 1 },
  customerName: { value: "Torquato Silva", confidence: 1 },
  planType: { value: "individual", confidence: 1 },
  age: { value: "40", confidence: 1 },
  city: { value: "Itaboraí", confidence: 1 },
  collectedFields: ["customerName", "planType", "age", "city"],
};

export type PhraseExplanation = {
  /** builtin/custom: a registered situation; ai: nothing matched and the AI answered with the roteiros; none: read as an answer. */
  kind: "builtin" | "custom" | "ai" | "none";
  label: string;
  response: string | null;
  action: string;
};

/**
 * What the engine does with a customer message during the qualification, in
 * the same order as the real conversation: quick replies (with the phrases
 * the tenant taught), then the tenant's own situations and the common
 * questions, then the AI answer guided by the roteiros. Nothing is sent.
 */
export async function explainPhrase(tenantId: string, text: string): Promise<PhraseExplanation> {
  const [situations, templates] = await Promise.all([loadTenantSituations(tenantId), loadQuickReplyTemplates(tenantId)]);
  const render = (body: string | undefined) => (body ? renderConversationVariables(body, EXAMPLE_CUSTOMER) : null);
  const quick = resolveQuickReply({
    body: text, conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: true,
    ...quickReplyTuning(situations),
  });
  if (quick.resolved && quick.templateKey && quick.templateKey !== "message.unclear") {
    const builtin = builtinSituation(quick.templateKey);
    const action: SituationAction = builtin?.action ?? "notify";
    return { kind: "builtin", label: builtin?.label ?? quick.templateKey, response: render(templates[quick.templateKey]?.body), action: SITUATION_ACTION_LABEL[action] };
  }
  const lateral = detectLateralSituation(text, situations);
  if (lateral?.kind === "faq") {
    return { kind: "builtin", label: lateral.label, response: render(templates[lateral.key]?.body), action: `${SITUATION_ACTION_LABEL.continue}: repete a pergunta pendente` };
  }
  if (lateral?.kind === "custom") {
    return { kind: "custom", label: lateral.label, response: render(lateral.response), action: lateral.action === "transfer" ? SITUATION_ACTION_LABEL.transfer : `${SITUATION_ACTION_LABEL.continue}: repete a pergunta pendente` };
  }
  if (isCustomerQuestion(text)) {
    const answer = await generateLateralAnswer({ tenantId, question: text, customerFirstName: "Torquato" });
    return { kind: "ai", label: "Nenhuma situação cadastrada: a IA responde com os roteiros", response: answer, action: answer ? "Responde e repete a pergunta pendente" : "A IA não respondeu; só a pergunta pendente é repetida" };
  }
  return { kind: "none", label: "Nenhuma situação: vale como resposta à pergunta pendente", response: null, action: "A qualificação segue normalmente" };
}
