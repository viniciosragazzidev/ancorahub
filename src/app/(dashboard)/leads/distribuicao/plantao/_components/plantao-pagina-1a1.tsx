"use client";

/**
 * Página do plantão 1:1 (27/11/2026, artifact "Página do plantão"): ações do topo, "Considerar leads a partir de" com o
 * personalizado, rodízio, tabela de leads, convites pendentes e histórico de uma ocorrência encerrada. Marcação nova
 * com o CSS do artifact (plantao-pagina-1a1.module.css) e o kit da aba Plantões.
 */
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { motionTokens } from "@/components/arc/motion-tokens";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { addPendingRosterEntryAction, removePendingRosterEntryAction } from "@/features/lead-distribution/duty-roster-pending-actions";
import type { DutyQueueOrderPreview } from "@/features/lead-distribution/duty-queue-order-queries";

import { plantaoDone, plantaoFailed } from "./plantao-feedback";
import { DotsIcon, PlMenu, initials, pl } from "./plantoes-1a1-kit";
import { DutyLeadDetailsTrigger } from "./duty-lead-details-trigger";
import { ScheduleEscalarButton } from "./schedule-escalar-button";
import type { DutyLeadRecord } from "./director-duty-leads";
import pp from "./plantao-pagina-1a1.module.css";

export { pp };

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}
function DownloadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
}
function ChevronDown() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" style={{ width: 14, height: 14 }}><path d="m6 9 6 6 6-6" /></svg>;
}

type EscalarInput = { scheduleId: string; scheduleName: string; date: string; brokers: Array<{ id: string; name: string; internalCode: string | null; branchId: string | null }> };

/** Topo: "Exportar ▾" (PDF e planilha) e "Escalar corretor", a ação primária. No celular: Escalar largo + exportar no ícone. */
export function PlantaoActions({ scheduleId, canExport, reportDate, escalar }: { scheduleId: string; canExport: boolean; reportDate?: string | null; escalar: EscalarInput | null }) {
  const suffix = reportDate ? `?data=${encodeURIComponent(reportDate)}` : "";
  const exportItems = canExport ? [
    { label: reportDate ? "Relatório desta ocorrência" : "PDF do plantão", onSelect: () => window.location.assign(`/api/reports/duty-schedule/${scheduleId}${suffix}`) },
    reportDate ? null : { label: "Planilha", onSelect: () => window.location.assign(`/api/reports/duty-schedule/${scheduleId}?format=xlsx`) },
  ] : [];
  return (
    <>
      <div className={pp.actions}>
        {canExport ? <PlMenu triggerClassName={cn(pl.pill, pl.pillQuiet)} trigger={<><DownloadIcon />Exportar<ChevronDown /></>} items={exportItems} /> : null}
        {escalar ? <ScheduleEscalarButton {...escalar} buttonClassName={cn(pl.pill, pl.pillPrimary)} icon={<PlusIcon />} /> : null}
      </div>
      {escalar || canExport ? (
        <div className={pp.actionsMobile}>
          {escalar ? <ScheduleEscalarButton {...escalar} buttonClassName={cn(pl.pill, pl.pillPrimary)} wrapperStyle={{ flex: 1, display: "flex" }} wide /> : null}
          {canExport ? <PlMenu triggerClassName={pl.iconbtn} triggerLabel="Exportar PDF ou planilha" trigger={<DownloadIcon />} items={exportItems} /> : null}
        </div>
      ) : null}
    </>
  );
}

