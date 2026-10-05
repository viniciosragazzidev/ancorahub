"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import {
  ArrowSquareOut,
  CalendarCheck,
  ChevronDownIcon,
  Copy,
  Loader2Icon,
  PencilSimple,
  Plus,
  Trash,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/metric-card";
import { AppSelect } from "@/components/ui/select";
import { assignmentShift, DEFAULT_SHIFT_SPLIT_AT, dutyShifts, worksInShift, type DutyShiftKey } from "@/features/lead-distribution/duty-shifts";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetSectionHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";
import {
  archiveDutyScheduleAction,
  createDutyScheduleAction,
  deleteDutyScheduleAction,
  duplicateDutyScheduleAction,
  restoreDutyScheduleAction,
  toggleDutyScheduleAction,
  updateDutyScheduleAction,
  type DutyActionState,
} from "@/features/lead-distribution/duty-actions";
import {
  createRosterAssignmentAction,
  moveRosterAssignmentAction,
  removeRosterAssignmentAction,
} from "@/features/lead-distribution/roster-actions";
import { cn } from "@/lib/utils";
import { getDutyCoverage } from "@/features/lead-distribution/domain";
import { buildMonthOccurrences, monthCoverage, monthShiftProgress, summarizeDutyDays } from "@/features/lead-distribution/monthly-duty-plan";
import { DutyMonthCalendar } from "./duty-month-calendar";
import { MonthlyDutyPlanner, monthLabel, useMonthlyDutyPlans, type MonthSchedule } from "./monthly-duty-planner";
import { getOperationalMonthKey } from "./duty-schedule-month-groups";

type Snapshot = DutyRosterSnapshot;
type Schedule = Snapshot["schedules"][number];
type DutyAction = (previous: DutyActionState, formData: FormData) => Promise<DutyActionState>;

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(value);
}

/**
 * The one date a plantão happens on, when it has a single one (the default
 * kind: "PME 25/09"). A rule whose period holds no date of its weekday (a
 * broken edit) resolves to its first possible date so it can be fixed with one
 * field. Weekly rules (two or more dates, or no end) return null.
 */
function singleDutyDate(schedule: Pick<Schedule, "validFrom" | "validUntil" | "dayOfWeek">) {
  if (!schedule.validUntil) return null;
  const from = dateInputValue(schedule.validFrom);
  const last = dateInputValue(lastIncludedDay(schedule.validUntil));
  const dates: string[] = [];
  for (let key = from; key <= last && dates.length < 2; key = addDaysKey(key, 1)) {
    if (new Date(`${key}T12:00:00Z`).getUTCDay() === schedule.dayOfWeek) dates.push(key);
  }
  if (dates.length === 1) return dates[0];
  if (dates.length === 0) {
    let key = from;
    while (new Date(`${key}T12:00:00Z`).getUTCDay() !== schedule.dayOfWeek) key = addDaysKey(key, 1);
    return key;
  }
  return null;
}

function isSingleDaySchedule(schedule: Pick<Schedule, "validFrom" | "validUntil" | "dayOfWeek">) {
  return singleDutyDate(schedule) !== null;
}

function addDaysKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Every date in [from, until] whose weekday is selected (capped to keep a batch sane). */
function datesInRange(from: string, until: string, weekdays: number[], limit = 93) {
  const dates: string[] = [];
  if (!from || !until || until < from) return dates;
  for (let key = from; key <= until && dates.length <= limit; key = addDaysKey(key, 1)) {
    if (weekdays.includes(new Date(`${key}T12:00:00Z`).getUTCDay())) dates.push(key);
  }
  return dates;
}

