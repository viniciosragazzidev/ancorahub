"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";
import { bestAssistMatch } from "@/features/assist/catalog";
import { useAssist } from "@/features/assist/components/assist-layer";
import { askAssistantAction } from "@/features/ai-gateway/ask-assistant";
import type { AgentId } from "@/features/ai-gateway/agents";
import { JACK_ASK_PREFIX } from "@/features/broker-workspace/chat/assistant-scripts";

import { ChatScreen } from "./chat-screen";
import type { Mention } from "./composer";
import type { ChatBlock, ChatScript, MascotShape } from "./types";

/** An assistant conversation: the script plays, replies run the broker's actions. */
export function AssistantChat({ identity, script, instant = false, headerAction, topNotice, agentId, canWrite = false }: { identity: { name: string; shape: MascotShape; hue: number | null }; script: ChatScript; instant?: boolean; headerAction?: ReactNode; topNotice?: ReactNode; /** Free text goes to this AI agent (when the flag is on). */ agentId?: AgentId; /** Only Jack's conversation takes typed text (2026-10-12); the others work by the suggested replies. */ canWrite?: boolean }) {
  const router = useRouter();
  const assist = useAssist();
  const ask = async (text: string): Promise<ChatBlock[]> => {
    if (agentId) return (await askAssistantAction({ agentId, question: text })).blocks;
    return [{ type: "assistant", id: `free-answer-${Date.now()}`, text: "Não achei isso. Tente com outras palavras ou toque em \"?\" no topo para a ajuda da tela." }];
  };
  return (
    <ChatScreen
      composerDisabled={!canWrite}
      placeholder={canWrite ? undefined : "Escolha uma opção acima. Para perguntar, fale com o Jack."}
      onLocalChoice={async (_choice, value): Promise<ChatBlock[]> => (value.startsWith(JACK_ASK_PREFIX) ? ask(value.slice(JACK_ASK_PREFIX.length)) : [])}
      identity={identity}
      backHref="/dashboard"
      script={script}
      instant={instant}
      headerAction={headerAction}
      topNotice={topNotice}
      runAction={async (action) => {
        const result = await runChatServerAction(action.name, action.payload);
        // An accepted lead continues in its own conversation: offer it as the next reply.
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
        router.push(mention.handle === "cotacao" ? "/cotacao" : `/dashboard/c/${mention.handle}`);
        return [];
      }}
      onFreeText={async (text): Promise<ChatBlock[]> => {
        // "Onde fica?" answered from the app catalog first: instant, free and always right.
        const where = bestAssistMatch(text, assist?.capabilities ?? {});
        if (where) {
          const stamp = Date.now();
          return [
            { type: "assistant", id: `where-${stamp}`, text: `${where.title}: ${where.description}` },
            { type: "button", id: `where-go-${stamp}`, label: where.kind === "action" ? "Me leva lá" : `Abrir ${where.title}`, href: where.href },
          ];
        }
        return ask(text);
      }}
    />
  );
}
