"use client";

/** Histórico de decisões da Saúde, paginado de 8 em 8 (14/11/2026): a lista chega inteira e pagina no cliente. */
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { formatLiteDate } from "@/components/lite/format/date";

import styles from "./director-distribution-health.module.css";

export type DistributionHealthEvent = {
  id: string;
  leadName: string;
  brokerName: string | null;
  queueName: string | null;
  action: string;
  actionLabel: string;
  reason: string | null;
  createdAt: string;
};

export function DirectorDistributionEvents({ events }: { events: DistributionHealthEvent[] }) {
  const { pageRows, pagination } = useLitePages(events, 8);
  if (!events.length) return <p className={styles.empty}>Ainda não há eventos neste escopo.</p>;
  return (
    <>
      <ol className={styles.events}>
        {pageRows.map((event) => (
          <li key={event.id} className={styles.event}>
            <div className={styles.eventCopy}>
              <p><strong>{event.leadName}</strong> <span aria-hidden="true">→</span> {event.brokerName ?? "Aguardando corretor"}</p>
              <p>{event.queueName ?? "Inbox geral"} · {event.actionLabel}{event.reason ? ` · ${event.reason}` : ""}</p>
            </div>
            <time dateTime={event.createdAt}>{formatLiteDate(event.createdAt, { dateStyle: "short", timeStyle: "short" })}</time>
          </li>
        ))}
      </ol>
      <LitePagination {...pagination} label="Páginas do histórico" />
    </>
  );
}