function dateTag(dateKey: string) {
  return `${DAYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]} ${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

/** `validUntil` is the exclusive instant after the last day: show that last day. */
function lastIncludedDay(value: Date | null) {
  return value ? new Date(value.getTime() - 1) : null;
}

function dateLabel(value: Date | null) {
  if (!value) return "Sem término";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

type RosterEntry = { id: string; brokerId: string; brokerName: string; dayOfWeek: number; startsAt: string; endsAt: string; published: boolean };

/**
 * Everyone on the plantão, as one list: the brokers added here plus the ones
 * the month's escala placed on it (from today on). A broker appears once.
 */
function plantaoRoster(snapshot: Snapshot, scheduleId: string): RosterEntry[] {
  const today = dateInputValue(new Date());
  const plantao = snapshot.schedules.find((schedule) => schedule.id === scheduleId);
  const entries: RosterEntry[] = [
    ...snapshot.assignments.filter((row) => row.scheduleId === scheduleId).map((row) => ({ ...row, published: false })),
    // Monthly-plan rows follow the plantão's own hours.
    ...snapshot.publishedAssignments.filter((row) => row.scheduleId === scheduleId && row.dutyDate >= today).map((row) => ({
      ...row, published: true, dayOfWeek: plantao?.dayOfWeek ?? 0, startsAt: plantao?.startsAt ?? "", endsAt: plantao?.endsAt ?? "",
    })),
  ].map((row) => ({ id: row.id, brokerId: row.brokerId, brokerName: row.brokerName, dayOfWeek: row.dayOfWeek, startsAt: row.startsAt, endsAt: row.endsAt, published: row.published }));
  const seen = new Set<string>();
  return entries.filter((entry) => !seen.has(entry.brokerId) && seen.add(entry.brokerId));
}

function coverageLabel(schedule: Schedule, snapshot: Snapshot) {
  return getDutyCoverage(plantaoRoster(snapshot, schedule.id).length, schedule.minimumBrokers);
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "duty_schedule.created": "Plantão criado",
    "duty_schedule.updated": "Regra atualizada",
    "duty_schedule.activated": "Plantão ativado",
    "duty_schedule.deactivated": "Plantão desativado",
    "duty_schedule.archived": "Plantão arquivado",
    "duty_schedule.restored": "Plantão restaurado",
    "duty_schedule.duplicated": "Plantão duplicado",
  };
  return labels[action] ?? action;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">Ativo</Badge>;
  if (status === "archived") return <Badge variant="outline">Arquivado</Badge>;
  return <Badge variant="secondary">Inativo</Badge>;
}

function DutyFormSheet({
  open,
  onOpenChange,
  schedule,
  snapshot,
  queues,
  defaultStartDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  snapshot: Snapshot;
  queues: QueueOption[];
  /** YYYY-MM-DD used as "a partir de" when creating from a month view. */
  defaultStartDate?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // New plantões are one-day plantões by default: a range becomes one per date.
  const [mode, setMode] = useState<"dates" | "weekly">(() => (schedule && !isSingleDaySchedule(schedule) ? "weekly" : "dates"));
  const [selectedDays, setSelectedDays] = useState<number[]>(() => (schedule ? [schedule.dayOfWeek] : [0, 1, 2, 3, 4, 5, 6]));
  const initialDate = schedule ? singleDutyDate(schedule) ?? dateInputValue(schedule.validFrom) : defaultStartDate ?? dateInputValue(new Date());
  const [rangeFrom, setRangeFrom] = useState(initialDate);
  const [rangeUntil, setRangeUntil] = useState(initialDate);
  const plannedDates = useMemo(() => (mode === "dates" && !schedule ? datesInRange(rangeFrom, rangeUntil, selectedDays) : []), [mode, rangeFrom, rangeUntil, schedule, selectedDays]);
  // Only offered at creation: picking a queue here is a shortcut for the same
  // "Exclusividade de Plantão" checklist the queue editor already has.
  // The queue that receives this plantão (kept in sync with Filas → Exclusividade de Plantão).
  const [queueIds, setQueueIds] = useState<string[]>(() => schedule?.linkedQueues?.map((queue) => queue.id) ?? (schedule?.linkedQueueId ? [schedule.linkedQueueId] : []));
  // Morning/afternoon shifts: brokers are put on one of them (or the whole day).
  const [splitOn, setSplitOn] = useState(Boolean(schedule?.shiftSplitAt));
  const [splitAt, setSplitAt] = useState(schedule?.shiftSplitAt ?? DEFAULT_SHIFT_SPLIT_AT);
  const toggleQueue = (id: string, checked: boolean) => setQueueIds((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  // A linked queue that is no longer active still shows by name.
  const queueChoices = [
    ...queues,
    ...(schedule?.linkedQueues ?? []).filter((linked) => !queues.some((queue) => queue.id === linked.id)),
  ];
  const tooManyDates = plannedDates.length > 93;
  const canSubmit = mode === "dates" && !schedule ? plannedDates.length > 0 && !tooManyDates : selectedDays.length > 0;
  const title = schedule ? "Editar plantão" : "Novo plantão";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (schedule) {
      formData.set("scheduleId", schedule.id);
      formData.set("receivingQueueIds", JSON.stringify(queueIds));
      if (mode === "dates") {
        // A one-day plantão moved to another date: its weekday follows the date.
        formData.set("validFrom", rangeFrom);
        formData.set("validUntil", rangeFrom);
        formData.set("dayOfWeek", String(new Date(`${rangeFrom}T12:00:00Z`).getUTCDay()));
      } else {
        formData.set("dayOfWeek", String(selectedDays[0] ?? schedule.dayOfWeek));
      }
    } else {
      if (mode === "dates") {
        formData.set("dates", JSON.stringify(plannedDates));
        formData.set("validFrom", rangeFrom);
        formData.delete("validUntil");
      }
      formData.set("daysOfWeek", JSON.stringify(mode === "dates" ? [...new Set(plannedDates.map((date) => new Date(`${date}T12:00:00Z`).getUTCDay()))] : selectedDays));
      // The queues that receive the new plantão(s): linked with it on the
      // server, which also scopes the same-time check by queue.
      if (queueIds.length) formData.set("responsibleQueueIds", JSON.stringify(queueIds));
    }
    const action: DutyAction = schedule ? updateDutyScheduleAction : createDutyScheduleAction;
    startTransition(async () => {
      const result = await action({}, formData);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível salvar o plantão.");
        return;
      }
      toast.success(
        schedule
          ? "Plantão atualizado."
          : queueIds.length
            ? `${result.scheduleIds?.length ?? 1} plantão(ões) criado(s) e vinculado(s) a ${queueIds.length === 1 ? "1 fila" : `${queueIds.length} filas`}.`
            : `${result.scheduleIds?.length ?? 1} plantão(ões) criado(s).`,
      );
      if (result.message?.startsWith("Esta fila também está no plantão")) toast.info(result.message);
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {schedule
              ? "Edite a data, o horário, a fila que recebe e a cobertura deste plantão."
              : "Escolha o período e os dias da semana: cada dia vira um plantão de um dia, para todas as unidades."}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="duty-name">Nome</Label>
              <Input
                id="duty-name"
                name="name"
                defaultValue={schedule?.name ?? ""}
                placeholder="Ex.: Plantão comercial"
                required
              />
            </div>
            {/* Type stays in the data (kept on save) but is not part of the form. */}
            <input type="hidden" name="typeName" value={schedule?.typeName ?? ""} />
            <div className="grid gap-2">
              <Label htmlFor="duty-attendance-mode">Tipo de plantão</Label>
              <AppSelect id="duty-attendance-mode" name="attendanceMode" defaultValue={schedule?.attendanceMode ?? "online"} options={[{ value: "online", label: "Online" }, { value: "presencial", label: "Presencial" }]} />
              <p className="text-xs text-muted-foreground">No presencial, o gestor confirma cada corretor na unidade antes de ele receber leads.</p>
            </div>
            <div className="grid gap-3 rounded-[var(--radius-card)] border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Quando</p>
                {!schedule || !isSingleDaySchedule(schedule) ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={mode === "weekly"} disabled={Boolean(schedule)} onCheckedChange={(checked) => setMode(checked === true ? "weekly" : "dates")} />
                    Repetir toda semana
                  </label>
                ) : null}
              </div>
              {mode === "dates" ? (
                schedule ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="duty-date">Data</Label>
                    <Input id="duty-date" type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} required />
                    <p className="text-[11px] text-muted-foreground">Este plantão vale só neste dia.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="duty-range-from">De</Label>
                        <Input id="duty-range-from" type="date" value={rangeFrom} onChange={(event) => { setRangeFrom(event.target.value); if (event.target.value > rangeUntil) setRangeUntil(event.target.value); }} required />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="duty-range-until">Até</Label>
                        <Input id="duty-range-until" type="date" value={rangeUntil} min={rangeFrom} onChange={(event) => setRangeUntil(event.target.value)} required />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
                      {WEEKDAY_ORDER.map((index) => {
                        const selected = selectedDays.includes(index);
                        const count = datesInRange(rangeFrom, rangeUntil, [index]).length;
                        return (
                          <button
                            key={index}
                            type="button"
                            aria-pressed={selected}
                            disabled={count === 0}
                            onClick={() => setSelectedDays((current) => (selected ? current.filter((day) => day !== index) : [...current, index].sort((a, b) => a - b)))}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${selected && count ? "border-primary/25 bg-primary/8 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                          >
                            {DAYS[index]}{count ? ` · ${count === 1 ? datesInRange(rangeFrom, rangeUntil, [index])[0].slice(8, 10) + "/" + datesInRange(rangeFrom, rangeUntil, [index])[0].slice(5, 7) : `${count}×`}` : ""}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-1.5">
                      <p className="text-xs text-muted-foreground">
                        {tooManyDates ? "Escolha no máximo 93 dias (cerca de 3 meses) por vez." : plannedDates.length ? `Serão criados ${plannedDates.length} ${plannedDates.length === 1 ? "plantão de um dia" : "plantões de um dia cada"}:` : "Nenhum dia selecionado no período."}
                      </p>
                      {plannedDates.length && !tooManyDates ? (
                        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                          {plannedDates.map((date) => <Badge key={date} variant="outline" className="font-normal tabular-nums">{dateTag(date)}</Badge>)}
                        </div>
                      ) : null}
                    </div>
                  </>
                )
              ) : null}
              {mode === "weekly" ? (
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Dias da semana</legend>
                <p className="text-xs text-muted-foreground">
                  {schedule ? "Esta regra vale para um único dia." : "Selecione um ou mais dias."}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WEEKDAY_ORDER.map((index) => {
                    const day = DAYS_FULL[index];
                    const selected = selectedDays.includes(index);
                    return (
                      <label
                        key={day}
                        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-border/70 bg-card px-2.5 py-2 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/8"
                      >
                        <Checkbox
                          checked={selected}
                          disabled={Boolean(schedule) || (selected && selectedDays.length === 1)}
                          onCheckedChange={(checked) =>
                            setSelectedDays((current) => {
                              if (checked === true)
                                return [...new Set([...current, index])].sort((a, b) => a - b);
                              if (current.length === 1) return current;
                              return current.filter((dayIndex) => dayIndex !== index);
                            })
                          }
                        />
                        <span>{day}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              ) : null}
              {mode === "weekly" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="duty-valid-from">Repete toda semana a partir de</Label>
                    <Input
                      id="duty-valid-from"
                      name="validFrom"
                      type="date"
                      defaultValue={schedule ? dateInputValue(schedule.validFrom) : defaultStartDate ?? dateInputValue(new Date())}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duty-valid-until">Até (opcional)</Label>
                    <Input
                      id="duty-valid-until"
                      name="validUntil"
                      type="date"
                      defaultValue={dateInputValue(lastIncludedDay(schedule?.validUntil ?? null))}
                    />
                    <p className="text-[11px] text-muted-foreground">Em branco: repete sem data para acabar. O dia informado entra.</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="duty-start">Início</Label>
                <Input
                  id="duty-start"
                  name="startsAt"
                  type="time"
                  defaultValue={schedule?.startsAt.slice(0, 5) ?? "09:00"}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duty-end">Fim</Label>
                <Input
                  id="duty-end"
                  name="endsAt"
                  type="time"
                  defaultValue={schedule?.endsAt.slice(0, 5) ?? "18:00"}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duty-minimum">Mínimo de corretores</Label>
              <Input
                id="duty-minimum"
                name="minimumBrokers"
                type="number"
                min={1}
                max={99}
                defaultValue={schedule?.minimumBrokers ?? 1}
                required
              />
              <p className="text-xs text-muted-foreground">
                Abaixo deste mínimo, o plantão vira uma pendência; a distribuição não é bloqueada.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duty-maximum">Máximo de corretores (opcional)</Label>
              <Input
                id="duty-maximum"
                name="maximumBrokers"
                type="number"
                min={1}
                max={99}
                defaultValue={schedule?.maximumBrokers ?? ""}
              />
              <p className="text-xs text-muted-foreground">Deixe em branco para não limitar a capacidade. Quando definido, não pode ser menor que o mínimo.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duty-max-leads">Limite de leads por corretor neste plantão (opcional)</Label>
              <Input
                id="duty-max-leads"
                name="maxLeadsPerBroker"
                type="number"
                min={1}
                max={500}
                defaultValue={schedule?.maxLeadsPerBroker ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Quantos leads cada corretor pode receber em cada dia deste plantão. Quem atinge o limite para de receber até o próximo dia do plantão; oferta expirada ou recusada não conta. Em branco, sem limite.
              </p>
            </div>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={splitOn} onCheckedChange={(checked) => setSplitOn(checked === true)} aria-label="Dividir em turnos" />
                Dividir em turnos (manhã e tarde)
              </label>
              <input type="hidden" name="shiftSplitAt" value={splitOn ? splitAt : ""} />
              {splitOn ? (
                <div className="grid gap-1.5 pl-6">
                  <Label htmlFor="duty-split-at">A tarde começa às</Label>
                  <Input id="duty-split-at" type="time" value={splitAt} onChange={(event) => setSplitAt(event.target.value)} className="w-32" />
                  <p className="text-xs text-muted-foreground">
                    Cada corretor fica na manhã, na tarde ou no dia todo. Ele só recebe leads e só é chamado para confirmar presença no turno dele.
                  </p>
                </div>
              ) : null}
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Filas que recebem este plantão</legend>
              {queueChoices.length ? (
                <div className="grid max-h-48 gap-1 overflow-y-auto rounded-[var(--radius-card)] border border-border p-2">
                  {queueChoices.map((queue) => (
                    <label key={queue.id} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-card)] px-2 py-1.5 text-sm hover:bg-accent/40">
                      <Checkbox checked={queueIds.includes(queue.id)} onCheckedChange={(checked) => toggleQueue(queue.id, checked === true)} aria-label={queue.name} />
                      <span className="truncate">{queue.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma fila ativa.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {queueIds.length === 0
                  ? schedule ? "Nenhuma fila: o plantão não recebe leads de fila." : "Nenhuma agora: dá para vincular depois."
                  : `Os leads ${queueIds.length === 1 ? "dessa fila" : `dessas ${queueIds.length} filas`} vão para os corretores deste plantão.`} Fica sincronizado com Filas → Exclusividade de Plantão.
              </p>
            </fieldset>
            <div className="grid gap-2">
              <Label htmlFor="duty-credential">Origem de entrada</Label>
              <AppSelect
                id="duty-credential"
                name="webhookCredentialId"
                defaultValue={schedule?.webhookCredentialId ?? ""}
                options={[
                  { value: "", label: "Todas as origens" },
                  ...snapshot.credentials.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                A origem representa a Página ou integração que recebe o lead. Campanhas da mesma
                Página seguem este plantão; regras específicas de campanha continuam na Matriz de
                Roteamento.
              </p>
            </div>
            <section
              aria-labelledby="duty-review"
              className="rounded-[var(--radius-card)] border border-primary/20 bg-primary/8 p-4"
            >
              <h3 id="duty-review" className="text-sm font-semibold">
                Resumo da criação
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {selectedDays.length} regra(s) global(is) serão criadas para todas as unidades e corretores. O plantão só concorre enquanto horário, vigência e origem corresponderem.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="outline">{selectedDays.length} dia(s)</Badge>
                <Badge variant="outline">Todas as unidades</Badge>
              </div>
            </section>
            <p className="rounded-[var(--radius-card)] border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Fuso operacional: America/Sao_Paulo. A fila de entrada seleciona os leads; a escala
              do plantão reúne corretores de todas as unidades.
            </p>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending
                ? "Salvando…"
                : schedule
                  ? "Salvar alterações"
                  : mode === "dates"
                    ? `Criar ${plannedDates.length || ""} ${plannedDates.length === 1 ? "plantão" : "plantões"}`.replace("  ", " ")
                    : "Criar plantão semanal"}
            </Button>
          </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function DutyInspector({
  schedule,
  open,
  onOpenChange,
  snapshot,
  onEdit,
}: {
  schedule: Schedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: Snapshot;
  onEdit: (schedule: Schedule) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [brokerSearch, setBrokerSearch] = useState("");
  // Every eligible broker is already in `snapshot`, so filtering is instant —
  // the brief "searching" window below is purely to give typing a search
  // feel (results settling a beat after the last keystroke) rather than
  // results snapping in on every character.
  const [searchingBrokers, setSearchingBrokers] = useState(false);
  const [addingBrokerId, setAddingBrokerId] = useState<string | null>(null);
  const assignments = schedule ? plantaoRoster(snapshot, schedule.id) : [];
  const shifts = schedule ? dutyShifts(schedule) : null;
  const [addShift, setAddShift] = useState<DutyShiftKey>("manha");
  const eligibleBrokers = schedule
    ? snapshot.brokers.filter(
        (broker) =>
          (schedule.branchId === null || broker.branchId === schedule.branchId) &&
          !assignments.some((assignment) => assignment.brokerId === broker.id),
      )
    : [];
  const filteredEligibleBrokers = eligibleBrokers.filter((broker) => {
    const query = brokerSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return true;
    return `${broker.name} ${broker.internalCode ?? ""}`.toLocaleLowerCase("pt-BR").includes(query);
  });
  const history = schedule
    ? snapshot.history.filter((event) => event.scheduleId === schedule.id).slice(0, 6)
    : [];

  useEffect(() => {
    // Nothing to flag once the query is empty — the results panel itself is
    // only rendered while there's a query, so a stale `true` here never shows.
    if (!brokerSearch.trim()) return;
    setSearchingBrokers(true);
    const timer = setTimeout(() => setSearchingBrokers(false), 220);
    return () => clearTimeout(timer);
  }, [brokerSearch]);

  function runAction(action: DutyAction, successMessage: string, close = false) {
    if (!schedule) return;
    const formData = new FormData();
    formData.set("scheduleId", schedule.id);
    startTransition(async () => {
      const result = await action({}, formData);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível atualizar o plantão.");
        return;
      }
      toast.success(successMessage);
      if (result.message?.startsWith("Esta fila também está no plantão")) toast.info(result.message);
      setConfirmArchive(false);
      router.refresh();
      if (close) onOpenChange(false);
    });
  }

  function assignBroker(brokerId: string) {
    if (!schedule) return;
    const formData = new FormData();
    formData.set("scheduleId", schedule.id);
    formData.set("brokerId", brokerId);
    formData.set("dayOfWeek", String(schedule.dayOfWeek));
    const shift = shifts?.find((item) => item.key === addShift);
    formData.set("startsAt", shift?.startsAt ?? schedule.startsAt.slice(0, 5));
    formData.set("endsAt", shift?.endsAt ?? schedule.endsAt.slice(0, 5));
    setAddingBrokerId(brokerId);
    startTransition(async () => {
      const result = await createRosterAssignmentAction({}, formData);
      setAddingBrokerId(null);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível escalar o corretor.");
        return;
      }
      setBrokerSearch("");
      toast.success("Corretor adicionado à escala.");
      router.refresh();
    });
  }

  function changeShift(assignment: RosterEntry, key: DutyShiftKey) {
    const shift = shifts?.find((item) => item.key === key);
    if (!schedule || !shift) return;
    const formData = new FormData();
    formData.set("assignmentId", assignment.id);
    formData.set("scheduleId", schedule.id);
    formData.set("brokerId", assignment.brokerId);
    formData.set("dayOfWeek", String(assignment.dayOfWeek));
    formData.set("startsAt", shift.startsAt);
    formData.set("endsAt", shift.endsAt);
    startTransition(async () => {
      const result = await moveRosterAssignmentAction({}, formData);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível trocar o turno.");
        return;
      }
      toast.success(`${assignment.brokerName}: ${shift.label}.`);
      router.refresh();
    });
  }

  function removeAssignment(assignment: RosterEntry) {
    const formData = new FormData();
    formData.set("assignmentId", assignment.id);
    startTransition(async () => {
      const result = await removeRosterAssignmentAction({}, formData);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível remover o corretor.");
        return;
      }
      router.refresh();
      toast.success("Corretor removido da escala.");
    });
  }

  const coverage = schedule ? coverageLabel(schedule, snapshot) : null;
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            {schedule && (
              <>
                <div className="flex items-center gap-2">
                  <StatusBadge status={schedule.status} />
                  <span className="text-xs text-muted-foreground">{schedule.branchName ?? "Todas as unidades"}</span>
                </div>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {schedule.name}
                  <Badge variant="outline" className="font-normal tabular-nums">
                    {isSingleDaySchedule(schedule) ? dateTag(singleDutyDate(schedule)!) : `↻ ${DAYS[schedule.dayOfWeek]}`}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {schedule.queueName} · {DAYS_FULL[schedule.dayOfWeek]} ·{" "}
                  {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}
                </SheetDescription>
                <Button
                  className="mt-1 w-fit gap-2 text-xs"
                  render={<Link href={`/leads/distribuicao/plantao/${schedule.id}`} />}
                  size="sm"
                  variant="outline"
                >
                  <ArrowSquareOut className="size-4" />
                  Ver plantão e histórico
                </Button>
              </>
            )}
          </SheetHeader>
          {schedule && (
            <>
              <SheetBody contentClassName="grid gap-4">
                <SheetSection>
                  <SheetSectionHeader>
                    <div>
                      <p className="text-sm font-semibold">Cobertura</p>
                      <p className="text-xs text-muted-foreground">
                        A escala não bloqueia a distribuição enquanto estiver incompleta.
                      </p>
                    </div>
                    <Badge variant={coverage?.covered ? "success" : "warning"}>
                      {coverage?.assigned}/{coverage?.minimum}
                    </Badge>
                  </SheetSectionHeader>
                  <div className="p-4">
                    {coverage?.covered ? (
                      <p className="text-sm text-success">Mínimo de corretores atendido.</p>
                    ) : (
                      <p className="text-sm text-warning">
                        Faltam {(coverage?.minimum ?? 0) - (coverage?.assigned ?? 0)} corretor(es)
                        para atingir o mínimo.
                      </p>
                    )}
                  </div>
                </SheetSection>
                <SheetSection>
                  <SheetSectionHeader>
                    <div>
                      <p className="text-sm font-semibold">Regra</p>
                      <p className="text-xs text-muted-foreground">
                        Detalhes que definem a entrada do plantão.
                      </p>
                    </div>
                  </SheetSectionHeader>
                  <dl className="grid gap-3 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Origem</dt>
                      <dd className="text-right">
                        {schedule.credentialName ?? "Todas as origens"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{isSingleDaySchedule(schedule) ? "Data" : "Repete toda semana"}</dt>
                      <dd className="text-right">
                        {isSingleDaySchedule(schedule)
                          ? dateTag(singleDutyDate(schedule)!)
                          : `${dateLabel(schedule.validFrom)} · ${dateLabel(lastIncludedDay(schedule.validUntil))}`}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Limite por corretor</dt>
                      <dd className="text-right">{schedule.maxLeadsPerBroker ? `${schedule.maxLeadsPerBroker} leads por dia de plantão` : "Sem limite"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Timezone</dt>
                      <dd>{schedule.timezone}</dd>
                    </div>
                  </dl>
                </SheetSection>
                <SheetSection>
                  <SheetSectionHeader>
                    <div>
                      <p className="text-sm font-semibold">Escala de corretores</p>
                      <p className="text-xs text-muted-foreground">
                        Adicione ou remova pessoas do plantão.
                      </p>
                    </div>
                  </SheetSectionHeader>
                  <div className="grid gap-3 p-4">
                    {shifts ? (
                      <div className="grid gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Turno de quem você adicionar</p>
                        <div className="grid grid-cols-3 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5" role="radiogroup" aria-label="Turno de quem você adicionar">
                          {shifts.map((shift) => (
                            <button
                              key={shift.key}
                              type="button"
                              role="radio"
                              aria-checked={addShift === shift.key}
                              onClick={() => setAddShift(shift.key)}
                              className={cn(
                                "rounded-full px-2 py-1.5 text-xs font-medium",
                                addShift === shift.key ? "bg-background text-foreground shadow-none" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {shift.label.split(" · ")[0]}
                              <span className="block text-[10px] font-normal text-muted-foreground">{shift.label.split(" · ")[1]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      <Input
                        value={brokerSearch}
                        onChange={(event) => setBrokerSearch(event.target.value)}
                        placeholder="Pesquisar corretor por nome ou código"
                        aria-label="Pesquisar corretor por nome ou código"
                        disabled={pending || schedule.status !== "active"}
                      />
                      {brokerSearch.trim() && schedule.status === "active" ? (
                        <div className="rounded-[var(--radius-card)] border border-border/70 bg-card">
                          {searchingBrokers ? (
                            <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                              <Loader2Icon className="size-3.5 animate-spin" />
                              Buscando corretores…
                            </p>
                          ) : filteredEligibleBrokers.length ? (
                            <div className="max-h-52 divide-y divide-border/60 overflow-y-auto">
                              {filteredEligibleBrokers.map((broker) => (
                                <div
                                  key={broker.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{broker.name}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      {broker.internalCode ? `${broker.internalCode} · ` : ""}
                                      {broker.availabilityStatus === "available" ? "Disponível" : "Pausado"}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="outline"
                                    className="shrink-0"
                                    aria-label={`Adicionar ${broker.name} a este plantão`}
                                    title={`Adicionar ${broker.name}`}
                                    disabled={pending}
                                    onClick={() => assignBroker(broker.id)}
                                  >
                                    {addingBrokerId === broker.id ? (
                                      <Loader2Icon className="size-4 animate-spin" />
                                    ) : (
                                      <Plus className="size-4" />
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-2.5 text-xs text-muted-foreground">
                              Nenhum corretor elegível encontrado.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {(shifts ? shifts.filter((shift) => shift.key !== "dia").map((shift) => ({
                      key: shift.key,
                      label: shift.label as string | null,
                      entries: assignments.filter((assignment) => worksInShift(assignmentShift(schedule, assignment), shift.key as "manha" | "tarde")),
                    })) : [{ key: "todos", label: null as string | null, entries: assignments }]).map((section) => (
                    <div key={section.key} className="grid gap-2">
                      {section.label ? <p className="text-xs font-semibold text-muted-foreground">{section.label} · {section.entries.length}</p> : null}
                      {section.entries.map((assignment) => (
                        <div
                          key={`${section.key}:${assignment.id}`}
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 bg-muted/20 px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {assignment.brokerName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {shifts ? (shifts.find((shift) => shift.key === assignmentShift(schedule, assignment))?.label ?? `${assignment.startsAt.slice(0, 5)}–${assignment.endsAt.slice(0, 5)}`) : "Escalado neste horário"}
                            </span>
                          </span>
                          {shifts && !assignment.published ? (
                            <AppSelect
                              aria-label={`Turno de ${assignment.brokerName}`}
                              className="w-28 shrink-0"
                              value={assignmentShift(schedule, assignment) ?? ""}
                              onValueChange={(value) => { if (value) changeShift(assignment, value as DutyShiftKey); }}
                              options={shifts.map((shift) => ({ value: shift.key, label: shift.label.split(" · ")[0] }))}
                              disabled={pending}
                            />
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Remover ${assignment.brokerName} da escala`}
                            onClick={() => removeAssignment(assignment)}
                            disabled={pending}
                          >
                            <Trash className="size-4" />
                          </Button>
                        </div>
                      ))}
                      {!section.entries.length && (
                        <p className="rounded-[var(--radius-card)] border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                          {section.label ? "Ninguém neste turno." : "Nenhum corretor escalado."}
                        </p>
                      )}
                    </div>
                    ))}
                  </div>
                </SheetSection>
                <SheetSection>
                  <SheetSectionHeader>
                    <div>
                      <p className="text-sm font-semibold">Histórico</p>
                      <p className="text-xs text-muted-foreground">
                        Alterações auditadas deste plantão.
                      </p>
                    </div>
                  </SheetSectionHeader>
                  <div className="grid gap-2 p-4">
                    {history.map((event, index) => (
                      <div
                        key={`${event.action}-${event.createdAt.toISOString()}-${index}`}
                        className="flex justify-between gap-3 text-xs"
                      >
                        <span>
                          {actionLabel(event.action)} · {event.actorName}
                        </span>
                        <time className="shrink-0 text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(event.createdAt)}
                        </time>
                      </div>
                    ))}
                    {!history.length && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum evento de histórico disponível.
                      </p>
                    )}
                  </div>
                </SheetSection>
              </SheetBody>
              <SheetFooter>
                {schedule.status === "archived" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        runAction(restoreDutyScheduleAction, "Plantão restaurado como inativo.")
                      }
                      disabled={pending}
                    >
                      Restaurar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                      disabled={pending}
                    >
                      Excluir
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        runAction(
                          toggleDutyScheduleAction,
                          schedule.status === "active" ? "Plantão desativado." : "Plantão ativado.",
                        )
                      }
                      disabled={pending}
                    >
                      {schedule.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        runAction(duplicateDutyScheduleAction, "Cópia criada como inativa.")
                      }
                      disabled={pending}
                    >
                      <Copy />
                      Duplicar
                    </Button>
                    <Button variant="outline" onClick={() => onEdit(schedule)} disabled={pending}>
                      <PencilSimple />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmArchive(true)}
                      disabled={pending}
                    >
                      <Trash />
                      Arquivar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                      disabled={pending}
                    >
                      Excluir
                    </Button>
                  </>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Arquivar este plantão?</DialogTitle>
            <DialogDescription>
              Ele sairá da distribuição e os {assignments.length} corretor(es) da escala ficarão
              inativos neste plantão. O histórico será preservado e a regra poderá ser restaurada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchive(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => runAction(archiveDutyScheduleAction, "Plantão arquivado.", true)}
              disabled={pending}
            >
              Arquivar plantão
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Excluir este plantão permanentemente?</DialogTitle>
            <DialogDescription>
              Esta ação remove a regra e a escala de corretores de forma definitiva. O registro de auditoria será preservado, mas o plantão não poderá ser restaurado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>Cancelar</Button>
            <Button variant="destructive" onClick={() => runAction(deleteDutyScheduleAction, "Plantão excluído permanentemente.", true)} disabled={pending}>Excluir plantão</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