/** "Considerar leads a partir de": as opções de sempre, o corte e o personalizado (dia e hora, até 31 dias atrás). */
export function PlantaoSinceControl({ choices, customActive, customValue, customError, customBaseHref, cut }: {
  choices: Array<{ value: string; label: string; href: string; active: boolean }>;
  customActive: boolean;
  customValue: string | null;
  customError: string | null;
  /** O endereço da página sem `desde`/`desdeEm`, para montar o personalizado. */
  customBaseHref: string;
  cut: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(customActive || Boolean(customError));
  const [day, setDay] = useState(customValue?.slice(0, 10) ?? "");
  const [time, setTime] = useState(customValue?.slice(11, 16) ?? "");
  const [pending, startTransition] = useTransition();

  function apply() {
    if (!day || !time) return;
    const separator = customBaseHref.includes("?") ? "&" : "?";
    startTransition(() => router.push(`${customBaseHref}${separator}desde=custom&desdeEm=${encodeURIComponent(`${day}T${time}`)}`));
  }

  return (
    <div className={pp.since}>
      <span>Considerar leads a partir de</span>
      {choices.map((choice) => (
        <Link key={choice.value} href={choice.href} className={cn(pp.occ, pp.occSm)} aria-current={choice.active && !customActive ? "page" : undefined}>{choice.label}</Link>
      ))}
      <button type="button" className={cn(pp.occ, pp.occSm)} aria-pressed={customActive || open} aria-expanded={open} onClick={() => setOpen((value) => !value)}>Personalizado</button>
      {open ? (
        <form className={pp.dateForm} style={{ display: "inline-flex" }} onSubmit={(event) => { event.preventDefault(); apply(); }} aria-label="Início personalizado dos leads">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>De
            <input className={cn(pp.input, pp.inputSm)} type="date" value={day} onChange={(event) => setDay(event.target.value)} required />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span className={pl.srOnly}>Hora</span>
            <input className={cn(pp.input, pp.inputSm)} type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </label>
          <button type="submit" className={cn(pl.pill, pl.pillPrimary, pl.pillSm)} style={{ minHeight: 32 }} disabled={pending || !day || !time}>{pending ? "Aplicando…" : "Aplicar"}</button>
        </form>
      ) : null}
      {cut}
      <span>· só para ver e atribuir à mão</span>
      {customError ? <p role="alert" className={pp.sinceError}>{customError} A lista segue a janela do plantão.</p> : null}
    </div>
  );
}

type TurnSlotInput = { id: string; name: string; offeredAt: string; outcome?: "accepted" | "skip" | "waiting" } | null;
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });
const OUTCOME = { accepted: "Aceitou", skip: "Pulou a vez", waiting: "Aguardando" } as const;

