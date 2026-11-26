"use client";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { classifyTimelineOrigin, filterTimelineByOrigin } from "@/features/leads/timeline-origin";
import { TimelineOriginSegments, TimelineOriginTag, useTimelineOriginFilter } from "@/features/leads/components/timeline-origin-filter";
import type { TimelineItem } from "./supervisor-lead-detail";

const timelineLabels: Record<string, string> = {
  status_change: "Mudança de etapa",
  note: "Nota",
  service_started: "Atendimento iniciado",
  system_alert: "Aviso do sistema",
  quote_generated: "Cotação gerada",
  document_upload: "Documento enviado",
  document_review: "Documento revisado",
  distributed: "Lead distribuído",
  accepted: "Lead aceito",
  declined: "Lead recusado",
};

function timelineLabel(tipo: string) {
  return timelineLabels[tipo] ?? "Atualização";
}

export function SupervisorLeadTimeline({ items, viewerId }: { items: TimelineItem[]; viewerId?: string | null }) {
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const [filter, setFilter] = useTimelineOriginFilter(viewerId);
  const visible = filterTimelineByOrigin(items, filter);
  return <section className="flex flex-col gap-3" aria-labelledby="lead-timeline-title">
    <h2 id="lead-timeline-title" className="text-base font-medium text-(--foreground)">Linha do tempo</h2>
    {items.length ? <TimelineOriginSegments value={filter} onValueChange={setFilter} /> : null}
    {visible.length ? <ol className="grid gap-4">{visible.map((item) => { const origin = classifyTimelineOrigin(item); return <li key={item.id} className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-(--foreground)">{timelineLabel(item.tipo)}<TimelineOriginTag origin={origin} /></span>
      {item.conteudo ? <p className="break-words text-sm text-(--text-secondary)">{item.conteudo}</p> : null}
      <time className="text-xs text-(--text-muted)" dateTime={new Date(item.createdAt).toISOString()}>{origin === "team" && item.userName ? `${item.userName} · ` : ""}{dateFormat.format(new Date(item.createdAt))}</time>
    </li>; })}</ol> : items.length ? <p className="text-sm text-(--text-secondary)">Nada aqui com esse filtro.</p> : <EmptyState title="Ainda não há atualizações neste lead" description="As próximas atividades aparecem aqui." />}
  </section>;
}

