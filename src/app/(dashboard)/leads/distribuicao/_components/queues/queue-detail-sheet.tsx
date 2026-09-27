"use client";

import type { ReactNode } from "react";

import { PencilSimple, Trash } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetSection,
  SheetSectionHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QUEUE_SOURCE_OPTIONS } from "@/features/lead-distribution/routing-catalog";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { MetaEntries, type MetaEntriesData } from "./meta-entries";
import { assignmentLabel, queueDutyScheduleIds, type DutySchedule, type Queue } from "./types";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 px-4 py-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <SheetSectionHeader>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </SheetSectionHeader>
  );
}

/** Everything about one queue, opened from its table row. */
export function QueueDetailSheet({
  queue,
  onOpenChange,
  dutySchedules,
  brokerNames,
  meta,
  canEdit,
  onEdit,
  onDelete,
}: {
  queue: Queue | null;
  onOpenChange: (open: boolean) => void;
  dutySchedules: DutySchedule[];
  brokerNames: Map<string, string>;
  meta: MetaEntriesData;
  canEdit: boolean;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
}) {
  const duties = queue
    ? queueDutyScheduleIds(queue).map((id) => dutySchedules.find((duty) => duty.id === id)?.name).filter(Boolean)
    : [];
  const sources = queue
    ? (queue.allowedSourceIds ?? []).flatMap((id) => QUEUE_SOURCE_OPTIONS.find((source) => source.id === id)?.label ?? [])
    : [];
  const specificBrokers = queue ? (queue.allowedBrokerIds ?? []).map((id) => brokerNames.get(id) ?? "Corretor removido") : [];

  return (
    <Sheet open={Boolean(queue)} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,36rem)]">
        {queue ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <QueueColorDot hue={queue.colorHue} className="size-2.5" />
                {queue.name}
                <Badge variant={queue.status === "active" ? "success" : "outline"}>
                  {queue.status === "active" ? "Ativa" : "Pausada"}
                </Badge>
              </SheetTitle>
              <SheetDescription>{queue.branchName || "Todas as unidades"} · {assignmentLabel(queue)}</SheetDescription>
            </SheetHeader>
            <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
              <dl className="grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/80 bg-card">
                {[
                  { label: "Aguardando", value: queue.waiting },
                  { label: "Elegíveis", value: queue.members },
                  { label: "Em atendimento", value: queue.activeLeads },
                ].map((metric) => (
                  <div key={metric.label} className="px-4 py-3">
                    <dt className="text-[11px] text-muted-foreground">{metric.label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{metric.value}</dd>
                  </div>
                ))}
              </dl>

              <SheetSection>
                <SectionTitle title="Entradas Meta" description="Campanhas e anúncios que caem nesta fila. A campanha traz todos os anúncios dela." />
                <div className="p-4">
                  <MetaEntries queueId={queue.id} data={meta} canEdit={canEdit} />
                </div>
              </SheetSection>

              <SheetSection>
                <SheetSectionHeader>
                  <div>
                    <p className="text-sm font-semibold">Configuração</p>
                    <p className="text-xs text-muted-foreground">Como esta fila escolhe o corretor.</p>
                  </div>
                  {canEdit ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onEdit(queue)}>
                      <PencilSimple className="size-3.5" /> Editar
                    </Button>
                  ) : null}
                </SheetSectionHeader>
                <dl className="divide-y divide-border/60 py-1">
                  <Detail label="Distribuição">{assignmentLabel(queue)}</Detail>
                  <Detail label="Capacidade">{queue.capacityEnabled ? `${queue.capacityPerBroker} leads por corretor` : "Sem limite"}</Detail>
                  <Detail label="Intervalo entre ofertas">{queue.offerIntervalMinutes ?? 5} min</Detail>
                  <Detail label="Ofertas pendentes">{queue.maxPendingOffersPerBroker ?? 1} por corretor</Detail>
                  <Detail label="Qualificação por IA">{queue.aiQualificationEnabled === false ? "Pausada" : "Ativa"}</Detail>
                  <Detail label="Plantões">{duties.length ? duties.join(", ") : "Nenhum"}</Detail>
                  <Detail label="Fontes">{sources.length ? sources.join(", ") : "Todas as fontes válidas"}</Detail>
                  <Detail label="Corretores">{specificBrokers.length ? specificBrokers.join(", ") : "Todos os elegíveis das unidades"}</Detail>
                </dl>
              </SheetSection>

              {canEdit ? (
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(queue)}>
                    <Trash className="size-3.5" /> Excluir fila
                  </Button>
                </div>
              ) : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** A plain drawer used by the page "⋯" menu (ignored campaigns, SLA, policy…). */
export function PanelSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,36rem)]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        {/* Panels reused from the page are full Cards: the drawer already has the
            title, so drop the card chrome and its header here. */}
        <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4 [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:bg-transparent [&>[data-slot=card]>[data-slot=card-header]]:hidden [&>[data-slot=card]>[data-slot=card-content]]:p-0">
          {children}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
