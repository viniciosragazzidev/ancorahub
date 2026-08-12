"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ChartBar, CheckCircle, Clock, MagicWand, Plus, SlidersHorizontal, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { saveDistributionQueueAction, saveMetaCampaignQueueRouteAction, simulateDistributionAction } from "@/features/lead-distribution/actions";
import { toast } from "sonner";

type Queue = { id: string; name: string; branchId: string; branchName: string; status: string; assignmentMode: string; assignmentStrategy: string; capacityEnabled: boolean; capacityPerBroker: number | null; waiting: number; members: number; activeLeads: number };
type Branch = { id: string; name: string };
type Campaign = { campaignId: string; name: string; status: string };
type CampaignRoute = { campaignId: string; queueId: string; queueName: string; enabled: boolean };
type Simulation = { success: boolean; error?: string; queue?: { id: string; name: string } | null; reason?: string; selected?: { id: string; name: string; activeLeads: number; capacity: number | null } | null; eligible?: Array<{ id: string; name: string; activeLeads: number; capacity: number | null; score: number }> };

const emptyQueue = { branchId: "", name: "", assignmentMode: "automatic", assignmentStrategy: "capacity", capacityEnabled: false, capacityPerBroker: "10", status: "active" };

export function QueueControlCenter({ queues, branches, campaigns, campaignRoutes, canEdit }: { queues: Queue[]; branches: Branch[]; campaigns: Campaign[]; campaignRoutes: CampaignRoute[]; canEdit: boolean }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyQueue);
  const [saving, setSaving] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationForm, setSimulationForm] = useState({ branchId: branches[0]?.id ?? "", queueId: "", temperature: "warm", score: "50" });
  const [campaignRoute, setCampaignRoute] = useState({ campaignId: campaigns[0]?.campaignId ?? "", queueId: queues[0]?.id ?? "" });
  const [savingCampaignRoute, setSavingCampaignRoute] = useState(false);

  const branchQueues = useMemo(() => queues.filter((queue) => queue.branchId === simulationForm.branchId && queue.status === "active"), [queues, simulationForm.branchId]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyQueue, branchId: branches[0]?.id ?? "" });
    setEditorOpen(true);
  }

  function openEdit(queue: Queue) {
    setEditingId(queue.id);
    setForm({ branchId: queue.branchId, name: queue.name, assignmentMode: queue.assignmentMode, assignmentStrategy: queue.assignmentStrategy, capacityEnabled: queue.capacityEnabled, capacityPerBroker: String(queue.capacityPerBroker ?? 10), status: queue.status });
    setEditorOpen(true);
  }

  async function saveQueue() {
    setSaving(true);
    const result = await saveDistributionQueueAction({ id: editingId ?? undefined, branchId: form.branchId, name: form.name, assignmentMode: form.assignmentMode, assignmentStrategy: form.assignmentStrategy, capacityEnabled: form.capacityEnabled, capacityPerBroker: form.capacityEnabled ? Number(form.capacityPerBroker) : null, status: form.status });
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

  async function saveCampaignRoute() {
    setSavingCampaignRoute(true);
    const result = await saveMetaCampaignQueueRouteAction({ ...campaignRoute, enabled: true });
    setSavingCampaignRoute(false);
    if (!result.success) return toast.error(result.error ?? "Não foi possível vincular a campanha.");
    toast.success(result.message ?? "Campanha vinculada Ã  fila.");
  }

  return <>
    <section aria-labelledby="queues-title" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="queues-title" className="text-base font-semibold">Filas de distribuição</h2><p className="mt-1 text-sm text-muted-foreground">Cada fila decide como a unidade recebe e prioriza novos leads.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSimulation(null); setSimulatorOpen(true); }}><MagicWand />Simular distribuição</Button>
          {canEdit ? <Button size="sm" onClick={openCreate}><Plus />Criar fila</Button> : null}
        </div>
      </div>
      {!queues.length ? <Card variant="overview"><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground"><UserList className="size-5" /></span><p className="text-sm font-medium">Nenhuma fila configurada</p><p className="max-w-sm text-xs text-muted-foreground">Crie a primeira fila para tornar a distribuição previsível nesta unidade.</p>{canEdit ? <Button size="sm" onClick={openCreate}><Plus />Criar fila</Button> : null}</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{queues.map((queue) => <Card key={queue.id} variant="compact" className="group transition-[border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-primary/30 motion-reduce:transition-none"><CardHeader className="gap-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{queue.name}</CardTitle><CardDescription className="mt-1">{queue.branchName}</CardDescription></div><Badge variant={queue.status === "active" ? "success" : "outline"}>{queue.status === "active" ? "Ativa" : "Pausada"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-3 gap-2 text-center"><Metric icon={Clock} label="Aguardando" value={queue.waiting} /><Metric icon={UserList} label="Elegíveis" value={queue.members} /><Metric icon={ChartBar} label="Ativos" value={queue.activeLeads} /></div><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{queue.assignmentMode === "automatic" ? "Automática" : "Manual"} · {queue.assignmentStrategy === "round_robin" ? "Round robin" : "Menor carga"}</span>{queue.capacityEnabled ? <span>{queue.capacityPerBroker}/corretor</span> : <span>Sem limite</span>}</div>{canEdit ? <div className="flex justify-end border-t border-border/60 pt-3"><Button size="xs" variant="outline" onClick={() => openEdit(queue)}><SlidersHorizontal />Editar</Button></div> : null}</CardContent></Card>)}</div>}
    </section>

    <Card variant="compact" className="border-primary/15 bg-primary/[0.025]"><CardHeader><CardTitle className="text-base">Entrada por campanha Meta <InfoTooltip title="Regra de entrada" description="Quando a Meta enviar um lead desta campanha, ele entra nesta fila antes da regra geral da Página. A fila continua aplicando capacidade, escala e ranking." /></CardTitle><CardDescription>Associe uma campanha já sincronizada a uma fila. A configuração é isolada por empresa.</CardDescription></CardHeader><CardContent className="space-y-4">{campaigns.length && queues.length ? <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><AppSelect aria-label="Campanha Meta" value={campaignRoute.campaignId} onValueChange={(campaignId) => setCampaignRoute({ ...campaignRoute, campaignId })} options={campaigns.map((campaign) => ({ value: campaign.campaignId, label: `${campaign.name} · ${campaign.status}` }))} /><AppSelect aria-label="Fila de destino da campanha" value={campaignRoute.queueId} onValueChange={(queueId) => setCampaignRoute({ ...campaignRoute, queueId })} options={queues.filter((queue) => queue.status === "active").map((queue) => ({ value: queue.id, label: `${queue.name} · ${queue.branchName}` }))} /><Button size="sm" onClick={saveCampaignRoute} disabled={!canEdit || savingCampaignRoute || !campaignRoute.campaignId || !campaignRoute.queueId}>{savingCampaignRoute ? "Salvando…" : "Vincular"}</Button></div> : <p className="text-sm text-muted-foreground">Sincronize ao menos uma campanha Meta e crie uma fila ativa para configurar essa regra.</p>}{campaignRoutes.length ? <div className="space-y-2 border-t border-border/60 pt-3">{campaignRoutes.map((route) => <div key={route.campaignId} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{campaigns.find((campaign) => campaign.campaignId === route.campaignId)?.name ?? route.campaignId}</span><Badge variant={route.enabled ? "success" : "outline"}>→ {route.queueName}</Badge></div>)}</div> : null}</CardContent></Card>

    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogPopup><DialogPanel><DialogHeader><DialogTitle>{editingId ? "Editar fila" : "Criar fila"}</DialogTitle><DialogDescription>As mudanças afetam os próximos leads distribuídos. Leads já atribuídos mantêm seu histórico.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-1.5 text-sm font-medium">Nome<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Leads quentes" /></label><AppSelect aria-label="Unidade da fila" value={form.branchId} onValueChange={(branchId) => setForm({ ...form, branchId })} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} /><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Modo<select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={form.assignmentMode} onChange={(event) => setForm({ ...form, assignmentMode: event.target.value })}><option value="automatic">Automática</option><option value="manual">Manual</option></select></label><label className="grid gap-1.5 text-sm font-medium">Estratégia<select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={form.assignmentStrategy} onChange={(event) => setForm({ ...form, assignmentStrategy: event.target.value })}><option value="capacity">Menor carga</option><option value="round_robin">Round robin</option></select></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.capacityEnabled} onChange={(event) => setForm({ ...form, capacityEnabled: event.target.checked })} />Limitar leads ativos por corretor <InfoTooltip title="Capacidade" description="Quando o limite é atingido, o corretor deixa de ser elegível para novos leads dessa fila." /></label>{form.capacityEnabled ? <label className="grid gap-1.5 text-sm font-medium">Máximo por corretor<Input type="number" min={1} max={200} value={form.capacityPerBroker} onChange={(event) => setForm({ ...form, capacityPerBroker: event.target.value })} /></label> : null}<label className="grid gap-1.5 text-sm font-medium">Estado<select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Ativa</option><option value="inactive">Pausada</option></select></label></div><DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button><Button onClick={saveQueue} disabled={saving || !form.name.trim() || !form.branchId}>{saving ? "Salvando…" : "Salvar fila"}</Button></DialogFooter></DialogPanel></DialogPopup></Dialog>

    <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}><DialogPopup className="max-w-2xl"><DialogPanel><DialogHeader><DialogTitle>Simular distribuição</DialogTitle><DialogDescription>Veja a decisão provável antes de alterar uma regra. A simulação não cria eventos nem altera a fila.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><AppSelect aria-label="Unidade da simulação" value={simulationForm.branchId} onValueChange={(branchId) => setSimulationForm({ ...simulationForm, branchId, queueId: "" })} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} /><AppSelect aria-label="Fila da simulação" value={simulationForm.queueId} onValueChange={(queueId) => setSimulationForm({ ...simulationForm, queueId })} options={[{ value: "", label: "Fila padrão da unidade" }, ...branchQueues.map((queue) => ({ value: queue.id, label: queue.name }))]} /></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Temperatura<select className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm" value={simulationForm.temperature} onChange={(event) => setSimulationForm({ ...simulationForm, temperature: event.target.value })}><option value="hot">Quente</option><option value="warm">Morno</option><option value="cold">Frio</option></select></label><label className="grid gap-1.5 text-sm font-medium">Score<Input type="number" min={0} max={100} value={simulationForm.score} onChange={(event) => setSimulationForm({ ...simulationForm, score: event.target.value })} /></label></div><Button className="w-fit" onClick={runSimulation} disabled={simulating || !simulationForm.branchId}>{simulating ? "Calculando…" : "Executar simulação"}</Button>{simulation?.success ? <div className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-2"><CheckCircle className="size-4 text-success" /><p className="text-sm font-semibold">{simulation.queue?.name ?? "Sem fila resolvida"}</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{simulation.reason}</p>{simulation.selected ? <p className="mt-3 text-sm">Destino provável: <strong>{simulation.selected.name}</strong> · {simulation.selected.activeLeads} leads ativos{simulation.selected.capacity ? ` de ${simulation.selected.capacity}` : ""}</p> : null}{simulation.eligible?.length ? <div className="mt-4 space-y-2 border-t border-border pt-3">{simulation.eligible.map((broker) => <div key={broker.id} className="flex items-center justify-between text-xs"><span>{broker.name}</span><span className="font-mono text-muted-foreground">{broker.activeLeads}{broker.capacity ? `/${broker.capacity}` : ""} · score {broker.score}</span></div>)}</div> : null}</div> : null}</div><DialogFooter><Button variant="outline" onClick={() => setSimulatorOpen(false)}>Fechar</Button></DialogFooter></DialogPanel></DialogPopup></Dialog>
  </>;
}

function Metric({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: number }) { return <div className="rounded-lg bg-muted/50 px-2 py-2"><Icon className="mx-auto size-3.5 text-muted-foreground" /><p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>; }