type QueueOption = { id: string; name: string };

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function outsideLabel(schedule: Schedule, reason: "ends_before" | "starts_after" | "no_weekday" | "empty_range") {
  if (reason === "empty_range") return "Não tem nenhuma data válida: abra e escolha a data";
  if (reason === "ends_before") return `Terminou em ${dateLabel(lastIncludedDay(schedule.validUntil))}`;
  if (reason === "starts_after") return `Começa em ${dateLabel(schedule.validFrom)}`;
  return "Não cai neste mês";
}

export function DutyOperationsWorkspace({ snapshot, queues = [], monthlySchedulingEnabled = false, canPlanMonthlySchedule = false, initialMonthlyScheduleMonth = null }: { snapshot: Snapshot; queues?: QueueOption[]; monthlySchedulingEnabled?: boolean; canPlanMonthlySchedule?: boolean; initialMonthlyScheduleMonth?: string | null }) {
  const router = useRouter();
  const currentMonthKey = getOperationalMonthKey();
  // One month drives the whole tab: the plantões shown, the scale and "Novo plantão".
  const [month, setMonth] = useState(() => initialMonthlyScheduleMonth ?? currentMonthKey);
  const [plannerOpen, setPlannerOpen] = useState(Boolean(initialMonthlyScheduleMonth));
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [formSchedule, setFormSchedule] = useState<Schedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // "Novo plantão" from inside the scale: swap drawers, then come back to it.
  const [returnToPlanner, setReturnToPlanner] = useState(false);
  // Day clicked in the calendar: "Novo plantão" opens on that date.
  const [createDate, setCreateDate] = useState<string | null>(null);
  const plansState = useMonthlyDutyPlans(monthlySchedulingEnabled);
  const { load: loadPlan } = plansState;

  useEffect(() => {
    if (monthlySchedulingEnabled) queueMicrotask(() => { void loadPlan(month); });
  }, [loadPlan, month, monthlySchedulingEnabled]);

  // Month arrows stop at the first and last month that have a plantão
  // (open-ended weekly rules: at most 12 months ahead).
  const { firstMonth, lastMonth } = useMemo(() => {
    const cap = shiftMonth(currentMonthKey, 12);
    let first = currentMonthKey;
    let last = currentMonthKey;
    for (const schedule of snapshot.schedules) {
      if (schedule.status === "archived") continue;
      const from = dateInputValue(schedule.validFrom).slice(0, 7);
      const until = schedule.validUntil ? dateInputValue(lastIncludedDay(schedule.validUntil)).slice(0, 7) : cap;
      if (until < from) continue;
      if (from < first) first = from;
      if (until > last) last = until;
    }
    return { firstMonth: first, lastMonth: last > cap ? cap : last };
  }, [currentMonthKey, snapshot.schedules]);
  const visibleSchedules = useMemo(
    () => snapshot.schedules.filter((schedule) => showArchived || schedule.status !== "archived"),
    [showArchived, snapshot.schedules],
  );
  const coverageById = useMemo(
    () => new Map(visibleSchedules.map((schedule) => [schedule.id, monthCoverage(schedule, month)])),
    [month, visibleSchedules],
  );
  const monthSchedules = visibleSchedules.filter((schedule) => coverageById.get(schedule.id)?.covered);
  const progressById = useMemo(() => {
    const now = new Date();
    return new Map(monthSchedules.map((schedule) => [schedule.id, monthShiftProgress(schedule, month, now)]));
  }, [month, monthSchedules]);
  const outsideSchedules = visibleSchedules.filter((schedule) => !coverageById.get(schedule.id)?.covered && schedule.status !== "archived");
  const plannerSchedules = useMemo<MonthSchedule[]>(() => {
    const now = new Date();
    return snapshot.schedules
    .filter((schedule) => schedule.status === "active")
    .map((schedule) => {
      const coverage = monthCoverage(schedule, month);
      // Only dates that have not ended can still be staffed.
      const upcoming = coverage.covered ? buildMonthOccurrences(month, [schedule], [], { from: now }).length : 0;
      return {
        id: schedule.id,
        name: schedule.name,
        dayOfWeek: schedule.dayOfWeek,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        minimumBrokers: schedule.minimumBrokers,
        maximumBrokers: schedule.maximumBrokers,
        dates: upcoming,
        finished: coverage.covered && upcoming === 0,
        queueId: schedule.linkedQueueId ?? null,
        queueName: schedule.linkedQueueId ? schedule.queueName : null,
        queues: schedule.linkedQueues ?? [],
        outside: coverage.covered ? null : { reason: coverage.reason, label: outsideLabel(schedule, coverage.reason) },
      };
    });
  }, [month, snapshot.schedules]);
  const plan = plansState.plans[month];
  const publishedScheduleIds = useMemo(
    () => new Set(plan?.status === "published" ? plan.occurrences.filter((occurrence) => occurrence.assignedCount > 0).map((occurrence) => occurrence.scheduleId) : []),
    [plan],
  );

  const repeatingScheduleIds = useMemo(
    () => new Set(monthSchedules.filter((schedule) => !isSingleDaySchedule(schedule)).map((schedule) => schedule.id)),
    [monthSchedules],
  );
  const gapScheduleIds = useMemo(
    () => new Set(monthSchedules.filter((schedule) => schedule.status === "active" && !coverageLabel(schedule, snapshot).covered).map((schedule) => schedule.id)),
    [monthSchedules, snapshot],
  );
  const monthDays = summarizeDutyDays(monthSchedules.filter((schedule) => schedule.status === "active").map((schedule) => progressById.get(schedule.id)));
  const gapCount = summarizeDutyDays(monthSchedules.filter((schedule) => schedule.status === "active" && gapScheduleIds.has(schedule.id) && !publishedScheduleIds.has(schedule.id)).map((schedule) => progressById.get(schedule.id))).upcoming;

  function openCreate(date: string | null = null) {
    setCreateDate(date);
    setFormSchedule(null);
    setFormOpen(true);
  }
  function openEdit(schedule: Schedule) {
    setSelectedSchedule(null);
    setFormSchedule(schedule);
    setFormOpen(true);
  }
  function chooseMonth(key: string) {
    setMonth(key);
    if (plannerOpen) updateMonthParam(key);
  }
  function updateMonthParam(value: string | null) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("escalaMes", value);
    else url.searchParams.delete("escalaMes");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  function setPlanner(open: boolean) {
    setPlannerOpen(open);
    updateMonthParam(open ? month : null);
  }

  /** One click: keep the plantão going until the last day of the viewed month. */
  async function extendSchedule(scheduleId: string) {
    const schedule = snapshot.schedules.find((item) => item.id === scheduleId);
    if (!schedule) return false;
    const formData = new FormData();
    formData.set("scheduleId", schedule.id);
    formData.set("name", schedule.name);
    formData.set("typeName", schedule.typeName ?? "");
    formData.set("dayOfWeek", String(schedule.dayOfWeek));
    formData.set("startsAt", schedule.startsAt);
    formData.set("endsAt", schedule.endsAt);
    formData.set("minimumBrokers", String(schedule.minimumBrokers));
    formData.set("maximumBrokers", schedule.maximumBrokers === null ? "" : String(schedule.maximumBrokers));
    formData.set("maxLeadsPerBroker", schedule.maxLeadsPerBroker == null ? "" : String(schedule.maxLeadsPerBroker));
    formData.set("validFrom", dateInputValue(schedule.validFrom));
    formData.set("validUntil", lastDayOfMonth(month));
    if (schedule.webhookCredentialId) formData.set("webhookCredentialId", schedule.webhookCredentialId);
    const result = await updateDutyScheduleAction({}, formData);
    if (!result.success) {
      toast.error(result.error ?? "Não foi possível estender o plantão.");
      return false;
    }
    toast.success(`${schedule.name} agora vai até ${dateLabel(new Date(`${lastDayOfMonth(month)}T12:00:00Z`))}.`);
    router.refresh();
    return true;
  }

  const monthStart = `${month}-01`;
  const todayKey = dateInputValue(new Date());
  const defaultStartDate = monthStart > todayKey ? monthStart : todayKey;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Plantões</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Cada plantão vale no dia escolhido, para todas as unidades. ↻ marca os que repetem toda semana.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {monthlySchedulingEnabled ? (
            <Button variant="outline" onClick={() => setPlanner(true)}>
              <CalendarCheck className="size-4" />
              Escala de {monthLabel(month).replace(/ de \d{4}$/, "")}
            </Button>
          ) : null}
          <Button onClick={() => openCreate()}>
            <Plus />
            Novo plantão
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3">
        <StatCard label={`Dias com plantão em ${monthLabel(month).replace(/ de \d{4}$/, "").toLocaleLowerCase("pt-BR")}`} value={monthDays.total} sublabel={`${monthDays.upcoming} por acontecer · ${monthDays.finished} ${monthDays.finished === 1 ? "encerrado" : "encerrados"}`} />
        <StatCard
          label="Dias sem cobertura"
          value={gapCount}
          sublabel="abaixo do mínimo na escala semanal"
          valueClassName={gapCount ? "text-warning" : undefined}
        />
      </section>

      <Card variant="overview">
        <CardHeader className="gap-0 border-b border-border/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4" />
              {monthLabel(month)}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Mês anterior" disabled={month <= firstMonth} onClick={() => chooseMonth(shiftMonth(month, -1))}>
                <ChevronDownIcon className="size-4 rotate-90" />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Próximo mês" disabled={month >= lastMonth} onClick={() => chooseMonth(shiftMonth(month, 1))}>
                <ChevronDownIcon className="size-4 -rotate-90" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4">
          {monthSchedules.length ? (
            <DutyMonthCalendar
              month={month}
              schedules={monthSchedules}
              progressById={progressById}
              publishedScheduleIds={publishedScheduleIds}
              gapScheduleIds={gapScheduleIds}
              repeatingScheduleIds={repeatingScheduleIds}
              canCreate
              onOpen={setSelectedSchedule}
              onCreateOnDate={(date) => openCreate(date)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">Nenhum plantão acontece em {monthLabel(month)}</p>
              <Button onClick={() => openCreate()}>
                <Plus />
                Novo plantão
              </Button>
            </div>
          )}
          <label className="flex items-center gap-2 justify-self-end text-xs text-muted-foreground">
            <Checkbox checked={showArchived} onCheckedChange={(checked) => setShowArchived(checked === true)} />
            Mostrar arquivados
          </label>
          {outsideSchedules.length ? (
            <details className="rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-xs">
              <summary className="cursor-pointer font-medium">
                {outsideSchedules.length} {outsideSchedules.length === 1 ? "plantão não acontece" : "plantões não acontecem"} em {monthLabel(month)}
              </summary>
              <ul className="mt-2 grid gap-1.5">
                {outsideSchedules.map((schedule) => {
                  const coverage = coverageById.get(schedule.id);
                  const reason = coverage && !coverage.covered ? coverage.reason : "no_weekday";
                  return (
                    <li key={schedule.id} className="flex items-center justify-between gap-2">
                      <button type="button" className="min-w-0 text-left hover:underline" onClick={() => setSelectedSchedule(schedule)}>
                        <span className="block truncate text-foreground">{schedule.name} · {DAYS[schedule.dayOfWeek]} {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</span>
                        <span className="block text-muted-foreground">{outsideLabel(schedule, reason)}</span>
                      </button>
                      {reason === "ends_before" && schedule.status === "active" ? (
                        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => { void extendSchedule(schedule.id); }}>
                          Estender até o fim do mês
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </CardContent>
      </Card>

      {monthlySchedulingEnabled ? (
        <MonthlyDutyPlanner
          brokers={snapshot.brokers}
          enabled={monthlySchedulingEnabled}
          canEdit={canPlanMonthlySchedule}
          month={month}
          open={plannerOpen}
          onOpenChange={setPlanner}
          schedules={plannerSchedules}
          plansState={plansState}
          onCreateSchedule={() => {
            setReturnToPlanner(true);
            setPlannerOpen(false);
            openCreate(null);
          }}
          onExtendSchedule={extendSchedule}
        />
      ) : null}
      <DutyInspector
        key={`${selectedSchedule?.id ?? "closed"}-${selectedSchedule ? "open" : "closed"}`}
        schedule={selectedSchedule}
        open={Boolean(selectedSchedule)}
        onOpenChange={(open) => {
          if (!open) setSelectedSchedule(null);
        }}
        snapshot={snapshot}
        onEdit={openEdit}
      />
      <DutyFormSheet
        key={formSchedule?.id ?? (formOpen ? `new-${createDate ?? month}` : "closed")}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open && returnToPlanner) {
            setReturnToPlanner(false);
            setPlannerOpen(true);
          }
        }}
        schedule={formSchedule}
        snapshot={snapshot}
        queues={queues}
        defaultStartDate={createDate ?? defaultStartDate}
      />
    </div>
  );
}
