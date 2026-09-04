"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import {
  ArrowLeft,
  Buildings,
  CalendarCheck,
  CheckCircle,
  Clock,
  Copy,
  PencilSimple,
  Plus,
  Trash,
  Users,
  WarningCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getDutyCoverage } from "@/features/lead-distribution/domain";

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
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
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

function SummaryCard({ icon: Icon, label, value, description, tone = "neutral" }: {
  icon: typeof CalendarCheck;
  label: string;
  value: number;
  description: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass = tone === "warning" ? "border-warning/30 bg-warning/5" : tone === "success" ? "border-success/25 bg-success/5" : "border-border/80 bg-card";
  const iconTone = tone === "warning" ? "bg-warning/10 text-warning" : tone === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  return <Card className={`gap-0 p-0 ${toneClass}`}><CardContent className="flex min-h-20 items-center gap-3 p-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}><Icon className="size-4" /></span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><div className="mt-0.5 flex items-baseline gap-2"><p className="text-lg font-semibold tabular-nums text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{description}</p></div></div></CardContent></Card>;
}

function DutyCard({ schedule, assignments, onOpen }: { schedule: Schedule; assignments: Assignment[]; onOpen: () => void }) {
  const coverage = coverageLabel(schedule, assignments);
  const coverageClass = schedule.status !== "active" ? "border-border/70 bg-muted/20 text-muted-foreground" : coverage.covered ? "border-border bg-card hover:border-primary/35" : "border-warning/40 bg-warning/5 hover:border-warning/60";
  return <button type="button" onClick={onOpen} className={`group min-w-0 max-w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${coverageClass}`}>
    <div className="flex min-w-0 items-center justify-between gap-2"><p className="min-w-0 truncate text-sm font-semibold text-foreground">{schedule.name}</p><StatusBadge status={schedule.status} /></div>
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock className="size-3 shrink-0" />{schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</p>
    <p className="mt-2 truncate text-xs text-muted-foreground">{schedule.queueName} · {schedule.credentialName ?? "Todas as origens"}</p>
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2"><Badge variant="outline">P{schedule.priority}</Badge><Badge variant={coverage.covered || schedule.status !== "active" ? "outline" : "warning"}>{coverage.assigned}/{coverage.minimum} escalados</Badge></div>
  </button>;
}

function DutyTimeline({ schedules, assignments, onOpen }: { schedules: Schedule[]; assignments: Assignment[]; onOpen: (schedule: Schedule) => void }) {
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

  return <div className="relative"><div ref={scrollRef} className="overflow-x-auto pb-1"><div className="grid min-w-[1540px] grid-cols-7 overflow-hidden rounded-xl border border-border/70 bg-border/70">{DAYS.map((day, dayIndex) => {
    const daySchedules = schedules.filter((schedule) => schedule.dayOfWeek === dayIndex);
    return <section key={day} className="min-w-0 bg-card"><header className="flex items-center justify-between border-b border-border/70 px-3 py-2.5"><h3 className="text-xs font-semibold text-foreground">{day}</h3><span className="text-xs tabular-nums text-muted-foreground">{daySchedules.length}</span></header><div className="min-h-60 space-y-2 bg-muted/10 p-3">{daySchedules.map((schedule) => <DutyCard key={schedule.id} schedule={schedule} assignments={assignments} onOpen={() => onOpen(schedule)} />)}{daySchedules.length === 0 && <p className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">Sem plantão</p>}</div></section>;
  })}</div></div>        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={scrollToStart}
          className={`absolute bottom-3 left-3 z-10 rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-background hover:text-foreground hover:shadow-md active:scale-95 ${showScrollButton ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <ArrowLeft className="size-3.5" />
          Início
        </Button></div>;
}

function CoverageAlerts({ schedules, assignments, onOpen }: { schedules: Schedule[]; assignments: Assignment[]; onOpen: (schedule: Schedule) => void }) {
  const gaps = schedules.filter((schedule) => schedule.status === "active" && !coverageLabel(schedule, assignments).covered);
  if (!gaps.length) return <Card className="gap-0 border-success/25 bg-success/5 p-0"><CardContent className="flex items-center gap-3 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><CheckCircle className="size-4" /></span><div><p className="text-sm font-semibold">Cobertura em dia</p><p className="text-xs text-muted-foreground">Todos os plantões ativos atendem ao mínimo definido.</p></div></CardContent></Card>;
  return <Card className="gap-0 overflow-hidden border-warning/35 bg-warning/5 p-0"><CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning"><WarningCircle className="size-4" /></span><div className="min-w-0"><CardTitle className="text-sm">Lacunas de cobertura</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">A distribuição segue ativa para quem já está escalado.</p></div></CardHeader><CardContent className="grid gap-2 px-4 pb-4">{gaps.map((schedule) => { const coverage = coverageLabel(schedule, assignments); return <button key={schedule.id} type="button" onClick={() => onOpen(schedule)} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-warning/25 bg-card/70 px-3 py-2 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0"><span className="block truncate text-xs font-semibold">{schedule.name}</span><span className="block truncate text-[11px] text-muted-foreground">{DAYS_FULL[schedule.dayOfWeek]} · {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)} · {schedule.queueName}</span></span><Badge variant="warning" className="shrink-0">Faltam {coverage.minimum - coverage.assigned}</Badge></button>; })}</CardContent></Card>;
}

function DutyFormSheet({ open, onOpenChange, schedule, snapshot }: { open: boolean; onOpenChange: (open: boolean) => void; schedule: Schedule | null; snapshot: Snapshot }) {
  const [pending, startTransition] = useTransition();
  const [branchIds, setBranchIds] = useState<string[]>(schedule ? [schedule.branchId] : [snapshot.branches[0]?.id ?? ""].filter(Boolean));
  const [queueIdsByBranch, setQueueIdsByBranch] = useState<Record<string, string>>(() => Object.fromEntries((schedule ? [schedule.branchId] : [snapshot.branches[0]?.id ?? ""].filter(Boolean)).map((branchId) => [branchId, schedule && schedule.branchId === branchId ? schedule.queueId : snapshot.queues.find((queue) => queue.branchId === branchId)?.id ?? ""])));
  const selectedBranches = snapshot.branches.filter((branch) => branchIds.includes(branch.id));
  const queueForBranch = (branchId: string) => queueIdsByBranch[branchId] ?? snapshot.queues.find((queue) => queue.branchId === branchId)?.id ?? "";
  const canSubmit = selectedBranches.length > 0 && selectedBranches.every((branch) => Boolean(queueForBranch(branch.id)));
  const title = schedule ? "Editar plantão" : "Novo plantão";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (schedule) {
      formData.set("branchId", schedule.branchId);
      formData.set("queueId", queueForBranch(schedule.branchId));
      formData.set("scheduleId", schedule.id);
    } else {
      formData.set("unitAssignments", JSON.stringify(selectedBranches.map((branch) => ({ branchId: branch.id, queueId: queueForBranch(branch.id) }))));
    }
    const action: DutyAction = schedule ? updateDutyScheduleAction : createDutyScheduleAction;
    startTransition(async () => { const result = await action({}, formData); if (!result.success) { toast.error(result.error ?? "Não foi possível salvar o plantão."); return; } toast.success(schedule ? "Plantão atualizado." : `${result.scheduleIds?.length ?? 1} plantão(ões) criado(s).`); onOpenChange(false); });
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{schedule ? "Edite esta regra local sem alterar os demais plantões." : "Selecione uma ou mais unidades. Uma regra independente será criada para cada unidade e fila."}</SheetDescription></SheetHeader><SheetBody><form className="grid gap-5" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="duty-name">Nome</Label><Input id="duty-name" name="name" defaultValue={schedule?.name ?? ""} placeholder="Ex.: Plantão comercial" required /></div><fieldset className="grid gap-2"><Label>Unidades</Label><div className="grid gap-2">{snapshot.branches.map((branch) => { const selected = branchIds.includes(branch.id); const hasQueue = snapshot.queues.some((queue) => queue.branchId === branch.id); return <label key={branch.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="checkbox" checked={selected} disabled={Boolean(schedule) || !hasQueue} onChange={(event) => setBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))} className="size-4 rounded border-input text-primary focus:ring-ring" /><span className="min-w-0 flex-1 truncate">{branch.name}</span><span className="text-xs text-muted-foreground">{hasQueue ? "Fila ativa" : "Sem fila"}</span></label>; })}</div>{schedule && <p className="text-xs text-muted-foreground">A edição mantém a unidade atual. Para replicar a regra, crie um novo plantão com várias unidades.</p>}</fieldset><div className="grid gap-3">{selectedBranches.map((branch) => { const queues = snapshot.queues.filter((queue) => queue.branchId === branch.id); const queueId = queueForBranch(branch.id); return <div key={branch.id} className="grid gap-2"><Label htmlFor={`duty-queue-${branch.id}`}>Fila · {branch.name}</Label><AppSelect id={`duty-queue-${branch.id}`} value={queueId} onValueChange={(val) => setQueueIdsByBranch((current) => ({ ...current, [branch.id]: val }))} disabled={!queues.length} options={queues.map((q) => ({ value: q.id, label: q.name }))} />{!queues.length && <p className="text-xs text-warning">Esta unidade não possui uma fila ativa.</p>}</div>; })}</div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="duty-day">Dia</Label><AppSelect id="duty-day" name="dayOfWeek" defaultValue={String(schedule?.dayOfWeek ?? 1)} options={DAYS_FULL.map((day, index) => ({ value: String(index), label: day }))} /></div><div className="grid gap-2"><Label htmlFor="duty-priority">Prioridade</Label><Input id="duty-priority" name="priority" type="number" min={1} max={999} defaultValue={schedule?.priority ?? 100} required /></div></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="duty-start">Início</Label><Input id="duty-start" name="startsAt" type="time" defaultValue={schedule?.startsAt.slice(0, 5) ?? "09:00"} required /></div><div className="grid gap-2"><Label htmlFor="duty-end">Fim</Label><Input id="duty-end" name="endsAt" type="time" defaultValue={schedule?.endsAt.slice(0, 5) ?? "18:00"} required /></div></div><div className="grid gap-2"><Label htmlFor="duty-minimum">Mínimo de corretores</Label><Input id="duty-minimum" name="minimumBrokers" type="number" min={1} max={99} defaultValue={schedule?.minimumBrokers ?? 1} required /><p className="text-xs text-muted-foreground">Abaixo deste mínimo, o plantão vira uma pendência; a distribuição não é bloqueada.</p></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="duty-valid-from">Início da vigência</Label><Input id="duty-valid-from" name="validFrom" type="date" defaultValue={dateInputValue(schedule?.validFrom ?? new Date())} required /></div><div className="grid gap-2"><Label htmlFor="duty-valid-until">Fim da vigência</Label><Input id="duty-valid-until" name="validUntil" type="date" defaultValue={dateInputValue(schedule?.validUntil ?? null)} /></div></div><div className="grid gap-2"><Label htmlFor="duty-credential">Origem de lead</Label><AppSelect id="duty-credential" name="webhookCredentialId" defaultValue={schedule?.webhookCredentialId ?? ""} options={[{ value: "", label: "Todas as origens" }, ...snapshot.credentials.map((c) => ({ value: c.id, label: c.name }))]} /></div><p className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Fuso operacional: America/Sao_Paulo. Cada unidade conserva uma fila e uma escala próprias; conflitos são validados antes de criar qualquer regra.</p><Button type="submit" disabled={pending || !canSubmit}>{pending ? "Salvando…" : schedule ? "Salvar alterações" : `Criar em ${selectedBranches.length || 0} unidade(s)`}</Button></form></SheetBody></SheetContent></Sheet>;
}

function DutyInspector({ schedule, open, onOpenChange, snapshot, onEdit }: { schedule: Schedule | null; open: boolean; onOpenChange: (open: boolean) => void; snapshot: Snapshot; onEdit: (schedule: Schedule) => void }) {
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const assignments = schedule ? snapshot.assignments.filter((assignment) => assignment.scheduleId === schedule.id) : [];
  const eligibleBrokers = schedule ? snapshot.brokers.filter((broker) => broker.branchId === schedule.branchId && !assignments.some((assignment) => assignment.brokerId === broker.id)) : [];
  const history = schedule ? snapshot.history.filter((event) => event.scheduleId === schedule.id).slice(0, 6) : [];

  function runAction(action: DutyAction, successMessage: string, close = false) {
    if (!schedule) return;
    const formData = new FormData(); formData.set("scheduleId", schedule.id);
    startTransition(async () => { const result = await action({}, formData); if (!result.success) { toast.error(result.error ?? "Não foi possível atualizar o plantão."); return; } toast.success(successMessage); setConfirmArchive(false); if (close) onOpenChange(false); });
  }

  function assignBroker(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedule) return;
    if (!selectedBrokerId) { toast.error("Selecione um corretor para adicionar à escala."); return; }
    const formData = new FormData(event.currentTarget); formData.set("scheduleId", schedule.id); formData.set("dayOfWeek", String(schedule.dayOfWeek)); formData.set("startsAt", schedule.startsAt); formData.set("endsAt", schedule.endsAt);
    startTransition(async () => { const result = await createRosterAssignmentAction({}, formData); if (!result.success) { toast.error(result.error ?? "Não foi possível escalar o corretor."); return; } setSelectedBrokerId(""); toast.success("Corretor adicionado à escala."); });
  }

  function removeAssignment(assignment: Assignment) {
    const formData = new FormData(); formData.set("assignmentId", assignment.id);
    startTransition(async () => { const result = await removeRosterAssignmentAction({}, formData); if (!result.success) { toast.error(result.error ?? "Não foi possível remover o corretor."); return; } toast.success("Corretor removido da escala."); });
  }

  const coverage = schedule ? coverageLabel(schedule, snapshot.assignments) : null;
  return <><Sheet open={open} onOpenChange={onOpenChange}><SheetContent><SheetHeader>{schedule && <><div className="flex items-center gap-2"><StatusBadge status={schedule.status} /><span className="text-xs text-muted-foreground">{schedule.branchName}</span></div><SheetTitle>{schedule.name}</SheetTitle><SheetDescription>{schedule.queueName} · {DAYS_FULL[schedule.dayOfWeek]} · {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</SheetDescription></>}</SheetHeader>{schedule && <><SheetBody contentClassName="grid gap-4"><SheetSection><SheetSectionHeader><div><p className="text-sm font-semibold">Cobertura</p><p className="text-xs text-muted-foreground">A escala não bloqueia a distribuição enquanto estiver incompleta.</p></div><Badge variant={coverage?.covered ? "success" : "warning"}>{coverage?.assigned}/{coverage?.minimum}</Badge></SheetSectionHeader><div className="p-4">{coverage?.covered ? <p className="text-sm text-success">Mínimo de corretores atendido.</p> : <p className="text-sm text-warning">Faltam {(coverage?.minimum ?? 0) - (coverage?.assigned ?? 0)} corretor(es) para atingir o mínimo.</p>}</div></SheetSection><SheetSection><SheetSectionHeader><div><p className="text-sm font-semibold">Regra</p><p className="text-xs text-muted-foreground">Detalhes que definem a entrada do plantão.</p></div></SheetSectionHeader><dl className="grid gap-3 p-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Prioridade</dt><dd>P{schedule.priority}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Origem</dt><dd className="text-right">{schedule.credentialName ?? "Todas as origens"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Vigência</dt><dd className="text-right">{dateLabel(schedule.validFrom)} · {dateLabel(schedule.validUntil)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Timezone</dt><dd>{schedule.timezone}</dd></div></dl></SheetSection><SheetSection><SheetSectionHeader><div><p className="text-sm font-semibold">Escala de corretores</p><p className="text-xs text-muted-foreground">Adicione ou remova pessoas do plantão.</p></div></SheetSectionHeader><div className="grid gap-3 p-4"><form className="flex gap-2" onSubmit={assignBroker}><AppSelect name="brokerId" value={selectedBrokerId} onValueChange={setSelectedBrokerId} disabled={pending || schedule.status !== "active" || !eligibleBrokers.length} options={[{ value: "", label: eligibleBrokers.length ? "Selecionar corretor" : "Nenhum corretor elegível" }, ...eligibleBrokers.map((b) => ({ value: b.id, label: `${b.name} · ${b.availabilityStatus === "available" ? "Disponível" : "Pausado"}` }))]} /><Button size="sm" type="submit" disabled={pending || !selectedBrokerId || schedule.status !== "active" || !eligibleBrokers.length}>Adicionar</Button></form><div className="grid gap-2">{assignments.map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"><span className="min-w-0"><span className="block truncate text-sm font-medium">{assignment.brokerName}</span><span className="block text-xs text-muted-foreground">Escalado neste horário</span></span><Button size="sm" variant="ghost" aria-label={`Remover ${assignment.brokerName} da escala`} onClick={() => removeAssignment(assignment)} disabled={pending}><Trash className="size-4" /></Button></div>)}{!assignments.length && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Nenhum corretor escalado.</p>}</div></div></SheetSection><SheetSection><SheetSectionHeader><div><p className="text-sm font-semibold">Histórico</p><p className="text-xs text-muted-foreground">Alterações auditadas deste plantão.</p></div></SheetSectionHeader><div className="grid gap-2 p-4">{history.map((event, index) => <div key={`${event.action}-${event.createdAt.toISOString()}-${index}`} className="flex justify-between gap-3 text-xs"><span>{actionLabel(event.action)} · {event.actorName}</span><time className="shrink-0 text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(event.createdAt)}</time></div>)}{!history.length && <p className="text-xs text-muted-foreground">Nenhum evento de histórico disponível.</p>}</div></SheetSection></SheetBody><SheetFooter>{schedule.status === "archived" ? <Button variant="outline" onClick={() => runAction(restoreDutyScheduleAction, "Plantão restaurado como inativo.") } disabled={pending}>Restaurar</Button> : <><Button variant="outline" onClick={() => runAction(toggleDutyScheduleAction, schedule.status === "active" ? "Plantão desativado." : "Plantão ativado.")} disabled={pending}>{schedule.status === "active" ? "Desativar" : "Ativar"}</Button><Button variant="outline" onClick={() => runAction(duplicateDutyScheduleAction, "Cópia criada como inativa.")} disabled={pending}><Copy />Duplicar</Button><Button variant="outline" onClick={() => onEdit(schedule)} disabled={pending}><PencilSimple />Editar</Button><Button variant="destructive" onClick={() => setConfirmArchive(true)} disabled={pending}><Trash />Arquivar</Button></>}</SheetFooter></>}</SheetContent></Sheet><Dialog open={confirmArchive} onOpenChange={setConfirmArchive}><DialogPopup><DialogHeader><DialogTitle>Arquivar este plantão?</DialogTitle><DialogDescription>Ele sairá da distribuição e os {assignments.length} corretor(es) da escala ficarão inativos neste plantão. O histórico será preservado e a regra poderá ser restaurada.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmArchive(false)} disabled={pending}>Cancelar</Button><Button variant="destructive" onClick={() => runAction(archiveDutyScheduleAction, "Plantão arquivado.", true)} disabled={pending}>Arquivar plantão</Button></DialogFooter></DialogPopup></Dialog></>;
}

export function DutyOperationsWorkspace({ snapshot }: { snapshot: Snapshot }) {
  const [selectedBranchId, setSelectedBranchId] = useState(snapshot.branches[0]?.id ?? "");
  const [selectedQueueId, setSelectedQueueId] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [formSchedule, setFormSchedule] = useState<Schedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const selectedQueue = selectedQueueId === "all" ? null : selectedQueueId;
  const scopedSchedules = useMemo(() => snapshot.schedules.filter((schedule) => schedule.branchId === selectedBranchId && (!selectedQueue || schedule.queueId === selectedQueue) && (showArchived || schedule.status !== "archived")), [selectedBranchId, selectedQueue, showArchived, snapshot.schedules]);
  const scopedAssignments = useMemo(() => snapshot.assignments.filter((assignment) => assignment.branchId === selectedBranchId), [selectedBranchId, snapshot.assignments]);
  const activeCount = scopedSchedules.filter((schedule) => schedule.status === "active").length;
  const inactiveCount = scopedSchedules.filter((schedule) => schedule.status === "inactive").length;
  const archivedCount = snapshot.schedules.filter((schedule) => schedule.branchId === selectedBranchId && schedule.status === "archived").length;
  const gapCount = scopedSchedules.filter((schedule) => schedule.status === "active" && !coverageLabel(schedule, scopedAssignments).covered).length;
  const branchQueues = snapshot.queues.filter((queue) => queue.branchId === selectedBranchId);

  function openCreate() { setFormSchedule(null); setFormOpen(true); }
  function openEdit(schedule: Schedule) { setSelectedSchedule(null); setFormSchedule(schedule); setFormOpen(true); }

  return <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5"><section className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-primary"><CalendarCheck className="size-4" /><span className="text-xs font-semibold">Distribuição de leads</span></div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Plantões</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Organize as regras semanais e acompanhe a cobertura dos corretores sem alterar a fila manualmente.</p></div><Button onClick={openCreate}><Plus />Novo plantão</Button></section><section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-sm font-medium"><Buildings className="size-4 text-muted-foreground" />Unidade</span><AppSelect className="w-48" value={selectedBranchId} onValueChange={(val) => { setSelectedBranchId(val); setSelectedQueueId("all"); setSelectedSchedule(null); }} options={snapshot.branches.map((b) => ({ value: b.id, label: b.name }))} /><AppSelect className="w-48" value={selectedQueueId} onValueChange={setSelectedQueueId} options={[{ value: "all", label: "Todas as filas" }, ...branchQueues.map((q) => ({ value: q.id, label: q.name }))]} /></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-4 rounded border-input text-primary focus:ring-ring" />Mostrar arquivados</label></section><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard icon={CalendarCheck} label="Plantões ativos" value={activeCount} description="Regras elegíveis agora" tone="success" /><SummaryCard icon={Users} label="Sem cobertura" value={gapCount} description="Abaixo do mínimo configurado" tone={gapCount ? "warning" : "neutral"} /><SummaryCard icon={Clock} label="Inativos" value={inactiveCount} description="Regras pausadas" /><SummaryCard icon={Trash} label="Arquivados" value={archivedCount} description="Histórico reversível" /></section>{gapCount > 0 && <CoverageAlerts schedules={scopedSchedules} assignments={scopedAssignments} onOpen={setSelectedSchedule} />}<Card className="gap-0 overflow-hidden border-border/80 p-0"><CardHeader className="border-b border-border/70 bg-card/70 p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Grade semanal</CardTitle><p className="mt-1 text-xs text-muted-foreground">Clique em um plantão para editar a regra ou a escala de corretores.</p></div><Badge variant="outline">America/Sao_Paulo</Badge></div></CardHeader>        <CardContent className="max-h-[80vh] overflow-y-auto p-3 sm:p-4"><DutyTimeline schedules={scopedSchedules} assignments={scopedAssignments} onOpen={setSelectedSchedule} /></CardContent></Card>{!scopedSchedules.length && <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><CalendarCheck aria-hidden="true" className="size-5" /></span><div><p className="text-sm font-semibold">Nenhum plantão neste escopo</p><p className="mt-1 text-xs text-muted-foreground">Crie uma regra para que a unidade comece a organizar sua cobertura.</p></div><Button onClick={openCreate}><Plus />Criar plantão</Button></CardContent></Card>}<DutyInspector schedule={selectedSchedule} open={Boolean(selectedSchedule)} onOpenChange={(open) => { if (!open) setSelectedSchedule(null); }} snapshot={snapshot} onEdit={openEdit} /><DutyFormSheet key={formSchedule?.id ?? (formOpen ? "new" : "closed")} open={formOpen} onOpenChange={setFormOpen} schedule={formSchedule} snapshot={snapshot} /></div>;
}
