"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowsClockwise,
  CheckCircle,
  MagicWand,
  Plus,
  UserList,
  Buildings,
  Lightning,
  MagnifyingGlass,
  ChevronDownIcon,
  ShieldX,
  Gear,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import {
  deleteDistributionQueueAction,
  forceDeleteQueueAction,
  getQueueDependenciesAction,
  saveDistributionQueueAction,
  simulateDistributionAction,
  type QueueDependencyInfo,
} from "@/features/lead-distribution/actions";
import { toast } from "@/components/ui/sonner";
import { Loader2Icon } from "@/components/huge-icons";
import { cn } from "@/utils/core/cn";
import { QUEUE_SOURCE_OPTIONS } from "@/features/lead-distribution/routing-catalog";
import { circularHueDistance, pickDistinctHue, QUEUE_COLOR_SWATCHES } from "@/features/lead-distribution/queue-color";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { MetaEntries, countQueueEntries, type MetaAd, type MetaAdRoute, type MetaCampaign, type MetaCampaignRoute, type MetaEntriesData } from "./queues/meta-entries";
import { PanelSheet, QueueDetailSheet } from "./queues/queue-detail-sheet";
import { QueuesTable } from "./queues/queues-table";
import type { DutySchedule, Queue } from "./queues/types";

const IGNORED_PANEL_ID = "__ignored_campaigns__";

type Branch = { id: string; name: string };
type Broker = { id: string; name: string; branchId?: string | null; branchName?: string | null };
const DUTY_DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
type Simulation = {
  success: boolean;
  error?: string;
  queue?: { id: string; name: string } | null;
  reason?: string;
  selected?: { id: string; name: string; activeLeads: number; capacity: number | null } | null;
  eligible?: Array<{
    id: string;
    name: string;
    activeLeads: number;
    capacity: number | null;
    score: number;
  }>;
};

const emptyQueue = {
  branchId: "",
  exclusiveDutyScheduleId: "",
  exclusiveDutyScheduleIds: [] as string[],
  dutyFallbackPolicy: "unit_roster" as "unit_roster" | "wait_next_duty" | "fallback_queue",
  dutyFallbackQueueId: "",
  allowedBranchIds: [] as string[],
  brokerScopeMode: "all" as "all" | "selected",
  allowedBrokerIds: [] as string[],
  allowedSourceIds: [] as string[],
  name: "",
  assignmentMode: "automatic",
  assignmentStrategy: "capacity",
  capacityEnabled: false,
  capacityPerBroker: "10",
  offerIntervalMinutes: "5",
  maxPendingOffersPerBroker: "1",
  aiQualificationEnabled: true,
  attendanceFlowId: null as string | null,
  status: "active",
  colorHue: null as number | null,
};

const QUEUE_DRAFT_STORAGE_KEY = "ancorahub:distribution:queue-draft:v1";

