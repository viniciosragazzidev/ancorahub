"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";
import { askAssistantAction } from "@/features/ai-gateway/ask-assistant";
import type { AgentId } from "@/features/ai-gateway/agents";

import { ChatScreen } from "./chat-screen";
import type { Mention } from "./composer";
import type { ChatBlock, ChatScript, MascotShape } from "./types";

/** An assistant conversation: the script plays, replies run the broker's actions. */
export function AssistantChat({ identity, script, instant = false, headerAction, agentId }: { identity: { name: string; shape: MascotShape; hue: number | null }; script: ChatScript; instant?: boolean; headerAction?: ReactNode; /** Free text goes to this AI agent (when the flag is on). */ agentId?: AgentId }) {
  const router = useRouter();
  return (
    <ChatScreen
      identity={identity}
      backHref="/dashboard"
      script={script}
      instant={instant}
      headerAction={headerAction}
      runAction={async (action) => {
        const result = await runChatServerAction(action.name, action.payload);
        // An accepted lead continues in its own conversation: offer it as the next reply.
        const followUp: ChatBlock[] = result.ok && result.href?.startsWith("/") && !result.href.startsWith("//")
          ? [{ type: "question", id: `after-${action.name}-${Date.now()}`, prompt: "Quer seguir com ele agora?", choices: [{ id: "open", label: "Abrir a conversa", action: { kind: "href", href: result.href } }] }]
          // External links (WhatsApp) become a button: opened by the tap, never blocked as a popup.
          : result.ok && result.href?.startsWith("https://")
            ? [{ type: "button", id: `after-${action.name}-${Date.now()}`, label: "Abrir WhatsApp", href: result.href, tone: "whatsapp" }]
            : [];
        return { ok: result.ok, message: result.message, warning: result.warning, followUp };
      }}
      onMention={(mention: Mention): ChatBlock[] => {
        router.push(mention.handle === "cotacao" ? "/cotacao" : `/dashboard/c/${mention.handle}`);
        return [];
      }}
      onFreeText={async (text): Promise<ChatBlock[]> => {
        if (agentId) return (await askAssistantAction({ agentId, question: text })).blocks;
        return [{ type: "assistant", id: `free-answer-${Date.now()}`, text: "Ainda não entendo texto livre aqui. Escolha uma das opções ou use @ para abrir outra conversa." }];
      }}
    />
  );
}
