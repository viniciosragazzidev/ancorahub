"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChatScreen } from "@/components/chat/chat-screen";
import styles from "@/components/chat/chat.module.css";
import type { Mention } from "@/components/chat/composer";
import type { ChatBlock, ChatScript } from "@/components/chat/types";

import { runChatServerAction } from "./chat-actions";

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
  return (
    <div className="arc-venancor">
      <ChatScreen
        identity={{ name, shape: "mochi", hue: null, initials }}
        backHref="/minha-fila"
        script={script}
        composerDisabled={!canWrite}
        headerAction={
          <Link href={`/leads/${leadId}?ficha=1`} className={styles.iconButton} aria-label="Ver ficha completa">
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.5" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </Link>
        }
        runAction={async (action) => {
          const result = await runChatServerAction(action.name, action.payload);
          // Registering the first contact returns the WhatsApp link: open it beside the app.
          if (result.ok && result.href?.startsWith("http")) window.open(result.href, "_blank", "noopener");
          if (result.ok && action.name === "lead.decline") router.push("/minha-fila");
          return { ok: result.ok, message: result.message };
        }}
        onFreeText={async (text): Promise<ChatBlock[]> => {
          const result = await runChatServerAction("lead.addNote", { leadId, content: text });
          return [{ type: "assistant", id: `note-${Date.now()}`, text: result.message }];
        }}
        onMention={(mention: Mention): ChatBlock[] => {
          router.push(mention.handle === "cotacao" ? "/cotacao" : `/dashboard/c/${mention.handle}`);
          return [];
        }}
      />
    </div>
  );
}
