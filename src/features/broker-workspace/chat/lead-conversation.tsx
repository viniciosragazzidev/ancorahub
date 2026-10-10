"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import styles from "@/components/chat/chat.module.css";
import type { Mention } from "@/components/chat/composer";
import type { ChatBlock, ChatScript } from "@/components/chat/types";
import { recordWhatsAppOpenedAction } from "@/features/leads/whatsapp-open-action";
import { FirstMessageDialog } from "@/features/broker-workspace/first-message/first-message-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";

import { runChatServerAction } from "./chat-actions";
import { askAssistantAction } from "@/features/ai-gateway/ask-assistant";
import { whatsappButton } from "./lead-script";

/**
 * A lead as a conversation: the script plays, replies run the broker's lead
 * actions and free text becomes a note in the lead history.
 */
export function LeadConversation({
  leadId,
  name,
  initials,
  canWrite,
  script,
}: {
  leadId: string;
  name: string;
  initials: string;
  canWrite: boolean;
  script: ChatScript;
}) {
  const router = useRouter();
  // On a computer "WhatsApp" opens the first-message dialog (send from the system or connect); phones open the app.
  const desktop = useMediaQuery("(min-width: 1024px) and (pointer: fine)");
  const [firstMessageOpen, setFirstMessageOpen] = useState(false);
  return (
    <div className="arc-venancor">
      <ChatScreen
        identity={{ name, shape: "mochi", hue: null, initials }}
        backHref="/dashboard"
        script={script}
        composerDisabled={!canWrite}
        onButtonOpen={(block, event) => {
          if (block.tone !== "whatsapp") return;
          void recordWhatsAppOpenedAction(leadId);
          // An AI draft keeps its own text: only the plain "Abrir WhatsApp" goes to the dialog.
          if (desktop && !block.id.startsWith("ai-send")) {
            event.preventDefault();
            setFirstMessageOpen(true);
          }
        }}
        headerAction={
          <Link href={`/leads/${leadId}?ficha=1`} className={styles.iconButton} aria-label="Ver ficha completa">
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.5" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </Link>
        }
        runAction={async (action) => {
          const result = await runChatServerAction(action.name, action.payload);
          if (result.ok && action.name === "lead.decline") router.push("/minha-fila");
          // Registering the first contact returns the WhatsApp link: a button right below opens it.
          const followUp: ChatBlock[] = result.ok && result.href?.startsWith("http") ? [whatsappButton(`b-whatsapp-${Date.now()}`, result.href)] : [];
          if (desktop && action.name === "lead.registerContact" && result.ok) setFirstMessageOpen(true);
          return { ok: result.ok, message: result.message, warning: result.warning, followUp };
        }}
        onFreeText={async (text): Promise<ChatBlock[]> => {
          // A question ("...?") goes to the AI of this lead; anything else, or an AI failure, is a note.
          if (text.trim().endsWith("?")) {
            const answer = await askAssistantAction({ agentId: "lead", question: text, leadId });
            if (answer.ok) return answer.blocks;
          }
          const result = await runChatServerAction("lead.addNote", { leadId, content: text });
          return [{ type: "assistant", id: `note-${Date.now()}`, text: result.message }];
        }}
        onMention={(mention: Mention): ChatBlock[] => {
          router.push(mention.handle === "cotacao" ? "/cotacao" : `/dashboard/c/${mention.handle}`);
          return [];
        }}
      />
      {desktop ? <FirstMessageDialog leadId={leadId} open={firstMessageOpen} onOpenChange={setFirstMessageOpen} onSent={() => router.refresh()} /> : null}
    </div>
  );
}
