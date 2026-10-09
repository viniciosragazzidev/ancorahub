"use client";

import { useRouter } from "next/navigation";

import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";

import { ChatScreen } from "./chat-screen";
import type { Mention } from "./composer";
import type { ChatBlock, ChatScript, MascotShape } from "./types";

/** An assistant conversation: the script plays, replies run the broker's actions. */
export function AssistantChat({ identity, script }: { identity: { name: string; shape: MascotShape; hue: number | null }; script: ChatScript }) {
  const router = useRouter();
  return (
    <ChatScreen
      identity={identity}
      backHref="/dashboard"
      script={script}
      runAction={async (action) => {
        const result = await runChatServerAction(action.name, action.payload);
        if (result.ok && result.href?.startsWith("http")) window.open(result.href, "_blank", "noopener");
        return { ok: result.ok, message: result.message };
      }}
      onMention={(mention: Mention): ChatBlock[] => {
        router.push(mention.handle === "cotacao" ? "/cotacao" : `/dashboard/c/${mention.handle}`);
        return [];
      }}
      onFreeText={async (): Promise<ChatBlock[]> => [
        { type: "assistant", id: `free-answer-${Date.now()}`, text: "Ainda não entendo texto livre aqui. Escolha uma das opções ou use @ para abrir outra conversa." },
      ]}
    />
  );
}
