import type { CSSProperties, ReactNode } from "react";

import { ArrowRight, Bell, BellRinging, CalendarCheck, Clock, TriangleAlertIcon, Warning, XCircle } from "@/components/huge-icons";

import css from "./notice-card.module.css";

/**
 * One notice (Notificações and the Âncora conversation share it): colored icon
 * by who it is about, title and time, message, a category tag and where it
 * leads, plus the unread dot. Presentational only; the caller wraps it in a
 * link or a button.
 */
export type NoticePriority = "urgent" | "attention" | "info";
export type NoticeCategory = "gestao" | "lead" | "plantao" | "alerta" | "info";

export function noticePriority(type: string): NoticePriority {
  if (["lead_unworked", "lead_stalled", "document_rejected"].includes(type)) return "urgent";
  if (["agent.lead_assigned", "lead_feedback_reminder", "client_renewal_reminder"].includes(type)) return "attention";
  return "info";
}

/** Who the notice is about, for the color of its icon (same idea as the assistants' colors). */
export function noticeCategory(item: { type: string; leadId: string | null }): NoticeCategory {
  if (noticePriority(item.type) === "urgent") return "alerta";
  if (item.type.startsWith("relationship.") || item.type === "manager_note") return "gestao";
  if (item.type.includes("duty") || item.type.includes("plantao")) return "plantao";
  if (item.leadId || item.type.startsWith("lead") || item.type.includes("lead")) return "lead";
  return "info";
}

export const NOTICE_CATEGORY_LABEL: Record<NoticeCategory, string> = { gestao: "Gestão", lead: "Lead", plantao: "Plantão", alerta: "Ação necessária", info: "Aviso" };

/** Where a tap on the notice goes, and what the link says. */
export function noticeLink(item: { type: string; leadId: string | null }): { href: string; label: string } | null {
  if (item.type === "situation_suggestion") return { href: "/atendimento/situacoes?view=sugestoes", label: "Revisar sugestão" };
  if (item.leadId) return { href: `/leads/${item.leadId}`, label: "Abrir lead" };
  return null;
}

export function NoticeIcon({ type, className, style }: { type: string; className?: string; style?: CSSProperties }) {
  if (type === "lead_unworked") return <Warning className={className} style={style} />;
  if (type === "lead_stalled") return <TriangleAlertIcon className={className} style={style} />;
  if (type === "document_rejected") return <XCircle className={className} style={style} />;
  if (type === "lead_feedback_reminder") return <Clock className={className} style={style} />;
  if (type === "client_renewal_reminder") return <CalendarCheck className={className} style={style} />;
  if (type === "lead_reengagement") return <BellRinging className={className} style={style} />;
  return <Bell className={className} style={style} />;
}

/** The inside of a notice row: icon, text, tag, link hint and the unread dot. */
export function NoticeCardBody({ type, leadId, title, message, time, timeIso, unread, linkLabel, extra }: {
  type: string;
  leadId: string | null;
  title: string;
  message: string | null;
  time: string;
  timeIso: string;
  unread: boolean;
  linkLabel?: string | null;
  extra?: ReactNode;
}) {
  const category = noticeCategory({ type, leadId });
  return (
    <>
      <span className={`${css.icon} ${css[category]}`} aria-hidden="true">
        <NoticeIcon type={type} className="size-5" />
      </span>
      <span className={css.text}>
        <span className={css.top}>
          <span className={`${css.title} ${unread ? css.titleUnread : ""}`}>{title}</span>
          <time dateTime={timeIso} className={css.time}>{time}</time>
        </span>
        {message && message !== title ? <span className={css.message}>{message}</span> : null}
        <span className={css.meta}>
          <span className={`${css.tag} ${css[category]}`}>{NOTICE_CATEGORY_LABEL[category]}</span>
          {linkLabel ? <span className={css.open}>{linkLabel} <ArrowRight className="size-3" aria-hidden="true" /></span> : null}
          {extra}
        </span>
      </span>
      {unread ? <><span className={css.dot} aria-hidden="true" /><span className="sr-only">Não lida</span></> : null}
    </>
  );
}

export const noticeRowClass = css.row;
