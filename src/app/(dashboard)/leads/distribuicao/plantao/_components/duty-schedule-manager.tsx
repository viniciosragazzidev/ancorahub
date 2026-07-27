"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  Buildings,
  CalendarBlank,
  CalendarCheck,
  Clock,
  Plus,
  XCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  createDutyScheduleAction,
  toggleDutyScheduleAction,
  type DutyActionState,
} from "@/features/lead-distribution/duty-actions";

type Branch = { id: string; name: string };
type Queue = { id: string; branchId: string; name: string };
type Credential = { id: string; name: string };
type Schedule = {
  id: string;
  branchId: string;
  queueId: string;
  name: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  priority: number;
  status: string;
  webhookCredentialId: string | null;
};

const DAY_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

const COLORS_BY_PRIORITY = [
  { min: 0, max: 10, bg: "bg-primary/20", border: "border-primary/40", text: "text-primary", dot: "bg-primary" },
  { min: 11, max: 30, bg: "bg-chart-2/15", border: "border-chart-2/35", text: "text-chart-2", dot: "bg-chart-2" },
  { min: 31, max: 60, bg: "bg-chart-3/15", border: "border-chart-3/35", text: "text-chart-3", dot: "bg-chart-3" },
  { min: 61, max: 100, bg: "bg-chart-4/15", border: "border-chart-4/35", text: "text-chart-4", dot: "bg-chart-4" },
  { min: 101, max: Infinity, bg: "bg-chart-5/15", border: "border-chart-5/35", text: "text-chart-5", dot: "bg-chart-5" },
] as const;

function getPriorityColor(priority: number) {
  return (
    COLORS_BY_PRIORITY.find((c) => priority >= c.min && priority <= c.max) ??
    COLORS_BY_PRIORITY[4]
  );
}

function getMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function Feedback({ state }: { state: DutyActionState }) {
  useEffect(() => {
    if (state.success) toast.success("Plantão atualizado.");
    if (state.error) toast.error(state.error);
  }, [state]);
  return null;
}

