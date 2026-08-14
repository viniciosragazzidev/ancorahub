"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ChartBar, CheckCircle, Clock, MagicWand, Plus, SlidersHorizontal, Trash, UserList, Buildings } from "@/components/huge-icons";
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
  branchId: string;
  branchName: string;
  status: string;
  assignmentMode: string;
  assignmentStrategy: string;
  capacityEnabled: boolean;
  capacityPerBroker: number | null;
  waiting: number;
  members: number;
  activeLeads: number;
  allowedBranchIds?: string[];
  allowedBrokerIds?: string[];
};

type Branch = { id: string; name: string };
type Broker = { id: string; name: string; branchId?: string | null; branchName?: string | null };
type Campaign = { campaignId: string; name: string; status: string };
type CampaignRoute = { campaignId: string; queueId: string | null; queueName: string | null; enabled: boolean };
type Ad = { adId: string; name: string; status: string };
type AdRoute = { adId: string; queueId: string | null; queueName: string | null; enabled: boolean };
type Simulation = { success: boolean; error?: string; queue?: { id: string; name: string } | null; reason?: string; selected?: { id: string; name: string; activeLeads: number; capacity: number | null } | null; eligible?: Array<{ id: string; name: string; activeLeads: number; capacity: number | null; score: number }> };

const emptyQueue = {
  branchId: "",
  allowedBranchIds: [] as string[],
  brokerScopeMode: "all" as "all" | "selected",
  allowedBrokerIds: [] as string[],
  name: "",
  assignmentMode: "automatic",
  assignmentStrategy: "capacity",
  capacityEnabled: false,
  capacityPerBroker: "10",
  status: "active",
};

