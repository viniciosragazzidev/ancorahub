"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CalendarCheck, Clock, DotsThreeVertical, MagnifyingGlass, Users, X } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createRosterAssignmentAction, moveRosterAssignmentAction, removeRosterAssignmentAction } from "@/features/lead-distribution/roster-actions";

type Branch = { id: string; name: string };
type Broker = { id: string; name: string; email: string; branchId: string | null; availabilityStatus: string };
type Schedule = { id: string; branchId: string; queueId: string; name: string; dayOfWeek: number; startsAt: string; endsAt: string; priority: number; status: string };
type Assignment = { id: string; branchId: string; scheduleId: string; brokerId: string; dayOfWeek: number; startsAt: string; endsAt: string; status: string; brokerName: string };

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function DraggableBroker({ broker }: { broker: Broker }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `broker:${broker.id}`, data: { kind: "broker", brokerId: broker.id } });
  return <button ref={setNodeRef} {...listeners} {...attributes} type="button" className={`flex w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 ${isDragging ? "opacity-40" : ""}`}><DotsThreeVertical className="size-3.5 text-muted-foreground" /><span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{broker.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{broker.name}</span><span className={`size-2 rounded-full ${broker.availabilityStatus === "available" ? "bg-success" : "bg-accent"}`} title={broker.availabilityStatus === "available" ? "Disponível" : "Pausado"} /></button>;
}

function AssignmentChip({ assignment, onRemove }: { assignment: Assignment; onRemove: (assignment: Assignment) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `assignment:${assignment.id}`, data: { kind: "assignment", assignment } });
  return <div ref={setNodeRef} {...listeners} {...attributes} className={`group flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-primary/15 ${isDragging ? "opacity-30" : ""}`}><DotsThreeVertical className="size-3 text-muted-foreground" /><span className="min-w-0 flex-1 truncate font-medium">{assignment.brokerName}</span><button type="button" className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" aria-label={`Remover ${assignment.brokerName} da escala`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemove(assignment)}><X className="size-3" /></button></div>;
}

function ScheduleDropZone({ schedule, assignments, onRemove }: { schedule: Schedule; assignments: Assignment[]; onRemove: (assignment: Assignment) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `schedule:${schedule.id}`, data: { schedule } });
  return <div ref={setNodeRef} className={`min-h-24 rounded-lg border p-2 transition-colors ${isOver ? "border-primary bg-primary/10" : "border-border/60 bg-muted/20"}`}><div className="mb-2 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{schedule.name}</p><p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="size-3" />{schedule.startsAt.slice(0, 5)} - {schedule.endsAt.slice(0, 5)}</p></div><Badge variant="outline" className="shrink-0 text-[10px]">P{schedule.priority}</Badge></div><div className="grid gap-1.5">{assignments.map((assignment) => <AssignmentChip key={assignment.id} assignment={assignment} onRemove={onRemove} />)}{assignments.length === 0 && <p className="rounded border border-dashed border-border/70 px-2 py-2 text-center text-[11px] text-muted-foreground">Solte um corretor aqui</p>}</div></div>;
}