export function QueueControlCenter({
  queues,
  branches,
  brokers = [],
  dutySchedules = [],
  campaigns,
  ads,
  campaignRoutes,
  adRoutes,
  canEdit,
  settingsPanels = [],
  attendanceFlows = null,
}: {
  queues: Queue[];
  branches: Branch[];
  brokers?: Broker[];
  dutySchedules?: DutySchedule[];
  campaigns: MetaCampaign[];
  ads: MetaAd[];
  campaignRoutes: MetaCampaignRoute[];
  adRoutes: MetaAdRoute[];
  canEdit: boolean;
  /** Attendance flows (DEC-127); null while the switch is off, so the field stays hidden. */
  attendanceFlows?: Array<{ id: string; name: string; description: string | null }> | null;
  /** Secondary settings reached from the page "⋯" menu, each in a drawer. */
  settingsPanels?: Array<{ id: string; label: string; description?: string; content: ReactNode }>;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyQueue);
  const [saving, setSaving] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationForm, setSimulationForm] = useState({
    branchId: branches[0]?.id ?? "",
    queueId: "",
    temperature: "warm",
    score: "50",
  });
  // Queue drawer (row click) and the "⋯" menu drawers.
  const [detailQueueId, setDetailQueueId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Queue | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<QueueDependencyInfo | null>(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);
  const router = useRouter();

  const persistQueueDraft = useCallback((nextForm = form) => {
    if (typeof window === "undefined" || editingId) return;
    window.localStorage.setItem(
      QUEUE_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 1, form: nextForm, savedAt: new Date().toISOString() }),
    );
  }, [editingId, form]);

  function readQueueDraft() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(QUEUE_DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { version?: number; form?: Record<string, unknown> };
      if (parsed.version !== 1 || !parsed.form || typeof parsed.form !== "object") return null;
      const draft = parsed.form;
      if (typeof draft.name !== "string") return null;
      return {
        ...emptyQueue,
        ...draft,
        exclusiveDutyScheduleIds: Array.isArray(draft.exclusiveDutyScheduleIds) ? draft.exclusiveDutyScheduleIds.filter((id): id is string => typeof id === "string") : [],
        allowedBranchIds: Array.isArray(draft.allowedBranchIds) ? draft.allowedBranchIds.filter((id): id is string => typeof id === "string") : [],
        allowedBrokerIds: Array.isArray(draft.allowedBrokerIds) ? draft.allowedBrokerIds.filter((id): id is string => typeof id === "string") : [],
        allowedSourceIds: Array.isArray(draft.allowedSourceIds) ? draft.allowedSourceIds.filter((id): id is string => typeof id === "string") : [],
      };
    } catch {
      window.localStorage.removeItem(QUEUE_DRAFT_STORAGE_KEY);
      return null;
    }
  }

  useEffect(() => {
    if (editorOpen && !editingId) persistQueueDraft();
  }, [editorOpen, editingId, persistQueueDraft]);

  const meta = useMemo<MetaEntriesData>(
    () => ({ campaigns, ads, campaignRoutes, adRoutes }),
    [campaigns, ads, campaignRoutes, adRoutes],
  );
  const entriesByQueue = useMemo(
    () => new Map(queues.map((queue) => [queue.id, countQueueEntries(meta, queue.id)])),
    [queues, meta],
  );
  const brokerNames = useMemo(() => new Map(brokers.map((broker) => [broker.id, broker.name])), [brokers]);
  const detailQueue = queues.find((queue) => queue.id === detailQueueId) ?? null;
  const activePanel = settingsPanels.find((panel) => panel.id === panelId) ?? null;

  async function handleDeleteQueue(queue: Queue) {
    setDeleteTarget(queue);
    setDeleteConfirmOpen(true);
    setDeleteDependencies(null);
    setLoadingDependencies(true);
    const result = await getQueueDependenciesAction(queue.id);
    setLoadingDependencies(false);
    if (result.success && result.dependencies) setDeleteDependencies(result.dependencies);
  }

  async function confirmDeleteQueue() {
    if (!deleteTarget) return;
    setDeleteConfirmOpen(false);
    const result = await deleteDistributionQueueAction(deleteTarget.id);
    if (!result.success) return toast.error(result.error ?? "Não foi possível excluir a fila.");
    toast.success(result.message, { description: `A fila "${deleteTarget.name}" foi removida.` });
    router.refresh();
  }

  async function forceDeleteQueue() {
    if (!deleteTarget) return;
    setForceDeleting(true);
    const result = await forceDeleteQueueAction(deleteTarget.id);
    setForceDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeleteDependencies(null);
    if (!result.success) return toast.error(result.error ?? "Não foi possível forçar a exclusão.");
    toast.success(result.message, {
      description: `A fila "${deleteTarget.name}" e todas as dependências foram removidas.`,
    });
    router.refresh();
  }

  const branchQueues = useMemo(
    () =>
      queues.filter(
        (queue) =>
          (queue.branchId === simulationForm.branchId || !queue.branchId) &&
          queue.status === "active",
      ),
    [queues, simulationForm.branchId],
  );

  // "Todas as Unidades" means every unit, full stop — never trust a saved
  // allowedBranchIds snapshot for that (a unit created after the queue was
  // last saved wouldn't be in it, leaving the checklist half-checked even
  // though the queue already reaches everyone).
  const effectiveAllowedBranchIds = useMemo(
    () => (form.branchId ? form.allowedBranchIds : branches.map((branch) => branch.id)),
    [form.branchId, form.allowedBranchIds, branches],
  );

  // Available brokers based on selected primary and additional branches
  const formTargetBranchIds = useMemo(
    () => Array.from(new Set([form.branchId, ...effectiveAllowedBranchIds].filter(Boolean))),
    [form.branchId, effectiveAllowedBranchIds],
  );

  const availableBrokersForForm = useMemo(() => {
    if (!formTargetBranchIds.length) return brokers;
    return brokers.filter((b) => b.branchId && formTargetBranchIds.includes(b.branchId));
  }, [brokers, formTargetBranchIds]);

  /** Other queues' colors — used both to keep a fresh color distinct and to warn about near-duplicates. */
  function otherQueueColors(queueId: string | null) {
    return queues
      .filter((queue) => queue.id !== queueId)
      .map((queue) => ({ name: queue.name, hue: queue.colorHue ?? null }));
  }
  function usedHuesExcept(queueId: string | null) {
    return otherQueueColors(queueId).map((entry) => entry.hue);
  }

  function openCreate() {
    setEditingId(null);
    const draft = readQueueDraft();
    if (draft) {
      setForm({
        ...draft,
        colorHue: typeof draft.colorHue === "number" ? draft.colorHue : pickDistinctHue(usedHuesExcept(null)),
        allowedBranchIds: draft.branchId ? draft.allowedBranchIds : (draft.allowedBranchIds.length ? draft.allowedBranchIds : branches.map((b) => b.id)),
      });
      toast.info("Rascunho restaurado", { description: "Continuamos a criação da fila de onde você parou." });
      setEditorOpen(true);
      return;
    }
    setForm({
      ...emptyQueue,
      branchId: "",
      exclusiveDutyScheduleId: "",
      exclusiveDutyScheduleIds: [],
      dutyFallbackPolicy: "unit_roster",
      dutyFallbackQueueId: "",
      allowedBranchIds: branches.map((b) => b.id), // Todas marcadas por padrão
      brokerScopeMode: "all",
      allowedBrokerIds: [],
      allowedSourceIds: [],
      colorHue: pickDistinctHue(usedHuesExcept(null)),
    });
    setEditorOpen(true);
  }

  function openEdit(queue: Queue) {
    setEditingId(queue.id);
    const hasSpecificBrokers = (queue.allowedBrokerIds?.length ?? 0) > 0;
    setForm({
      branchId: queue.branchId ?? "",
      exclusiveDutyScheduleId: queue.exclusiveDutyScheduleId ?? "",
      exclusiveDutyScheduleIds: Array.from(new Set([
        ...(queue.exclusiveDutyScheduleIds ?? []),
        ...(queue.exclusiveDutyScheduleId ? [queue.exclusiveDutyScheduleId] : []),
      ])),
      dutyFallbackPolicy: queue.dutyFallbackPolicy === "fallback_queue" || queue.dutyFallbackPolicy === "wait_next_duty" || queue.dutyFallbackPolicy === "unit_roster"
        ? queue.dutyFallbackPolicy
        : (queue.exclusiveDutyScheduleIds?.length || queue.exclusiveDutyScheduleId ? "wait_next_duty" : "unit_roster"),
      dutyFallbackQueueId: queue.dutyFallbackQueueId ?? "",
      allowedBranchIds: queue.allowedBranchIds ?? [],
      brokerScopeMode: hasSpecificBrokers ? "selected" : "all",
      allowedBrokerIds: queue.allowedBrokerIds ?? [],
      allowedSourceIds: queue.allowedSourceIds ?? [],
      name: queue.name,
      assignmentMode: queue.assignmentMode,
      assignmentStrategy: queue.assignmentStrategy,
      capacityEnabled: queue.capacityEnabled,
      capacityPerBroker: String(queue.capacityPerBroker ?? 10),
      offerIntervalMinutes: String(queue.offerIntervalMinutes ?? 5),
      maxPendingOffersPerBroker: String(queue.maxPendingOffersPerBroker ?? 1),
      aiQualificationEnabled: queue.aiQualificationEnabled ?? true,
      attendanceFlowId: queue.attendanceFlowId ?? null,
      status: queue.status,
      colorHue: queue.colorHue ?? pickDistinctHue(usedHuesExcept(queue.id)),
    });
    setEditorOpen(true);
  }

  function toggleAllowedBranch(branchId: string) {
    setForm((prev) => {
      // "Todas as Unidades" already reaches everyone — the checklist is
      // shown disabled in that state, this guard is just defense in depth.
      if (!prev.branchId) return prev;
      const exists = prev.allowedBranchIds.includes(branchId);
      const nextBranches = exists
        ? prev.allowedBranchIds.filter((id) => id !== branchId)
        : [...prev.allowedBranchIds, branchId];
      return { ...prev, allowedBranchIds: nextBranches };
    });
  }

  /** Ao mudar a unidade principal, atualiza allowedBranchIds automaticamente. */
  function handleBranchChange(newBranchId: string) {
    setForm((prev) => {
      if (!newBranchId) {
        // "Todas as unidades" selecionada → marcar todas as checkboxes
        return { ...prev, branchId: newBranchId, allowedBranchIds: branches.map((b) => b.id) };
      }
      // Unidade específica → remover ela de allowedBranchIds
      return {
        ...prev,
        branchId: newBranchId,
        allowedBranchIds: prev.allowedBranchIds.filter((id) => id !== newBranchId),
      };
    });
  }

  function toggleAllowedBroker(brokerId: string) {
    setForm((prev) => {
      const exists = prev.allowedBrokerIds.includes(brokerId);
      const nextBrokers = exists
        ? prev.allowedBrokerIds.filter((id) => id !== brokerId)
        : [...prev.allowedBrokerIds, brokerId];
      return { ...prev, allowedBrokerIds: nextBrokers };
    });
  }

  function toggleDutySchedule(scheduleId: string) {
    setForm((prev) => ({
      ...prev,
      exclusiveDutyScheduleIds: prev.exclusiveDutyScheduleIds.includes(scheduleId)
        ? prev.exclusiveDutyScheduleIds.filter((id) => id !== scheduleId)
        : [...prev.exclusiveDutyScheduleIds, scheduleId],
    }));
  }

  function setDutyFallbackPolicy(policy: "unit_roster" | "wait_next_duty" | "fallback_queue") {
    setForm((prev) => ({
      ...prev,
      dutyFallbackPolicy: policy,
      dutyFallbackQueueId: policy === "fallback_queue" ? prev.dutyFallbackQueueId : "",
    }));
  }

  function toggleAllowedSource(sourceId: string) {
    setForm((prev) => ({
      ...prev,
      allowedSourceIds: prev.allowedSourceIds.includes(sourceId)
        ? prev.allowedSourceIds.filter((id) => id !== sourceId)
        : [...prev.allowedSourceIds, sourceId],
    }));
  }

  async function saveQueue() {
    setSaving(true);
    const finalAllowedBrokerIds = form.brokerScopeMode === "selected" ? form.allowedBrokerIds : [];
    const result = await saveDistributionQueueAction({
      id: editingId ?? undefined,
      branchId: form.branchId || null,
      exclusiveDutyScheduleId: form.exclusiveDutyScheduleIds[0] ?? null,
      exclusiveDutyScheduleIds: form.exclusiveDutyScheduleIds,
      dutyFallbackPolicy: form.exclusiveDutyScheduleIds.length ? form.dutyFallbackPolicy : "unit_roster",
      dutyFallbackQueueId: form.exclusiveDutyScheduleIds.length && form.dutyFallbackPolicy === "fallback_queue" ? form.dutyFallbackQueueId || null : null,
      allowedBranchIds: effectiveAllowedBranchIds,
      allowedBrokerIds: finalAllowedBrokerIds,
      allowedSourceIds: form.allowedSourceIds,
      name: form.name,
      assignmentMode: form.assignmentMode,
      assignmentStrategy: form.assignmentStrategy,
      capacityEnabled: form.capacityEnabled,
      capacityPerBroker: form.capacityEnabled ? Number(form.capacityPerBroker) : null,
      offerIntervalMinutes: Math.max(0, Math.trunc(Number(form.offerIntervalMinutes) || 0)),
      maxPendingOffersPerBroker: Math.max(0, Math.trunc(Number(form.maxPendingOffersPerBroker) || 0)),
      aiQualificationEnabled: form.aiQualificationEnabled,
      ...(attendanceFlows ? { attendanceFlowId: form.attendanceFlowId } : {}),
      status: form.status,
      colorHue: form.colorHue,
    });
    setSaving(false);
    if (!result.success)
      return toast.error(result.error ?? "Não foi possível salvar a fila.", {
        description: "Verifique os dados e tente novamente.",
      });
    if (result.warning) {
      toast.warning(result.message, { description: result.warning });
    } else {
      toast.success(result.message, {
        description: editingId
          ? `A fila "${form.name}" foi atualizada.`
          : `A fila "${form.name}" está pronta para receber leads.`,
      });
    }
    if (!editingId && typeof window !== "undefined") {
      window.localStorage.removeItem(QUEUE_DRAFT_STORAGE_KEY);
    }
    setEditorOpen(false);
    router.refresh();
  }

  async function runSimulation() {
    setSimulating(true);
    const result = await simulateDistributionAction({
      branchId: simulationForm.branchId || undefined,
      queueId: simulationForm.queueId || undefined,
      temperature: simulationForm.temperature,
      score: Number(simulationForm.score),
    });
    setSimulating(false);
    setSimulation(result);
    if (!result.success) toast.error(result.error ?? "Não foi possível simular.");
  }

  return (
    <>
      <Card variant="overview">
        <SectionCardHeader
          icon={<UserList />}
          title="Filas de distribuição"
          description="Cada fila decide quem recebe, em que ordem e por quais campanhas. Clique numa fila para ver e ajustar."
          actions={
            <>
              {canEdit ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Nova fila
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                  <Gear className="size-3.5" />
                  Configurações
                  <ChevronDownIcon className="size-3 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem
                    onClick={() => {
                      setSimulation(null);
                      setSimulatorOpen(true);
                    }}
                  >
                    <MagicWand className="size-3.5" /> Simular distribuição
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPanelId(IGNORED_PANEL_ID)}>
                    <ShieldX className="size-3.5" /> Campanhas não registradas
                  </DropdownMenuItem>
                  {settingsPanels.length ? <DropdownMenuSeparator /> : null}
                  {settingsPanels.map((panel) => (
                    <DropdownMenuItem key={panel.id} onClick={() => setPanelId(panel.id)}>
                      <Gear className="size-3.5" /> {panel.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
        <div className="p-4">
          {queues.length ? (
            <QueuesTable
              queues={queues}
              dutySchedules={dutySchedules}
              entriesByQueue={entriesByQueue}
              canEdit={canEdit}
              onOpen={(queue) => setDetailQueueId(queue.id)}
              onEdit={openEdit}
              onDelete={(queue) => void handleDeleteQueue(queue)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm font-medium">Nenhuma fila configurada</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Crie a primeira fila para tornar a distribuição previsível na operação.
              </p>
            </div>
          )}
        </div>
      </Card>

      <QueueDetailSheet
        queue={detailQueue}
        onOpenChange={(open) => {
          if (!open) setDetailQueueId(null);
        }}
        dutySchedules={dutySchedules}
        brokerNames={brokerNames}
        meta={meta}
        canEdit={canEdit}
        onEdit={(queue) => {
          setDetailQueueId(null);
          openEdit(queue);
        }}
        onDelete={(queue) => {
          setDetailQueueId(null);
          void handleDeleteQueue(queue);
        }}
      />

      <PanelSheet
        open={panelId === IGNORED_PANEL_ID}
        onOpenChange={(open) => {
          if (!open) setPanelId(null);
        }}
        title="Campanhas não registradas"
        description="Leads destas campanhas ou anúncios não entram no CRM."
      >
        <MetaEntries queueId={null} data={meta} canEdit={canEdit} />
      </PanelSheet>

      <PanelSheet
        open={Boolean(activePanel)}
        onOpenChange={(open) => {
          if (!open) setPanelId(null);
        }}
        title={activePanel?.label ?? ""}
        description={activePanel?.description}
      >
        {activePanel?.content}
      </PanelSheet>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogPopup className="sm:max-w-2xl max-h-[88vh] p-0 flex flex-col overflow-hidden">
          <DialogPanel className="flex flex-col h-full min-h-0">
            <DialogHeader className="p-5 sm:p-6 border-b border-border/70 bg-card shrink-0">
              <DialogTitle>{editingId ? "Editar fila" : "Criar fila"}</DialogTitle>
              <DialogDescription>
                As mudanças afetam os próximos leads distribuídos. Leads já atribuídos mantêm seu
                histórico.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 space-y-4 min-h-0">
              <label className="grid gap-1.5 text-sm font-medium">
                Nome da fila
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ex.: Leads Quentes, Plantão Central"
                  className="w-full"
                />
              </label>

              {/* Cor da fila — diferencia os leads desta fila na tabela, no kanban e no drawer */}
              <div className="grid gap-2 text-sm font-medium">
                <div className="flex items-center justify-between gap-2">
                  <span>Cor da fila</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setForm({ ...form, colorHue: pickDistinctHue(usedHuesExcept(editingId), { jitter: true }) })}
                  >
                    <ArrowsClockwise className="size-3.5" /> Aleatória
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUEUE_COLOR_SWATCHES.map((hue) => (
                    <button
                      key={hue}
                      type="button"
                      aria-pressed={form.colorHue === hue}
                      aria-label={`Usar esta cor`}
                      title={`Matiz ${hue}°`}
                      onClick={() => setForm({ ...form, colorHue: hue })}
                      className={cn(
                        "grid size-7 place-items-center rounded-full border-2 transition-transform hover:scale-110",
                        form.colorHue === hue ? "border-foreground" : "border-transparent",
                      )}
                    >
                      <QueueColorDot hue={hue} className="size-4" />
                    </button>
                  ))}
                </div>
                {(() => {
                  if (typeof form.colorHue !== "number") return null;
                  const nearest = otherQueueColors(editingId)
                    .map((entry) => ({ ...entry, distance: typeof entry.hue === "number" ? circularHueDistance(form.colorHue as number, entry.hue) : Infinity }))
                    .sort((a, b) => a.distance - b.distance)[0];
                  if (!nearest || nearest.distance >= 18) return null;
                  return (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <QueueColorDot hue={form.colorHue} className="size-2" /> Cor parecida com a fila &ldquo;{nearest.name}&rdquo;. Pode continuar, mas fica mais fácil confundir na tabela.
                    </p>
                  );
                })()}
              </div>

              {/* Unidade Principal */}
              <label className="grid gap-1.5 text-sm font-medium">
                Unidade principal (opcional)
                <AppSelect
                  aria-label="Unidade principal da fila"
                  value={form.branchId}
                  onValueChange={handleBranchChange}
                  options={[
                    { value: "", label: "Todas as Unidades (Geral / Sem Unidade Específica)" },
                    ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                  ]}
                />
              </label>

              {/* Exclusividade de Plantão */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Lightning className="size-4 text-emerald-500 shrink-0" /> Exclusividade de
                  Plantão Agendado ou Ativo
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Selecione um ou mais plantões. A fila só usa corretores escalados nos plantões
                  ativos escolhidos; sem seleção, segue a disponibilidade normal da unidade.
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-emerald-500/20 bg-background/70 p-2.5">
                  {dutySchedules.length ? dutySchedules.map((ds) => {
                    const isChecked = form.exclusiveDutyScheduleIds.includes(ds.id);
                    return (
                      <label key={ds.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-emerald-500/5">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleDutySchedule(ds.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{ds.name}</span>
                            {typeof ds.dayOfWeek === "number" && ds.dayOfWeek >= 0 && ds.dayOfWeek <= 6 ? (
                              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px] font-mono">
                                {DUTY_DAY_LABELS[ds.dayOfWeek]}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {ds.startsAt}–{ds.endsAt}{ds.branchName ? ` · ${ds.branchName}` : ""}
                          </span>
                        </span>
                      </label>
                    );
                  }) : <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum plantão ativo disponível.</p>}
                </div>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  {form.exclusiveDutyScheduleIds.length
                    ? `${form.exclusiveDutyScheduleIds.length} plantão(ões) selecionado(s)`
                    : "Nenhum plantão selecionado — disponibilidade padrão"}
                </p>

                {form.exclusiveDutyScheduleIds.length ? (
                  <fieldset className="space-y-2 border-t border-emerald-500/20 pt-3">
                    <legend className="text-xs font-semibold text-foreground">
                      Quando nenhum plantão selecionado estiver ativo
                    </legend>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Escolha o destino do lead fora dos horários dessas escalas. A primeira opção é a recomendada para manter a distribuição contínua.
                    </p>
                    <div className="grid gap-2">
                      {[
                        {
                          value: "unit_roster" as const,
                          title: "Usar disponibilidade normal da unidade",
                          description: "Continua distribuindo para corretores disponíveis da unidade.",
                        },
                        {
                          value: "wait_next_duty" as const,
                          title: "Aguardar o próximo plantão selecionado",
                          description: "Mantém o lead na fila até uma escala escolhida ficar ativa.",
                        },
                        {
                          value: "fallback_queue" as const,
                          title: "Enviar para uma fila de contingência",
                          description: "Encaminha o lead para outra fila ativa, com o mesmo motor de distribuição.",
                        },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors motion-reduce:transition-none",
                            form.dutyFallbackPolicy === option.value
                              ? "border-primary/60 bg-primary/5"
                              : "border-border/70 bg-background hover:bg-accent/40",
                          )}
                        >
                          <input
                            type="radio"
                            name="duty-fallback-policy"
                            value={option.value}
                            checked={form.dutyFallbackPolicy === option.value}
                            onChange={() => setDutyFallbackPolicy(option.value)}
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium">{option.title}</span>
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>

                    {form.dutyFallbackPolicy === "fallback_queue" ? (
                      <label className="grid gap-1.5 pt-1 text-xs font-medium">
                        Fila de contingência
                        <AppSelect
                          aria-label="Fila de contingência"
                          value={form.dutyFallbackQueueId}
                          onValueChange={(value) => setForm((prev) => ({ ...prev, dutyFallbackQueueId: value }))}
                          options={[
                            { value: "", label: "Selecione uma fila ativa" },
                            ...queues
                              .filter((queue) => queue.id !== editingId && queue.status === "active")
                              .map((queue) => ({ value: queue.id, label: `${queue.name}${queue.branchName ? ` · ${queue.branchName}` : ""}` })),
                          ]}
                        />
                        <span className="text-[10px] font-normal text-muted-foreground">
                          A fila não pode apontar para ela mesma nem formar um ciclo de contingência.
                        </span>
                      </label>
                    ) : null}

                    {form.dutyFallbackPolicy === "wait_next_duty" ? (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                        Sem plantão ativo agora, os leads permanecerão aguardando nesta fila e serão reavaliados automaticamente no próximo ciclo.
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}
              </div>

              {/* Multi-Unidades Adicionais */}
              {branches.length > 1 && (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Buildings className="size-4 text-primary shrink-0" /> Unidades adicionais
                    atendidas por esta fila
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {form.branchId
                      ? "Marque outras unidades que também poderão enviar ou compartilhar corretores para esta fila."
                      : "Unidade principal é “Todas as Unidades”, então esta fila já atende todas — nada para marcar aqui."}
                  </p>
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    {branches
                      .filter((b) => b.id !== form.branchId)
                      .map((branch) => {
                        const isChecked = effectiveAllowedBranchIds.includes(branch.id);
                        return (
                          <label
                            key={branch.id}
                            className={cn(
                              "flex items-center gap-2 text-xs font-medium min-w-0",
                              form.branchId ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              disabled={!form.branchId}
                              onCheckedChange={() => toggleAllowedBranch(branch.id)}
                            />
                            <span className="truncate">{branch.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Fontes aceitas pela fila */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MagnifyingGlass className="size-4 text-primary shrink-0" /> Fontes aceitas
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Restrinja a fila a canais específicos. Deixe sem seleção para aceitar qualquer origem.
                  Manual e Webhook são fontes exclusivas e não podem ser vinculadas a outra fila ativa.
                </p>
                <div className="grid gap-1.5 pt-1 sm:grid-cols-2">
                  {QUEUE_SOURCE_OPTIONS.map((source) => (
                    <label key={source.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-medium hover:bg-accent/40">
                      <Checkbox
                        checked={form.allowedSourceIds.includes(source.id)}
                        onCheckedChange={() => toggleAllowedSource(source.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{source.label}</span>
                      {source.singleton ? <Badge variant="outline" className="text-[9px]">exclusiva</Badge> : null}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {form.allowedSourceIds.length ? `${form.allowedSourceIds.length} fonte(s) selecionada(s)` : "Todas as fontes válidas"}
                </p>
              </div>

              {/* Escopo e Seleção de Corretores */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
                    <UserList className="size-4 text-primary shrink-0" /> Corretores participantes
                  </p>
                  <div className="w-full sm:w-auto min-w-[200px]">
                    <AppSelect
                      aria-label="Escopo de corretores"
                      size="sm"
                      value={form.brokerScopeMode}
                      onValueChange={(val) =>
                        setForm({ ...form, brokerScopeMode: val as "all" | "selected" })
                      }
                      options={[
                        { value: "all", label: "Todos os corretores elegíveis" },
                        { value: "selected", label: "Selecionar corretores específicos" },
                      ]}
                    />
                  </div>
                </div>

                {form.brokerScopeMode === "selected" ? (
                  <div className="space-y-2 border-t border-border/60 pt-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Selecione apenas os corretores que receberão leads desta fila:
                    </p>
                    <div className="max-h-40 overflow-y-auto overflow-x-hidden space-y-1.5 pr-1">
                      {availableBrokersForForm.length ? (
                        availableBrokersForForm.map((broker) => {
                          const isChecked = form.allowedBrokerIds.includes(broker.id);
                          return (
                            <label
                              key={broker.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-xs font-medium border border-border/50 hover:bg-accent/40 cursor-pointer min-w-0"
                            >
                              <span className="flex items-center gap-2 truncate min-w-0">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleAllowedBroker(broker.id)}
                                />
                                <span className="truncate">{broker.name}</span>
                              </span>
                              {broker.branchName && (
                                <Badge variant="outline" className="text-[9px] shrink-0">
                                  {broker.branchName}
                                </Badge>
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-2">
                          Nenhum corretor encontrado na(s) unidade(s) selecionada(s).
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Todos os corretores ativos e disponíveis na(s) unidade(s) selecionada(s)
                    participarão da rodada.
                  </p>
                )}
              </div>

              {/* Modo e Estratégia */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 text-sm font-medium">
                  <span>Modo</span>
                  <AppSelect
                    aria-label="Modo de atribuição"
                    value={form.assignmentMode}
                    onValueChange={(assignmentMode) => setForm({ ...form, assignmentMode })}
                    options={[
                      { value: "automatic", label: "Automática" },
                      { value: "manual", label: "Manual" },
                    ]}
                  />
                </div>
                <div className="grid gap-1.5 text-sm font-medium">
                  <span>Estratégia</span>
                  <AppSelect
                    aria-label="Estratégia de atribuição"
                    value={form.assignmentStrategy}
                    onValueChange={(assignmentStrategy) => setForm({ ...form, assignmentStrategy })}
                    options={[
                      { value: "capacity", label: "Menor carga" },
                      { value: "round_robin", label: "Round robin" },
                    ]}
                  />
                </div>
              </div>

              {/* Qualificação por Bot de IA */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                <label className="flex items-center justify-between text-sm font-semibold text-foreground cursor-pointer">
                  <span className="flex items-center gap-2">
                    <MagicWand className="size-4 text-primary shrink-0" /> Ativar Qualificação por
                    Bot de IA
                  </span>
                  <Checkbox
                    checked={form.aiQualificationEnabled}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, aiQualificationEnabled: checked === true })
                    }
                  />
                </label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Quando ativada, o Bot de IA do WhatsApp qualifica automaticamente os leads
                  direcionados a esta fila.
                </p>
              </div>

              {attendanceFlows ? (
                <div className="rounded-xl border border-border/70 p-4 space-y-1.5">
                  <label htmlFor="queue-attendance-flow" className="text-sm font-semibold text-foreground">Fluxo de atendimento</label>
                  <select
                    id="queue-attendance-flow"
                    value={form.attendanceFlowId ?? ""}
                    onChange={(event) => setForm({ ...form, attendanceFlowId: event.target.value || null })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Sem fluxo (atendimento atual)</option>
                    {attendanceFlows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
                  </select>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {attendanceFlows.find((flow) => flow.id === form.attendanceFlowId)?.description ?? "Os leads desta fila seguem o atendimento de hoje."}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold text-foreground">Entradas da fila</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Campanhas e exceções por anúncio são configuradas na seção “Entradas por campanha Meta”,
                  abaixo da lista de filas. Assim, cada entrada tem um único lugar para ser revisada.
                </p>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    persistQueueDraft();
                    setEditorOpen(false);
                    window.setTimeout(
                      () =>
                        document.getElementById("entradas-meta")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                      0,
                    );
                  }}
                >
                  Configurar entradas
                </Button>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={form.capacityEnabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, capacityEnabled: checked === true })
                  }
                />
                <span>Limitar leads ativos por corretor</span>
                <InfoTooltip
                  title="Capacidade"
                  description="Quando o limite é atingido, o corretor deixa de ser elegível para novos leads dessa fila."
                />
              </label>

              {form.capacityEnabled ? (
                <label className="grid gap-1.5 text-sm font-medium">
                  Máximo por corretor
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={form.capacityPerBroker}
                    onChange={(event) =>
                      setForm({ ...form, capacityPerBroker: event.target.value })
                    }
                    className="w-full"
                  />
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Intervalo entre ofertas (min)
                    <InfoTooltip
                      title="Intervalo entre ofertas"
                      description="Tempo mínimo entre dois leads oferecidos ao mesmo corretor. Evita enxurrada quando leads guardados são liberados no início do plantão. Use 0 para desativar."
                    />
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={form.offerIntervalMinutes}
                    onChange={(event) => setForm({ ...form, offerIntervalMinutes: event.target.value })}
                    className="w-full"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Ofertas pendentes por corretor
                    <InfoTooltip
                      title="Ofertas pendentes"
                      description="Quantas ofertas sem resposta o corretor pode ter ao mesmo tempo. Com 1, o próximo lead só é oferecido depois que o anterior for aceito ou expirar. Use 0 para desativar."
                    />
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={form.maxPendingOffersPerBroker}
                    onChange={(event) => setForm({ ...form, maxPendingOffersPerBroker: event.target.value })}
                    className="w-full"
                  />
                </label>
              </div>

              <div className="grid gap-1.5 text-sm font-medium">
                <span>Estado</span>
                <AppSelect
                  aria-label="Estado da fila"
                  value={form.status}
                  onValueChange={(status) => setForm({ ...form, status })}
                  options={[
                    { value: "active", label: "Ativa" },
                    { value: "inactive", label: "Pausada" },
                  ]}
                />
              </div>
            </div>

            <DialogFooter className="p-4 sm:p-5 border-t border-border/70 bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={saving}
                className="active:scale-[0.97] transition-transform"
              >
                Cancelar
              </Button>
              <Button
                onClick={saveQueue}
                disabled={saving || !form.name.trim()}
                className={cn(
                  "gap-1.5 active:scale-[0.97] transition-all duration-150",
                  saving && "pointer-events-none",
                )}
              >
                {saving ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />{" "}
                    Salvando…
                  </>
                ) : (
                  "Salvar fila"
                )}
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* Delete Queue Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogPopup className="sm:max-w-md p-0">
          <DialogPanel>
            <DialogHeader className="p-5 sm:p-6 border-b border-border/70">
              <DialogTitle>Excluir fila</DialogTitle>
              <DialogDescription>
                {deleteTarget
                  ? `Tem certeza que deseja excluir a fila "${deleteTarget.name}"?`
                  : "Verificando pendências..."}
              </DialogDescription>
            </DialogHeader>
            <div className="p-5 sm:p-6 space-y-4">
              {loadingDependencies ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />{" "}
                  Verificando pendências...
                </div>
              ) : deleteDependencies ? (
                <div className="space-y-3">
                  {deleteDependencies.campaignRoutes.length > 0 ||
                  deleteDependencies.adRoutes.length > 0 ||
                  deleteDependencies.queuedLeads > 0 ? (
                    <>
                      <p className="text-sm font-medium text-foreground">Pendências encontradas:</p>
                      <div className="space-y-2">
                        {deleteDependencies.campaignRoutes.length > 0 && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-xs font-semibold text-warning">
                              {deleteDependencies.campaignRoutes.length} campanha(s) vinculada(s)
                            </p>
                            <div className="mt-1 space-y-0.5">
                              {deleteDependencies.campaignRoutes.map((r) => (
                                <p key={r.campaignId} className="text-[11px] text-muted-foreground">
                                  • {r.campaignName ?? r.campaignId}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {deleteDependencies.adRoutes.length > 0 && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-xs font-semibold text-warning">
                              {deleteDependencies.adRoutes.length} anúncio(s) vinculado(s)
                            </p>
                            <div className="mt-1 space-y-0.5">
                              {deleteDependencies.adRoutes.map((r) => (
                                <p key={r.adId} className="text-[11px] text-muted-foreground">
                                  • {r.adName ?? r.adId}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {deleteDependencies.queuedLeads > 0 && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-xs font-semibold text-warning">
                              {deleteDependencies.queuedLeads} lead(s) na fila
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Leaves sem unidade ficarão na inbox geral.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma pendência encontrada. A fila pode ser excluída normalmente.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <DialogFooter className="p-4 sm:p-5 border-t border-border/70 bg-muted/20 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={forceDeleting}
                className="active:scale-[0.97] transition-transform"
              >
                Cancelar
              </Button>
              {deleteDependencies &&
              (deleteDependencies.campaignRoutes.length > 0 ||
                deleteDependencies.adRoutes.length > 0 ||
                deleteDependencies.queuedLeads > 0) ? (
                <Button
                  variant="destructive"
                  onClick={() => void forceDeleteQueue()}
                  disabled={forceDeleting}
                  className={cn(
                    "gap-1.5 active:scale-[0.97] transition-all duration-150",
                    forceDeleting && "pointer-events-none",
                  )}
                >
                  {forceDeleting ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
                      Desvinculando...
                    </>
                  ) : (
                    "Desvincular e excluir fila"
                  )}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => void confirmDeleteQueue()}
                  disabled={!deleteDependencies}
                  className="active:scale-[0.97] transition-transform"
                >
                  Excluir fila
                </Button>
              )}
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* Simulator Modal */}
      <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}>
        <DialogPopup className="sm:max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogPanel className="flex flex-col h-full min-h-0">
            <DialogHeader className="p-5 sm:p-6 border-b border-border/70 bg-card shrink-0">
              <DialogTitle>Simular distribuição</DialogTitle>
              <DialogDescription>
                Veja a decisão provável antes de alterar uma regra. A simulação não cria eventos nem
                altera a fila.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 space-y-4 min-h-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <AppSelect
                  aria-label="Unidade da simulação"
                  value={simulationForm.branchId}
                  onValueChange={(branchId) =>
                    setSimulationForm({ ...simulationForm, branchId, queueId: "" })
                  }
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
                <AppSelect
                  aria-label="Fila da simulação"
                  value={simulationForm.queueId}
                  onValueChange={(queueId) => setSimulationForm({ ...simulationForm, queueId })}
                  options={[
                    { value: "", label: "Fila padrão da unidade" },
                    ...branchQueues.map((queue) => ({ value: queue.id, label: queue.name })),
                  ]}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 text-sm font-medium">
                  <span>Temperatura</span>
                  <AppSelect
                    aria-label="Temperatura do lead simulado"
                    value={simulationForm.temperature}
                    onValueChange={(temperature) =>
                      setSimulationForm({ ...simulationForm, temperature })
                    }
                    options={[
                      { value: "hot", label: "Quente" },
                      { value: "warm", label: "Morno" },
                      { value: "cold", label: "Frio" },
                    ]}
                  />
                </div>
                <label className="grid gap-1.5 text-sm font-medium">
                  Score
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={simulationForm.score}
                    onChange={(event) =>
                      setSimulationForm({ ...simulationForm, score: event.target.value })
                    }
                    className="w-full"
                  />
                </label>
              </div>

              <Button
                className={cn(
                  "w-fit gap-1.5 active:scale-[0.97] transition-all duration-150",
                  simulating && "pointer-events-none",
                )}
                onClick={runSimulation}
                disabled={simulating || !simulationForm.branchId}
              >
                {simulating ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />{" "}
                    Calculando…
                  </>
                ) : (
                  "Executar simulação"
                )}
              </Button>

              {simulation?.success ? (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-success" />
                    <p className="text-sm font-semibold">
                      {simulation.queue?.name ?? "Sem fila resolvida"}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {simulation.reason}
                  </p>
                  {simulation.selected ? (
                    <p className="mt-3 text-sm">
                      Destino provável: <strong>{simulation.selected.name}</strong> ·{" "}
                      {simulation.selected.activeLeads} leads ativos
                      {simulation.selected.capacity ? ` de ${simulation.selected.capacity}` : ""}
                    </p>
                  ) : null}
                  {simulation.eligible?.length ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-3">
                      {simulation.eligible.map((broker) => (
                        <div key={broker.id} className="flex items-center justify-between text-xs">
                          <span>{broker.name}</span>
                          <span className="font-mono text-muted-foreground">
                            {broker.activeLeads}
                            {broker.capacity ? `/${broker.capacity}` : ""} · score {broker.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <DialogFooter className="p-4 sm:p-5 border-t border-border/70 bg-muted/20 shrink-0 flex items-center justify-end">
              <Button variant="outline" onClick={() => setSimulatorOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
