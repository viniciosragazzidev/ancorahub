"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import {
  ArrowLeft,
  ArrowSquareOut,
  CalendarCheck,
  ChevronDownIcon,
  CheckCircle,
  Clock,
  Copy,
  FolderSimple,
  Loader2Icon,
  PencilSimple,
  Plus,
  Trash,
  Users,
  WarningCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/select";
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
  removeRosterAssignmentAction,
} from "@/features/lead-distribution/roster-actions";
import { syncDutySchedulesIntoQueueAction } from "@/features/lead-distribution/actions";
import { getDutyCoverage } from "@/features/lead-distribution/domain";
import {
  getDefaultDutyScheduleMonthKey,
  getDutyScheduleMonthKey,
  getOperationalMonthKey,
  groupDutySchedulesByMonth,
} from "./duty-schedule-month-groups";

type Snapshot = DutyRosterSnapshot;
type Schedule = Snapshot["schedules"][number];
type Assignment = Snapshot["assignments"][number];
type DutyAction = (previous: DutyActionState, formData: FormData) => Promise<DutyActionState>;

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(value);
}

function dateLabel(value: Date | null) {
  if (!value) return "Sem término";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function coverageLabel(schedule: Schedule, assignments: Assignment[]) {
  const assigned = assignments.filter((assignment) => assignment.scheduleId === schedule.id).length;
  return getDutyCoverage(assigned, schedule.minimumBrokers);
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

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "neutral",
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: number;
  description: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/5"
      : tone === "success"
        ? "border-success/25 bg-success/5"
        : "border-border/80 bg-card";
  const iconTone =
    tone === "warning"
      ? "bg-warning/10 text-warning"
      : tone === "success"
        ? "bg-success/10 text-success"
        : "bg-muted text-muted-foreground";
  return (
    <Card className={`gap-0 p-0 ${toneClass}`}>
      <CardContent className="flex min-h-20 items-center gap-3 p-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DutyCard({
  schedule,
  assignments,
  onOpen,
}: {
  schedule: Schedule;
  assignments: Assignment[];
  onOpen: () => void;
}) {
  const coverage = coverageLabel(schedule, assignments);
  const coverageClass =
    schedule.status !== "active"
      ? "border-border/70 bg-muted/20 text-muted-foreground"
      : coverage.covered
        ? "border-border bg-card hover:border-primary/35"
        : "border-warning/40 bg-warning/5 hover:border-warning/60";
  return (
    <Button
      type="button"
      onClick={onOpen}
      className={`group h-auto min-w-0 max-w-full flex-col items-stretch overflow-hidden px-3 py-2.5 text-left ${coverageClass}`}
      variant="outline"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{schedule.name}</p>
        <StatusBadge status={schedule.status} />
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Clock className="size-3 shrink-0" />
        {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}
      </p>
      <p className="mt-2 truncate text-xs text-muted-foreground">
        {schedule.queueName} · {schedule.credentialName ?? "Todas as origens"}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <Badge variant={coverage.covered || schedule.status !== "active" ? "outline" : "warning"}>
          {coverage.assigned}/{coverage.minimum} escalados
        </Badge>
      </div>
    </Button>
  );
}

function DutyTimeline({
  schedules,
  assignments,
  onOpen,
}: {
  schedules: Schedule[];
  assignments: Assignment[];
  onOpen: (schedule: Schedule) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowScrollButton(el.scrollLeft > 20);
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, []);

  const scrollToStart = useCallback(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="grid min-w-[1540px] grid-cols-7 overflow-hidden rounded-xl border border-border/70 bg-border/70">
          {DAYS.map((day, dayIndex) => {
            const daySchedules = schedules.filter((schedule) => schedule.dayOfWeek === dayIndex);
            return (
              <section key={day} className="min-w-0 bg-card">
                <header className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
                  <h3 className="text-xs font-semibold text-foreground">{day}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {daySchedules.length}
                  </span>
                </header>
                <div className="min-h-60 space-y-2 bg-muted/10 p-3">
                  {daySchedules.map((schedule) => (
                    <DutyCard
                      key={schedule.id}
                      schedule={schedule}
                      assignments={assignments}
                      onOpen={() => onOpen(schedule)}
                    />
                  ))}
                  {daySchedules.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">
                      Sem plantão
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>{" "}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={scrollToStart}
        className={`absolute bottom-3 left-3 z-10 rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-background hover:text-foreground hover:shadow-md active:scale-95 ${showScrollButton ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ArrowLeft className="size-3.5" />
        Início
      </Button>
    </div>
  );
}

function CoverageAlerts({
  schedules,
  assignments,
  onOpen,
}: {
  schedules: Schedule[];
  assignments: Assignment[];
  onOpen: (schedule: Schedule) => void;
}) {
  const gaps = schedules.filter(
    (schedule) => schedule.status === "active" && !coverageLabel(schedule, assignments).covered,
  );
  if (!gaps.length)
    return (
      <Card className="gap-0 border-success/25 bg-success/5 p-0">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
            <CheckCircle className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Cobertura em dia</p>
            <p className="text-xs text-muted-foreground">
              Todos os plantões ativos atendem ao mínimo definido.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  return (
    <Card className="gap-0 overflow-hidden border-warning/35 bg-warning/5 p-0">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
          <WarningCircle className="size-4" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-sm">Lacunas de cobertura</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A distribuição segue ativa para quem já está escalado.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 pb-4">
        {gaps.map((schedule) => {
          const coverage = coverageLabel(schedule, assignments);
          return (
            <Button
              key={schedule.id}
              type="button"
              onClick={() => onOpen(schedule)}
              className="h-auto min-w-0 justify-between gap-3 border-warning/25 bg-card/70 px-3 py-2 text-left hover:bg-card"
              variant="outline"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{schedule.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {DAYS_FULL[schedule.dayOfWeek]} · {schedule.startsAt.slice(0, 5)}–
                  {schedule.endsAt.slice(0, 5)} · {schedule.queueName}
                </span>
              </span>
              <Badge variant="warning" className="shrink-0">
                Faltam {coverage.minimum - coverage.assigned}
              </Badge>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DutyFormSheet({
  open,
  onOpenChange,
  schedule,
  snapshot,
  queues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  snapshot: Snapshot;
  queues: QueueOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedDays, setSelectedDays] = useState<number[]>(() => [schedule?.dayOfWeek ?? 1]);
  // Only offered at creation: picking a queue here is a shortcut for the same
  // "Exclusividade de Plantão" checklist the queue editor already has.
  const [queueId, setQueueId] = useState<string>("");
  const canSubmit = selectedDays.length > 0;
  const title = schedule ? "Editar plantão" : "Novo plantão";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (schedule) {
      formData.set("scheduleId", schedule.id);
      formData.set("dayOfWeek", String(selectedDays[0] ?? schedule.dayOfWeek));
    } else {
      formData.set("daysOfWeek", JSON.stringify(selectedDays));
      // Lets the same-time conflict check scope by queue: a different queue
      // at the same day/time is fine, only the same queue collides.
      if (queueId) formData.set("responsibleQueueId", queueId);
    }
    const action: DutyAction = schedule ? updateDutyScheduleAction : createDutyScheduleAction;
    startTransition(async () => {
      const result = await action({}, formData);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível salvar o plantão.");
        return;
      }
      if (!schedule && queueId && result.scheduleIds?.length) {
        const syncResult = await syncDutySchedulesIntoQueueAction({ queueId, scheduleIds: result.scheduleIds });
        if (!syncResult.success) {
          toast.warning("Plantão criado, mas não foi possível vincular à fila.", { description: syncResult.error });
          router.refresh();
          onOpenChange(false);
          return;
        }
      }
      toast.success(
        schedule
          ? "Plantão atualizado."
          : queueId
            ? `${result.scheduleIds?.length ?? 1} plantão(ões) criado(s) e vinculado(s) à fila.`
            : `${result.scheduleIds?.length ?? 1} plantão(ões) criado(s).`,
      );
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
              ? "Edite o horário e a cobertura deste plantão global. O dia desta regra permanece fixo."
              : "Este plantão será compartilhado por todas as unidades e corretores da corretora."}
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
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground">
              <p className="font-medium">Escopo global da corretora</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                O mesmo horário e a mesma regra serão aplicados aos corretores escalados em todas as unidades. A fila de entrada continua definindo quais leads podem usar este plantão.
              </p>
            </div>
            {!schedule ? (
              <div className="grid gap-2">
                <Label htmlFor="duty-queue">Fila responsável (opcional)</Label>
                <AppSelect
                  aria-label="Fila responsável pelo plantão"
                  value={queueId}
                  onValueChange={setQueueId}
                  options={[
                    { value: "", label: "Nenhuma agora — vincular depois pela fila" },
                    ...queues.map((queue) => ({ value: queue.id, label: queue.name })),
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Marca este plantão como exclusividade dessa fila assim que ele for criado — o mesmo que fazer depois em Filas → Editar → Exclusividade de Plantão. Escolher a fila também libera criar outro plantão no mesmo horário, desde que seja para uma fila diferente.
                </p>
              </div>
            ) : null}
            <div className="grid gap-3">
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Dias da semana</legend>
                <p className="text-xs text-muted-foreground">
                  {schedule ? "Esta regra vale para um único dia." : "Selecione um ou mais dias."}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DAYS_FULL.map((day, index) => {
                    const selected = selectedDays.includes(index);
                    return (
                      <label
                        key={day}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="duty-valid-from">Início da vigência</Label>
                <Input
                  id="duty-valid-from"
                  name="validFrom"
                  type="date"
                  defaultValue={dateInputValue(schedule?.validFrom ?? new Date())}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duty-valid-until">Fim da vigência</Label>
                <Input
                  id="duty-valid-until"
                  name="validUntil"
                  type="date"
                  defaultValue={dateInputValue(schedule?.validUntil ?? null)}
                />
              </div>
            </div>
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
              className="rounded-xl border border-primary/20 bg-primary/5 p-4"
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
            <p className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Fuso operacional: America/Sao_Paulo. A fila de entrada seleciona os leads; a escala
              do plantão reúne corretores de todas as unidades.
            </p>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending
                ? "Salvando…"
                : schedule
                  ? "Salvar alterações"
                  : "Criar plantão global"}
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
  const assignments = schedule
    ? snapshot.assignments.filter((assignment) => assignment.scheduleId === schedule.id)
    : [];
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
    formData.set("startsAt", schedule.startsAt);
    formData.set("endsAt", schedule.endsAt);
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

  function removeAssignment(assignment: Assignment) {
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

  const coverage = schedule ? coverageLabel(schedule, snapshot.assignments) : null;
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
                <SheetTitle>{schedule.name}</SheetTitle>
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
                  Abrir página do plantão
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
                      <dt className="text-muted-foreground">Vigência</dt>
                      <dd className="text-right">
                        {dateLabel(schedule.validFrom)} · {dateLabel(schedule.validUntil)}
                      </dd>
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
                    <div className="grid gap-2">
                      <Input
                        value={brokerSearch}
                        onChange={(event) => setBrokerSearch(event.target.value)}
                        placeholder="Pesquisar corretor por nome ou código"
                        aria-label="Pesquisar corretor por nome ou código"
                        disabled={pending || schedule.status !== "active"}
                      />
                      {brokerSearch.trim() && schedule.status === "active" ? (
                        <div className="rounded-lg border border-border/70 bg-card">
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
                    <div className="grid gap-2">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {assignment.brokerName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Escalado neste horário
                            </span>
                          </span>
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
                      {!assignments.length && (
                        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                          Nenhum corretor escalado.
                        </p>
                      )}
                    </div>
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

export function DutyOperationsWorkspace({ snapshot, queues = [] }: { snapshot: Snapshot; queues?: QueueOption[] }) {
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [formSchedule, setFormSchedule] = useState<Schedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const scopedSchedules = useMemo(
    () =>
      snapshot.schedules.filter(
        (schedule) =>
          (showArchived || schedule.status !== "archived"),
      ),
    [showArchived, snapshot.schedules],
  );
  const currentMonthKey = getOperationalMonthKey();
  const monthGroups = useMemo(
    () => groupDutySchedulesByMonth(scopedSchedules, currentMonthKey),
    [currentMonthKey, scopedSchedules],
  );
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(
    () => new Set([getDefaultDutyScheduleMonthKey(monthGroups, currentMonthKey)]),
  );
  const knownScheduleMonths = useRef(new Map(
    snapshot.schedules.map((schedule) => [schedule.id, getDutyScheduleMonthKey(schedule.validFrom)]),
  ));
  useEffect(() => {
    const currentScheduleMonths = new Map(
      snapshot.schedules.map((schedule) => [schedule.id, getDutyScheduleMonthKey(schedule.validFrom)]),
    );
    const changedMonths = [...currentScheduleMonths.entries()]
      .filter(([scheduleId, monthKey]) => knownScheduleMonths.current.get(scheduleId) !== monthKey)
      .map(([, monthKey]) => monthKey);
    if (changedMonths.length) {
      setExpandedMonthKeys((previous) => new Set([...previous, ...changedMonths]));
    }
    knownScheduleMonths.current = currentScheduleMonths;
  }, [snapshot.schedules]);
  const scopedAssignments = snapshot.assignments;
  const activeCount = scopedSchedules.filter((schedule) => schedule.status === "active").length;
  const inactiveCount = scopedSchedules.filter((schedule) => schedule.status === "inactive").length;
  const archivedCount = snapshot.schedules.filter((schedule) => schedule.status === "archived").length;
  const gapCount = scopedSchedules.filter(
    (schedule) =>
      schedule.status === "active" && !coverageLabel(schedule, scopedAssignments).covered,
  ).length;

  function openCreate() {
    setFormSchedule(null);
    setFormOpen(true);
  }
  function openEdit(schedule: Schedule) {
    setSelectedSchedule(null);
    setFormSchedule(schedule);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Plantões</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Organize escalas, horários e cobertura sem perder o vínculo com a fila de destino.
          </p>
        </div>
        <Button
          onClick={openCreate}
        >
          <Plus />
          Novo plantão
        </Button>
      </section>
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Escopo: todas as unidades</p>
          <p className="mt-1 text-xs text-muted-foreground">Os plantões são globais; as filas apenas escolhem quando uma origem usa a regra.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          Mostrar arquivados
        </label>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarCheck}
          label="Plantões ativos"
          value={activeCount}
          description="Regras elegíveis agora"
          tone="success"
        />
        <SummaryCard
          icon={Users}
          label="Sem cobertura"
          value={gapCount}
          description="Abaixo do mínimo configurado"
          tone={gapCount ? "warning" : "neutral"}
        />
        <SummaryCard
          icon={Clock}
          label="Inativos"
          value={inactiveCount}
          description="Regras pausadas"
        />
        <SummaryCard
          icon={Trash}
          label="Arquivados"
          value={archivedCount}
          description="Histórico reversível"
        />
      </section>
      {gapCount > 0 && (
        <CoverageAlerts
          schedules={scopedSchedules}
          assignments={scopedAssignments}
          onOpen={setSelectedSchedule}
        />
      )}
      <Card className="gap-0 overflow-hidden border-border/80 p-0">
        <CardHeader className="border-b border-border/70 bg-card/70 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Plantões por mês</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Agrupados pelo início da vigência. Abra um mês para editar os plantões e as escalas.
              </p>
            </div>
            <Badge variant="outline">America/Sao_Paulo</Badge>
          </div>
        </CardHeader>{" "}
        <CardContent className="max-h-[80vh] overflow-y-auto p-3 sm:p-4">
          <div className="space-y-3">
            {monthGroups.map((group) => {
              const expanded = expandedMonthKeys.has(group.key);
              const regionId = `duty-month-${group.key}`;
              return (
                <section key={group.key} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between gap-3 rounded-none px-3 py-3 text-left sm:px-4"
                    id={`${regionId}-trigger`}
                    aria-expanded={expanded}
                    aria-controls={regionId}
                    onClick={() => setExpandedMonthKeys((previous) => {
                      const next = new Set(previous);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    })}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <FolderSimple aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{group.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {group.schedules.length} {group.schedules.length === 1 ? "plantão" : "plantões"}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {group.key === currentMonthKey ? <Badge variant="secondary">Mês atual</Badge> : null}
                      <Badge variant="outline">{group.schedules.length}</Badge>
                      <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                    </span>
                  </Button>
                  <div
                    id={regionId}
                    role="region"
                    aria-labelledby={`${regionId}-trigger`}
                    hidden={!expanded}
                    className="border-t border-border/70 p-3 sm:p-4"
                  >
                    {expanded ? (
                      <DutyTimeline
                        schedules={group.schedules}
                        assignments={scopedAssignments}
                        onOpen={setSelectedSchedule}
                      />
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {!scopedSchedules.length && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
              <CalendarCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Nenhum plantão neste escopo</p>
          <p className="mt-1 text-xs text-muted-foreground">
                Crie uma regra para organizar a cobertura de todas as unidades.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus />
              Criar plantão
            </Button>
          </CardContent>
        </Card>
      )}
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
        key={formSchedule?.id ?? (formOpen ? "new" : "closed")}
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={formSchedule}
        snapshot={snapshot}
        queues={queues}
      />
    </div>
  );
}