export function DutyRosterCalendar({ branches, brokers, schedules, initialAssignments }: { branches: Branch[]; brokers: Broker[]; schedules: Schedule[]; initialAssignments: Assignment[] }) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [assignments, setAssignments] = useState(initialAssignments);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );
  const branchSchedules = useMemo(() => schedules.filter((schedule) => schedule.branchId === selectedBranch && schedule.status === "active"), [schedules, selectedBranch]);
  const branchBrokers = useMemo(() => brokers.filter((broker) => broker.branchId === selectedBranch && broker.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [brokers, query, selectedBranch]);
  const branchAssignments = useMemo(() => assignments.filter((assignment) => assignment.branchId === selectedBranch && assignment.status === "active"), [assignments, selectedBranch]);
  useEffect(() => setAssignments(initialAssignments), [initialAssignments]);

  function formFor(schedule: Schedule, brokerId: string) {
    const form = new FormData();
    form.set("scheduleId", schedule.id); form.set("brokerId", brokerId); form.set("dayOfWeek", String(schedule.dayOfWeek)); form.set("startsAt", schedule.startsAt); form.set("endsAt", schedule.endsAt);
    return form;
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith("broker:")) setActiveLabel(brokers.find((broker) => broker.id === id.slice(7))?.name ?? "Corretor");
    else setActiveLabel(assignments.find((assignment) => assignment.id === id.slice(11))?.brokerName ?? "Escala");
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLabel(null);
    const overId = event.over?.id;
    if (!overId || !String(overId).startsWith("schedule:")) return;
    const schedule = branchSchedules.find((item) => item.id === String(overId).slice(9));
    if (!schedule) return;
    const activeId = String(event.active.id);
    if (activeId.startsWith("broker:")) {
      const brokerId = activeId.slice(7);
      const broker = brokers.find((item) => item.id === brokerId);
      if (!broker) return;
      const optimistic: Assignment = { id: `pending-${crypto.randomUUID()}`, branchId: schedule.branchId, scheduleId: schedule.id, brokerId, dayOfWeek: schedule.dayOfWeek, startsAt: schedule.startsAt, endsAt: schedule.endsAt, status: "active", brokerName: broker.name };
      setAssignments((current) => [...current, optimistic]);
      startTransition(async () => {
        const result = await createRosterAssignmentAction({}, formFor(schedule, brokerId));
        if (!result.success) { setAssignments((current) => current.filter((item) => item.id !== optimistic.id)); toast.error(result.error); return; }
        toast.success("Corretor adicionado à escala."); router.refresh();
      });
      return;
    }
    if (activeId.startsWith("assignment:")) {
      const assignmentId = activeId.slice(11);
      const current = assignments.find((item) => item.id === assignmentId);
      if (!current || current.scheduleId === schedule.id) return;
      const previous = current;
      setAssignments((items) => items.map((item) => item.id === assignmentId ? { ...item, scheduleId: schedule.id, dayOfWeek: schedule.dayOfWeek, startsAt: schedule.startsAt, endsAt: schedule.endsAt } : item));
      const form = formFor(schedule, current.brokerId); form.set("assignmentId", assignmentId);
      startTransition(async () => { const result = await moveRosterAssignmentAction({}, form); if (!result.success) { setAssignments((items) => items.map((item) => item.id === assignmentId ? previous : item)); toast.error(result.error); return; } toast.success("Escala movida."); router.refresh(); });
    }
  }

  function removeAssignment(assignment: Assignment) {
    setAssignments((items) => items.filter((item) => item.id !== assignment.id));
    const form = new FormData(); form.set("assignmentId", assignment.id);
    startTransition(async () => { const result = await removeRosterAssignmentAction({}, form); if (!result.success) { setAssignments((items) => [...items, assignment]); toast.error(result.error); return; } toast.success("Corretor removido da escala."); router.refresh(); });
  }

  const availableBrokers = useMemo(() => branchBrokers.filter((b) => b.availabilityStatus === "available"), [branchBrokers]);
  const pausedBrokers = useMemo(() => branchBrokers.filter((b) => b.availabilityStatus !== "available"), [branchBrokers]);

  return (
    <div className="space-y-6">
      {/* ─── 1. CABEÇALHO DA ESCALA DE PLANTÃO ─── */}
      <Card className="border border-border/80 bg-card p-4 sm:p-5 shadow-2xs rounded-xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Operação de Plantão
              </span>
            </div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Escala de Plantão Comercial da Unidade
            </h2>
            <p className="text-xs text-muted-foreground">
              Gerencie a escala visual em tempo real. Os corretores escalados recebem atribuição automática da fila de entrada.
            </p>
          </div>
        </div>
      </Card>

      {/* ─── 2. DAILY OPERATION STATUS BAR ─── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-emerald-500/30 bg-emerald-500/10 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Disponíveis</span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-xs">{availableBrokers.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Prontos para novo atendimento</p>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/10 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Em Atendimento</span>
            <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono text-xs">{branchAssignments.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Em negociação comercial</p>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/10 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Em Pausa</span>
            <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-xs">{pausedBrokers.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Status temporário ausente</p>
        </Card>
        <Card className="border-border/70 bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Elegíveis</span>
            <Badge variant="outline" className="font-mono text-xs">{branchBrokers.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Corretores da unidade</p>
        </Card>
      </div>

      {/* ─── 3. CALENDÁRIO VISUAL E DND ─── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Card className="overflow-hidden border-border/70 shadow-xs">
          <CardHeader className="gap-4 border-b border-border/60 bg-card/80 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="size-5 text-primary" />
                  <CardTitle className="text-base font-bold">Grade Semanal da Escala</CardTitle>
                  {isPending && <Badge variant="outline" className="text-[10px]">Salvando…</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Arraste corretores para os plantões da unidade.</p>
              </div>
              <select aria-label="Filial da escala" value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-4 xl:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="grid content-start gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Corretores da Unidade</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Arraste um nome para o plantão desejado.</p>
              </div>
              <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar corretor..." className="pl-8 text-xs h-9" />
              </div>
              <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
                {branchBrokers.map((broker) => <DraggableBroker key={broker.id} broker={broker} />)}
                {branchBrokers.length === 0 && <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground"><Users className="mx-auto mb-2 size-5" />Nenhum corretor encontrado.</div>}
              </div>
            </aside>
            <div className="grid gap-3 overflow-x-auto">
              <div className="grid min-w-[900px] grid-cols-7 gap-2">
                {DAYS.map((day, index) => <div key={day} className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs font-bold text-foreground">{day}<span className="ml-1 text-[10px] font-normal text-muted-foreground">({branchSchedules.filter((schedule) => schedule.dayOfWeek === index).length})</span></div>)}
              </div>
              <div className="grid min-w-[900px] grid-cols-7 gap-2">
                {DAYS.map((day, index) => <div key={day} className="grid content-start gap-2">{branchSchedules.filter((schedule) => schedule.dayOfWeek === index).map((schedule) => <ScheduleDropZone key={schedule.id} schedule={schedule} assignments={branchAssignments.filter((assignment) => assignment.scheduleId === schedule.id)} onRemove={removeAssignment} />)}{branchSchedules.every((schedule) => schedule.dayOfWeek !== index) && <div className="rounded-lg border border-dashed border-border/60 px-3 py-8 text-center text-xs text-muted-foreground">Sem plantão</div>}</div>)}
              </div>
            </div>
          </CardContent>
        </Card>
        <DragOverlay>
          {activeLabel ? <div className="rounded-lg border border-primary/40 bg-card px-3 py-2 text-sm font-medium shadow-lg">{activeLabel}</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
