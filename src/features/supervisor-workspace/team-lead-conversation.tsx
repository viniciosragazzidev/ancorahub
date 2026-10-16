"use client";

import { ChatScreen } from "@/components/chat/chat-screen";
import type { ChatBlock, ChatScript } from "@/components/chat/types";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import type { TeamConversationDetail, TeamConversationMessage } from "@/features/team-conversations/types";

const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

function mediaLabel(kind: string | null) {
  if (!kind) return "Mídia sem legenda";
  const labels: Record<string, string> = {
    image: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    document: "Documento",
    sticker: "Figurinha",
  };
  return labels[kind.toLowerCase()] ?? "Mídia";
}

/** Only WhatsApp transcript blocks are admitted; no block can run an action or open a link. */
export function readOnlyWhatsAppBlocks(messages: TeamConversationMessage[]): ChatBlock[] {
  return messages.map((message) => ({
    type: "whatsapp",
    id: `team-wa-${message.id}`,
    text: message.body.trim() || mediaLabel(message.mediaKind),
    at: timeLabel.format(new Date(message.at)),
    from: message.fromClient ? "client" : message.byAi ? "qualification" : "broker",
  }));
}

export function TeamLeadConversation({ conversation, brokerWhatsAppConnected }: { conversation: TeamConversationDetail; brokerWhatsAppConnected: boolean }) {
  if (!brokerWhatsAppConnected) {
    return (
      <section aria-labelledby="team-lead-chat-heading" className="arc-venancor flex flex-col gap-3">
        <h2 id="team-lead-chat-heading" className="text-lg font-semibold text-(--foreground)">Conversa do WhatsApp</h2>
        <EmptyState
          title="Visualização ao vivo desativada, corretor não conectou o WhatsApp"
          description="A conversa ao vivo fica indisponível até o corretor reconectar o WhatsApp."
        />
      </section>
    );
  }

  if (conversation.messages.length === 0) {
    return (
      <section aria-labelledby="team-lead-chat-heading" className="arc-venancor flex flex-col gap-3">
        <h2 id="team-lead-chat-heading" className="text-lg font-semibold text-(--foreground)">Conversa do WhatsApp</h2>
        <EmptyState title="Ainda não há mensagens" description="As mensagens da conversa aparecerão aqui quando forem registradas." />
      </section>
    );
  }

  const script: ChatScript = {
    blocks: readOnlyWhatsAppBlocks(conversation.messages),
    status: { label: "Somente leitura", tone: "paused" },
    composerPlaceholder: "Conversa somente leitura",
  };
  const initials = conversation.leadName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "?";

  return (
    <section aria-labelledby="team-lead-chat-heading" className="arc-venancor flex flex-col gap-3">
      <h2 id="team-lead-chat-heading" className="text-lg font-semibold text-(--foreground)">Conversa do WhatsApp</h2>
      <ChatScreen
        identity={{ name: conversation.leadName, shape: "mochi", hue: null, initials }}
        backHref="/leads"
        script={script}
        composerDisabled
        instant
      />
    </section>
  );
}
