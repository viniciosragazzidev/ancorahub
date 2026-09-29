import { NextRequest, NextResponse } from "next/server";

import { resolvePublishedAgentBehavior } from "@/features/agent-training/runtime";
import { generateLateralAnswer, isCustomerQuestion } from "@/features/ai-agent/lateral-answer";
import { createEmptyMemory, extractFieldsFromMessage, type ConversationMemory } from "@/features/ai-agent/memory";
import { loadQuickReplyTemplates, parseHumanRequest, parseOptOut } from "@/features/ai-agent/quick-reply";
import { detectLateralSituation, phraseMatches, quickReplyTuning } from "@/features/attendance-situations/catalog";
import { loadTenantSituations } from "@/features/attendance-situations/service";
import { loadTenantAiAgentConfig } from "@/features/ai-agent/tenant-config";
import { renderConversationVariables } from "@/features/qualification-engine/reply-composer";
import { resolveDeterministicQualificationTurn } from "@/features/qualification-engine/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const runtime = "nodejs";

type SimulatorMessage = { role: "user" | "assistant"; content: string };

/**
 * POST /api/qualificacao/simulador
 *
 * Runs the same engine as a real WhatsApp conversation (extraction, next
 * question, reply composer, quick replies and common questions), without
 * sending or saving anything. The memory is rebuilt from the messages on
 * every call, so what is tested here is what the customer receives.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getRequiredTenantContext();
    const body = (await req.json()) as { messages?: SimulatorMessage[] };
    const messages = Array.isArray(body.messages) ? body.messages.filter((message) => typeof message?.content === "string") : [];
    const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
    if (!lastUser) return NextResponse.json({ error: "messages array is required" }, { status: 400 });

    const startedAt = Date.now();
    const [behavior, tenantConfig, templates, situations] = await Promise.all([
      resolvePublishedAgentBehavior(tenantId),
      loadTenantAiAgentConfig(tenantId),
      loadQuickReplyTemplates(tenantId),
      loadTenantSituations(tenantId),
    ]);
    const { phrases } = quickReplyTuning(situations);
    const asksForPerson = (text: string) => parseHumanRequest(text) || phraseMatches(text, phrases.request_human);

    // Replay the conversation: each assistant message is the question the next
    // customer message answers, exactly as in the real engine.
    let memory: ConversationMemory = createEmptyMemory();
    let before: ConversationMemory = memory;
    let transferred = false;
    const assistantTexts: string[] = [];
    messages.forEach((message, index) => {
      if (message.role === "assistant") {
        memory = { ...memory, lastQuestionAsked: message.content };
        assistantTexts.push(message.content);
        return;
      }
      const isLast = index === messages.length - 1 || messages.slice(index + 1).every((next) => next.role !== "user");
      if (isLast) before = memory;
      else if (asksForPerson(message.content)) transferred = true;
      memory = extractFieldsFromMessage(message.content, memory);
    });
    const reply = (text: string, extra: { transfer?: boolean } = {}) => NextResponse.json({
      reply: text,
      modelUsed: "motor-deterministico",
      latencyMs: Date.now() - startedAt,
      shouldTransferToHuman: Boolean(extra.transfer),
    });

    if (parseOptOut(lastUser) || phraseMatches(lastUser, phrases.opt_out)) return reply(templates["opt_out.confirmed"]?.body ?? "Entendido.");
    if (asksForPerson(lastUser)) {
      return transferred
        ? reply(templates["human.waiting_reminder"]?.body ?? "Sua mensagem foi recebida.")
        : reply(renderConversationVariables(templates["human.requested"]?.body ?? "", before), { transfer: true });
    }
    if (transferred) return reply(templates["human.waiting_reminder"]?.body ?? "Sua mensagem foi recebida.");

    const answered = memory.collectedFields.filter((field) => !before.collectedFields.includes(field))
      .filter((field) => !(field === "numberOfLives" && (memory.numberOfLives?.confidence ?? 1) < 1));
    const turn = resolveDeterministicQualificationTurn({
      memory,
      policy: behavior.policy,
      handoffMessage: tenantConfig.handoffMessage,
      pastOutboundTexts: new Set(assistantTexts.map((text) => text.trim().toLowerCase())),
      answeredNow: answered.length > 0,
      answered,
      previousReply: assistantTexts[assistantTexts.length - 1] ?? null,
      seed: `simulador:${assistantTexts.length}`,
    });

    let text = turn.reply;
    if (turn.kind === "collecting" && answered.length === 0) {
      const situation = detectLateralSituation(lastUser, situations);
      if (situation?.kind === "custom" && situation.action === "transfer") return reply(renderConversationVariables(situation.response, memory), { transfer: true });
      const situationText = situation?.kind === "custom" ? situation.response : situation ? templates[situation.key]?.body : undefined;
      if (situationText) text = `${renderConversationVariables(situationText, memory)}\n\n${turn.reply}`;
      else if (!situation && isCustomerQuestion(lastUser)) {
        const lateral = await generateLateralAnswer({ tenantId, question: lastUser, customerFirstName: memory.customerFirstName?.value ?? null }).catch(() => null);
        if (lateral) text = `${lateral}\n\n${turn.reply}`;
      }
    }
    return reply(text, { transfer: turn.kind === "handoff" });
  } catch (error) {
    console.error("[simulador-api] unexpected error", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ reply: "Não foi possível simular esta mensagem agora. Tente novamente." }, { status: 200 });
  }
}
