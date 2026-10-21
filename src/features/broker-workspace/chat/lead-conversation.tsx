"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChatScreen } from "@/components/chat/chat-screen";
import styles from "@/components/chat/chat.module.css";
import type { Mention } from "@/components/chat/composer";
import type { ChatBlock, ChatScript } from "@/components/chat/types";
import { recordWhatsAppOpenedAction } from "@/features/leads/whatsapp-open-action";
import { openWhatsApp, prepareWhatsAppWindow } from "@/lib/whatsapp-open";

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
  // "WhatsApp" goes straight to the client's chat (Vinicios, 2026-10-21): WhatsApp Web on the computer, the app on the phone.
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
          // The app-wide WhatsApp link handler opens it (Web tab or app); nothing in between.
          void event;
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
          // Same tap as the reply: WhatsApp opens right away (Web tab on the computer, the app on the phone).
          void recordWhatsAppOpenedAction(leadId);
          openWhatsApp(value.slice(WHATSAPP_LOCAL_PREFIX.length));
          // Back from WhatsApp: one tap confirms the contact (kept in the lead's history).
          const first = name.split(/\s+/)[0] || name;
          return [
            { type: "assistant", id: `wa-open-${stamp}`, text: "Abrindo o WhatsApp…" },
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
          // "Aceitar e chamar no WhatsApp": the WhatsApp tab opens inside the tap (before the await), then goes to the chat.
          const whatsapp = action.name === "lead.registerContact" ? prepareWhatsAppWindow() : null;
          let result: Awaited<ReturnType<typeof runChatServerAction>>;
          try {
            result = await runChatServerAction(action.name, action.payload);
          } catch (error) {
            whatsapp?.cancel();
            throw error;
          }
          if (result.ok && action.name === "lead.decline") router.push("/minha-fila");
          const opened = Boolean(whatsapp && result.ok && result.href?.startsWith("http") && whatsapp.go(result.href));
          if (!opened) whatsapp?.cancel();
          if (opened) void recordWhatsAppOpenedAction(leadId);
          // The link stays as a button right below, to open the chat again.
          const followUp: ChatBlock[] = result.ok && result.href?.startsWith("http") ? [whatsappButton(`b-whatsapp-${Date.now()}`, result.href)] : [];
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
    </div>
  );
}
