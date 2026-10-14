"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";

import type { TeamConversationDetail } from "./types";
import styles from "./team-conversations.module.css";

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const mediaLabel: Record<string, string> = { image: "Imagem", audio: "Áudio", video: "Vídeo", document: "Documento", sticker: "Figurinha" };

/** One broker conversation, read only: the manager or supervisor follows the service without answering in the broker's name. */
export function TeamConversationView({ conversation }: { conversation: TeamConversationDetail }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, []);

  // Day separators: a message opens a new day when its date differs from the previous one.
  const days = conversation.messages.map((message) => dayLabel(message.at));
  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={`${styles.head} ${styles.enter}`}>
          <span className={styles.avatar} aria-hidden="true">{conversation.leadName.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
          <span style={{ minWidth: 0 }}>
            <h1 className={styles.headName}>{conversation.leadName}</h1>
            <span className={styles.headMeta}>Atendido por {conversation.brokerName ?? "ninguém ainda"}</span>
          </span>
          <Link href={`/leads/${encodeURIComponent(conversation.leadId)}`} className={styles.pill}>Ver lead</Link>
        </header>
        <span className={`${styles.readOnly} ${styles.enter}`} style={{ "--i": 1 } as CSSProperties}>Somente leitura: a conversa é do corretor</span>

        {conversation.messages.length ? (
          <div className={styles.thread} role="log" aria-label={`Mensagens com ${conversation.leadName}`}>
            {conversation.messages.map((message, index) => {
              const day = days[index];
              const showDay = index === 0 || day !== days[index - 1];
              return (
                <div key={message.id} style={{ display: "contents" }}>
                  {showDay ? <span className={styles.day}>{day}</span> : null}
                  <p className={`${styles.bubble} ${styles.enter}`} data-side={message.fromClient ? "client" : "team"} style={{ "--i": Math.min(index, 10), margin: 0 } as CSSProperties}>
                    {message.byAi ? <span className={styles.ai}>IA</span> : null}
                    {message.body || (message.mediaKind ? mediaLabel[message.mediaKind] ?? "Mídia" : "Mensagem sem texto")}
                    <span className={styles.bubbleMeta}>{message.fromClient ? "Cliente" : message.byAi ? "Assistente" : "Corretor"} · {timeLabel(message.at)}</span>
                  </p>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        ) : (
          <div className={styles.empty}>
            <strong>Sem mensagens ainda</strong>
            <p>Quando o corretor conversar com este cliente pelo WhatsApp conectado, as mensagens aparecem aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
