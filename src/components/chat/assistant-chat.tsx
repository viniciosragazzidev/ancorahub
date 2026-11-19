"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";
import { bestAssistMatch } from "@/features/assist/catalog";
import { useAssist } from "@/features/assist/components/assist-layer";
import { askAssistantAction } from "@/features/ai-gateway/ask-assistant";
import type { AgentId } from "@/features/ai-gateway/agents";
import { ASSISTANTS, SASA_ASK_PREFIX } from "@/features/broker-workspace/chat/assistant-scripts";
import { readSasaPick, type SasaCommandInput } from "@/features/sasa/command-core";
import { sasaCommandAction } from "@/features/sasa/command-action";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { prepareWhatsAppWindow } from "@/lib/whatsapp-open";
import { rememberWhatsAppHandoff, useAcceptHandoffEnabled } from "@/features/broker-workspace/whatsapp-handoff/handoff-store";

import { ChatScreen } from "./chat-screen";
import { feedbackOnResult } from "./chat-feedback";
import type { Mention } from "./composer";
import type { AssistantAvatarAsset, ChatBlock, ChatScript, MascotShape } from "./types";

/** An assistant conversation: the script plays, replies run the broker's actions. */
export function AssistantChat({ identity, script, instant = false, headerAction, topNotice, agentId, canWrite = false }: { identity: { name: string; shape: MascotShape; hue: number | null; avatarAsset?: AssistantAvatarAsset }; script: ChatScript; instant?: boolean; headerAction?: ReactNode; topNotice?: ReactNode; /** Free text goes to this AI agent (when the flag is on). */ agentId?: AgentId; /** Only Sasá's conversation takes typed text (2026-10-12); the others work by the suggested replies. */ canWrite?: boolean }) {
  const router = useRouter();
  const assist = useAssist();
  // Aceite com contador (11/11): ligado, o WhatsApp abre na tela do lead depois de 30 s.
  const handoff = useAcceptHandoffEnabled();
  const lab = useDevLab();
  const fire = useFeedback();
  // Sasá agêntica (fase 1, 19/11): o pedido roda primeiro como comando; o que não for comando segue para a IA.
  const agentic = agentId === "ancora";
  const command = async (input: SasaCommandInput) => {
    const reply = await (lab?.sasa?.command ?? sasaCommandAction)(input);
    // Nível 1 (FEEDBACK.md): confirmação só depois do servidor; falha com erro. Sem som de celebração.
    if (reply.executed) feedbackOnResult(reply.executed.action, reply.executed, fire);
    return reply;
  };
  const askAi = async (text: string): Promise<ChatBlock[]> => {
    if (lab?.sasa) return [{ type: "assistant", id: `lab-free-${Date.now()}`, text: "No laboratório, só os pedidos da fase 1 respondem: plantão, pausa, quem está esperando, agenda, retornos e etapa." }];
    if (agentId) return (await askAssistantAction({ agentId, question: text })).blocks;
    return [{ type: "assistant", id: `free-answer-${Date.now()}`, text: "Não achei isso. Tente com outras palavras ou toque em \"?\" no topo para a ajuda da tela." }];
  };
  /** Pergunta pronta ("ask:") ou texto: comando da Sasá primeiro, IA depois. */
  const ask = async (text: string): Promise<ChatBlock[]> => {
    if (agentic) {
      const reply = await command({ text });
      if (reply.handled) return reply.blocks;
    }
    return askAi(text);
  };
  return (
    <ChatScreen
      composerDisabled={!canWrite}
      placeholder={canWrite ? undefined : "Escolha uma opção acima. Para perguntar, fale com Sasá."}
      onLocalChoice={async (_choice, value): Promise<ChatBlock[]> => {
        if (value.startsWith(SASA_ASK_PREFIX)) return ask(value.slice(SASA_ASK_PREFIX.length));
        // "Qual Carlos?" e "Tentar de novo": repete o pedido com o lead escolhido.
        const pick = readSasaPick(value);
        if (pick) return (await command({ text: pick.text, pickedLeadId: pick.leadId })).blocks;
        return [];
      }}
      identity={identity}
      backHref="/dashboard"
      script={script}
      instant={instant}
      headerAction={headerAction}
      topNotice={topNotice}
      runAction={async (action) => {
        // Accepting opens the client's WhatsApp in the same tap: the tab opens before the await (popup blockers).
        const handoffAccept = handoff && action.name === "lead.accept";
        const whatsapp = !handoffAccept && (action.name === "lead.accept" || action.name === "lead.registerContact") ? prepareWhatsAppWindow() : null;
        let result: Awaited<ReturnType<typeof runChatServerAction>>;
        try {
          result = lab?.sasa ? await lab.sasa.run(action.name, action.payload) : await runChatServerAction(action.name, action.payload);
        } catch (error) {
          whatsapp?.cancel();
          throw error;
        }
        const whatsappHref = action.name === "lead.accept" ? result.whatsapp : result.href?.startsWith("https://") ? result.href : undefined;
        const opened = Boolean(whatsapp && result.ok && whatsappHref && whatsapp.go(whatsappHref));
        if (!opened) whatsapp?.cancel();
        if (action.name === "lead.accept" && result.ok && result.href?.startsWith("/") && !result.href.startsWith("//")) {
          if (handoffAccept && whatsappHref) {
            const leadId = result.href.split("/").filter(Boolean).pop()?.split("?")[0];
            if (leadId) rememberWhatsAppHandoff(leadId, whatsappHref);
            router.push(result.href);
            return { ok: true, message: "Aceito. Veja quem é o cliente antes de chamar.", warning: result.warning, followUp: [] };
          }
          router.push(result.href);
          return { ok: true, message: opened ? "Aceito. Abrindo o WhatsApp do cliente." : "Aceito. Abrindo o lead agora.", warning: result.warning, followUp: [] };
        }
        // Other local actions keep their destination available as the next reply.
        const followUp: ChatBlock[] = result.ok && result.href?.startsWith("/") && !result.href.startsWith("//")
          ? [{ type: "question", id: `after-${action.name}-${Date.now()}`, prompt: "Quer seguir com ele agora?", choices: [{ id: "open", label: "Abrir a conversa", action: { kind: "href", href: result.href } }] }]
          // External links (WhatsApp) become a button: opened by the tap, never blocked as a popup.
          : result.ok && result.href?.startsWith("https://")
            ? [{ type: "button", id: `after-${action.name}-${Date.now()}`, label: "Abrir WhatsApp", href: result.href, tone: "whatsapp" }]
            : [];
        if (result.ok && result.undo) followUp.push({ type: "question", id: `undo-${action.name}-${Date.now()}`, prompt: "Foi sem querer?", choices: [{ id: "undo", label: result.undo.label, action: result.undo.action }] });
        return { ok: result.ok, message: result.message, warning: result.warning, followUp };
      }}
      onMention={(mention: Mention): ChatBlock[] => {
        const destination = ASSISTANTS[mention.handle as keyof typeof ASSISTANTS]?.href;
        router.push(destination ?? `/dashboard/c/${encodeURIComponent(mention.handle)}`);
        return [];
      }}
      onFreeText={async (text, meta): Promise<ChatBlock[]> => {
        if (agentic) {
          const reply = await command({ text, clientCommandId: meta?.clientMessageId ?? null });
          if (reply.handled) return reply.blocks;
          if (lab?.sasa) return askAi(text);
        }
        // "Onde fica?" answered from the app catalog first: instant, free and always right.
        const where = bestAssistMatch(text, assist?.capabilities ?? {});
        if (where) {
          const stamp = Date.now();
          return [
            { type: "assistant", id: `where-${stamp}`, text: `${where.title}: ${where.description}` },
            { type: "button", id: `where-go-${stamp}`, label: where.kind === "action" ? "Me leva lá" : `Abrir ${where.title}`, href: where.href },
          ];
        }
        return askAi(text);
      }}
    />
  );
}
