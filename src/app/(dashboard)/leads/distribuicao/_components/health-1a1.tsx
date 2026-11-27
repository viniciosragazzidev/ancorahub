"use client";

/**
 * Saúde da distribuição no Lite (27/11/2026): histórico de decisões em tabela paginada (a linha abre a gaveta com o
 * detalhe), automação da fila e efeitos de entrada em cartões, com as exceções na gaveta. Mesmos dados e textos de antes.
 */
import { useMemo, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { formatLiteDate } from "@/components/lite/format/date";
import { cn } from "@/lib/utils";
import { PlSheet, pl } from "../plantao/_components/plantoes-1a1-kit";
import { Search1a1, Section1a1, TableFoot1a1, ab, cols, usePages1a1 } from "./abas-1a1-kit";

type Health = { pending: number; retrying: number; processing: number; failed: number; completed: number };
type EventRow = { id: string; leadName: string; brokerName: string | null; queueName: string | null; action: string; reason: string | null; createdAt: string };
type FailedEffect = { id: string; leadName: string; type: string; attemptCount: number; lastErrorCode: string | null; lastErrorMessage: string | null };

function eventActionLabel(action: string) {
  const labels: Record<string, string> = {
    "lead.assigned": "Lead atribuído",
    lead_assigned: "Lead atribuído",
    "lead.routed_to_unit": "Lead enviado à unidade",
    lead_returned_to_queue: "Lead devolvido à fila",
    "lead.assignment_recovered": "Atribuição recuperada",
    lead_offer_accepted: "Oferta aceita",
    lead_offer_expired: "Oferta expirada",
  };
  return labels[action] ?? "Atualização de distribuição";
}

function effectTypeLabel(type: string) {
  const labels: Record<string, string> = { assignment: "Atribuição de lead", notify_broker: "Aviso ao corretor", update_meta_status: "Atualização na Meta" };
  return labels[type] ?? "Ação de integração";
}

const fmt = (value: number) => value.toLocaleString("pt-BR");
const when = (iso: string) => formatLiteDate(iso, { dateStyle: "short", timeStyle: "short" });

export function DistributionHealth1a1({ events, jobs, jobsAvailable, jobsEnabled, effects, failedEffects }: {
  events: EventRow[];
  jobs: Health;
  jobsAvailable: boolean;
  jobsEnabled: boolean;
  effects: Health;
  failedEffects: FailedEffect[];
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const all = events.map((event) => ({ ...event, actionLabel: eventActionLabel(event.action) }));
    if (!needle) return all;
    return all.filter((event) => [event.leadName, event.brokerName, event.queueName, event.actionLabel, event.reason].some((text) => text?.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [events, query]);
  const pages = usePages1a1(rows, 20);
  const open = rows.find((event) => event.id === openId) ?? null;

  const jobLabel = !jobsAvailable ? "Aguardando configuração" : !jobsEnabled ? "Pausada" : jobs.failed > 0 ? "Requer atenção" : "Ativa";
  const jobTone = !jobsAvailable || !jobsEnabled ? "" : jobs.failed ? pl.bWarn : pl.bGood;
  const effectLabel = effects.failed > 0 ? "Requer revisão" : "Íntegro";
  const template = "minmax(200px, 1.4fr) minmax(160px, 1fr) minmax(140px, 1fr) minmax(170px, 1fr) minmax(160px, 1.2fr) 150px";

  return (
    <>
      <Section1a1 id="saude-historico" title="Histórico de decisões" count={events.length} lead="Atribuições, redistribuições e intervenções deste escopo.">
        {events.length ? (
          <>
            <div className={ab.toolbar}><Search1a1 value={query} onChange={(value) => { setQuery(value); pages.setPage(1); }} placeholder="Buscar lead, corretor ou fila" /></div>
            <ScrollArea orientation="horizontal" className={ab.desktopOnly}>
              <div className={ab.table} style={cols(template, 1000)} role="table" aria-label="Histórico de decisões">
                <div className={cn(ab.tr, ab.th)} role="row"><span>Lead</span><span>Corretor</span><span>Fila</span><span>Decisão</span><span>Motivo</span><span>Quando</span></div>
                {pages.pageRows.map((event) => (
                  <button key={event.id} type="button" className={cn(ab.tr, ab.trBtn)} role="row" onClick={() => setOpenId(event.id)} aria-label={`Abrir decisão de ${event.leadName}`}>
                    <span className={ab.strong}>{event.leadName}</span>
                    <span className={event.brokerName ? ab.secondary : ab.muted}>{event.brokerName ?? "Aguardando corretor"}</span>
                    <span className={ab.secondary}>{event.queueName ?? "Inbox geral"}</span>
                    <span><span className={pl.badge}>{event.actionLabel}</span></span>
                    <span className={ab.secondary}>{event.reason ?? "-"}</span>
                    <span className={cn(ab.muted, pl.num)} style={{ whiteSpace: "nowrap" }}>{when(event.createdAt)}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className={ab.mobileList}>
              {pages.pageRows.map((event) => (
                <button key={event.id} type="button" className={ab.mRow} onClick={() => setOpenId(event.id)}>
                  <span className={ab.cellText} style={{ flex: 1 }}><span className={ab.strong}>{event.leadName}</span><span className={ab.sub}>{event.brokerName ?? "Aguardando corretor"} · {event.actionLabel}</span></span>
                  <span className={cn(ab.muted, pl.num)} style={{ fontSize: 12 }}>{when(event.createdAt)}</span>
                </button>
              ))}
            </div>
            {rows.length ? null : <p className={ab.empty}><span className={ab.emptyText}>Nenhuma decisão com esse termo.</span></p>}
            <TableFoot1a1 pages={pages} noun="decisões" label="Páginas do histórico" />
          </>
        ) : <div className={ab.empty}><p className={ab.emptyText}>Ainda não há eventos neste escopo.</p></div>}
      </Section1a1>

      <div className={ab.grid2}>
        <Section1a1 id="saude-automacao" title="Automação da fila" delay={160} actions={<span className={cn(pl.badge, jobTone)}>{jobLabel}</span>}>
          <div className={ab.sectionBody}>
            <dl className={ab.metrics}>
              <div className={ab.metric}><dt>Aguardando</dt><dd>{fmt(jobs.pending + jobs.retrying)}</dd></div>
              <div className={ab.metric}><dt>Em processamento</dt><dd>{fmt(jobs.processing)}</dd></div>
              <div className={ab.metric}><dt>Exceções</dt><dd className={jobs.failed ? ab.toneWarning : undefined}>{fmt(jobs.failed)}</dd></div>
            </dl>
            <p className={ab.note}>{jobs.failed ? "Exceções para revisão da gestão." : jobs.pending + jobs.retrying ? "O motor tentará distribuir as pendências." : "Nenhuma pendência automática."}</p>
          </div>
        </Section1a1>
        <Section1a1 id="saude-efeitos" title="Efeitos de entrada" delay={200} actions={<span className={cn(pl.badge, effects.failed ? pl.bWarn : pl.bGood)}>{effectLabel}</span>}>
          <div className={ab.sectionBody}>
            <dl className={ab.metrics}>
              <div className={ab.metric}><dt>Aguardando</dt><dd>{fmt(effects.pending + effects.retrying)}</dd></div>
              <div className={ab.metric}><dt>Processando</dt><dd>{fmt(effects.processing)}</dd></div>
              <div className={ab.metric}><dt>Exceções</dt><dd className={effects.failed ? ab.toneWarning : undefined}>{fmt(effects.failed)}</dd></div>
              <div className={ab.metric}><dt>Concluídos</dt><dd>{fmt(effects.completed)}</dd></div>
            </dl>
            {failedEffects.length ? (
              <button type="button" className={cn(pl.pill, pl.pillQuiet)} style={{ alignSelf: "flex-start" }} onClick={() => setFailuresOpen(true)}>
                Ver {failedEffects.length} {failedEffects.length === 1 ? "efeito que falhou" : "efeitos que falharam"}
              </button>
            ) : <p className={ab.note}>Nenhum efeito pendente de revisão.</p>}
          </div>
        </Section1a1>
      </div>

      <PlSheet open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }} title={open?.leadName ?? ""} description={open ? when(open.createdAt) : undefined}
        badges={open ? <span className={pl.badge}>{open.actionLabel}</span> : null}>
        {open ? (
          <dl className={ab.kv}>
            <dt>Corretor</dt><dd>{open.brokerName ?? "Aguardando corretor"}</dd>
            <dt>Fila</dt><dd>{open.queueName ?? "Inbox geral"}</dd>
            <dt>Decisão</dt><dd>{open.actionLabel}</dd>
            <dt>Motivo</dt><dd>{open.reason ?? "-"}</dd>
            <dt>Quando</dt><dd className={pl.num}>{when(open.createdAt)}</dd>
          </dl>
        ) : null}
      </PlSheet>

      <PlSheet open={failuresOpen} onOpenChange={setFailuresOpen} title="Efeitos que falharam" description="A integração precisa de revisão.">
        <ul className={pl.rows} aria-label="Efeitos que falharam">
          {failedEffects.map((effect) => (
            <li key={effect.id} className={ab.failRow}>
              <strong>{effect.leadName} · {effectTypeLabel(effect.type)}</strong>
              <span>{effect.lastErrorMessage ?? "A integração precisa de revisão."} · {effect.attemptCount} tentativas</span>
            </li>
          ))}
        </ul>
      </PlSheet>
    </>
  );
}