/** Rodízio nos 3 blocos do artifact: anterior, recebendo agora e próximo. */
export function PlantaoTurnStrip({ scheduleName, previous, current, nextName }: { scheduleName: string; previous: DutyQueueOrderPreview["previous"] | TurnSlotInput; current: DutyQueueOrderPreview["current"] | TurnSlotInput; nextName: string | null }) {
  const reduceMotion = useReducedMotion() ?? false;
  const prevOutcome = previous && "outcome" in previous && previous.outcome ? OUTCOME[previous.outcome] : null;
  const slots = [
    { role: "previous", label: "Anterior", key: previous?.id ?? "empty", name: previous?.name ?? null, detail: previous ? `${prevOutcome ?? "Recebeu"} às ${clock.format(new Date(previous.offeredAt))}` : "Ninguém ainda" },
    { role: "current", label: "Recebendo agora", key: current?.id ?? "empty", name: current?.name ?? null, detail: current ? `Oferta desde ${clock.format(new Date(current.offeredAt))}` : "Nenhum lead em oferta" },
    { role: "next", label: "Próximo", key: nextName ?? "empty", name: nextName, detail: nextName ? "na vez seguinte" : "Ninguém disponível" },
  ] as const;
  return (
    <div className={pp.turn} role="group" aria-label={`Rodízio do ${scheduleName}`}>
      {slots.map((slot) => (
        <div key={slot.role} className={pp.turnSlot} data-turn={slot.role}>
          <span className={pp.turnLabel}>{slot.label}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={slot.key} initial={reduceMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}>
              <span className={pp.turnName}>{slot.name ?? "Sem corretor"}</span>
              <span className={cn(pp.turnDetail, slot.role === "current" && pp.long)}>{slot.detail}</span>
              {slot.role === "current" ? <span className={cn(pp.turnDetail, pp.short)}>{nextName ? `Próximo: ${nextName}` : slot.detail}</span> : null}
            </motion.span>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

const dateShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });
function formatShort(value: string | null) {
  return value ? dateShort.format(new Date(value)).replace(",", "") : null;
}

function temperatureBadge(status: string | null | undefined) {
  const norm = (status ?? "").trim().toLowerCase();
  if (norm === "hot") return { label: "Quente", cls: pl.bBad };
  if (norm === "warm") return { label: "Morno", cls: pl.bWarn };
  if (norm === "cold") return { label: "Frio", cls: pl.bInfo };
  return { label: "Sem temperatura", cls: "" };
}

function toneClass(tone: DutyLeadRecord["distributionTone"]) {
  if (tone === "success") return pl.bGood;
  if (tone === "warning") return pl.bWarn;
  if (tone === "info") return pl.bInfo;
  if (tone === "destructive") return pl.bBad;
  return "";
}

type DrawerProps = {
  brokers: Array<{ id: string; name: string; branchId: string | null }>;
  branches: Array<{ id: string; name: string }>;
  contextRole: string;
  contextJobTitle: string | null;
  contextBranchId: string | null;
  manualAssignmentChoiceEnabled: boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
};

export type PlantaoLeadRow = DutyLeadRecord & { whatsapp: boolean };

/** Tabela de leads do artifact (grupos em cinza, devolvido em âmbar) e, no celular, a lista em pílulas. */
export function PlantaoLeadsTable({ groups, empty, drawer, emptyGroup }: { groups: Array<{ key: string; label: string; leads: PlantaoLeadRow[] }>; empty: string | null; emptyGroup: string; drawer: DrawerProps }) {
  const trigger = (row: PlantaoLeadRow) => <DutyLeadDetailsTrigger lead={row.lead} {...drawer} />;
  if (empty) return <p className={pp.emptyLeads}>{empty}</p>;
  return (
    <>
      <ScrollArea className={pp.tableDesktop} orientation="horizontal">
        <div className={pp.tableMin}>
          <div className={cn(pp.lead, pp.leadh)} role="row"><span>Lead</span><span>Temperatura</span><span>Fila</span><span>Corretor</span><span>Distribuição</span><span>Etapa</span><span>Recebido</span><span>Distribuído</span></div>
          {groups.map((group) => (
            <div key={group.key} role="rowgroup" aria-label={group.label}>
              <div className={pp.group}><span>{group.label}</span><span className={pl.num}>{group.leads.length}</span></div>
              {group.leads.length ? group.leads.map((row) => {
                const temp = temperatureBadge(row.lead.qualificationStatus);
                return (
                  <div key={row.lead.id} className={cn(pp.lead, row.returnedUnaccepted && pp.leadReturned)} role="row">
                    <span className={pp.leadName}>{trigger(row)}{row.whatsapp ? <span className={pp.wa} title={row.whatsappLabel ? `Entrou pelo WhatsApp · ${row.whatsappLabel}` : "Entrou pelo WhatsApp"}>WhatsApp</span> : null}</span>
                    <span className={pp.cellStack}><span className={cn(pl.badge, temp.cls)}>{temp.label}</span>{row.coldHeld ? <span className={cn(pp.cellWarn)} style={{ fontSize: 12 }}>Frio, retido pela fila</span> : null}</span>
                    <span className={pp.cellSecondary}>{row.queueName ?? "Sem fila"}</span>
                    <span className={row.returnedUnaccepted ? pp.cellWarn : row.brokerName ? undefined : pp.cellMuted}>{row.returnedUnaccepted ? "Devolvido, não aceito" : row.brokerName ?? "Sem corretor"}</span>
                    <span><span className={cn(pl.badge, toneClass(row.distributionTone))}>{row.distributionLabel}</span></span>
                    <span className={pp.cellSecondary}>{LEAD_STATUS_LABELS[row.lead.status] ?? row.lead.status}</span>
                    <span className={pp.cellMuted}>{formatShort(row.createdAt)}</span>
                    <span className={pp.cellMuted}>{row.assignedAt && row.lead.corretorId ? formatShort(row.assignedAt) : "Ainda não"}</span>
                  </div>
                );
              }) : <p className={pp.groupEmpty}>{emptyGroup}</p>}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className={pp.mList}>
        {groups.map((group) => (
          <div key={group.key} style={{ display: "contents" }}>
            <p className={pp.mGroup}>{group.label} · {group.leads.length}</p>
            {group.leads.map((row) => {
              const meta = row.returnedUnaccepted ? "Devolvido, não aceito" : row.brokerName ? `${row.brokerName}${row.assignedAt ? ` · ${formatShort(row.assignedAt)}` : ""}` : `Recebido ${formatShort(row.createdAt)}`;
              return (
                <div key={row.lead.id} className={cn(pp.mLead, row.returnedUnaccepted && pp.mLeadReturned)}>
                  <span className={pp.pillBody}><span className={pp.leadName}>{trigger(row)}</span><span className={pp.pillMeta}>{meta}</span></span>
                  <span className={cn(pl.badge, toneClass(row.distributionTone))}>{row.distributionLabel}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

type Person = { id: string; name: string; internalCode: string | null; branchName: string | null };
const personMeta = (person: Person, tail: string) => [person.internalCode ? `Código ${person.internalCode}` : null, person.branchName, tail].filter(Boolean).join(" · ");

/** Convite pendente na linha em pílula do artifact, com Remover e o escalar de quem ainda não tem conta. */
export function PlantaoPendingRoster({ scheduleId, entries, candidates }: { scheduleId: string; entries: Array<Person & { entryId: string }>; candidates: Person[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState("");
  const available = candidates.filter((candidate) => !entries.some((entry) => entry.id === candidate.id));
  function run(action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) { plantaoFailed(result.error, "Não consegui atualizar o plantão agora."); return; }
      plantaoDone(done);
      setChoice("");
      router.refresh();
    });
  }
  if (!entries.length && !available.length) return null;
  return (
    <div className={pp.split} aria-label="Escalados com convite pendente">
      <h3 className={pp.groupTitle}>Convite pendente<span className={pp.groupCount}>{entries.length}</span></h3>
      {entries.map((entry) => (
        <div key={entry.entryId} className={pp.pillRow}>
          <span className={pl.av} aria-hidden="true">{initials(entry.name)}</span>
          <span className={pp.pillBody}><span className={pp.pillName}>{entry.name}</span><span className={pp.pillMeta}>{personMeta(entry, "entra quando criar a conta")}</span></span>
          <span className={cn(pl.badge, pl.bWarn)}>Convite pendente</span>
          <button type="button" className={cn(pl.pill, pl.pillSm, pl.pillGhost)} disabled={pending} onClick={() => run(() => removePendingRosterEntryAction({ scheduleId, entryId: entry.entryId }), "Removido do plantão.")}>Remover</button>
        </div>
      ))}
      {available.length ? (
        <div className={pp.pendingAdd}>
          <select className={pl.select} aria-label="Corretor convidado para escalar" value={choice} onChange={(event) => setChoice(event.target.value)}>
            <option value="">Escalar corretor convidado (sem conta ainda)</option>
            {available.map((person) => <option key={person.id} value={person.id}>{[person.name, person.internalCode ? `Código ${person.internalCode}` : null, person.branchName].filter(Boolean).join(" · ")}</option>)}
          </select>
          <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={!choice || pending} onClick={() => run(() => addPendingRosterEntryAction({ scheduleId, brokerProfileId: choice }), "Escalado. Entra no plantão quando criar a conta.")}>{pending ? "Escalando…" : "Escalar"}</button>
        </div>
      ) : null}
    </div>
  );
}

type HistoryRow = { id: string; leadName: string; brokerName: string; assignedAt: string; kind: string; exact: boolean };

/** Ocorrência encerrada: leads distribuídos na mesma tabela do artifact. */
export function PlantaoHistoryDistributions({ rows }: { rows: HistoryRow[] }) {
  if (!rows.length) return <p className={pp.emptyLeads}>Nenhuma atribuição registrada neste período.</p>;
  const columns = "minmax(200px,1.6fr) minmax(160px,1fr) 120px 140px 150px";
  return (
    <ScrollArea orientation="horizontal">
      <div style={{ minWidth: 820 }}>
        <div className={cn(pp.lead, pp.leadh)} style={{ gridTemplateColumns: columns }} role="row"><span>Lead</span><span>Corretor na época</span><span>Distribuído</span><span>Origem</span><span>Vínculo</span></div>
        {rows.map((row) => (
          <div key={row.id} className={pp.lead} style={{ gridTemplateColumns: columns }} role="row">
            <span className={pp.cellSecondary} style={{ color: "var(--foreground)", fontWeight: 500 }}>{row.leadName}</span>
            <span className={pp.cellSecondary}>{row.brokerName}</span>
            <span className={pp.cellMuted}>{formatShort(row.assignedAt)}</span>
            <span><span className={pl.badge}>{row.kind}</span></span>
            <span><span className={cn(pl.badge, row.exact && pl.bGood)}>{row.exact ? "Confirmado" : "Estimado pela fila"}</span></span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export { DotsIcon };
