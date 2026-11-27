/**
 * Página do plantão 1:1 (27/11/2026, artifact "Página do plantão"): a marcação inteira do Lite, alimentada por props já
 * prontas. A página real monta as props com os dados do servidor; a prévia `/dev/diretor-shell-real?tela=plantao` usa
 * dados de exemplo. Ordem do artifact: voltar, topo, ocorrências, números, escala e leads.
 */
import type { ReactNode } from "react";
import Link from "next/link";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { BrokerOccurrence1a1, type BrokerOccurrence1a1Props } from "./broker-occurrence-1a1";
import { BrokerDayHistoryTrigger } from "./broker-day-history-trigger";
import { DutyLeadsCutControl } from "./duty-leads-cut-control";
import { DutyTurnAutoRefresh } from "./duty-turn-auto-refresh";
import { DutyTurnSortableGrid } from "./duty-turn-sortable-grid";
import { PlantaoActions, PlantaoHistoryDistributions, PlantaoLeadsTable, PlantaoPendingRoster, PlantaoSinceControl, PlantaoTurnStrip, type PlantaoLeadRow } from "./plantao-pagina-1a1";
import { TypeDot } from "./plantoes-1a1-kit";
// Este arquivo roda no servidor: as classes e funções vêm direto daqui, nunca de um módulo "use client" (lá elas chegam
// como referência de cliente e a página saía sem estilo em produção, 27/11/2026).
import pp from "./plantao-pagina-1a1.module.css";
import pl from "./plantoes-1a1.module.css";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("pt-BR");
}

type Tone = "good" | "info" | "warn" | "neutral";
const TONE: Record<Tone, string> = { good: pl.bGood, info: pl.bInfo, warn: pl.bWarn, neutral: "" };

export type PlantaoPaginaHeader = {
  state: { label: string; tone: Tone; live: boolean };
  typeName: string | null;
  typeHue: number | null;
  recurrence: string;
  modality: string;
  title: string;
  dayLabel: string;
  branchLabel: string;
  queueLabel: string;
};

/** `short`: o rótulo e o detalhe curtos do Celular.dc.html. */
type Stat = { label: string; value: ReactNode; detail: string; warn?: boolean; shortLabel?: string; shortDetail?: string };
type Occurrences = { items: Array<{ key: string; label: string; href: string; current: boolean }>; dateDefault?: string } | null;
type EscalarInput = { scheduleId: string; scheduleName: string; date: string; brokers: Array<{ id: string; name: string; internalCode: string | null; branchId: string | null }> } | null;

export type PlantaoPaginaEscala = {
  title: string;
  /** Celular: "Escala". */
  shortTitle: string;
  badge: string;
  badgeGood: boolean;
  sub: string;
  turn: { scheduleName: string; previous: { id: string; name: string; offeredAt: string; outcome?: "accepted" | "skip" | "waiting" } | null; current: { id: string; name: string; offeredAt: string } | null; nextName: string | null } | null;
  autoRefresh: boolean;
  startIntervalText: string | null;
  rotationText: string | null;
  noneEligible: boolean;
  sections: Array<{
    key: string;
    label: string | null;
    count: number;
    groups: Array<{ key: string; label: string; cards: BrokerOccurrence1a1Props[]; sortable: { scheduleId: string; dutyDate: string; order: string[]; queue: string[] } | null }>;
  }>;
  emptyText: string | null;
  pending: { scheduleId: string; entries: Array<{ entryId: string; id: string; name: string; internalCode: string | null; branchName: string | null }>; candidates: Array<{ id: string; name: string; internalCode: string | null; branchName: string | null }> };
};

export type PlantaoPaginaLeads = {
  count: number;
  sub: string;
  filters: Array<{ key: string; label: string; count: number; href: string; active: boolean }>;
  since: null | {
    choices: Array<{ value: string; label: string; href: string; active: boolean }>;
    customActive: boolean;
    customValue: string | null;
    customError: string | null;
    customBaseHref: string;
    cut: { scheduleId: string; cutAt: string };
  };
  queueTabs: Array<{ key: string; label: string; count: number; href: string; active: boolean }>;
  channelTabs: Array<{ key: string; label: string; count: number; href: string; active: boolean }>;
  groups: Array<{ key: string; label: string; leads: PlantaoLeadRow[] }>;
  empty: string | null;
  drawer: Parameters<typeof PlantaoLeadsTable>[0]["drawer"];
};

