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
import { WHATSAPP_LOCAL_PREFIX, whatsappButton } from "./lead-script";
import { ASSISTANTS } from "./assistant-scripts";

/**
 * A lead as a conversation: the script plays, replies run the broker's lead
 * actions and free text becomes a note in the lead history.
 */
export function LeadConversation({
  leadId,
  name,
  initials,
  script,
}: {
  leadId: string;
  name: string;
  initials: string;
  /** Kept for the callers; the composer is off on the lead page since 2026-10-12. */
  canWrite: boolean;
  script: ChatScript;
}) {
  const router = useRouter();
  // On a computer "WhatsApp" opens the first-message dialog (send from the system or connect); phones open the app.
  const desktop = useMediaQuery("(min-width: 1024px) and (pointer: fine)");
  const [firstMessageOpen, setFirstMessageOpen] = useState(false);
  return (
    <div className="arc-venancor h-full min-h-0">
      <ChatScreen
        identity={{ name, shape: "mochi", hue: null, initials }}
        backHref="/dashboard"
        fill
        embedded
        emptyText="A conversa com o cliente aparece aqui. Aceite o lead e chame no WhatsApp para começar."
        script={script}
        tourTargets={{ conversation: "micro-conv-messages", composer: "micro-conv-composer" }}
        // The lead page works by the replies above (Vinicios, 2026-10-12): no free text here.
        composerDisabled
        placeholder="Escolha uma das opções acima"
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
          <Link href={`/leads/${leadId}?ficha=1`} className={styles.iconButton} data-tour="micro-conv-ficha" aria-label="Ver ficha completa">
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.5" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </Link>
        }
        onLocalChoice={(_choice, value): ChatBlock[] => {
          const stamp = Date.now();
          if (value === "wa-later") return [{ type: "assistant", id: `wa-later-${stamp}`, text: "Sem problema. Quando falar, me conta aqui que eu registro." }];
          if (!value.startsWith(WHATSAPP_LOCAL_PREFIX)) return [];
          // Same tap as the reply: the phone opens WhatsApp (never a blocked popup); the computer opens the dialog.
          void recordWhatsAppOpenedAction(leadId);
          if (desktop) setFirstMessageOpen(true);
          else window.open(value.slice(WHATSAPP_LOCAL_PREFIX.length), "_blank", "noopener");
          // Back from WhatsApp: one tap confirms the contact (kept in the lead's history).
          const first = name.split(/\s+/)[0] || name;
          return [
            { type: "assistant", id: `wa-open-${stamp}`, text: desktop ? "Abrindo a mensagem…" : "Abrindo o WhatsApp…" },
            {
              type: "question",
              id: `wa-confirm-${stamp}`,
              prompt: `Conseguiu falar com ${first}?`,
              choices: [
                { id: "wa-yes", label: `Sim, falei com ${first}`, reply: `Falei com ${first}`, action: { kind: "server", name: "lead.addNote", payload: { leadId, content: "Contato feito pelo WhatsApp (confirmado pelo corretor)." } } },
                { id: "wa-sent", label: "Enviei mensagem, aguardando resposta", reply: "Enviei mensagem, estou aguardando", action: { kind: "server", name: "lead.addNote", payload: { leadId, content: "Mensagem enviada pelo WhatsApp, aguardando resposta do cliente." } } },
                { id: "wa-no", label: "Ainda não", action: { kind: "local", value: "wa-later" } },
              ],
            },
          ];
        }}
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
            // The AI consent card is shown as is (the question is not saved as a note).
            if (answer.ok || answer.blocks.some((block) => block.type === "consent")) return answer.blocks;
          }
          const result = await runChatServerAction("lead.addNote", { leadId, content: text });
          return [{ type: "assistant", id: `note-${Date.now()}`, text: result.message }];
        }}
        onMention={(mention: Mention): ChatBlock[] => {
          const destination = ASSISTANTS[mention.handle as keyof typeof ASSISTANTS]?.href;
          router.push(destination ?? `/dashboard/c/${encodeURIComponent(mention.handle)}`);
          return [];
        }}
      />
      {desktop ? <FirstMessageDialog leadId={leadId} open={firstMessageOpen} onOpenChange={setFirstMessageOpen} onSent={() => router.refresh()} /> : null}
    </div>
  );
}
