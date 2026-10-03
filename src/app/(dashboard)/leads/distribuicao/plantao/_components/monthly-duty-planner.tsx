"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Loader2Icon, MagnifyingGlass, Plus, Sparkle, Warning, X } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchAddList } from "@/components/ui/search-add-list";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  generateMonthlyDutyPlanAction,
  getMonthlyDutyPlanAction,
  publishMonthlyDutyPlanAction,
  updateMonthlyDutyDraftAction,
  type MonthlyDutyPlanView,
} from "@/features/lead-distribution/monthly-duty-actions";
import { cn } from "@/lib/utils";

type Broker = { id: string; name: string; branchId: string | null; branchName?: string | null };
type Step = "schedules" | "quotas" | "review";

/** A plantão as the month sees it: in the month (with its dates) or out, with the reason. */
export type MonthSchedule = {
  id: string;
  name: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  minimumBrokers: number;
  maximumBrokers: number | null;
  /** Dates in the month that have not ended yet (only those can be staffed). */
  dates: number;
  /** Happens in the month, but every date already ended. */
  finished?: boolean;
  /** Queue that receives this plantão's leads (as on the Filas page). */
  queueId?: string | null;
  queueName?: string | null;
  /** Every queue that receives this plantão (it may be several). */
  queues?: { id: string; name: string }[];
  outside: null | { reason: "ends_before" | "starts_after" | "no_weekday" | "empty_range"; label: string };
};

