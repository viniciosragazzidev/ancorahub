"use client";

/**
 * Filas no Lite (27/11/2026): a tabela no padrão /equipe (mais leads aguardando primeiro), busca, paginação de 20,
 * "Nova fila" como CTA e as configurações no ⋯. A linha abre a gaveta da fila com os mesmos dados e ações de antes.
 */
import { useMemo, useState, type ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { QUEUE_SOURCE_OPTIONS } from "@/features/lead-distribution/routing-catalog";
import { isColdLeadsQueueName } from "@/features/lead-distribution/cold-age-release-rules";
import { cn } from "@/lib/utils";
import { DotsIcon, PlMenu, PlSection, PlSheet, PlusIcon, pl } from "../../plantao/_components/plantoes-1a1-kit";
import { Search1a1, Section1a1, TableFoot1a1, ab, cols, usePages1a1 } from "../abas-1a1-kit";
import { ColdAgeReleaseSection } from "./cold-age-release-section";
import { MetaEntries, type MetaEntriesData } from "./meta-entries";
import { sortQueuesByBacklog } from "./queues-table";
import { assignmentLabel, queueDutyScheduleIds, type DutySchedule, type Queue } from "./types";

type Entries = { campaigns: number; ads: number };

function entriesLabel({ campaigns, ads }: Entries) {
  if (!campaigns && !ads) return "Fila geral";
  return [campaigns ? `${campaigns} campanha${campaigns === 1 ? "" : "s"}` : null, ads ? `${ads} anúncio${ads === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
}

export function QueuesSection1a1({ queues, dutySchedules, entriesByQueue, canEdit, onOpen, onEdit, onDelete, onCreate, settings }: {
  queues: Queue[];
  dutySchedules: DutySchedule[];
  entriesByQueue: Map<string, Entries>;
  canEdit: boolean;
  onOpen: (queue: Queue) => void;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
  onCreate: () => void;
  settings: Array<{ label: ReactNode; onSelect: () => void }>;
}) {
  const [query, setQuery] = useState("");
  const dutyName = useMemo(() => new Map(dutySchedules.map((duty) => [duty.id, duty.name])), [dutySchedules]);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const sorted = sortQueuesByBacklog(queues);
    return needle ? sorted.filter((queue) => queue.name.toLocaleLowerCase("pt-BR").includes(needle) || (queue.branchName ?? "").toLocaleLowerCase("pt-BR").includes(needle)) : sorted;
  }, [queues, query]);
  const pages = usePages1a1(rows, 20);
  const template = "minmax(220px, 1.5fr) 96px minmax(150px, 1fr) 96px 90px 110px minmax(140px, 1fr) minmax(140px, 1fr) 52px";

  return (
    <Section1a1 id="filas-lista" title="Filas de distribuição" count={queues.length}
      lead="Cada fila decide quem recebe, em que ordem e por quais campanhas. Clique numa fila para ver e ajustar."
      actions={(
        <>
          <PlMenu trigger={<>Configurações<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></>}
            triggerClassName={cn(pl.pill, pl.pillQuiet)} items={settings} />
          {canEdit ? <button type="button" className={cn(pl.pill, pl.pillPrimary)} onClick={onCreate}><PlusIcon />Nova fila</button> : null}
        </>
      )}>
      {queues.length ? (
        <>
          <div className={ab.toolbar}><Search1a1 value={query} onChange={(value) => { setQuery(value); pages.setPage(1); }} placeholder="Buscar fila ou unidade" /></div>
          <ScrollArea orientation="horizontal" className={ab.desktopOnly}>
            <div className={ab.table} style={cols(template, 1180)} role="table" aria-label="Filas de distribuição">
              <div className={cn(ab.tr, ab.th)} role="row"><span>Fila</span><span>Status</span><span>Distribuição</span><span className={ab.right}>Aguardando</span><span className={ab.right}>Elegíveis</span><span className={ab.right}>Em atendimento</span><span>Entradas</span><span>Plantão</span><span className={pl.srOnly}>Ações</span></div>
              {pages.pageRows.map((queue) => {
                const duties = queueDutyScheduleIds(queue).map((id) => dutyName.get(id)).filter(Boolean) as string[];
                return (
                  <div key={queue.id} className={cn(ab.tr, ab.trBtn, queue.status !== "active" && ab.trOff)} role="row" tabIndex={0}
                    onClick={() => onOpen(queue)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(queue); } }}
                    aria-label={`Abrir fila ${queue.name}`}>
                    <span className={ab.cellName}><QueueColorDot hue={queue.colorHue} /><span className={ab.cellText}><span className={ab.strong}>{queue.name}</span><span className={ab.sub}>{queue.branchName || "Todas as unidades"}</span></span></span>
                    <span><span className={cn(pl.badge, queue.status === "active" ? pl.bGood : undefined)}>{queue.status === "active" ? "Ativa" : "Pausada"}</span></span>
                    <span className={ab.secondary}>{assignmentLabel(queue)}</span>
                    <span className={cn(ab.right, queue.waiting ? ab.toneWarning : undefined)}>{queue.waiting.toLocaleString("pt-BR")}</span>
                    <span className={ab.right}>{queue.members.toLocaleString("pt-BR")}</span>
                    <span className={ab.right}>{queue.activeLeads.toLocaleString("pt-BR")}</span>
                    <span className={ab.secondary}>{entriesLabel(entriesByQueue.get(queue.id) ?? { campaigns: 0, ads: 0 })}</span>
                    <span className={duties.length ? ab.secondary : ab.muted} title={duties.join(", ")}>{duties.length ? `${duties.slice(0, 2).join(", ")}${duties.length > 2 ? ` +${duties.length - 2}` : ""}` : "-"}</span>
                    <span className={ab.rowMenu} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      {canEdit ? <PlMenu trigger={<DotsIcon />} triggerClassName={cn(pl.iconbtn, pl.iconbtnGhost)} triggerLabel={`Ações da fila ${queue.name}`}
                        items={[{ label: "Editar configuração", onSelect: () => onEdit(queue) }, { label: "Excluir fila", danger: true, onSelect: () => onDelete(queue) }]} /> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className={ab.mobileList}>
            {pages.pageRows.map((queue) => (
              <button key={queue.id} type="button" className={ab.mRow} onClick={() => onOpen(queue)}>
                <QueueColorDot hue={queue.colorHue} />
                <span className={ab.cellText} style={{ flex: 1 }}><span className={ab.strong}>{queue.name}</span><span className={ab.sub}>{assignmentLabel(queue)} · {queue.waiting} aguardando</span></span>
                <span className={cn(pl.badge, queue.status === "active" ? pl.bGood : undefined)}>{queue.status === "active" ? "Ativa" : "Pausada"}</span>
              </button>
            ))}
          </div>
          {rows.length ? null : <div className={ab.empty}><p className={ab.emptyText}>Nenhuma fila com esse nome.</p></div>}
          <TableFoot1a1 pages={pages} noun="filas" label="Páginas das filas" />
        </>
      ) : (
        <div className={ab.empty}>
          <p className={ab.emptyTitle}>Nenhuma fila configurada</p>
          <p className={ab.emptyText}>Crie a primeira fila para tornar a distribuição previsível na operação.</p>
        </div>
      )}
    </Section1a1>
  );
}

/** A gaveta da fila no molde do Lite: números, entradas Meta, configuração, liberação dos frios e as ações. */
export function QueueDetail1a1({ queue, onOpenChange, dutySchedules, brokerNames, meta, canEdit, onEdit, onDelete }: {
  queue: Queue | null;
  onOpenChange: (open: boolean) => void;
  dutySchedules: DutySchedule[];
  brokerNames: Map<string, string>;
  meta: MetaEntriesData;
  canEdit: boolean;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
}) {
  const duties = queue ? queueDutyScheduleIds(queue).map((id) => dutySchedules.find((duty) => duty.id === id)?.name).filter(Boolean) : [];
  const sources = queue ? (queue.allowedSourceIds ?? []).flatMap((id) => QUEUE_SOURCE_OPTIONS.find((source) => source.id === id)?.label ?? []) : [];
  const specificBrokers = queue ? (queue.allowedBrokerIds ?? []).map((id) => brokerNames.get(id) ?? "Corretor removido") : [];
  return (
    <PlSheet open={Boolean(queue)} onOpenChange={onOpenChange} width={560}
      title={queue ? <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><QueueColorDot hue={queue.colorHue} />{queue.name}</span> : ""}
      description={queue ? `${queue.branchName || "Todas as unidades"} · ${assignmentLabel(queue)}` : undefined}
      badges={queue ? <span className={cn(pl.badge, queue.status === "active" ? pl.bGood : undefined)}>{queue.status === "active" ? "Ativa" : "Pausada"}</span> : null}
      footer={queue && canEdit ? (
        <>
          <button type="button" className={cn(pl.pill, pl.pillPrimary, pl.pillWide)} onClick={() => onEdit(queue)}>Editar configuração</button>
          <PlMenu side="top" trigger={<DotsIcon />} triggerClassName={pl.iconbtn} triggerLabel="Mais ações" items={[{ label: "Excluir fila", danger: true, onSelect: () => onDelete(queue) }]} />
        </>
      ) : null}>
      {queue ? (
        <>
          <dl className={ab.metrics}>
            <div className={ab.metric}><dt>Aguardando</dt><dd>{queue.waiting.toLocaleString("pt-BR")}</dd></div>
            <div className={ab.metric}><dt>Elegíveis</dt><dd>{queue.members.toLocaleString("pt-BR")}</dd></div>
            <div className={ab.metric}><dt>Em atendimento</dt><dd>{queue.activeLeads.toLocaleString("pt-BR")}</dd></div>
          </dl>
          <PlSection title="Entradas Meta" hint="Campanhas e anúncios que caem nesta fila. A campanha traz todos os anúncios dela.">
            <div className={ab.panelHost}><MetaEntries queueId={queue.id} data={meta} canEdit={canEdit} /></div>
          </PlSection>
          <PlSection title="Configuração" hint="Como esta fila escolhe o corretor.">
            <dl className={ab.kv}>
              <dt>Distribuição</dt><dd>{assignmentLabel(queue)}</dd>
              <dt>Capacidade</dt><dd>{queue.capacityEnabled ? `${queue.capacityPerBroker} leads por corretor` : "Sem limite"}</dd>
              <dt>Ofertas pendentes</dt><dd>{queue.maxPendingOffersPerBroker ?? 1} por corretor</dd>
              <dt>Qualificação por IA</dt><dd>{queue.aiQualificationEnabled === false ? "Pausada" : "Ativa"}</dd>
              <dt>Não distribuir leads frios no plantão</dt><dd>{queue.holdColdLeads ? "Ligado" : "Desligado"}</dd>
              <dt>Plantões</dt><dd>{duties.length ? duties.join(", ") : "Nenhum"}</dd>
              <dt>Fontes</dt><dd>{sources.length ? sources.join(", ") : "Todas as fontes válidas"}</dd>
              <dt>Corretores</dt><dd>{specificBrokers.length ? specificBrokers.join(", ") : "Todos os elegíveis das unidades"}</dd>
            </dl>
          </PlSection>
          {isColdLeadsQueueName(queue.name) ? <div className={ab.panelHost}><ColdAgeReleaseSection key={queue.id} queueId={queue.id} canEdit={canEdit} /></div> : null}
        </>
      ) : null}
    </PlSheet>
  );
}

/** Gaveta simples das configurações do ⋯ (campanhas não registradas, prazo, política…). */
export function PanelSheet1a1({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <PlSheet open={open} onOpenChange={onOpenChange} title={title} description={description} width={560}>
      <div className={ab.panelHost}>{children}</div>
    </PlSheet>
  );
}
