"use client";

/**
 * Conteúdo do painel de um lead em pós-venda (24/11): situação da pesquisa, respostas resumidas e a conversa
 * pelo WhatsApp desde o envio. Ações: retomar a pergunta parada, abrir a conversa e ver o lead.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { LiteActionButton } from "@/components/lite/controls";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { getPostSaleSurveyMessagesAction, resumePostSaleSurveyAction } from "@/features/post-sale-audit/actions";
import { postSaleRuleLabel } from "@/features/post-sale-audit/auto-rules";
import { lossReasonCheckSummary, readLossReasonCheck } from "@/features/post-sale-audit/loss-reason-check";
import { POST_SALE_STAGE_LABELS, POST_SALE_STAGE_TONES, postSaleStage, type PostSaleSurveyRow } from "@/features/post-sale-audit/overview";
import { answerChips, intentDetails, type AnswerChip } from "@/features/post-sale-audit/responses-view";
import { useHrefAllowed } from "@/features/dashboard/components/allowed-link";

import styles from "./post-sale.module.css";

type Message = { id: string; direction: "in" | "out"; body: string; sentAt: string; fromAssistant: boolean };

const DATE_TIME = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" } as const;
const CHIP_TONE: Record<AnswerChip["tone"], "success" | "danger" | undefined> = { good: "success", bad: "danger", neutral: undefined };

export function PostSaleStageBadge({ row }: { row: Pick<PostSaleSurveyRow, "status" | "sentAt" | "lastReplyAt"> }) {
  const stage = postSaleStage(row);
  return <span className={page.badge} data-tone={POST_SALE_STAGE_TONES[stage]}>{POST_SALE_STAGE_LABELS[stage]}</span>;
}

export function PostSaleChips({ row, limit }: { row: PostSaleSurveyRow; limit?: number }) {
  const chips = answerChips(row);
  if (!chips.length) return null;
  const shown = limit ? chips.slice(0, limit) : chips;
  return (
    <span className={styles.chips}>
      {shown.map((chip) => <span key={chip.label} className={page.badge} data-tone={CHIP_TONE[chip.tone]}>{chip.label}</span>)}
      {limit && chips.length > limit ? <span className={page.badge}>+{chips.length - limit}</span> : null}
    </span>
  );
}

export function PostSaleLeadPanel({ row }: { row: PostSaleSurveyRow }) {
  const canOpenConversations = useHrefAllowed()("/conversas");
  const [messages, setMessages] = useState<Message[] | "loading" | string>("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void getPostSaleSurveyMessagesAction(row.id).then((result) => {
      if (active) setMessages(result.ok ? result.data : result.error);
    });
    return () => { active = false; };
  }, [row.id, reload]);

  const lossCheck = readLossReasonCheck(row.answers);
  const details = intentDetails(row.answers);
  const comment = typeof row.answers.comment === "string" ? row.answers.comment : null;
  const reason = typeof row.answers.reason === "string" ? row.answers.reason : null;
  const canResume = (row.status === "sent" || row.status === "answering") && !row.answers.r0 && Boolean(row.sentAt);

  return (
    <div className={styles.panel}>
      <dl className={styles.facts}>
        <dt>Situação</dt><dd><PostSaleStageBadge row={row} /></dd>
        <dt>Corretor</dt><dd>{row.brokerName ?? "Sem corretor"}</dd>
        <dt>Origem</dt><dd>{postSaleRuleLabel(row.ruleKey)}</dd>
        <dt>Enviada</dt><dd>{row.sentAt ? formatLiteDate(row.sentAt, DATE_TIME) : "Ainda não saiu"}</dd>
        {row.sentAt ? <><dt>Entregue</dt><dd>{row.deliveredAt ? formatLiteDate(row.deliveredAt, DATE_TIME) : row.lastReplyAt ? "Sim" : "Sem confirmação"}</dd></> : null}
        {row.sentAt ? <><dt>Lida</dt><dd>{row.readAt ? formatLiteDate(row.readAt, DATE_TIME) : row.lastReplyAt ? "Sim" : "Sem confirmação"}</dd></> : null}
        <dt>Respondeu</dt><dd>{row.lastReplyAt ? formatLiteDate(row.lastReplyAt, DATE_TIME) : "Ainda não"}</dd>
        {row.skipReason ? <><dt>Motivo</dt><dd>{row.skipReason}</dd></> : null}
      </dl>

      <PostSaleChips row={row} />
      {lossCheck ? <p className={styles.detail}>{lossCheck.divergent ? "Motivo de perda diferente do registrado. " : null}{lossReasonCheckSummary(lossCheck)}</p> : null}
      {details.map((line) => <p key={line} className={styles.detail}>{line}</p>)}
      {reason || comment ? <p className={styles.detail}>{reason ? `Motivo: ${reason}. ` : null}{comment ? `Comentário: “${comment}”` : null}</p> : null}

      <section className={page.group} aria-label={`Conversa com ${row.leadName}`}>
        <h3 className={page.sectionTitle}>Conversa da pesquisa</h3>
        <div className={styles.thread} role="log">
          {messages === "loading" ? <p className={styles.detail}>Carregando mensagens…</p>
            : typeof messages === "string" ? <p className={styles.detail}>{messages} <button type="button" className={page.cellLink} onClick={() => { setMessages("loading"); setReload((value) => value + 1); }}>Tentar de novo</button></p>
            : messages.length ? messages.map((message) => (
              <div key={message.id} className={`${styles.bubble} ${message.direction === "in" ? styles.bubbleIn : styles.bubbleOut}`}>
                <p>{message.body}</p>
                <div className={styles.bubbleMeta}>{message.direction === "in" ? "Cliente" : message.fromAssistant ? "Pesquisa" : "Equipe"} · {formatLiteDate(message.sentAt, DATE_TIME)}</div>
              </div>
            ))
            : <p className={styles.detail}>Nenhuma mensagem registrada desde o envio.</p>}
        </div>
      </section>

      <div className={styles.actions}>
        {canResume ? (
          <LiteActionButton
            size="sm"
            busyLabel="Enviando…"
            doneLabel="Retomada enviada"
            keeps="A pesquisa continua aberta."
            onAction={async () => {
              const result = await resumePostSaleSurveyAction(row.id);
              if (result.ok) { setMessages("loading"); setReload((value) => value + 1); }
              return result.ok ? { ok: true } : { ok: false, error: result.error };
            }}
          >
            Retomar agora
          </LiteActionButton>
        ) : null}
        {canOpenConversations ? <Link className={page.button} href={`/conversas?leadId=${row.leadId}`}>Abrir conversa</Link> : null}
        <Link className={page.button} href={`/leads/${encodeURIComponent(row.leadId)}`}>Ver lead</Link>
      </div>
    </div>
  );
}