const NO_QUEUE = "__none";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
  return label.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function dateLabel(key: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

/** Loads and caches monthly plans; shared by the plantões list and the planner. */
export function useMonthlyDutyPlans(enabled: boolean) {
  const [plans, setPlans] = useState<Record<string, MonthlyDutyPlanView | null>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const requested = useRef(new Set<string>());

  const load = useCallback(async (month: string, force = false) => {
    if (!enabled || (!force && requested.current.has(month))) return;
    requested.current.add(month);
    setLoading((previous) => new Set(previous).add(month));
    setFailed((previous) => { const next = new Set(previous); next.delete(month); return next; });
    try {
      const plan = await getMonthlyDutyPlanAction(month);
      setPlans((previous) => ({ ...previous, [month]: plan }));
    } catch {
      requested.current.delete(month);
      setFailed((previous) => new Set(previous).add(month));
    } finally {
      setLoading((previous) => { const next = new Set(previous); next.delete(month); return next; });
    }
  }, [enabled]);

  const setPlan = useCallback((view: MonthlyDutyPlanView) => setPlans((previous) => ({ ...previous, [view.monthKey]: view })), []);
  return { plans, loading, failed, load, setPlan };
}

type PlansState = ReturnType<typeof useMonthlyDutyPlans>;

export function MonthlyDutyPlanner({
  brokers,
  enabled,
  canEdit = false,
  month,
  open,
  onOpenChange,
  schedules,
  plansState,
  onCreateSchedule,
  onExtendSchedule,
}: {
  brokers: Broker[];
  enabled: boolean;
  canEdit?: boolean;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: MonthSchedule[];
  plansState: PlansState;
  onCreateSchedule: () => void;
  onExtendSchedule: (scheduleId: string) => Promise<boolean>;
}) {
  const eligibleBrokers = useMemo(() => brokers.filter((broker) => broker.branchId), [brokers]);
  const brokerName = useMemo(() => new Map(eligibleBrokers.map((broker) => [broker.id, broker.name])), [eligibleBrokers]);
  const { plans, loading, failed, load, setPlan } = plansState;
  const plan = plans[month];
  const published = plan?.status === "published";
  const inMonth = useMemo(() => schedules.filter((schedule) => !schedule.outside && !schedule.finished), [schedules]);
  const finished = useMemo(() => schedules.filter((schedule) => !schedule.outside && schedule.finished), [schedules]);
  // Queues of the month's plantões, to staff only one kind (e.g. only Fila PME) in one go.
  const queues = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; ids: string[] }>();
    for (const schedule of inMonth) {
      // A plantão of several queues is staffed from each of them.
      const linked = schedule.queues?.length ? schedule.queues : schedule.queueId ? [{ id: schedule.queueId, name: schedule.queueName ?? "Fila" }] : [];
      for (const queue of linked.length ? linked : [null]) {
        const key = queue?.id ?? NO_QUEUE;
        const entry = byKey.get(key) ?? { key, label: queue ? queue.name : "Sem fila", ids: [] };
        if (!entry.ids.includes(schedule.id)) entry.ids.push(schedule.id);
        byKey.set(key, entry);
      }
    }
    return [...byKey.values()].sort((a, b) => (a.key === NO_QUEUE ? 1 : b.key === NO_QUEUE ? -1 : a.label.localeCompare(b.label, "pt-BR")));
  }, [inMonth]);
  const outside = useMemo(() => schedules.filter((schedule) => schedule.outside), [schedules]);

  const [stepByMonth, setStepByMonth] = useState<Record<string, Step>>({});
  // A published month staffed again from scratch (a new revision).
  const [redoByMonth, setRedoByMonth] = useState<Record<string, boolean>>({});
  const [chosenByMonth, setChosenByMonth] = useState<Record<string, Set<string>>>({});
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, Record<string, number>>>({});
  const [search, setSearch] = useState("");
  const [bulkQuota, setBulkQuota] = useState("2");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) queueMicrotask(() => { void load(month); });
  }, [load, month, open]);

  // Default step: review when a draft/published plan exists, otherwise start at the plantões.
  const redo = published && Boolean(redoByMonth[month]);
  const editing = canEdit && (!published || redo);
  const step: Step = !editing ? "review" : stepByMonth[month] ?? (plan && !published ? "review" : "schedules");
  const setStep = (next: Step) => setStepByMonth((previous) => ({ ...previous, [month]: next }));
  // Everything that happens in the month starts checked (a plantão just created included).
  const chosen = chosenByMonth[month] ?? new Set(inMonth.map((schedule) => schedule.id));
  const chosenInMonth = inMonth.filter((schedule) => chosen.has(schedule.id));
  const chosenDates = chosenInMonth.reduce((sum, schedule) => sum + schedule.dates, 0);

  const savedQuotas = useMemo(() => Object.fromEntries((plan?.quotas ?? []).map((item) => [item.brokerId, item.quota])), [plan]);
  const quotas = quotaDrafts[month] ?? savedQuotas;
  const quotaTotal = eligibleBrokers.reduce((sum, broker) => sum + (quotas[broker.id] ?? 0), 0);
  const matchingBrokers = eligibleBrokers.filter((broker) => `${broker.name} ${broker.branchName ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  const branchNames = [...new Set(matchingBrokers.map((broker) => broker.branchName ?? "Sem unidade"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const occurrenceDates = [...new Set((plan?.occurrences ?? []).map((occurrence) => occurrence.dutyDate))];
  const shortfalls = (plan?.quotas ?? []).filter((item) => item.assigned < item.quota);

  const sameSet = (ids: readonly string[]) => chosenInMonth.length === ids.length && ids.every((id) => chosen.has(id));
  function chooseOnly(ids: readonly string[]) {
    setChosenByMonth((previous) => ({ ...previous, [month]: new Set(ids) }));
  }

  function toggleSchedule(id: string, checked: boolean) {
    const next = new Set(chosen);
    if (checked) next.add(id);
    else next.delete(id);
    setChosenByMonth((previous) => ({ ...previous, [month]: next }));
  }

  function setQuota(brokerId: string, value: number) {
    const quota = Math.min(31, Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0));
    setQuotaDrafts((previous) => ({ ...previous, [month]: { ...quotas, [brokerId]: quota } }));
  }

  function applyBulkQuota() {
    const quota = Math.min(31, Math.max(0, Math.trunc(Number(bulkQuota) || 0)));
    setQuotaDrafts((previous) => ({ ...previous, [month]: Object.fromEntries(eligibleBrokers.map((broker) => [broker.id, quota])) }));
  }

  function run(key: string, task: () => Promise<MonthlyDutyPlanView>, success: string, after?: () => void) {
    setBusyKey(key);
    startTransition(async () => {
      try {
        setPlan(await task());
        after?.();
        toast.success(success);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  function extend(scheduleId: string) {
    setBusyKey(`extend:${scheduleId}`);
    startTransition(async () => {
      const ok = await onExtendSchedule(scheduleId);
      setBusyKey(null);
      if (ok) setChosenByMonth((previous) => ({ ...previous, [month]: new Set([...chosen, scheduleId]) }));
    });
  }

  function generate() {
    const payload = eligibleBrokers.map((broker) => ({ brokerId: broker.id, quota: quotas[broker.id] ?? 0 }));
    run("generate", () => generateMonthlyDutyPlanAction({ monthKey: month, quotas: payload, scheduleIds: chosenInMonth.map((schedule) => schedule.id) }), "Proposta gerada. Revise antes de publicar.", () => {
      setQuotaDrafts((previous) => { const next = { ...previous }; delete next[month]; return next; });
      setRedoByMonth((previous) => ({ ...previous, [month]: false }));
      setStep("review");
    });
  }

  function editDraft(occurrenceId: string, brokerId: string, operation: "add" | "remove") {
    if (!plan) return;
    run(`${operation}:${occurrenceId}:${brokerId}`, () => updateMonthlyDutyDraftAction({ planId: plan.id, occurrenceId, brokerId, operation }),
      operation === "add" ? "Corretor adicionado ao plantão." : "Corretor removido do plantão.",
      operation === "add" ? () => setAddingTo(null) : undefined);
  }

  function publish() {
    if (!plan) return;
    run("publish", () => publishMonthlyDutyPlanAction(plan.id), "Escala publicada. Os corretores foram notificados.", () => setConfirmPublish(false));
  }

  const steps: Array<{ id: Step; label: string; disabled?: boolean }> = [
    { id: "schedules", label: "Plantões" },
    { id: "quotas", label: "Cotas", disabled: chosenInMonth.length === 0 },
    { id: "review", label: "Proposta", disabled: !plan },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (!next) setAddingTo(null); onOpenChange(next); }}>
        <SheetContent className="data-[side=right]:w-[min(100vw-1rem,40rem)]">
          <SheetHeader>
            <SheetTitle>Escala de {monthLabel(month)}</SheetTitle>
            <SheetDescription>
              {!canEdit ? "Escala mensal dos corretores da sua unidade."
                : published && !redo ? `Publicada${plan?.publishedAt ? ` em ${new Date(plan.publishedAt).toLocaleDateString("pt-BR")}` : ""}. Para mudar, gere uma nova escala: ela substitui as datas que ainda não passaram.`
                  : redo ? "Nova escala do mês: vale nas datas que ainda não passaram e substitui a publicada nelas."
                  : "Escolha os plantões, defina quantos cada corretor faz e publique."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
            {!enabled ? (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-medium">Escala mensal indisponível</p>
                <p className="mt-1 text-xs text-muted-foreground">Peça ao Super-admin para habilitar o planejamento mensal. Os plantões semanais continuam funcionando normalmente.</p>
              </div>
            ) : failed.has(month) ? (
              <div className="grid gap-2 rounded-lg border border-destructive/30 p-4">
                <p className="text-sm">Não foi possível carregar a escala deste mês.</p>
                <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => { void load(month, true); }}>Tentar novamente</Button>
              </div>
            ) : loading.has(month) || plan === undefined ? (
              <div className="grid gap-3" aria-label="Carregando escala"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>
            ) : (
              <>
                {editing ? (
                  <ol aria-label="Etapas" className="grid grid-cols-3 gap-1 rounded-lg border border-border p-0.5">
                    {steps.map((item, index) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={step === item.id ? "step" : undefined}
                          disabled={item.disabled}
                          onClick={() => setStep(item.id)}
                          className={cn("w-full rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40", step === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          {index + 1}. {item.label}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {step === "schedules" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{chosenInMonth.length} de {inMonth.length} plantões · {chosenDates} datas no mês</p>
                      <Button type="button" size="sm" variant="outline" onClick={onCreateSchedule}><Plus className="size-3.5" /> Novo plantão</Button>
                    </div>
                    {queues.length > 1 ? (
                      <div role="group" aria-label="Escalar só uma fila" className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 text-xs text-muted-foreground">Fila</span>
                        {[{ key: "__all", label: "Todas", ids: inMonth.map((schedule) => schedule.id) }, ...queues].map((queue) => {
                          const active = sameSet(queue.ids);
                          return (
                            <button
                              key={queue.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => chooseOnly(queue.ids)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {queue.label} · {queue.ids.length}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {inMonth.length ? (
                      <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card">
                        {inMonth.map((schedule) => (
                          <li key={schedule.id}>
                            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                              <Checkbox checked={chosen.has(schedule.id)} onCheckedChange={(checked) => toggleSchedule(schedule.id, checked === true)} aria-label={`Incluir ${schedule.name} de ${WEEKDAYS[schedule.dayOfWeek]}`} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{schedule.name}</span>
                                <span className="block text-xs text-muted-foreground">{schedule.queueId ? `${schedule.queueName} · ` : "Sem fila · "}{WEEKDAYS[schedule.dayOfWeek]} · {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)} · mín. {schedule.minimumBrokers}{schedule.maximumBrokers !== null ? ` · máx. ${schedule.maximumBrokers}` : ""}</span>
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{schedule.dates} {schedule.dates === 1 ? "data" : "datas"}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Nenhum plantão ainda vai acontecer em {monthLabel(month)}. Crie um novo ou estenda um dos abaixo.</p>
                    )}
                    {finished.length ? (
                      <p className="text-xs text-muted-foreground">
                        {finished.length} {finished.length === 1 ? "plantão já terminou" : "plantões já terminaram"} neste mês e não {finished.length === 1 ? "entra" : "entram"} na escala: {finished.map((schedule) => schedule.name).join(", ")}.
                      </p>
                    ) : null}
                    {outside.length ? (
                      <details className="rounded-lg border border-border bg-card px-3 py-2 text-xs" open={!inMonth.length}>
                        <summary className="cursor-pointer font-medium">{outside.length} {outside.length === 1 ? "plantão não acontece" : "plantões não acontecem"} em {monthLabel(month)}</summary>
                        <ul className="mt-2 grid gap-1.5">
                          {outside.map((schedule) => (
                            <li key={schedule.id} className="flex items-center justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-foreground">{schedule.name} · {WEEKDAYS[schedule.dayOfWeek]} {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</span>
                                <span className="block text-muted-foreground">{schedule.outside!.label}</span>
                              </span>
                              {canEdit && schedule.outside!.reason === "ends_before" ? (
                                <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={pending} onClick={() => extend(schedule.id)}>
                                  {busyKey === `extend:${schedule.id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                                  Estender até o fim do mês
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ) : step === "quotas" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{eligibleBrokers.length} corretores · {quotaTotal} plantões pedidos para {chosenDates} datas</p>
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="monthly-duty-bulk" className="text-xs text-muted-foreground">Mesma cota para todos</Label>
                        <Input id="monthly-duty-bulk" type="number" min={0} max={31} value={bulkQuota} onChange={(event) => setBulkQuota(event.target.value)} className="w-14 text-center" />
                        <Button type="button" size="sm" variant="outline" onClick={applyBulkQuota} disabled={pending || !eligibleBrokers.length}>Aplicar</Button>
                      </div>
                    </div>
                    <label className="relative block">
                      <span className="sr-only">Buscar corretor ou unidade</span>
                      <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar corretor ou unidade" className="pl-8" />
                    </label>
                    {branchNames.length ? branchNames.map((branch) => (
                      <section key={branch} className="grid gap-1.5">
                        <h4 className="text-xs font-semibold text-muted-foreground">{branch}</h4>
                        <div className="divide-y divide-border/60 rounded-lg border border-border bg-card">
                          {matchingBrokers.filter((broker) => (broker.branchName ?? "Sem unidade") === branch).map((broker) => (
                            <div key={broker.id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <Label htmlFor={`quota-${month}-${broker.id}`} className="min-w-0 truncate text-xs font-medium">{broker.name}</Label>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Diminuir cota de ${broker.name}`} disabled={(quotas[broker.id] ?? 0) === 0 || pending} onClick={() => setQuota(broker.id, (quotas[broker.id] ?? 0) - 1)}>−</Button>
                                <Input id={`quota-${month}-${broker.id}`} aria-label={`Cota mensal de ${broker.name}`} type="number" min={0} max={31} value={quotas[broker.id] ?? 0} onFocus={(event) => event.target.select()} onChange={(event) => setQuota(broker.id, Number(event.target.value))} disabled={pending} className="w-12 text-center tabular-nums" />
                                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Aumentar cota de ${broker.name}`} disabled={(quotas[broker.id] ?? 0) === 31 || pending} onClick={() => setQuota(broker.id, (quotas[broker.id] ?? 0) + 1)}><Plus aria-hidden="true" className="size-3.5" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )) : <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">{eligibleBrokers.length ? "Nenhum corretor corresponde à busca." : "Nenhum corretor elegível com unidade definida."}</p>}
                  </div>
                ) : plan ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                    <dl className="grid grid-cols-3 divide-x divide-border/70 rounded-lg border border-border bg-card">
                      {[
                        { label: "Datas", value: plan.occurrences.length },
                        { label: "Alocações", value: plan.totalAssigned },
                        { label: "Abaixo do mínimo", value: plan.belowMinimum, warn: plan.belowMinimum > 0 },
                      ].map((metric) => (
                        <div key={metric.label} className="px-3 py-2.5">
                          <dt className="text-[11px] text-muted-foreground">{metric.label}</dt>
                          <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums", metric.warn && "text-warning")}>{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {plan.problems.length ? (
                      <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                        <Warning aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                        <div>{plan.problems.map((problem) => <p key={problem}>{problem}</p>)}</div>
                      </div>
                    ) : null}
                    {plan.replacesPublished && !published ? (
                      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Ao publicar, esta escala substitui a publicada nas datas que ainda não passaram. As datas que já passaram ficam como estão.
                      </p>
                    ) : null}
                    {shortfalls.length && !published ? (
                      <details className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium">{plan.missingQuota} plantões de cota não couberam na grade</summary>
                        <ul className="mt-2 grid gap-1 text-muted-foreground">
                          {shortfalls.map((item) => <li key={item.brokerId}>{brokerName.get(item.brokerId) ?? "Corretor"}: {item.assigned} de {item.quota}</li>)}
                        </ul>
                      </details>
                    ) : null}
                    {occurrenceDates.map((date) => (
                      <section key={date} aria-label={dateLabel(date)} className="grid gap-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">{dateLabel(date)}</h4>
                        {plan.occurrences.filter((occurrence) => occurrence.dutyDate === date).map((occurrence) => {
                          const below = occurrence.assignedCount < occurrence.minimumBrokers;
                          const full = occurrence.maximumBrokers !== null && occurrence.assignedCount >= occurrence.maximumBrokers;
                          const editable = canEdit && !published && !occurrence.ended;
                          const candidates = eligibleBrokers
                            .filter((broker) => occurrence.allowedBrokerIds.includes(broker.id) && !occurrence.brokers.some((item) => item.id === broker.id))
                            .map((broker) => ({ id: broker.id, label: broker.name, hint: broker.branchName ?? undefined, keywords: broker.branchName ?? undefined }));
                          return (
                            <article key={occurrence.id} className={cn("rounded-lg border bg-card p-3", occurrence.ended ? "border-dashed border-border opacity-60" : below ? "border-warning/40" : "border-border")}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{occurrence.scheduleName}</p>
                                  <p className="text-xs text-muted-foreground">{occurrence.startsAt.slice(0, 5)}–{occurrence.endsAt.slice(0, 5)}</p>
                                </div>
                                {occurrence.ended ? (
                                  <Badge variant="outline" className="shrink-0">Já passou · não será publicado</Badge>
                                ) : (
                                  <Badge variant={below ? "warning" : "outline"} className="shrink-0 tabular-nums">
                                    {occurrence.assignedCount}/{occurrence.minimumBrokers} mín.{occurrence.maximumBrokers !== null ? ` · máx. ${occurrence.maximumBrokers}` : ""}
                                  </Badge>
                                )}
                              </div>
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {occurrence.brokers.map((broker) => (
                                  <li key={broker.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs">
                                    {broker.name}
                                    {editable ? (
                                      <button type="button" aria-label={`Remover ${broker.name} de ${occurrence.scheduleName} em ${dateLabel(date)}`} disabled={pending} onClick={() => editDraft(occurrence.id, broker.id, "remove")} className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                                        {busyKey === `remove:${occurrence.id}:${broker.id}` ? <Loader2Icon className="size-3 animate-spin" /> : <X className="size-3" />}
                                      </button>
                                    ) : <span className="w-1" />}
                                  </li>
                                ))}
                                {!occurrence.brokers.length ? <li className="text-xs text-muted-foreground">Ninguém escalado</li> : null}
                                {editable && !full ? (
                                  <li>
                                    <button type="button" onClick={() => setAddingTo(addingTo === occurrence.id ? null : occurrence.id)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                                      <Plus className="size-3" /> Adicionar
                                    </button>
                                  </li>
                                ) : null}
                              </ul>
                              {editable && addingTo === occurrence.id ? (
                                <div className="mt-2">
                                  <SearchAddList
                                    items={candidates}
                                    placeholder="Buscar corretor para este plantão"
                                    emptyLabel="Nenhum corretor elegível encontrado."
                                    addingId={busyKey?.startsWith(`add:${occurrence.id}:`) ? busyKey.split(":").at(-1) : null}
                                    disabled={pending}
                                    onAdd={(item) => editDraft(occurrence.id, item.id, "add")}
                                  />
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">O Diretor ainda não montou a escala deste mês.</p>
                )}
              </>
            )}
          </SheetBody>
          {enabled && canEdit && published && !redo ? (
            <SheetFooter>
              <Button type="button" variant="outline" className="ml-auto" onClick={() => { setRedoByMonth((previous) => ({ ...previous, [month]: true })); setStep("schedules"); }}>
                <Sparkle aria-hidden="true" />
                Gerar nova escala
              </Button>
            </SheetFooter>
          ) : null}
          {enabled && editing && plan !== undefined ? (
            <SheetFooter>
              {step === "schedules" ? (
                <Button type="button" className="ml-auto" disabled={!chosenInMonth.length} onClick={() => setStep("quotas")}>Continuar para cotas</Button>
              ) : step === "quotas" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setStep("schedules")} disabled={pending}>Voltar</Button>
                  <Button type="button" disabled={pending || quotaTotal === 0 || !chosenInMonth.length} onClick={generate}>
                    {busyKey === "generate" ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <Sparkle aria-hidden="true" />}
                    {plan ? "Gerar nova proposta" : "Gerar proposta"}
                  </Button>
                </>
              ) : plan ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setStep("quotas")} disabled={pending}>Voltar às cotas</Button>
                  <Button type="button" disabled={pending || !plan.totalAssigned || plan.problems.length > 0} onClick={() => setConfirmPublish(true)}>Publicar escala</Button>
                </>
              ) : null}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Publicar a escala de {monthLabel(month)}?</DialogTitle>
            <DialogDescription>
              {plan?.totalAssigned ?? 0} alocações passam a valer na distribuição nas datas publicadas e cada corretor recebe uma notificação.
              {plan?.belowMinimum ? ` ${plan.belowMinimum} datas ficam abaixo do mínimo.` : ""}{plan?.replacesPublished ? " Ela substitui a escala publicada nas datas que ainda não passaram." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmPublish(false)}>Voltar</Button>
            <Button type="button" disabled={pending} onClick={publish}>{busyKey === "publish" ? "Publicando…" : "Publicar escala"}</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
