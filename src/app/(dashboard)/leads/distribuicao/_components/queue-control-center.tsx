"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  ChartBar,
  CheckCircle,
  Clock,
  MagicWand,
  Plus,
  SlidersHorizontal,
  Trash,
  UserList,
  Buildings,
  Lightning,
  MagnifyingGlass,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSelect } from "@/components/ui/select";
import {
  deleteDistributionQueueAction,
  deleteMetaAdQueueRouteAction,
  deleteMetaCampaignQueueRouteAction,
  forceDeleteQueueAction,
  getQueueDependenciesAction,
  saveDistributionQueueAction,
  saveMetaAdQueueRouteAction,
  saveMetaCampaignQueueRouteAction,
  simulateDistributionAction,
  type QueueDependencyInfo,
} from "@/features/lead-distribution/actions";
import { toast } from "@/components/ui/sonner";
import { Loader2Icon } from "@/components/huge-icons";
import { cn } from "@/utils/core/cn";
import { QUEUE_SOURCE_OPTIONS } from "@/features/lead-distribution/routing-catalog";

type Queue = {
  id: string;
  name: string;
  branchId: string | null;
  exclusiveDutyScheduleId?: string | null;
  exclusiveDutyScheduleIds?: string[] | null;
  branchName?: string | null;
  status: string;
  assignmentMode: string;
  assignmentStrategy: string;
  capacityEnabled: boolean;
  capacityPerBroker: number | null;
  aiQualificationEnabled?: boolean;
  waiting: number;
  members: number;
  activeLeads: number;
  allowedBranchIds?: string[];
  allowedBrokerIds?: string[];
  allowedSourceIds?: string[];
};

