"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ChartBar, CheckCircle, Clock, MagicWand, Plus, SlidersHorizontal, Trash, UserList, Buildings, Lightning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { deleteDistributionQueueAction, saveDistributionQueueAction, saveMetaAdQueueRouteAction, saveMetaCampaignQueueRouteAction, simulateDistributionAction } from "@/features/lead-distribution/actions";
import { toast } from "sonner";

type Queue = {
  id: string;
  name: string;
  branchId: string | null;
  exclusiveDutyScheduleId?: string | null;
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
};

type Branch = { id: string; name: string };
type Broker = { id: string; name: string; branchId?: string | null; branchName?: string | null };
type DutySchedule = { id: string; name: string; startsAt: string; endsAt: string; dayOfWeek?: number; branchName?: string | null };
type Campaign = { campaignId: string; name: string; status: string };
type CampaignRoute = { campaignId: string; queueId: string | null; queueName: string | null; enabled: boolean };
type Ad = { adId: string; name: string; status: string };
type AdRoute = { adId: string; queueId: string | null; queueName: string | null; enabled: boolean };
type Simulation = { success: boolean; error?: string; queue?: { id: string; name: string } | null; reason?: string; selected?: { id: string; name: string; activeLeads: number; capacity: number | null } | null; eligible?: Array<{ id: string; name: string; activeLeads: number; capacity: number | null; score: number }> };