export type PlantaoPaginaHistory = {
  scheduleId: string;
  dutyDate: string;
  brokers: Array<{ brokerId: string; brokerName: string; branchName: string | null; onRoster: boolean; leads: number }>;
  rosterCount: number;
  distributions: Array<{ id: string; leadName: string; brokerName: string; assignedAt: string; kind: string; exact: boolean }>;
  truncated: boolean;
};

const SORTABLE = { wrap: pp.sortWrap, over: pp.sortWrapOver, drag: pp.sortWrapDrag, grip: pp.sortGrip, overlay: pp.dragOverlay, withGrip: pp.withGrip };

function Tabs({ label, tabs }: { label: string; tabs: PlantaoPaginaLeads["channelTabs"] }) {
  return (
    <ScrollArea orientation="horizontal">
      <nav className={pp.tabs} aria-label={label}>
        {tabs.map((tab) => <Link key={tab.key} href={tab.href} className={pp.tab} aria-current={tab.active ? "page" : undefined}>{tab.label}<span className={pp.tabCount}>{tab.count}</span></Link>)}
      </nav>
    </ScrollArea>
  );
}

export function PlantaoPagina1a1({ backHref, header, actions, invalidDateMessage, occurrences, stats, escala, leads, history, managerNote }: {
  backHref: string;
  header: PlantaoPaginaHeader;
  actions: { scheduleId: string; canExport: boolean; reportDate?: string | null; escalar: EscalarInput };
  invalidDateMessage: string | null;
  occurrences: Occurrences;
  stats: Stat[];
  escala?: PlantaoPaginaEscala;
  leads?: PlantaoPaginaLeads;
  history?: PlantaoPaginaHistory;
  managerNote: boolean;
}) {
  return (
    <main className={cn("arc-venancor", pl.gx, pp.page)} data-skin="diretor">
      <Link className={pp.back} href={backHref}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>Plantões</Link>

      <header className={cn(pp.top, pl.in)}>
        <div className={pp.topText}>
          <span className={pp.badges}>
            <span className={cn(pl.badge, TONE[header.state.tone])}>{header.state.live ? <span className={pl.dot} style={{ background: "var(--success)" }} aria-hidden="true" /> : null}{header.state.label}</span>
            <span className={pl.badge}><TypeDot hue={header.typeHue} name={header.typeName} />{header.typeName ?? "Sem tipo"}</span>
            <span className={pl.badge}>{header.recurrence}</span>
            <span className={pl.badge}>{header.modality}</span>
          </span>
          <h1 className={pp.h1}>{header.title}</h1>
          <p className={pp.detail}>{header.dayLabel}<span className={pp.detailLong}> · {header.branchLabel}</span> · {header.queueLabel}</p>
        </div>
        <PlantaoActions {...actions} />
      </header>

      {invalidDateMessage ? <p role="alert" className={pp.alert}>{invalidDateMessage}</p> : null}

      {occurrences ? (
        <section className={cn(pp.occRow, pl.in)} aria-label="Ocorrências" style={{ animationDelay: "40ms" }}>
          <span className={pp.occLabel}>Ocorrência</span>
          <ScrollArea className={pp.occChips} orientation="horizontal">
            <div className={pp.chipsInner}>
              {occurrences.items.map((item) => <Link key={item.key} className={pp.occ} href={item.href} aria-current={item.current ? "page" : undefined}>{item.label}</Link>)}
            </div>
          </ScrollArea>
          <form method="get" className={pp.dateForm}>
            <label><span className={pl.srOnly}>Outra data</span><input className={pp.input} type="date" name="data" defaultValue={occurrences.dateDefault} /></label>
            <button type="submit" className={cn(pl.pill, pl.pillQuiet, pl.pillSm)}>Consultar</button>
          </form>
        </section>
      ) : null}

      <section className={cn(pp.stats, pl.in)} aria-label="Resumo do plantão" style={{ animationDelay: "80ms" }}>
        {stats.map((stat) => (
          <article key={stat.label} className={cn(pl.card, pl.stat)}>
            <p className={pl.statLabel}><span className={pp.long}>{stat.label}</span><span className={pp.short}>{stat.shortLabel ?? stat.label}</span></p>
            <p className={pl.statValue} style={stat.warn ? { color: "var(--warning)" } : undefined}>{stat.value}</p>
            <p className={pl.statDetail}><span className={pp.long}>{stat.detail}</span><span className={pp.short}>{stat.shortDetail ?? stat.detail}</span></p>
          </article>
        ))}
      </section>

      {escala ? (
        <section className={cn(pl.card, pl.in, pp.escala)} aria-labelledby="plantao-escala" style={{ animationDelay: "120ms" }}>
          <div className={pp.headRow}>
            <div className={pp.headText}>
              <h2 id="plantao-escala" className={pp.h2}><span className={pp.long}>{escala.title}</span><span className={pp.short}>{escala.shortTitle}</span> <span className={cn(pl.badge, pl.num, escala.badgeGood && pl.bGood)}>{escala.badge}</span></h2>
              <p className={cn(pp.sub, pp.hideMobile)}>{escala.sub}</p>
            </div>
            {escala.turn ? <span className={cn(pl.badge, pl.bGood, pp.hideMobile)}><span className={pl.dot} style={{ background: "var(--success)" }} aria-hidden="true" />Ao vivo</span> : null}
          </div>
          {escala.autoRefresh ? <DutyTurnAutoRefresh /> : null}
          {escala.turn ? <PlantaoTurnStrip {...escala.turn} /> : null}
          {escala.startIntervalText ? <p role="status" className={pp.note}>{escala.startIntervalText}</p> : null}
          {escala.rotationText ? <p className={pp.note}>{escala.rotationText}</p> : null}
          {escala.noneEligible ? <p role="alert" className={pp.alert}><span style={{ fontWeight: 500 }}>Nenhum escalado está elegível para receber leads.</span> Há pendências de cadastro ou confirmação; os leads seguem aguardando.</p> : null}
          {escala.sections.map((section) => (
            <section key={section.key} aria-label={section.label ?? "Escalados"} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {section.label ? <h3 className={pp.shiftTitle}>{section.label}<span className={pp.groupCount}>{section.count}</span></h3> : null}
              {section.groups.length ? section.groups.map((group) => {
                const items = group.cards.map((card) => ({ key: `${section.key}:${card.assignmentId}`, id: card.brokerId, name: card.brokerName, node: <BrokerOccurrence1a1 key={`${section.key}:${card.assignmentId}`} {...card} /> }));
                return (
                  <div key={group.key} className={group.key === "absent" ? pp.split : undefined} style={group.key === "absent" ? undefined : { display: "flex", flexDirection: "column", gap: 8 }}>
                    <h3 className={pp.groupTitle}>{group.label}<span className={pp.groupCount}>{group.cards.length}</span></h3>
                    {items.length ? (group.sortable
                      ? <DutyTurnSortableGrid {...group.sortable} items={items} className={pp.grid} lite={SORTABLE} />
                      : <div className={pp.grid}>{items.map((item) => <div key={item.key} style={{ minWidth: 0 }}>{item.node}</div>)}</div>)
                      : <p className={pl.empty}>Ninguém nesta seção.</p>}
                  </div>
                );
              }) : <p className={pl.empty}>Ninguém escalado neste turno.</p>}
            </section>
          ))}
          {escala.emptyText ? <p className={pl.emptyBox}>{escala.emptyText}</p> : null}
          <PlantaoPendingRoster {...escala.pending} />
        </section>
      ) : null}

      {leads ? (
        <section className={cn(pl.card, pl.in, pp.leads)} aria-labelledby="plantao-leads" style={{ animationDelay: "160ms" }}>
          <div className={pp.leadsHead}>
            <div className={pp.headText}>
              <h2 id="plantao-leads" className={pp.h2}>Leads do plantão <span className={cn(pl.badge, pl.num)}>{leads.count}</span></h2>
              <p className={pp.sub}>{leads.sub}</p>
            </div>
            <nav className={pp.segment} aria-label="Situação dos leads">
              {leads.filters.map((item) => <Link key={item.key} href={item.href} className={pp.segbtn} aria-current={item.active ? "page" : undefined}>{item.label}<span className={pp.segCount}>{item.count}</span></Link>)}
            </nav>
          </div>
          {leads.since ? (
            <PlantaoSinceControl
              choices={leads.since.choices}
              customActive={leads.since.customActive}
              customValue={leads.since.customValue}
              customError={leads.since.customError}
              customBaseHref={leads.since.customBaseHref}
              cut={<DutyLeadsCutControl scheduleId={leads.since.cut.scheduleId} cutAt={leads.since.cut.cutAt} lite={{ link: pp.cutLink, input: cn(pp.input, pp.inputSm), primary: cn(pl.pill, pl.pillPrimary, pl.pillSm), ghost: cn(pl.pill, pl.pillGhost, pl.pillSm) }} />}
            />
          ) : null}
          {leads.queueTabs.length ? <Tabs label="Filtrar leads aguardando distribuição por fila" tabs={leads.queueTabs} /> : null}
          <Tabs label="Filtrar leads por canal de entrada" tabs={leads.channelTabs} />
          <PlantaoLeadsTable groups={leads.groups} empty={leads.empty} emptyGroup="Nenhum lead distribuído neste turno." drawer={leads.drawer} />
        </section>
      ) : null}

      {history ? (
        <>
          <section className={cn(pl.card, pl.in, pp.escala)} aria-labelledby="historico-escalados" style={{ animationDelay: "120ms" }}>
            <div className={pp.headText}>
              <h2 id="historico-escalados" className={pp.h2}>Corretores escalados <span className={cn(pl.badge, pl.num)}>{history.rosterCount}</span></h2>
              <p className={pp.sub}>Leads recebidos por corretor neste turno. Alterações posteriores podem limitar a reconstituição de turnos antigos.</p>
            </div>
            {history.brokers.length ? (
              <div className={pp.grid}>
                {history.brokers.map((entry) => (
                  <div key={entry.brokerId} className={pp.bc} style={{ cursor: "default" }}>
                    <span className={pp.bcRow}>
                      <span className={pl.av} aria-hidden="true">{initials(entry.brokerName)}</span>
                      <span className={pp.bcBody}><BrokerDayHistoryTrigger scheduleId={history.scheduleId} brokerId={entry.brokerId} brokerName={entry.brokerName} dutyDate={history.dutyDate} /><span className={pp.bcMeta}>{entry.branchName ?? "Sem unidade"}{entry.onRoster ? "" : " · fora da escala (recebeu lead)"}</span></span>
                      <span className={cn(pl.badge, pl.num, entry.leads ? pl.bInfo : "")}>{entry.leads} {entry.leads === 1 ? "lead" : "leads"}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className={pl.emptyBox}>Nenhum vínculo de escala encontrado para esta data.</p>}
          </section>
          <section className={cn(pl.card, pl.in, pp.leads)} aria-labelledby="historico-leads" style={{ animationDelay: "160ms" }}>
            <div className={pp.leadsHead}>
              <div className={pp.headText}>
                <h2 id="historico-leads" className={pp.h2}>Leads distribuídos <span className={cn(pl.badge, pl.num)}>{history.distributions.length}</span></h2>
                <p className={pp.sub}>Aceites e atribuições deste turno. O vínculo antigo pode ser estimado quando a fila era compartilhada.</p>
              </div>
            </div>
            <PlantaoHistoryDistributions rows={history.distributions} />
            {history.truncated ? <p className={pp.groupEmpty}>Exibindo os primeiros 200 registros deste período.</p> : null}
          </section>
        </>
      ) : null}

      {managerNote ? <p className={pl.small}>Você está vendo apenas dados da sua unidade.</p> : null}
    </main>
  );
}