type Branch = { id: string; name: string };
type Broker = { id: string; name: string; branchId?: string | null; branchName?: string | null };
type DutySchedule = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  dayOfWeek?: number;
  branchName?: string | null;
};
type Campaign = { campaignId: string; name: string; status: string };
type CampaignRoute = {
  campaignId: string;
  queueId: string | null;
  queueName: string | null;
  enabled: boolean;
};
type Ad = { adId: string; name: string; status: string };
type AdRoute = { adId: string; queueId: string | null; queueName: string | null; enabled: boolean };
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
  allowedBranchIds: [] as string[],
  brokerScopeMode: "all" as "all" | "selected",
  allowedBrokerIds: [] as string[],
  allowedSourceIds: [] as string[],
  name: "",
  assignmentMode: "automatic",
  assignmentStrategy: "capacity",
  capacityEnabled: false,
  capacityPerBroker: "10",
  aiQualificationEnabled: true,
  status: "active",
};

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
}: {
  queues: Queue[];
  branches: Branch[];
  brokers?: Broker[];
  dutySchedules?: DutySchedule[];
  campaigns: Campaign[];
  ads: Ad[];
  campaignRoutes: CampaignRoute[];
  adRoutes: AdRoute[];
  canEdit: boolean;
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
  const [campaignRoute, setCampaignRoute] = useState({
    campaignId: campaigns[0]?.campaignId ?? "",
    queueId: queues[0]?.id ?? "",
  });
  const [adRoute, setAdRoute] = useState({
    adId: ads[0]?.adId ?? "",
    queueId: queues[0]?.id ?? "",
  });
  const [savingCampaignRoute, setSavingCampaignRoute] = useState(false);
  const [savingAdRoute, setSavingAdRoute] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showOnlyActiveCampaigns, setShowOnlyActiveCampaigns] = useState(true);
  const [showOnlyActiveAds, setShowOnlyActiveAds] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [adSearch, setAdSearch] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Queue | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<QueueDependencyInfo | null>(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);
  const router = useRouter();

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => (c.status ?? "").toUpperCase() === "ACTIVE"),
    [campaigns],
  );
  const displayedCampaigns = useMemo(
    () => (showOnlyActiveCampaigns && activeCampaigns.length > 0 ? activeCampaigns : campaigns),
    [showOnlyActiveCampaigns, activeCampaigns, campaigns],
  );
  const filteredCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLocaleLowerCase("pt-BR");
    return query
      ? displayedCampaigns.filter((campaign) =>
          campaign.name.toLocaleLowerCase("pt-BR").includes(query),
        )
      : displayedCampaigns;
  }, [campaignSearch, displayedCampaigns]);

  const activeAds = useMemo(
    () => ads.filter((a) => (a.status ?? "").toUpperCase() === "ACTIVE"),
    [ads],
  );
  const displayedAds = useMemo(
    () => (showOnlyActiveAds && activeAds.length > 0 ? activeAds : ads),
    [showOnlyActiveAds, activeAds, ads],
  );
  const filteredAds = useMemo(() => {
    const query = adSearch.trim().toLocaleLowerCase("pt-BR");
    return query
      ? displayedAds.filter((ad) => ad.name.toLocaleLowerCase("pt-BR").includes(query))
      : displayedAds;
  }, [adSearch, displayedAds]);
  const queueIdsWithAdExceptions = useMemo(
    () => new Set(adRoutes.filter((route) => route.queueId && route.enabled).map((route) => route.queueId)),
    [adRoutes],
  );

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
    setDeletingId(deleteTarget.id);
    setDeleteConfirmOpen(false);
    const result = await deleteDistributionQueueAction(deleteTarget.id);
    setDeletingId(null);
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

  // Available brokers based on selected primary and additional branches
  const formTargetBranchIds = useMemo(
    () => Array.from(new Set([form.branchId, ...form.allowedBranchIds].filter(Boolean))),
    [form.branchId, form.allowedBranchIds],
  );

  const availableBrokersForForm = useMemo(() => {
    if (!formTargetBranchIds.length) return brokers;
    return brokers.filter((b) => b.branchId && formTargetBranchIds.includes(b.branchId));
  }, [brokers, formTargetBranchIds]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyQueue,
      branchId: "",
      exclusiveDutyScheduleId: "",
      exclusiveDutyScheduleIds: [],
      allowedBranchIds: branches.map((b) => b.id), // Todas marcadas por padrão
      brokerScopeMode: "all",
      allowedBrokerIds: [],
      allowedSourceIds: [],
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
      allowedBranchIds: queue.allowedBranchIds ?? [],
      brokerScopeMode: hasSpecificBrokers ? "selected" : "all",
      allowedBrokerIds: queue.allowedBrokerIds ?? [],
      allowedSourceIds: queue.allowedSourceIds ?? [],
      name: queue.name,
      assignmentMode: queue.assignmentMode,
      assignmentStrategy: queue.assignmentStrategy,
      capacityEnabled: queue.capacityEnabled,
      capacityPerBroker: String(queue.capacityPerBroker ?? 10),
      aiQualificationEnabled: queue.aiQualificationEnabled ?? true,
      status: queue.status,
    });
    setEditorOpen(true);
  }

  function toggleAllowedBranch(branchId: string) {
    setForm((prev) => {
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
      allowedBranchIds: form.allowedBranchIds,
      allowedBrokerIds: finalAllowedBrokerIds,
      allowedSourceIds: form.allowedSourceIds,
      name: form.name,
      assignmentMode: form.assignmentMode,
      assignmentStrategy: form.assignmentStrategy,
      capacityEnabled: form.capacityEnabled,
      capacityPerBroker: form.capacityEnabled ? Number(form.capacityPerBroker) : null,
      aiQualificationEnabled: form.aiQualificationEnabled,
      status: form.status,
    });
    setSaving(false);
    if (!result.success)
      return toast.error(result.error ?? "Não foi possível salvar a fila.", {
        description: "Verifique os dados e tente novamente.",
      });
    toast.success(result.message, {
      description: editingId
        ? `A fila "${form.name}" foi atualizada.`
        : `A fila "${form.name}" está pronta para receber leads.`,
    });
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

  async function saveCampaignRoute(enabled: boolean) {
    setSavingCampaignRoute(true);
    const result = await saveMetaCampaignQueueRouteAction({
      campaignId: campaignRoute.campaignId,
      queueId: enabled ? campaignRoute.queueId : null,
      enabled,
    });
    setSavingCampaignRoute(false);
    if (!result.success)
      return toast.error(result.error ?? "Não foi possível atualizar a campanha.", {
        description: "Verifique se a fila está ativa.",
      });
    toast.success(
      result.message ?? (enabled ? "Campanha vinculada à fila." : "Campanha ignorada pelo CRM."),
      {
        description: enabled
          ? "Leads serão direcionados automaticamente."
          : "A campanha não será registrada no CRM.",
      },
    );
    router.refresh();
  }

  async function saveAdRoute(enabled: boolean) {
    setSavingAdRoute(true);
    const result = await saveMetaAdQueueRouteAction({
      adId: adRoute.adId,
      queueId: enabled ? adRoute.queueId : null,
      enabled,
    });
    setSavingAdRoute(false);
    if (!result.success)
      return toast.error(result.error ?? "Não foi possível atualizar o anúncio.", {
        description: "Verifique se a fila está ativa.",
      });
    toast.success(
      result.message ?? (enabled ? "Anúncio vinculado à fila." : "Anúncio ignorado pelo CRM."),
      {
        description: enabled
          ? "Leads deste anúncio serão direcionados automaticamente."
          : "O anúncio não será registrado no CRM.",
      },
    );
    router.refresh();
  }

  async function deleteMetaCampaignRoute(campaignId: string) {
    if (!confirm("Remover esta regra de campanha? A campanha voltará a usar a fila geral.")) return;
    const result = await deleteMetaCampaignQueueRouteAction(campaignId);
    if (!result.success) return toast.error(result.error ?? "Não foi possível remover a regra.");
    toast.success(result.message);
    router.refresh();
  }

  async function deleteMetaAdRoute(adId: string) {
    if (!confirm("Remover esta regra de anúncio? O anúncio voltará a usar a fila geral.")) return;
    const result = await deleteMetaAdQueueRouteAction(adId);
    if (!result.success) return toast.error(result.error ?? "Não foi possível remover a regra.");
    toast.success(result.message);
    router.refresh();
  }

  return (
    <>
      <section aria-labelledby="queues-title" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="queues-title" className="text-base font-semibold">
              Filas de distribuição
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada fila decide como a corretora ou unidade recebe, prioriza e distribui novos leads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSimulation(null);
                setSimulatorOpen(true);
              }}
              className="active:scale-[0.97] transition-transform"
            >
              <MagicWand />
              Simular distribuição
            </Button>
            {canEdit ? (
              <Button
                size="sm"
                onClick={openCreate}
                className="active:scale-[0.97] transition-transform"
              >
                <Plus />
                Criar fila
              </Button>
            ) : null}
          </div>
        </div>

        {!queues.length ? (
          <Card variant="overview">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <UserList className="size-5" />
              </span>
              <p className="text-sm font-medium">Nenhuma fila configurada</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Crie a primeira fila para tornar a distribuição previsível na operação.
              </p>
              {canEdit ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Criar fila
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queues.map((queue) => {
              const multiBranchCount =
                (queue.allowedBranchIds?.length ?? 0) + (queue.branchId ? 1 : 0);
              const hasSpecificBrokers = (queue.allowedBrokerIds?.length ?? 0) > 0;
              const dutyScheduleIds = Array.from(new Set([
                ...(queue.exclusiveDutyScheduleIds ?? []),
                ...(queue.exclusiveDutyScheduleId ? [queue.exclusiveDutyScheduleId] : []),
              ]));
              const dutyScheduleNames = dutyScheduleIds
                .map((id) => dutySchedules.find((ds) => ds.id === id)?.name)
                .filter((name): name is string => Boolean(name));
              const queueCampaignRoutes = campaignRoutes.filter(
                (r) => r.queueId === queue.id && r.enabled,
              );
              const queueCampaigns = campaigns.filter((c) =>
                queueCampaignRoutes.some((r) => r.campaignId === c.campaignId),
              );
              const queueSourceIds = queue.allowedSourceIds ?? [];
              const queueSourceNames = queueSourceIds.flatMap((sourceId) => {
                const label = QUEUE_SOURCE_OPTIONS.find((source) => source.id === sourceId)?.label;
                return label ? [label] : [];
              });

              return (
                <Card
                  key={queue.id}
                  variant="compact"
                  className="group transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-primary/30 motion-reduce:transition-none"
                >
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{queue.name}</CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span>{queue.branchName || "Todas as Unidades (Geral)"}</span>
                          {multiBranchCount > 1 && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              +{multiBranchCount - 1} unidade(s)
                            </Badge>
                          )}
                          {dutyScheduleIds.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
                            >
                              <Lightning className="size-3.5" aria-hidden="true" /> Plantão{dutyScheduleIds.length > 1 ? "ões" : ""}:{" "}
                              {dutyScheduleNames.slice(0, 2).join(", ") || "Exclusivo"}
                              {dutyScheduleNames.length > 2 ? ` +${dutyScheduleNames.length - 2}` : ""}
                            </Badge>
                          )}
                          {queue.aiQualificationEnabled !== false ? (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1"
                            >
                              <MagicWand className="size-3" /> Bot IA Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground gap-1"
                            >
                              Bot IA Pausado
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                      <Badge variant={queue.status === "active" ? "success" : "outline"}>
                        {queue.status === "active" ? "Ativa" : "Pausada"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 divide-x divide-border/70 rounded-lg border border-border/60 bg-muted/20 py-2">
                      <Metric icon={Clock} label="Aguardando" value={queue.waiting} />
                      <Metric icon={UserList} label="Elegíveis" value={queue.members} />
                      <Metric icon={ChartBar} label="Ativos" value={queue.activeLeads} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {queue.assignmentMode === "automatic" ? "Automática" : "Manual"} ·{" "}
                        {queue.assignmentStrategy === "round_robin" ? "Round robin" : "Menor carga"}
                      </span>
                      {hasSpecificBrokers ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-primary/10 text-primary border-primary/20"
                        >
                          {queue.allowedBrokerIds!.length} corretor(es) específico(s)
                        </Badge>
                      ) : (
                        <span>
                          {queue.capacityEnabled
                            ? `${queue.capacityPerBroker}/corretor`
                            : "Sem limite"}
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">Entradas desta fila</p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            Campanhas vinculadas diretamente a este destino.
                          </p>
                        </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          document.getElementById("entradas-meta")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                        }
                      >
                        Ver entradas
                      </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {queueCampaigns.length > 0 ? (
                          <>
                            {queueCampaigns.slice(0, 3).map((campaign) => (
                              <Badge key={campaign.campaignId} variant="outline" className="max-w-full truncate text-[10px] font-medium">
                                {campaign.name}
                              </Badge>
                            ))}
                            {queueCampaigns.length > 3 ? (
                              <Badge variant="secondary" className="text-[10px]">+{queueCampaigns.length - 3}</Badge>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Fila geral — sem campanha específica</span>
                        )}
                        {queueIdsWithAdExceptions.has(queue.id) ? (
                          <span className="text-[10px] text-muted-foreground">· exceção por anúncio ativa</span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
                        <span className="text-[10px] font-medium text-muted-foreground">Fontes:</span>
                        {queueSourceNames.length ? queueSourceNames.slice(0, 3).map((label) => (
                          <Badge key={label} variant="secondary" className="text-[10px] font-normal">
                            {label}
                          </Badge>
                        )) : (
                          <span className="text-[10px] text-muted-foreground">Todas as fontes válidas</span>
                        )}
                        {queueSourceNames.length > 3 ? (
                          <Badge variant="secondary" className="text-[10px]">+{queueSourceNames.length - 3}</Badge>
                        ) : null}
                      </div>
                    </div>

                    {canEdit ? (
                      <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleDeleteQueue(queue)}
                          disabled={deletingId === queue.id}
                          className={cn(
                            "text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 active:scale-[0.96] transition-[transform,background-color,color] duration-150",
                            deletingId === queue.id && "pointer-events-none",
                          )}
                        >
                          {deletingId === queue.id ? (
                            <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <Trash className="size-3.5" />
                          )}
                          {deletingId === queue.id ? "Excluindo…" : "Excluir"}
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEdit(queue)}
                          className="active:scale-[0.96] transition-transform duration-150"
                        >
                          <SlidersHorizontal />
                          Editar
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="border-t border-border/70 pt-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Entradas e exceções</h2>
        <p className="mt-1 mb-4 text-sm leading-6 text-muted-foreground">
          A campanha define o destino padrão. Use uma exceção apenas quando um anúncio precisar de outra fila.
        </p>
      </div>

      {/* Meta Campaign Route Card */}
      <Card id="entradas-meta" variant="compact" className="scroll-mt-28 border-primary/20 bg-card shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>Campanhas Meta</span>
                <InfoTooltip
                  title="Regra de entrada por campanha"
                  description="Define para qual fila cada campanha envia os leads (Fila Geral, Unidade ou Corretor específico). Opcionalmente é possível ignorar uma campanha."
                />
                <Badge
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {activeCampaigns.length} ativa(s)
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Uma campanha sem regra específica usa a Fila Geral.
              </CardDescription>
            </div>
            {campaigns.length > activeCampaigns.length && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowOnlyActiveCampaigns((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {showOnlyActiveCampaigns
                  ? `Mostrar todas (${campaigns.length})`
                  : `Filtrar ativas (${activeCampaigns.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="relative block">
            <span className="sr-only">Buscar campanha Meta</span>
            <MagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={campaignSearch}
              onChange={(event) => setCampaignSearch(event.target.value)}
              placeholder="Buscar campanha por nome..."
              className="h-9 pl-9 text-sm"
            />
          </label>
          {displayedCampaigns.length && queues.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <AppSelect
                aria-label="Campanha Meta"
                value={campaignRoute.campaignId}
                onValueChange={(campaignId) => setCampaignRoute({ ...campaignRoute, campaignId })}
                contentClassName="max-h-72 overflow-y-auto"
                options={filteredCampaigns.map((campaign) => {
                  const isActive = (campaign.status ?? "").toUpperCase() === "ACTIVE";
                  return {
                    value: campaign.campaignId,
                    label: `${campaign.name} ${isActive ? "· Ativa" : "· Pausada"}`,
                  };
                })}
              />
              <AppSelect
                aria-label="Fila de destino da campanha"
                value={campaignRoute.queueId}
                onValueChange={(queueId) => setCampaignRoute({ ...campaignRoute, queueId })}
                options={queues
                  .filter((queue) => queue.status === "active")
                  .map((queue) => ({
                    value: queue.id,
                    label: queue.branchName
                      ? `${queue.name} · ${queue.branchName}`
                      : `${queue.name} · Fila geral`,
                  }))}
              />
              <Button
                size="sm"
                onClick={() => void saveCampaignRoute(true)}
                disabled={
                  !canEdit ||
                  savingCampaignRoute ||
                  !campaignRoute.campaignId ||
                  !campaignRoute.queueId
                }
                className={cn(
                  "gap-1.5 active:scale-[0.97] transition-all duration-150",
                  savingCampaignRoute && "pointer-events-none",
                )}
              >
                {savingCampaignRoute ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
                    Salvando…
                  </>
                ) : (
                  "Receber na fila"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveCampaignRoute(false)}
                disabled={!canEdit || savingCampaignRoute || !campaignRoute.campaignId}
                className={cn(
                  "text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all duration-150",
                  savingCampaignRoute && "pointer-events-none",
                )}
              >
                {savingCampaignRoute ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
                    Salvando…
                  </>
                ) : (
                  "Não registrar"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {campaigns.length === 0
                ? "Sincronize ao menos uma campanha Meta para configurar essa regra."
                : "Nenhuma campanha ativa encontrada. Alterne para 'Mostrar todas' para ver campanhas pausadas."}
            </p>
          )}

          {campaignRoutes.length ? (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Regras de Campanhas Configuradas ({campaignRoutes.length})
              </div>
              <ScrollArea className="h-64 max-h-[50vh] min-h-0 rounded-lg border border-border/60 bg-muted/20">
                <div className="divide-y divide-border/40">
                  {campaignRoutes
                    .filter((route) => {
                      const campaign = campaigns.find(
                        (item) => item.campaignId === route.campaignId,
                      );
                      return (
                        !campaignSearch.trim() ||
                        (campaign?.name ?? route.campaignId)
                          .toLocaleLowerCase("pt-BR")
                          .includes(campaignSearch.trim().toLocaleLowerCase("pt-BR"))
                      );
                    })
                    .map((route) => {
                      const matched = campaigns.find((c) => c.campaignId === route.campaignId);
                      const isActive = (matched?.status ?? "").toUpperCase() === "ACTIVE";
                      return (
                        <div
                          key={route.campaignId}
                          className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`size-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                            />
                            <span className="font-medium truncate">
                              {matched?.name ?? route.campaignId}
                            </span>
                            {matched?.status && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal uppercase"
                              >
                                {matched.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={route.enabled ? "success" : "outline"}
                              className="text-xs font-medium"
                            >
                              {route.enabled
                                ? `→ ${route.queueName ?? "Fila geral"}`
                                : "Não registrar no CRM"}
                            </Badge>
                            {canEdit && (
                              <>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setCampaignRoute({
                                      campaignId: route.campaignId,
                                      queueId: route.queueId ?? queues[0]?.id ?? "",
                                    });
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => void deleteMetaCampaignRoute(route.campaignId)}
                                  className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Meta Ad Route Card */}
      <Card id="excecoes-anuncio" variant="compact" className="scroll-mt-28 border-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>Exceções por anúncio</span>
                <InfoTooltip
                  title="Prioridade da regra"
                  description="Se um anúncio tiver regra própria, ela prevalece sobre a regra da campanha. Use quando anúncios da mesma campanha precisam de filas diferentes."
                />
                <Badge variant="outline" className="text-xs font-normal">
                  {activeAds.length} ativo(s)
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Uma exceção por anúncio prevalece sobre a regra da campanha.
              </CardDescription>
            </div>
            {ads.length > activeAds.length && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowOnlyActiveAds((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {showOnlyActiveAds
                  ? `Mostrar todos (${ads.length})`
                  : `Filtrar ativos (${activeAds.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="relative block">
            <span className="sr-only">Buscar anúncio Meta</span>
            <MagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={adSearch}
              onChange={(event) => setAdSearch(event.target.value)}
              placeholder="Buscar anúncio por nome..."
              className="h-9 pl-9 text-sm"
            />
          </label>
          {displayedAds.length && queues.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <AppSelect
                aria-label="Anúncio Meta"
                value={adRoute.adId}
                onValueChange={(adId) => setAdRoute({ ...adRoute, adId })}
                contentClassName="max-h-72 overflow-y-auto"
                options={filteredAds.map((ad) => {
                  const isActive = (ad.status ?? "").toUpperCase() === "ACTIVE";
                  return {
                    value: ad.adId,
                    label: `${ad.name} ${isActive ? "· Ativo" : "· Pausado"}`,
                  };
                })}
              />
              <AppSelect
                aria-label="Fila de destino do anúncio"
                value={adRoute.queueId}
                onValueChange={(queueId) => setAdRoute({ ...adRoute, queueId })}
                options={queues
                  .filter((queue) => queue.status === "active")
                  .map((queue) => ({
                    value: queue.id,
                    label: queue.branchName
                      ? `${queue.name} · ${queue.branchName}`
                      : `${queue.name} · Fila geral`,
                  }))}
              />
              <Button
                size="sm"
                onClick={() => void saveAdRoute(true)}
                disabled={!canEdit || savingAdRoute || !adRoute.adId || !adRoute.queueId}
                className={cn(
                  "gap-1.5 active:scale-[0.97] transition-all duration-150",
                  savingAdRoute && "pointer-events-none",
                )}
              >
                {savingAdRoute ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
                    Salvando…
                  </>
                ) : (
                  "Receber na fila"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveAdRoute(false)}
                disabled={!canEdit || savingAdRoute || !adRoute.adId}
                className={cn(
                  "text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all duration-150",
                  savingAdRoute && "pointer-events-none",
                )}
              >
                {savingAdRoute ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
                    Salvando…
                  </>
                ) : (
                  "Não registrar"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ads.length === 0
                ? "Os anúncios aparecem depois da sincronização completa da conta de anúncios."
                : "Nenhum anúncio ativo encontrado. Alterne para 'Mostrar todos' para ver anúncios pausados."}
            </p>
          )}

          {adRoutes.length ? (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Exceções de Anúncios Configuradas ({adRoutes.length})
              </div>
              <ScrollArea className="h-64 max-h-[50vh] min-h-0 rounded-lg border border-border/60 bg-muted/20">
                <div className="divide-y divide-border/40">
                  {adRoutes
                    .filter((route) => {
                      const ad = ads.find((item) => item.adId === route.adId);
                      return (
                        !adSearch.trim() ||
                        (ad?.name ?? route.adId)
                          .toLocaleLowerCase("pt-BR")
                          .includes(adSearch.trim().toLocaleLowerCase("pt-BR"))
                      );
                    })
                    .map((route) => {
                      const matched = ads.find((a) => a.adId === route.adId);
                      const isActive = (matched?.status ?? "").toUpperCase() === "ACTIVE";
                      return (
                        <div
                          key={route.adId}
                          className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`size-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                            />
                            <span className="font-medium truncate">
                              {matched?.name ?? route.adId}
                            </span>
                            {matched?.status && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal uppercase"
                              >
                                {matched.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={route.enabled ? "success" : "outline"}
                              className="text-xs font-medium"
                            >
                              {route.enabled
                                ? `→ ${route.queueName ?? "Fila geral"}`
                                : "Não registrar no CRM"}
                            </Badge>
                            {canEdit && (
                              <>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setAdRoute({
                                      adId: route.adId,
                                      queueId: route.queueId ?? queues[0]?.id ?? "",
                                    });
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => void deleteMetaAdRoute(route.adId)}
                                  className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Editor Modal */}
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
                          <span className="block truncate font-medium">{ds.name}</span>
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
              </div>

              {/* Multi-Unidades Adicionais */}
              {branches.length > 1 && (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Buildings className="size-4 text-primary shrink-0" /> Unidades adicionais
                    atendidas por esta fila
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Marque outras unidades que também poderão enviar ou compartilhar corretores para
                    esta fila.
                  </p>
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    {branches
                      .filter((b) => b.id !== form.branchId)
                      .map((branch) => {
                        const isChecked = form.allowedBranchIds.includes(branch.id);
                        return (
                          <label
                            key={branch.id}
                            className="flex items-center gap-2 text-xs font-medium cursor-pointer min-w-0"
                          >
                            <Checkbox
                              checked={isChecked}
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

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2">
      <Icon className="mx-auto size-3.5 text-muted-foreground" />
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