const emptyQueue = {
  branchId: "",
  exclusiveDutyScheduleId: "",
  allowedBranchIds: [] as string[],
  brokerScopeMode: "all" as "all" | "selected",
  allowedBrokerIds: [] as string[],
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
  const [simulationForm, setSimulationForm] = useState({ branchId: branches[0]?.id ?? "", queueId: "", temperature: "warm", score: "50" });
  const [campaignRoute, setCampaignRoute] = useState({ campaignId: campaigns[0]?.campaignId ?? "", queueId: queues[0]?.id ?? "" });
  const [adRoute, setAdRoute] = useState({ adId: ads[0]?.adId ?? "", queueId: queues[0]?.id ?? "" });
  const [savingCampaignRoute, setSavingCampaignRoute] = useState(false);
  const [savingAdRoute, setSavingAdRoute] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showOnlyActiveCampaigns, setShowOnlyActiveCampaigns] = useState(true);
  const [showOnlyActiveAds, setShowOnlyActiveAds] = useState(true);

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => (c.status ?? "").toUpperCase() === "ACTIVE"),
    [campaigns],
  );
  const displayedCampaigns = useMemo(
    () => (showOnlyActiveCampaigns && activeCampaigns.length > 0 ? activeCampaigns : campaigns),
    [showOnlyActiveCampaigns, activeCampaigns, campaigns],
  );

  const activeAds = useMemo(
    () => ads.filter((a) => (a.status ?? "").toUpperCase() === "ACTIVE"),
    [ads],
  );
  const displayedAds = useMemo(
    () => (showOnlyActiveAds && activeAds.length > 0 ? activeAds : ads),
    [showOnlyActiveAds, activeAds, ads],
  );

  async function handleDeleteQueue(queue: Queue) {
    if (!confirm(`Tem certeza que deseja excluir a fila "${queue.name}"?`)) return;
    setDeletingId(queue.id);
    const result = await deleteDistributionQueueAction(queue.id);
    setDeletingId(null);
    if (!result.success) return toast.error(result.error ?? "Não foi possível excluir a fila.");
    toast.success(result.message);
  }

  const branchQueues = useMemo(
    () => queues.filter((queue) => (queue.branchId === simulationForm.branchId || !queue.branchId) && queue.status === "active"),
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
      allowedBranchIds: [],
      brokerScopeMode: "all",
      allowedBrokerIds: [],
    });
    setEditorOpen(true);
  }

  function openEdit(queue: Queue) {
    setEditingId(queue.id);
    const hasSpecificBrokers = (queue.allowedBrokerIds?.length ?? 0) > 0;
    setForm({
      branchId: queue.branchId ?? "",
      exclusiveDutyScheduleId: queue.exclusiveDutyScheduleId ?? "",
      allowedBranchIds: queue.allowedBranchIds ?? [],
      brokerScopeMode: hasSpecificBrokers ? "selected" : "all",
      allowedBrokerIds: queue.allowedBrokerIds ?? [],
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

  function toggleAllowedBroker(brokerId: string) {
    setForm((prev) => {
      const exists = prev.allowedBrokerIds.includes(brokerId);
      const nextBrokers = exists
        ? prev.allowedBrokerIds.filter((id) => id !== brokerId)
        : [...prev.allowedBrokerIds, brokerId];
      return { ...prev, allowedBrokerIds: nextBrokers };
    });
  }

  async function saveQueue() {
    setSaving(true);
    const finalAllowedBrokerIds = form.brokerScopeMode === "selected" ? form.allowedBrokerIds : [];
    const result = await saveDistributionQueueAction({
      id: editingId ?? undefined,
      branchId: form.branchId || null,
      exclusiveDutyScheduleId: form.exclusiveDutyScheduleId || null,
      allowedBranchIds: form.allowedBranchIds,
      allowedBrokerIds: finalAllowedBrokerIds,
      name: form.name,
      assignmentMode: form.assignmentMode,
      assignmentStrategy: form.assignmentStrategy,
      capacityEnabled: form.capacityEnabled,
      capacityPerBroker: form.capacityEnabled ? Number(form.capacityPerBroker) : null,
      aiQualificationEnabled: form.aiQualificationEnabled,
      status: form.status,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error ?? "Não foi possível salvar a fila.");
    toast.success(result.message);
    setEditorOpen(false);
  }

  async function toggleCampaignForQueue(campaignId: string, queueId: string, enabled: boolean) {
    setSavingCampaignRoute(true);
    const result = await saveMetaCampaignQueueRouteAction({ campaignId, queueId: enabled ? queueId : null, enabled });
    setSavingCampaignRoute(false);
    if (!result.success) return toast.error(result.error ?? "Não foi possível atualizar a campanha.");
    toast.success(result.message ?? (enabled ? "Campanha vinculada à fila." : "Vínculo de campanha removido."));
  }

  async function runSimulation() {
    setSimulating(true);
    const result = await simulateDistributionAction({ branchId: simulationForm.branchId || undefined, queueId: simulationForm.queueId || undefined, temperature: simulationForm.temperature, score: Number(simulationForm.score) });
    setSimulating(false);
    setSimulation(result);
    if (!result.success) toast.error(result.error ?? "Não foi possível simular.");
  }

  async function saveCampaignRoute(enabled: boolean) {
    setSavingCampaignRoute(true);
    const result = await saveMetaCampaignQueueRouteAction({ campaignId: campaignRoute.campaignId, queueId: enabled ? campaignRoute.queueId : null, enabled });
    setSavingCampaignRoute(false);
    if (!result.success) return toast.error(result.error ?? "Não foi possível atualizar a campanha.");
    toast.success(result.message ?? (enabled ? "Campanha vinculada à fila." : "Campanha ignorada pelo CRM."));
  }

  async function saveAdRoute(enabled: boolean) {
    setSavingAdRoute(true);
    const result = await saveMetaAdQueueRouteAction({ adId: adRoute.adId, queueId: enabled ? adRoute.queueId : null, enabled });
    setSavingAdRoute(false);
    if (!result.success) return toast.error(result.error ?? "Não foi possível atualizar o anúncio.");
    toast.success(result.message ?? (enabled ? "Anúncio vinculado à fila." : "Anúncio ignorado pelo CRM."));
  }

  return (
    <>
      <section aria-labelledby="queues-title" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="queues-title" className="text-base font-semibold">Filas de distribuição</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada fila decide como a corretora ou unidade recebe, prioriza e distribui novos leads.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSimulation(null); setSimulatorOpen(true); }}>
              <MagicWand />Simular distribuição
            </Button>
            {canEdit ? <Button size="sm" onClick={openCreate}><Plus />Criar fila</Button> : null}
          </div>
        </div>

        {!queues.length ? (
          <Card variant="overview">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <UserList className="size-5" />
              </span>
              <p className="text-sm font-medium">Nenhuma fila configurada</p>
              <p className="max-w-sm text-xs text-muted-foreground">Crie a primeira fila para tornar a distribuição previsível na operação.</p>
              {canEdit ? <Button size="sm" onClick={openCreate}><Plus />Criar fila</Button> : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queues.map((queue) => {
              const multiBranchCount = (queue.allowedBranchIds?.length ?? 0) + (queue.branchId ? 1 : 0);
              const hasSpecificBrokers = (queue.allowedBrokerIds?.length ?? 0) > 0;
              const dutyScheduleName = dutySchedules.find((ds) => ds.id === queue.exclusiveDutyScheduleId)?.name;
              const queueCampaignRoutes = campaignRoutes.filter((r) => r.queueId === queue.id && r.enabled);
              const queueCampaigns = campaigns.filter((c) => queueCampaignRoutes.some((r) => r.campaignId === c.campaignId));

              return (
                <Card key={queue.id} variant="compact" className="group transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-primary/30 motion-reduce:transition-none">
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
                          {queue.exclusiveDutyScheduleId && (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                              ⚡ Plantão: {dutyScheduleName || "Exclusivo"}
                            </Badge>
                          )}
                          {queue.aiQualificationEnabled !== false ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
                              <MagicWand className="size-3" /> Bot IA Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
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
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Metric icon={Clock} label="Aguardando" value={queue.waiting} />
                      <Metric icon={UserList} label="Elegíveis" value={queue.members} />
                      <Metric icon={ChartBar} label="Ativos" value={queue.activeLeads} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{queue.assignmentMode === "automatic" ? "Automática" : "Manual"} · {queue.assignmentStrategy === "round_robin" ? "Round robin" : "Menor carga"}</span>
                      {hasSpecificBrokers ? (
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {queue.allowedBrokerIds!.length} corretor(es) específico(s)
                        </Badge>
                      ) : (
                        <span>{queue.capacityEnabled ? `${queue.capacityPerBroker}/corretor` : "Sem limite"}</span>
                      )}
                    </div>

                    {/* Campanhas vinculadas à fila diretamente no card */}
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span className="flex items-center gap-1.5">
                          🎯 Campanhas enviando para esta fila ({queueCampaigns.length})
                        </span>
                      </div>
                      {displayedCampaigns.length > 0 ? (
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {displayedCampaigns.map((campaign) => {
                            const route = campaignRoutes.find((r) => r.campaignId === campaign.campaignId);
                            const isChecked = route?.queueId === queue.id && route.enabled;
                            const isOtherQueue = route?.queueId && route.queueId !== queue.id && route.enabled;
                            return (
                              <label key={campaign.campaignId} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-background/80 p-1 rounded">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked ?? false}
                                    disabled={!canEdit || savingCampaignRoute}
                                    onChange={(e) => void toggleCampaignForQueue(campaign.campaignId, queue.id, e.target.checked)}
                                    className="rounded border-input text-primary focus:ring-primary shrink-0"
                                  />
                                  <span className="truncate text-[11px] font-medium">{campaign.name}</span>
                                </span>
                                {isOtherQueue && (
                                  <span className="text-[9px] text-muted-foreground shrink-0 truncate max-w-[90px]">
                                    (Em: {route.queueName})
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">Nenhuma campanha Meta cadastrada.</p>
                      )}
                    </div>

                    {canEdit ? (
                      <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleDeleteQueue(queue)}
                          disabled={deletingId === queue.id}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                        >
                          <Trash className="size-3.5" />
                          {deletingId === queue.id ? "Excluindo…" : "Excluir"}
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => openEdit(queue)}>
                          <SlidersHorizontal />Editar
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

      {/* Meta Campaign Route Card */}
      <Card variant="compact" className="border-primary/20 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Entrada por campanha Meta</span>
                <InfoTooltip title="Regra de entrada por campanha" description="Define para qual fila cada campanha envia os leads (Fila Geral, Unidade ou Corretor específico). Opcionalmente é possível ignorar uma campanha." />
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-normal">
                  {activeCampaigns.length} ativa(s)
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Escolha a campanha e selecione a fila de destino desejada. Campanhas sem regra explicita usam a Fila Geral.
              </CardDescription>
            </div>
            {campaigns.length > activeCampaigns.length && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowOnlyActiveCampaigns((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {showOnlyActiveCampaigns ? `Mostrar todas (${campaigns.length})` : `Filtrar ativas (${activeCampaigns.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayedCampaigns.length && queues.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <AppSelect
                aria-label="Campanha Meta"
                value={campaignRoute.campaignId}
                onValueChange={(campaignId) => setCampaignRoute({ ...campaignRoute, campaignId })}
                options={displayedCampaigns.map((campaign) => {
                  const isActive = (campaign.status ?? "").toUpperCase() === "ACTIVE";
                  return {
                    value: campaign.campaignId,
                    label: `${isActive ? "🟢" : "⚪"} ${campaign.name} ${isActive ? "" : "· PAUSED"}`,
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
                      ? `🏢 ${queue.name} · ${queue.branchName}`
                      : `🌐 ${queue.name} (Fila geral)`,
                  }))}
              />
              <Button
                size="sm"
                onClick={() => void saveCampaignRoute(true)}
                disabled={!canEdit || savingCampaignRoute || !campaignRoute.campaignId || !campaignRoute.queueId}
                className="gap-1"
              >
                {savingCampaignRoute ? "Salvando…" : "Receber na fila"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveCampaignRoute(false)}
                disabled={!canEdit || savingCampaignRoute || !campaignRoute.campaignId}
                className="text-destructive hover:bg-destructive/10"
              >
                {savingCampaignRoute ? "Salvando…" : "Não registrar"}
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
              <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/20">
                {campaignRoutes.map((route) => {
                  const matched = campaigns.find((c) => c.campaignId === route.campaignId);
                  const isActive = (matched?.status ?? "").toUpperCase() === "ACTIVE";
                  return (
                    <div key={route.campaignId} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span className="font-medium truncate">{matched?.name ?? route.campaignId}</span>
                        {matched?.status && (
                          <Badge variant="outline" className="text-[10px] font-normal uppercase">
                            {matched.status}
                          </Badge>
                        )}
                      </div>
                      <Badge variant={route.enabled ? "success" : "outline"} className="text-xs font-medium">
                        {route.enabled ? `→ ${route.queueName ?? "Fila geral"}` : "🚫 Não registrar no CRM"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Meta Ad Route Card */}
      <Card variant="compact" className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Exceção por anúncio</span>
                <InfoTooltip title="Prioridade da regra" description="Se um anúncio tiver regra própria, ela prevalece sobre a regra da campanha. Use quando anúncios da mesma campanha precisam de filas diferentes." />
                <Badge variant="outline" className="text-xs font-normal">
                  {activeAds.length} ativo(s)
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Configure o nível mais específico quando precisar separar anúncios dentro da mesma campanha.
              </CardDescription>
            </div>
            {ads.length > activeAds.length && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowOnlyActiveAds((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {showOnlyActiveAds ? `Mostrar todos (${ads.length})` : `Filtrar ativos (${activeAds.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayedAds.length && queues.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <AppSelect
                aria-label="Anúncio Meta"
                value={adRoute.adId}
                onValueChange={(adId) => setAdRoute({ ...adRoute, adId })}
                options={displayedAds.map((ad) => {
                  const isActive = (ad.status ?? "").toUpperCase() === "ACTIVE";
                  return {
                    value: ad.adId,
                    label: `${isActive ? "🟢" : "⚪"} ${ad.name} ${isActive ? "" : "· PAUSED"}`,
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
                      ? `🏢 ${queue.name} · ${queue.branchName}`
                      : `🌐 ${queue.name} (Fila geral)`,
                  }))}
              />
              <Button
                size="sm"
                onClick={() => void saveAdRoute(true)}
                disabled={!canEdit || savingAdRoute || !adRoute.adId || !adRoute.queueId}
              >
                {savingAdRoute ? "Salvando…" : "Receber na fila"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveAdRoute(false)}
                disabled={!canEdit || savingAdRoute || !adRoute.adId}
                className="text-destructive hover:bg-destructive/10"
              >
                {savingAdRoute ? "Salvando…" : "Não registrar"}
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
              <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/20">
                {adRoutes.map((route) => {
                  const matched = ads.find((a) => a.adId === route.adId);
                  const isActive = (matched?.status ?? "").toUpperCase() === "ACTIVE";
                  return (
                    <div key={route.adId} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span className="font-medium truncate">{matched?.name ?? route.adId}</span>
                        {matched?.status && (
                          <Badge variant="outline" className="text-[10px] font-normal uppercase">
                            {matched.status}
                          </Badge>
                        )}
                      </div>
                      <Badge variant={route.enabled ? "success" : "outline"} className="text-xs font-medium">
                        {route.enabled ? `→ ${route.queueName ?? "Fila geral"}` : "🚫 Não registrar no CRM"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Editor Modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogPopup className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar fila" : "Criar fila"}</DialogTitle>
              <DialogDescription>As mudanças afetam os próximos leads distribuídos. Leads já atribuídos mantêm seu histórico.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Nome da fila
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Leads Quentes, Plantão Central" />
              </label>

              {/* Unidade Principal */}
              <label className="grid gap-1.5 text-sm font-medium">
                Unidade principal (opcional)
                <AppSelect
                  aria-label="Unidade principal da fila"
                  value={form.branchId}
                  onValueChange={(branchId) => setForm({ ...form, branchId })}
                  options={[
                    { value: "", label: "Todas as Unidades (Geral / Sem Unidade Específica)" },
                    ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                  ]}
                />
              </label>

              {/* Exclusividade de Plantão */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Lightning className="size-4 text-emerald-500" /> Exclusividade de Plantão Agendado ou Ativo
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Se selecinoado, os leads direcionados a esta fila serão entregues exclusivamente aos corretores em escala ou ativos neste plantão.
                </p>
                <AppSelect
                  aria-label="Exclusividade de Plantão"
                  value={form.exclusiveDutyScheduleId}
                  onValueChange={(exclusiveDutyScheduleId) => setForm({ ...form, exclusiveDutyScheduleId })}
                  options={[
                    { value: "", label: "Nenhum (Fila convencional / Atendimento padrão)" },
                    ...dutySchedules.map((ds) => ({
                      value: ds.id,
                      label: `Plantão: ${ds.name} (${ds.startsAt} às ${ds.endsAt}${ds.branchName ? ` · ${ds.branchName}` : ""})`,
                    })),
                  ]}
                />
              </div>

              {/* Multi-Unidades Adicionais */}
              {branches.length > 1 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Buildings className="size-4 text-primary" /> Unidades adicionais atendidas por esta fila
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Marque outras unidades que também poderão enviar ou compartilhar corretores para esta fila.
                  </p>
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    {branches
                      .filter((b) => b.id !== form.branchId)
                      .map((branch) => {
                        const isChecked = form.allowedBranchIds.includes(branch.id);
                        return (
                          <label key={branch.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleAllowedBranch(branch.id)}
                              className="rounded border-input text-primary focus:ring-primary"
                            />
                            <span>{branch.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Escopo e Seleção de Corretores */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <UserList className="size-4 text-primary" /> Corretores participantes da fila
                  </p>
                  <AppSelect
                    aria-label="Escopo de corretores"
                    size="sm"
                    value={form.brokerScopeMode}
                    onValueChange={(val) => setForm({ ...form, brokerScopeMode: val as "all" | "selected" })}
                    options={[
                      { value: "all", label: "Todos os corretores elegíveis da(s) unidade(s)" },
                      { value: "selected", label: "Selecionar corretores específicos" },
                    ]}
                  />
                </div>

                {form.brokerScopeMode === "selected" ? (
                  <div className="space-y-2 border-t border-border/60 pt-2">
                    <p className="text-[11px] text-muted-foreground">
                      Selecione apenas os corretores que receberão leads desta fila:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {availableBrokersForForm.length ? (
                        availableBrokersForForm.map((broker) => {
                          const isChecked = form.allowedBrokerIds.includes(broker.id);
                          return (
                            <label key={broker.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-1.5 text-xs font-medium border border-border/50 hover:bg-accent/40 cursor-pointer">
                              <span className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAllowedBroker(broker.id)}
                                  className="rounded border-input text-primary focus:ring-primary"
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
                    Todos os corretores ativos e disponíveis na(s) unidade(s) selecionada(s) participarão da rodada.
                  </p>
                )}
              </div>

              {/* Modo e Estratégia */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Modo
                  <select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={form.assignmentMode} onChange={(event) => setForm({ ...form, assignmentMode: event.target.value })}>
                    <option value="automatic">Automática</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Estratégia
                  <select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={form.assignmentStrategy} onChange={(event) => setForm({ ...form, assignmentStrategy: event.target.value })}>
                    <option value="capacity">Menor carga</option>
                    <option value="round_robin">Round robin</option>
                  </select>
                </label>
              </div>

              {/* Qualificação por Bot de IA */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <label className="flex items-center justify-between text-sm font-semibold text-foreground cursor-pointer">
                  <span className="flex items-center gap-2">
                    <MagicWand className="size-4 text-primary" /> Ativar Qualificação por Bot de IA
                  </span>
                  <input
                    type="checkbox"
                    checked={form.aiQualificationEnabled}
                    onChange={(event) => setForm({ ...form, aiQualificationEnabled: event.target.checked })}
                    className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Quando ativada, o Bot de IA do WhatsApp qualifica automaticamente os leads direcionados a esta fila.
                </p>
              </div>

              {/* Campanhas Meta vinculadas a esta fila */}
              {campaigns.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    🎯 Campanhas Meta que enviam leads para esta fila
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Marque as campanhas que direcionarão leads automaticamente para esta fila:
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1 pr-1">
                    {displayedCampaigns.map((c) => {
                      const route = campaignRoutes.find((r) => r.campaignId === c.campaignId);
                      const isAssignedToThisQueue = route?.queueId === editingId && route.enabled;
                      const isAssignedToOtherQueue = route?.queueId && route.queueId !== editingId && route.enabled;
                      return (
                        <label
                          key={c.campaignId}
                          className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-1.5 text-xs font-medium border border-border/50 hover:bg-accent/40 cursor-pointer"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isAssignedToThisQueue ?? false}
                              disabled={!editingId || savingCampaignRoute}
                              onChange={(e) => {
                                if (editingId) {
                                  void toggleCampaignForQueue(c.campaignId, editingId, e.target.checked);
                                }
                              }}
                              className="rounded border-input text-primary focus:ring-primary shrink-0"
                            />
                            <span className="truncate">{c.name}</span>
                          </span>
                          {isAssignedToOtherQueue && (
                            <Badge variant="outline" className="text-[9px] shrink-0 text-muted-foreground">
                              Em: {route?.queueName}
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {!editingId && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Você poderá selecionar as campanhas assim que salvar a criação da fila.
                    </p>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.capacityEnabled} onChange={(event) => setForm({ ...form, capacityEnabled: event.target.checked })} />
                Limitar leads ativos por corretor <InfoTooltip title="Capacidade" description="Quando o limite é atingido, o corretor deixa de ser elegível para novos leads dessa fila." />
              </label>

              {form.capacityEnabled ? (
                <label className="grid gap-1.5 text-sm font-medium">
                  Máximo por corretor
                  <Input type="number" min={1} max={200} value={form.capacityPerBroker} onChange={(event) => setForm({ ...form, capacityPerBroker: event.target.value })} />
                </label>
              ) : null}

              <label className="grid gap-1.5 text-sm font-medium">
                Estado
                <select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Ativa</option>
                  <option value="inactive">Pausada</option>
                </select>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={saveQueue} disabled={saving || !form.name.trim()}>
                {saving ? "Salvando…" : "Salvar fila"}
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* Simulator Modal */}
      <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}>
        <DialogPopup className="max-w-2xl">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Simular distribuição</DialogTitle>
              <DialogDescription>Veja a decisão provável antes de alterar uma regra. A simulação não cria eventos nem altera a fila.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <AppSelect aria-label="Unidade da simulação" value={simulationForm.branchId} onValueChange={(branchId) => setSimulationForm({ ...simulationForm, branchId, queueId: "" })} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                <AppSelect aria-label="Fila da simulação" value={simulationForm.queueId} onValueChange={(queueId) => setSimulationForm({ ...simulationForm, queueId })} options={[{ value: "", label: "Fila padrão da unidade" }, ...branchQueues.map((queue) => ({ value: queue.id, label: queue.name }))]} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Temperatura
                  <select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={simulationForm.temperature} onChange={(event) => setSimulationForm({ ...simulationForm, temperature: event.target.value })}>
                    <option value="hot">Quente</option>
                    <option value="warm">Morno</option>
                    <option value="cold">Frio</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Score
                  <Input type="number" min={0} max={100} value={simulationForm.score} onChange={(event) => setSimulationForm({ ...simulationForm, score: event.target.value })} />
                </label>
              </div>

              <Button className="w-fit" onClick={runSimulation} disabled={simulating || !simulationForm.branchId}>
                {simulating ? "Calculando…" : "Executar simulação"}
              </Button>

              {simulation?.success ? (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-success" />
                    <p className="text-sm font-semibold">{simulation.queue?.name ?? "Sem fila resolvida"}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{simulation.reason}</p>
                  {simulation.selected ? (
                    <p className="mt-3 text-sm">
                      Destino provável: <strong>{simulation.selected.name}</strong> · {simulation.selected.activeLeads} leads ativos{simulation.selected.capacity ? ` de ${simulation.selected.capacity}` : ""}
                    </p>
                  ) : null}
                  {simulation.eligible?.length ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-3">
                      {simulation.eligible.map((broker) => (
                        <div key={broker.id} className="flex items-center justify-between text-xs">
                          <span>{broker.name}</span>
                          <span className="font-mono text-muted-foreground">{broker.activeLeads}{broker.capacity ? `/${broker.capacity}` : ""} · score {broker.score}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSimulatorOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}

function Metric({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2">
      <Icon className="mx-auto size-3.5 text-muted-foreground" />
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
