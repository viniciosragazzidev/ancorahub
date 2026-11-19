"use server";

import { z } from "zod";

import { brokerAiAccess } from "@/features/ai-gateway/broker-ai-pilot";
import { readAiConsent } from "@/features/ai-gateway/consent";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { runSasaCommand, sasaWorldOf, type SasaReply } from "./command-core";
import { isSasaDynamicAiEnabled } from "./dynamic-ai-flag";
import { answerSasaQuestion } from "./ecosystem";
import { looksLikeQuestion } from "./ecosystem-areas";
import { classifySasaText } from "./intent-rules";
import { interpretSasaText } from "./interpret";
import { sasaLimitMessage } from "./limits";
import { whenLabel } from "./parse-when";
import { firstNameOf } from "./resolve-entities";
import { findSasaCommand, saveSasaCommand, sasaUsageToday } from "./store";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(500),
  clientCommandId: z.string().min(8).max(80).nullish(),
  pickedLeadId: z.string().min(1).max(80).nullish(),
  origin: z.enum(["text", "voice"]).nullish(),
  /** Hora da gravação (fila sem internet); até 24 h, nunca no futuro. */
  recordedAt: z.string().datetime({ offset: true }).nullish(),
});

const NOT_HANDLED: SasaReply = { handled: false, blocks: [] };

/**
 * Pedido à Sasá agêntica. Tenant, usuário e papel vêm só da sessão; a IA nunca manda id.
 * Regras primeiro (grátis); a IA só interpreta quando as regras não casam e o corretor já consentiu.
 * `handled: false` devolve a vez para a resposta por IA de sempre (askAssistantAction).
 * Cada pedido vira uma linha em `sasa_commands` (fase 2), que dá o histórico, o teto de 150 por dia (D9)
 * e garante que um reenvio (resposta perdida na internet ruim) não executa duas vezes.
 */
export async function sasaCommandAction(raw: { text: string; clientCommandId?: string | null; pickedLeadId?: string | null; origin?: "text" | "voice" | null; recordedAt?: string | null }): Promise<SasaReply> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return NOT_HANDLED;
  const input = parsed.data;
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return NOT_HANDLED;
    // Piloto (D8): a mesma liberação da Sasá com IA (flag da empresa ou corretor do piloto).
    const access = await brokerAiAccess(context.userId);
    if (!access.enabled) return NOT_HANDLED;

    const stored = input.clientCommandId ? await findSasaCommand(context.tenantId, context.userId, input.clientCommandId) : null;
    if (stored?.reply && stored.status !== "transcribed") return stored.reply;
    // A voz já foi contada pela rota de transcrição: o mesmo pedido não conta duas vezes.
    const origin = stored?.origin === "voice" ? "voice" : input.origin ?? "text";
    const save = (status: Parameters<typeof saveSasaCommand>[0]["status"], extra: Partial<Parameters<typeof saveSasaCommand>[0]> = {}) =>
      input.clientCommandId
        ? saveSasaCommand({ tenantId: context.tenantId, userId: context.userId, clientCommandId: input.clientCommandId, origin, text: input.text, pickedLeadId: input.pickedLeadId ?? null, status, ...extra })
        : Promise.resolve();

    if (!stored) {
      const limit = sasaLimitMessage(await sasaUsageToday(context.tenantId, context.userId));
      if (limit) {
        const reply: SasaReply = { handled: true, blocks: [{ type: "assistant", id: `sasa-limit-${Date.now()}`, text: limit }] };
        await save("limited", { reply });
        return reply;
      }
    }

    const now = new Date();
    const world = sasaWorldOf(await getCachedBrokerWorkspaceData(), now);
    const recorded = input.recordedAt ? new Date(input.recordedAt) : null;
    const recordedAt = recorded && recorded.getTime() <= now.getTime() && now.getTime() - recorded.getTime() <= 86_400_000 ? recorded : null;

    let interpreted: Awaited<ReturnType<typeof interpretSasaText>> = null;
    let via: "rules" | "ai" = "rules";
    if (!classifySasaText(input.text)) {
      // LGPD: nada vai a um modelo sem o consentimento atual.
      const consent = await readAiConsent(context.tenantId, context.userId).catch(() => ({ granted: false }));
      // Pergunta não vira comando: vai direto para a leitura do ecossistema.
      const asking = looksLikeQuestion(input.text);
      if (consent.granted && !asking) {
        interpreted = await interpretSasaText({
          tenantId: context.tenantId,
          userId: context.userId,
          text: input.text,
          leadFirstNames: [...new Set(world.leads.map((lead) => firstNameOf(lead.name)))],
          nowLabel: whenLabel(now, now),
        }).catch(() => null);
      }
      if (!interpreted) {
        // Ecossistema (19/11): resposta direta pelos dados das telas; sem ela, a IA limitada (chave da empresa + consentimento).
        const dynamic = consent.granted && await isSasaDynamicAiEnabled(context.tenantId);
        const answer = await answerSasaQuestion(context, input.text, { dynamic, now }).catch((error) => { console.error("[sasa] answer failed", error); return null; });
        if (answer) {
          const reply: SasaReply = { handled: true, blocks: answer.blocks ?? [{ type: "assistant", id: `sasa-answer-${now.getTime()}`, text: answer.text }] };
          await save("answered", { tool: `${answer.via === "direct" ? "read" : "agent"}:${answer.areas.join(",")}${answer.truncated ? ":limite" : ""}`.slice(0, 120), via: answer.via === "direct" ? "rules" : "ai", reply });
          return reply;
        }
        await save("not_command");
        return NOT_HANDLED;
      }
      via = "ai";
    }

    const reply = await runSasaCommand({
      text: input.text,
      pickedLeadId: input.pickedLeadId ?? null,
      recordedAt,
      world,
      intent: interpreted?.intent,
      leadHint: interpreted?.leadHint,
      whenText: interpreted?.whenText,
      stamp: String(now.getTime()),
      run: (name, payload) => runChatServerAction(name, payload),
    });
    if (!reply.handled) {
      await save("not_command");
      return reply;
    }
    // Só o texto do pedido (D4: nunca áudio). A ação real já gravou a própria auditoria.
    await save(reply.executed ? (reply.executed.ok ? "done" : "failed") : "answered", { tool: reply.tool ?? null, via, reply });
    return reply;
  } catch (error) {
    console.error("[sasa] command failed", error);
    return NOT_HANDLED;
  }
}