export function QueueControlCenter({
  queues,
  branches,
  brokers = [],
  campaigns,
  ads,
  campaignRoutes,
  adRoutes,
  canEdit,
}: {
  queues: Queue[];
  branches: Branch[];
  brokers?: Broker[];
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

  async function handleDeleteQueue(queue: Queue) {
    if (!confirm(`Tem certeza que deseja excluir a fila "${queue.name}"?`)) return;
    setDeletingId(queue.id);
    const result = await deleteDistributionQueueAction(queue.id);
    setDeletingId(null);
    if (!result.success) return toast.error(result.error ?? "Não foi possível excluir a fila.");
    toast.success(result.message);
  }

  const branchQueues = useMemo(
    () => queues.filter((queue) => queue.branchId === simulationForm.branchId && queue.status === "active"),
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
      branchId: branches[0]?.id ?? "",
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
      branchId: queue.branchId,
      allowedBranchIds: queue.allowedBranchIds ?? [],
      brokerScopeMode: hasSpecificBrokers ? "selected" : "all",
      allowedBrokerIds: queue.allowedBrokerIds ?? [],
      name: queue.name,
      assignmentMode: queue.assignmentMode,
      assignmentStrategy: queue.assignmentStrategy,
      capacityEnabled: queue.capacityEnabled,
      capacityPerBroker: String(queue.capacityPerBroker ?? 10),
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
      branchId: form.branchId,
      allowedBranchIds: form.allowedBranchIds,
      allowedBrokerIds: finalAllowedBrokerIds,
      name: form.name,
      assignmentMode: form.assignmentMode,
      assignmentStrategy: form.assignmentStrategy,
      capacityEnabled: form.capacityEnabled,
      capacityPerBroker: form.capacityEnabled ? Number(form.capacityPerBroker) : null,
      status: form.status,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error ?? "Não foi possível salvar a fila.");
    toast.success(result.message);
    setEditorOpen(false);
  }

  async function runSimulation() {
    setSimulating(true);
    const result = await simulateDistributionAction({ branchId: simulationForm.branchId, queueId: simulationForm.queueId || undefined, temperature: simulationForm.temperature, score: Number(simulationForm.score) });
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
            <p className="mt-1 text-sm text-muted-foreground">Cada fila decide como a unidade recebe, prioriza e distribui novos leads.</p>
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
              <p className="max-w-sm text-xs text-muted-foreground">Crie a primeira fila para tornar a distribuição previsível nesta unidade.</p>
              {canEdit ? <Button size="sm" onClick={openCreate}><Plus />Criar fila</Button> : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queues.map((queue) => {
              const multiBranchCount = (queue.allowedBranchIds?.length ?? 0) + 1;
              const hasSpecificBrokers = (queue.allowedBrokerIds?.length ?? 0) > 0;

              return (
                <Card key={queue.id} variant="compact" className="group transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-primary/30 motion-reduce:transition-none">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{queue.name}</CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span>{queue.branchName}</span>
                          {multiBranchCount > 1 && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              +{multiBranchCount - 1} unidade(s)
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
      <Card variant="compact" className="border-primary/15 bg-primary/[0.025]">
        <CardHeader>
          <CardTitle className="text-base">
            Entrada por campanha Meta <InfoTooltip title="Regra de entrada" description="Uma campanha pode entrar na fila escolhida ou ser ignorada pelo CRM. Depois da entrada, a fila decide capacidade, escala e corretor." />
          </CardTitle>
          <CardDescription>Escolha somente as campanhas que devem gerar lead e a fila ativa de cada uma. Campanhas sem regra usam o fluxo geral da Página.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.length && queues.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <AppSelect aria-label="Campanha Meta" value={campaignRoute.campaignId} onValueChange={(campaignId) => setCampaignRoute({ ...campaignRoute, campaignId })} options={campaigns.map((campaign) => ({ value: campaign.campaignId, label: `${campaign.name} · ${campaign.status}` }))} />
              <AppSelect aria-label="Fila de destino da campanha" value={campaignRoute.queueId} onValueChange={(queueId) => setCampaignRoute({ ...campaignRoute, queueId })} options={queues.filter((queue) => queue.status === "active").map((queue) => ({ value: queue.id, label: `${queue.name} · ${queue.branchName}` }))} />
              <Button size="sm" onClick={() => void saveCampaignRoute(true)} disabled={!canEdit || savingCampaignRoute || !campaignRoute.campaignId || !campaignRoute.queueId}>
                {savingCampaignRoute ? "Salvando…" : "Receber na fila"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void saveCampaignRoute(false)} disabled={!canEdit || savingCampaignRoute || !campaignRoute.campaignId}>
                {savingCampaignRoute ? "Salvando…" : "Não registrar"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sincronize ao menos uma campanha Meta e crie uma fila ativa para configurar essa regra.</p>
          )}
          {campaignRoutes.length ? (
            <div className="space-y-2 border-t border-border/60 pt-3">
              {campaignRoutes.map((route) => (
                <div key={route.campaignId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{campaigns.find((campaign) => campaign.campaignId === route.campaignId)?.name ?? route.campaignId}</span>
                  <Badge variant={route.enabled ? "success" : "outline"}>
                    {route.enabled ? `→ ${route.queueName ?? "Fila geral"}` : "Não registrar no CRM"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Meta Ad Route Card */}
      <Card variant="compact">
        <CardHeader>
          <CardTitle className="text-base">
            Exceção por anúncio <InfoTooltip title="Prioridade da regra" description="Se um anúncio tiver regra própria, ela prevalece sobre a regra da campanha. Use quando anúncios da mesma campanha precisam de filas diferentes." />
          </CardTitle>
          <CardDescription>Configure o nível mais específico quando precisar separar anúncios dentro da mesma campanha.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ads.length && queues.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <AppSelect aria-label="Anúncio Meta" value={adRoute.adId} onValueChange={(adId) => setAdRoute({ ...adRoute, adId })} options={ads.map((ad) => ({ value: ad.adId, label: `${ad.name} · ${ad.status}` }))} />
              <AppSelect aria-label="Fila de destino do anúncio" value={adRoute.queueId} onValueChange={(queueId) => setAdRoute({ ...adRoute, queueId })} options={queues.filter((queue) => queue.status === "active").map((queue) => ({ value: queue.id, label: `${queue.name} · ${queue.branchName}` }))} />
              <Button size="sm" onClick={() => void saveAdRoute(true)} disabled={!canEdit || savingAdRoute || !adRoute.adId || !adRoute.queueId}>
                {savingAdRoute ? "Salvando…" : "Receber na fila"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void saveAdRoute(false)} disabled={!canEdit || savingAdRoute || !adRoute.adId}>
                {savingAdRoute ? "Salvando…" : "Não registrar"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Os anúncios aparecem depois da sincronização completa da conta de anúncios.</p>
          )}
          {adRoutes.length ? (
            <div className="space-y-2 border-t border-border/60 pt-3">
              {adRoutes.map((route) => (
                <div key={route.adId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{ads.find((ad) => ad.adId === route.adId)?.name ?? route.adId}</span>
                  <Badge variant={route.enabled ? "success" : "outline"}>
                    {route.enabled ? `→ ${route.queueName ?? "Fila geral"}` : "Não registrar no CRM"}
                  </Badge>
                </div>
              ))}
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
                Unidade principal (Proprietária)
                <AppSelect
                  aria-label="Unidade principal da fila"
                  value={form.branchId}
                  onValueChange={(branchId) => setForm({ ...form, branchId })}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </label>

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
              <Button onClick={saveQueue} disabled={saving || !form.name.trim() || !form.branchId}>
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