function NewScheduleForm({
  branches,
  queues,
  credentials,
  onSuccess,
}: {
  branches: Branch[];
  queues: Queue[];
  credentials: Credential[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(createDutyScheduleAction, {});
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id ?? "");
  const [selectedQueue, setSelectedQueue] = useState(queues[0]?.id ?? "");

  const branchQueues = useMemo(
    () => queues.filter((q) => q.branchId === selectedBranch),
    [queues, selectedBranch],
  );

  // Reset queue selection when branch changes
  useEffect(() => {
    if (branchQueues.length > 0 && !branchQueues.some((q) => q.id === selectedQueue)) {
      setSelectedQueue(branchQueues[0]?.id ?? "");
    }
  }, [branchQueues, selectedQueue]);

  useEffect(() => {
    if (state.success) {
      toast.success("Plantão criado com sucesso.");
      onSuccess?.();
    }
    if (state.error) toast.error(state.error);
  }, [state, onSuccess]);

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="duty-name">Nome do plantão</Label>
        <Input
          id="duty-name"
          name="name"
          placeholder="Ex: Plantão comercial"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="duty-branch">Unidade</Label>
        <select
          id="duty-branch"
          name="branchId"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="duty-queue">Fila de distribuição</Label>
        <select
          id="duty-queue"
          name="queueId"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={selectedQueue}
          onChange={(e) => setSelectedQueue(e.target.value)}
        >
          {branchQueues.map((queue) => (
            <option key={queue.id} value={queue.id}>
              {queue.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="duty-day">Dia da semana</Label>
          <select
            id="duty-day"
            name="dayOfWeek"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
            defaultValue="1"
          >
            {DAY_FULL.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="duty-priority">Prioridade</Label>
          <Input
            id="duty-priority"
            name="priority"
            type="number"
            defaultValue={100}
            min={1}
            max={999}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="duty-start">Início</Label>
          <Input id="duty-start" name="startsAt" type="time" defaultValue="09:00" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="duty-end">Fim</Label>
          <Input id="duty-end" name="endsAt" type="time" defaultValue="18:00" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="duty-valid-from">Início da vigência</Label>
          <Input id="duty-valid-from" name="validFrom" type="date" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="duty-valid-until">Fim da vigência (opcional)</Label>
          <Input id="duty-valid-until" name="validUntil" type="date" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="duty-credential">Origem do lead (opcional)</Label>
        <select
          id="duty-credential"
          name="webhookCredentialId"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          defaultValue=""
        >
          <option value="">Todas as origens</option>
          {credentials.map((cred) => (
            <option key={cred.id} value={cred.id}>
              {cred.name}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Selecione uma origem para receber apenas leads daquele webhook.
        </p>
      </div>

      <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
        Prioridades menores vencem conflitos. Use 1–10 para plantões críticos e 100+ para regras
        gerais.
      </div>

      <Button disabled={pending} type="submit">
        {pending ? "Criando…" : "Criar plantão"}
      </Button>
    </form>
  );
}

function ScheduleBlock({
  schedule,
  branchName,
  queueName,
  credentialName,
  index,
  top,
  height,
  onToggle,
}: {
  schedule: Schedule;
  branchName: string;
  queueName: string;
  credentialName: string | null;
  index: number;
  top: number;
  height: number;
  onToggle: (scheduleId: string) => void;
}) {
  const color = getPriorityColor(schedule.priority);
  const isActive = schedule.status === "active";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <motion.button
            type="button"
            onClick={() => onToggle(schedule.id)}
            className={`absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-all duration-150 ${
              isActive
                ? `${color.bg} ${color.border} ${color.text} hover:brightness-110`
                : "border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground/60 hover:bg-muted/50"
            }`}
            style={{ top: `${top}%`, height: `${Math.max(height, 4)}%`, minHeight: 20 }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: Math.min(index * 0.03, 0.3),
              duration: 0.15,
              ease: [0, 0, 0.2, 1],
            }}
            whileHover={{ scale: 1.02, zIndex: 10 }}
            whileTap={{ scale: 0.98 }}
          />
        }
      >
        {isActive && (
          <span
            className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-full ${color.dot}`}
          />
        )}
        <span className="relative truncate font-medium">
          {!isActive && <span className="mr-1 line-through">{schedule.name}</span>}
          {isActive && schedule.name}
        </span>
        <span className="relative block truncate opacity-75">
          {formatTime(schedule.startsAt)}–{formatTime(schedule.endsAt)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-56">
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold">{schedule.name}</p>
          <div className="grid gap-0.5 text-[10px] opacity-80">
            <p>Unidade: {branchName}</p>
            <p>Fila: {queueName}</p>
            <p>
              {DAY_FULL[schedule.dayOfWeek]} · {formatTime(schedule.startsAt)}–
              {formatTime(schedule.endsAt)}
            </p>
            <p>Prioridade: {schedule.priority}</p>
            <p>Origem: {credentialName ?? "Todas"}</p>
            <p>Status: {isActive ? "Ativo" : "Inativo"}</p>
          </div>
          <p className="text-[10px] opacity-60">
            Clique para {isActive ? "desativar" : "ativar"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function WeeklyCalendarGrid({
  schedules,
  branches,
  queues,
  credentials,
  onToggle,
}: {
  schedules: Schedule[];
  branches: Branch[];
  queues: Queue[];
  credentials: Credential[];
  onToggle: (scheduleId: string) => void;
}) {
  const timeRange = useMemo(() => {
    if (!schedules.length) return { start: 6, end: 23 };
    const starts = schedules.map((s) => Math.floor(getMinutes(s.startsAt) / 60));
    const ends = schedules.map((s) => Math.ceil(getMinutes(s.endsAt) / 60));
    return {
      start: Math.max(0, Math.min(...starts) - 1),
      end: Math.min(23, Math.max(...ends) + 1),
    };
  }, [schedules]);

  const hourSlots = useMemo(() => {
    const slots: number[] = [];
    for (let h = timeRange.start; h < timeRange.end; h++) {
      slots.push(h);
    }
    return slots;
  }, [timeRange]);

  if (!schedules.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <CalendarBlank className="size-8 text-muted-foreground/60" />
        <div>
          <p className="text-sm font-medium text-foreground">Nenhum plantão cadastrado</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clique em "Novo plantão" para criar o primeiro horário de distribuição.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      {/* Calendar Grid: CSS Grid with time col + 7 day cols */}
      <div
        className="grid min-w-[680px]"
        style={{
          gridTemplateColumns: `60px repeat(7, 1fr)`,
          gridTemplateRows: `auto repeat(${hourSlots.length}, 48px)`,
        }}
      >
        {/* Corner cell with clock icon */}
        <div className="sticky left-0 z-10 flex items-center justify-center border-b border-r border-border bg-muted/40">
          <Clock className="size-3.5 text-muted-foreground/50" />
        </div>

        {/* Day header cells */}
        {DAY_FULL.map((day, i) => {
          const daySchedules = schedules.filter((s) => s.dayOfWeek === i);
          const hasActive = daySchedules.some((s) => s.status === "active");
          return (
            <div
              key={day}
              className={`flex items-center justify-between gap-1 border-b border-border px-2 py-2 ${
                hasActive ? "bg-primary/[0.03]" : "bg-muted/20"
              }`}
            >
              <span className="text-xs font-semibold text-foreground">{day.slice(0, 3)}</span>
              {daySchedules.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {daySchedules.length}
                </span>
              )}
            </div>
          );
        })}

        {/* Hour rows */}
        {hourSlots.map((hour, rowIndex) => {
          const scheduleStartHour = hour;
          const scheduleEndHour = hour + 1;

          return (
            <div key={hour} className="contents">
              {/* Time gutter */}
              <div className="sticky left-0 z-10 flex items-start justify-end border-b border-r border-border bg-card pr-2 pt-1">
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
                  {String(hour).padStart(2, "0")}h
                </span>
              </div>

              {/* Day cells */}
              {DAY_FULL.map((_, dayIndex) => {
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`relative border-b border-r border-border/60 ${
                      rowIndex % 2 === 0 ? "bg-background/40" : "bg-muted/10"
                    }`}
                  >
                    {/* Render schedules that START in this hour slot */}
                    {schedules
                      .filter((s) => {
                        if (s.dayOfWeek !== dayIndex) return false;
                        const sMin = getMinutes(s.startsAt);
                        // Only render in the cell corresponding to the schedule's start hour
                        const startHour = Math.floor(sMin / 60);
                        return startHour === scheduleStartHour;
                      })
                      .map((schedule, sIndex) => {
                        const sMin = getMinutes(schedule.startsAt);
                        const eMin = getMinutes(schedule.endsAt);
                        const cellStart = scheduleStartHour * 60;
                        const blockTop = ((sMin - cellStart) / 60) * 100;
                        const blockHeight = ((eMin - sMin) / 60) * 100;

                        // Don't render if block is too tiny or negative
                        if (blockHeight <= 0) return null;

                        const branchObj = branches.find(
                          (b) => b.id === schedule.branchId,
                        );
                        const queueObj = queues.find(
                          (q) => q.id === schedule.queueId,
                        );

                        return (
                          <ScheduleBlock
                            key={schedule.id}
                            schedule={schedule}
                            branchName={branchObj?.name ?? "Unidade"}
                            queueName={queueObj?.name ?? "Fila"}
                            credentialName={credentials.find((credential) => credential.id === schedule.webhookCredentialId)?.name ?? null}
                            index={sIndex}
                            top={blockTop}
                            height={blockHeight}
                            onToggle={onToggle}
                          />
                        );
                      })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DutyScheduleManager({
  branches,
  queues,
  schedules,
  credentials,
}: {
  branches: Branch[];
  queues: Queue[];
  schedules: Schedule[];
  credentials: Credential[];
}) {
  const [toggleState, toggleAction] = useActionState(toggleDutyScheduleAction, {});
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredSchedules = useMemo(() => {
    if (selectedBranch === "all") return schedules;
    return schedules.filter((s) => s.branchId === selectedBranch);
  }, [schedules, selectedBranch]);

  const activeCount = filteredSchedules.filter((s) => s.status === "active").length;
  const inactiveCount = filteredSchedules.length - activeCount;

  const daysWithSchedules = DAY_FULL.map((day, i) => ({
    day,
    count: filteredSchedules.filter((s) => s.dayOfWeek === i && s.status === "active").length,
  }));

  function handleToggle(scheduleId: string) {
    const formData = new FormData();
    formData.set("scheduleId", scheduleId);
    toggleAction(formData);
  }

  return (
    <TooltipProvider delay={400}>
      <div className="grid gap-6">
        {/* Top bar: branch filter + new schedule button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Buildings className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              aria-label="Filtrar por unidade"
              className="h-9 w-56 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">Todas as unidades</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              render={
                <Button size="sm">
                  <Plus className="size-4" />
                  Novo plantão
                </Button>
              }
            />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Novo plantão</SheetTitle>
                <SheetDescription>
                  Defina qual fila recebe prioridade em cada horário. Prioridades menores vencem.
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <NewScheduleForm
                  branches={branches}
                  queues={queues}
                  credentials={credentials}
                  onSuccess={() => setSheetOpen(false)}
                />
              </SheetBody>
            </SheetContent>
          </Sheet>
        </div>

        {/* Stats bar */}
        <motion.div
          className="flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
        >
          <Badge variant="outline" className="gap-1.5 border-border/60 bg-card px-3 py-1.5">
            <CalendarCheck className="size-3.5 text-primary" />
            <span className="text-xs font-medium">
              <strong className="tabular-nums">{activeCount}</strong> ativo
              {activeCount !== 1 ? "s" : ""}
            </span>
          </Badge>
          {inactiveCount > 0 && (
            <Badge variant="outline" className="gap-1.5 border-border/60 bg-card px-3 py-1.5">
              <XCircle className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                <strong className="tabular-nums">{inactiveCount}</strong> inativo
                {inactiveCount !== 1 ? "s" : ""}
              </span>
            </Badge>
          )}
          <Badge variant="outline" className="gap-1.5 border-border/60 bg-card px-3 py-1.5">
            <Buildings className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {branches.length} {branches.length === 1 ? "unidade" : "unidades"}
            </span>
          </Badge>

          {/* Day distribution chips */}
          {daysWithSchedules
            .filter((d) => d.count > 0)
            .map((d) => (
              <Badge
                key={d.day}
                variant="secondary"
                className="gap-1 border-0 bg-primary/8 px-2 py-1 text-[11px] font-medium text-primary"
              >
                {d.day.slice(0, 3)}: {d.count}
              </Badge>
            ))}
        </motion.div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="font-medium">Prioridade:</span>
          {COLORS_BY_PRIORITY.map((c) => (
            <span key={c.min} className="flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-full ${c.dot}`} />
              <span>
                {c.min + 1}–{c.max === Infinity ? "999+" : c.max}
              </span>
            </span>
          ))}
          <span className="ml-2 text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/30" />
            Inativo
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3" />
            Clique no bloco para ativar/desativar
          </span>
        </div>

        {/* Calendar Grid */}
        <WeeklyCalendarGrid
          schedules={filteredSchedules}
          branches={branches}
          queues={queues}
          credentials={credentials}
          onToggle={handleToggle}
        />

        {/* Toggle feedback */}
        <Feedback state={toggleState} />
      </div>
    </TooltipProvider>
  );
}
