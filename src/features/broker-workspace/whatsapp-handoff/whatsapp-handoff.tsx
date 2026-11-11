"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { FloatingPill } from "@/components/chat/floating-pill";
import chatStyles from "@/components/chat/chat.module.css";
import { openWhatsApp, tryOpenWhatsAppWithoutGesture } from "@/lib/whatsapp-open";

import styles from "./whatsapp-handoff.module.css";
import { HANDOFF_SECONDS, useHandoffCountdown } from "./use-handoff-countdown";

export type HandoffLead = {
  name: string;
  wants: string | null;
  plan: string | null;
  lives: string | null;
  city: string | null;
  /** Plano anunciado da campanha, quando o cartão "De onde veio" existir. */
  advertisedPlan?: string | null;
};

type Phase = "counting" | "failed";

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function clock(seconds: number) {
  const total = Math.max(0, seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Aceite com contador (11/11): depois do aceite, o corretor lê quem é o cliente antes de chamar.
 * A pílula "Abrir WhatsApp · 0:30" abre na hora com um toque; ao zerar, tenta abrir sozinha. Se o
 * navegador barrar (sem toque recente), a pílula vira "Toque para abrir o WhatsApp" e pulsa.
 * "Ficar aqui" fecha tudo; o lead continua aceito e a tela tem o próprio botão do WhatsApp.
 */
export function WhatsAppHandoff({ lead, whatsappUrl, onClose, seconds = HANDOFF_SECONDS, initialPhase = "counting" }: {
  lead: HandoffLead;
  whatsappUrl: string;
  onClose: () => void;
  seconds?: number;
  /** Só para a prévia de /dev: começar no estado "Toque para abrir". */
  initialPhase?: Phase;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };
  const countdown = useHandoffCountdown({
    seconds,
    active: initialPhase === "counting",
    onZero: () => {
      void tryOpenWhatsAppWithoutGesture(whatsappUrl).then((result) => {
        if (result === "opened") close();
        else if (!closed.current) setPhase("failed");
      });
    },
  });

  const openNow = () => {
    countdown.finish();
    openWhatsApp(whatsappUrl);
    close();
  };
  const stay = () => {
    countdown.cancel();
    close();
  };

  // Rótulo para leitor de tela: atualizado a cada 10 s, não a cada segundo.
  const spoken = Math.max(10, Math.ceil(countdown.remaining / 10) * 10);
  const ariaLabel = phase === "failed"
    ? "Abrir o WhatsApp do cliente"
    : `Abrir o WhatsApp agora. Abre sozinho em até ${spoken} segundos`;

  const rows = useMemo(() => [
    { label: "Plano", value: lead.plan },
    { label: "Vidas", value: lead.lives },
    { label: "Cidade", value: lead.city },
    { label: "Anúncio", value: lead.advertisedPlan ?? null },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value)), [lead]);

  useEffect(() => () => { closed.current = true; }, []);

  return (
    <>
      <div className={styles.layer}>
        <motion.section
          className={styles.card}
          aria-labelledby="whatsapp-handoff-name"
          data-testid="whatsapp-handoff"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0.12 } : { type: "spring", visualDuration: 0.3, bounce: 0.15 }}
        >
          <div>
            <p className={styles.eyebrow}>Lead aceito · antes de chamar</p>
            <h2 id="whatsapp-handoff-name" className={styles.name}>{lead.name}</h2>
            {lead.wants ? <p className={styles.wants}>{lead.wants}</p> : null}
          </div>
          {rows.length ? (
            <dl className={styles.rows}>
              {rows.map((row) => (
                <div key={row.label} className={styles.row}><dt>{row.label}</dt><dd>{row.value}</dd></div>
              ))}
            </dl>
          ) : null}
          <div className={styles.footer}>
            <p className={styles.hint} role="status">
              {phase === "failed" ? "O navegador não deixou abrir sozinho. Toque no botão." : "O WhatsApp abre sozinho quando o contador zerar."}
            </p>
            <button type="button" className={styles.stay} onClick={stay}>Ficar aqui</button>
          </div>
        </motion.section>
      </div>
      <FloatingPill tone="whatsapp" pulse={phase === "failed"} ariaLabel={ariaLabel} onClick={openNow}>
        <WhatsAppGlyph />
        {phase === "failed" ? "Toque para abrir o WhatsApp" : (
          <>
            Abrir WhatsApp
            <span className={chatStyles.pillCount} aria-hidden="true">· {clock(countdown.remaining)}</span>
          </>
        )}
      </FloatingPill>
    </>
  );
}

/** Monta o quadro com o que a tela do lead já tem (resumo da IA, plano, vidas, cidade). */
export function handoffLeadFrom(lead: {
  nome: string;
  summary?: string | null;
  planName?: string | null;
  tipo?: string | null;
  livesCount?: number | null;
  city?: string | null;
  clientInfo?: Array<{ label: string; value: string }>;
}): HandoffLead {
  const info = (label: string) => lead.clientInfo?.find((item) => item.label.toLowerCase() === label.toLowerCase())?.value?.trim() || null;
  const plan = lead.planName || info("Plano de interesse");
  const kind = lead.tipo || info("Tipo de plano");
  const lives = lead.livesCount ? `${lead.livesCount} ${lead.livesCount === 1 ? "vida" : "vidas"}` : info("Vidas");
  const ages = info("Idades");
  return {
    name: lead.nome,
    wants: lead.summary?.trim() || info("Interesse"),
    plan: [plan, kind && kind !== plan ? kind : null].filter(Boolean).join(" · ") || null,
    lives: [lives, ages ? `idades ${ages}` : null].filter(Boolean).join(" · ") || null,
    city: lead.city || info("Cidade"),
  };
}
