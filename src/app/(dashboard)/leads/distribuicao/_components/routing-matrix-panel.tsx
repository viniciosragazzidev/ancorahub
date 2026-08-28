"use client";

import { useState } from "react";
import { Plus, ArrowUp, ArrowDown, Trash2, Edit3, ShieldAlert, CheckCircle2, Sliders, Zap, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogPopup, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  saveRoutingRuleAction,
  deleteRoutingRuleAction,
  reorderRoutingRulesAction,
  type RoutingRuleInput,
} from "@/features/lead-distribution/routing-actions";
import type { RoutingRule } from "@/features/lead-distribution/routing-engine";

type QueueItem = { id: string; name: string };
type BranchItem = { id: string; name: string };
type BrokerItem = { id: string; name: string };

const availablePlanTypes = [
  { id: "pme", label: "PME / Empresarial" },
  { id: "individual", label: "Individual / Pessoa Física" },
  { id: "familia", label: "Familiar" },
  { id: "adesao", label: "Adesão" },
  { id: "odonto", label: "Odontológico" },
];

const availableSources = [
  { id: "meta_ads", label: "Meta Ads (Facebook/Instagram)" },
  { id: "google_ads", label: "Google Ads" },
  { id: "whatsapp", label: "WhatsApp Direto" },
  { id: "indicacao", label: "Indicação" },
  { id: "site", label: "Site / Orgânico" },
];

const availableIAStatuses = [
  { id: "hot", label: "Lead Quente (Alta Intenção)" },
  { id: "warm", label: "Lead Morno (Em Qualificação)" },
  { id: "cold", label: "Lead Frio (Sem Resposta)" },
  { id: "handoff", label: "Encaminhado p/ Humano" },
];

export function RoutingMatrixPanel({
  rules: initialRules,
  queues,
  branches,
  brokers,
  canEdit = true,
}: {
  rules: RoutingRule[];
  queues: QueueItem[];
  branches: BranchItem[];
  brokers: BrokerItem[];
  canEdit?: boolean;
}) {
  const [rules, setRules] = useState<RoutingRule[]>(initialRules);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<"queue" | "branch" | "broker_group" | "specific_broker">("queue");
  const [targetId, setTargetId] = useState("");
  const [fallbackQueueId, setFallbackQueueId] = useState<string>("");
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [citiesText, setCitiesText] = useState("");
  const [minLives, setMinLives] = useState<string>("");
  const [maxLives, setMaxLives] = useState<string>("");
  const [selectedIAStatuses, setSelectedIAStatuses] = useState<string[]>([]);

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setName("");
    setTargetType("queue");
    setTargetId(queues[0]?.id ?? "");
    setFallbackQueueId("");
    setSelectedPlans([]);
    setSelectedSources([]);
    setCitiesText("");
    setMinLives("");
    setMaxLives("");
    setSelectedIAStatuses([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: RoutingRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTargetType(rule.targetType);
    setTargetId(rule.targetId);
    setFallbackQueueId(rule.fallbackQueueId ?? "");
    setSelectedPlans(rule.conditions.planTypes ?? []);
    setSelectedSources(rule.conditions.sources ?? []);
    setCitiesText((rule.conditions.cities ?? []).join(", "));
    setMinLives(rule.conditions.minLives ? String(rule.conditions.minLives) : "");
    setMaxLives(rule.conditions.maxLives ? String(rule.conditions.maxLives) : "");
    setSelectedIAStatuses(rule.conditions.qualificationStatuses ?? []);
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para a regra");
      return;
    }
    if (!targetId) {
      toast.error("Selecione o destino do lead");
      return;
    }

    setIsSaving(true);
    try {
      const cities = citiesText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const payload: RoutingRuleInput = {
        id: editingRule?.id,
        name: name.trim(),
        enabled: editingRule ? editingRule.enabled : true,
        targetType,
        targetId,
        fallbackQueueId: fallbackQueueId || null,
        planTypes: selectedPlans,
        sources: selectedSources,
        cities,
        minLives: minLives ? Number(minLives) : null,
        maxLives: maxLives ? Number(maxLives) : null,
        qualificationStatuses: selectedIAStatuses,
      };

      await saveRoutingRuleAction(payload);
      toast.success(editingRule ? "Regra atualizada com sucesso!" : "Regra criada com sucesso!");
      setIsModalOpen(false);

      // Optimistic update
      if (editingRule) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingRule.id
              ? {
                  ...r,
                  name: payload.name,
                  targetType: payload.targetType,
                  targetId: payload.targetId,
                  fallbackQueueId: payload.fallbackQueueId ?? null,
                  conditions: {
                    planTypes: selectedPlans,
                    sources: selectedSources,
                    cities,
                    minLives: payload.minLives ?? undefined,
                    maxLives: payload.maxLives ?? undefined,
                    qualificationStatuses: selectedIAStatuses,
                  },
                }
              : r,
          ),
        );
      } else {
        const newRule: RoutingRule = {
          id: `tmp-${Date.now()}`,
          tenantId: "",
          name: payload.name,
          priority: rules.length + 1,
          enabled: true,
          targetType: payload.targetType,
          targetId: payload.targetId,
          fallbackQueueId: payload.fallbackQueueId ?? null,
          conditions: {
            planTypes: selectedPlans,
            sources: selectedSources,
            cities,
            minLives: payload.minLives ?? undefined,
            maxLives: payload.maxLives ?? undefined,
            qualificationStatuses: selectedIAStatuses,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setRules((prev) => [...prev, newRule]);
      }
    } catch (err) {
      toast.error("Erro ao salvar regra de roteamento");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Deseja realmente excluir esta regra de roteamento?")) return;
    try {
      await deleteRoutingRuleAction(ruleId);
      toast.success("Regra removida");
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch {
      toast.error("Erro ao remover regra");
    }
  };

  const handleMoveRule = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const newRules = [...rules];
    const [moved] = newRules.splice(index, 1);
    newRules.splice(targetIndex, 0, moved);

    setRules(newRules);
    try {
      await reorderRoutingRulesAction(newRules.map((r) => r.id));
      toast.success("Prioridade das regras atualizada");
    } catch {
      toast.error("Erro ao reordenar regras");
    }
  };

  const toggleRuleEnabled = async (rule: RoutingRule) => {
    try {
      const nextEnabled = !rule.enabled;
      await saveRoutingRuleAction({
        id: rule.id,
        name: rule.name,
        enabled: nextEnabled,
        targetType: rule.targetType,
        targetId: rule.targetId,
        fallbackQueueId: rule.fallbackQueueId,
        planTypes: rule.conditions.planTypes ?? [],
        sources: rule.conditions.sources ?? [],
        cities: rule.conditions.cities ?? [],
        minLives: rule.conditions.minLives ?? null,
        maxLives: rule.conditions.maxLives ?? null,
        qualificationStatuses: rule.conditions.qualificationStatuses ?? [],
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextEnabled } : r)));
      toast.success(nextEnabled ? "Regra ativada!" : "Regra pausada!");
    } catch {
      toast.error("Erro ao alterar status da regra");
    }
  };

  const resolveTargetName = (type: string, id: string) => {
    if (type === "queue") return queues.find((q) => q.id === id)?.name ?? `Fila #${id}`;
    if (type === "branch") return branches.find((b) => b.id === id)?.name ?? `Filial #${id}`;
    if (type === "specific_broker") return brokers.find((b) => b.id === id)?.name ?? `Corretor #${id}`;
    if (type === "broker_group") return `Grupo de Corretores (#${id})`;
    return id;
  };

  const toggleArrayItem = (arr: string[], item: string, setter: (res: string[]) => void) => {
    if (arr.includes(item)) {
      setter(arr.filter((i) => i !== item));
    } else {
      setter([...arr, item]);
    }
  };

  return (
    <Card variant="overview" className="space-y-6 p-6">
      <CardHeader className="p-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sliders className="h-5 w-5 text-primary" />
              Matriz Inteligente de Roteamento de Leads
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Defina visualmente qual tipo de lead deve ir para cada fila, filial ou grupo de corretores em ordem de prioridade.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={handleOpenCreateModal} size="sm" className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Nova Regra de Roteamento
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {rules.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold">Nenhuma regra de roteamento configurada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Todos os novos leads seguirão o fluxo padrão da Fila Geral da Unidade. Crie a primeira regra para direcionar por Tipo de Plano, Origem ou Localidade.
            </p>
            {canEdit && (
              <Button onClick={handleOpenCreateModal} size="sm" variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Criar Primeira Regra
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule, idx) => {
              const cond = rule.conditions;
              const hasConditions =
                (cond.planTypes?.length ?? 0) > 0 ||
                (cond.sources?.length ?? 0) > 0 ||
                (cond.cities?.length ?? 0) > 0 ||
                typeof cond.minLives === "number" ||
                typeof cond.maxLives === "number" ||
                (cond.qualificationStatuses?.length ?? 0) > 0;

              return (
                <div
                  key={rule.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
                    rule.enabled ? "bg-card border-border/80" : "bg-muted/30 border-dashed opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        #{rule.priority}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm truncate">{rule.name}</h4>
                          <Badge variant={rule.enabled ? "success" : "outline"} className="text-[10px]">
                            {rule.enabled ? "Ativa" : "Pausada"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                          <span>Destino:</span>
                          <strong className="text-foreground">{resolveTargetName(rule.targetType, rule.targetId)}</strong>
                          {rule.fallbackQueueId && (
                            <span className="text-[11px] text-muted-foreground ml-1">
                              (Fallback: {queues.find((q) => q.id === rule.fallbackQueueId)?.name ?? "Fila Geral"})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleMoveRule(idx, "up")}
                          disabled={idx === 0}
                          title="Subir prioridade"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleMoveRule(idx, "down")}
                          disabled={idx === rules.length - 1}
                          title="Descer prioridade"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleOpenEditModal(rule)}
                          title="Editar regra"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => toggleRuleEnabled(rule)}
                          title={rule.enabled ? "Pausar regra" : "Ativar regra"}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 ${rule.enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-destructive hover:bg-destructive/10"
                          title="Excluir regra"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Conditions Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
                    <span className="text-[11px] text-muted-foreground mr-1">Condições:</span>
                    {!hasConditions ? (
                      <Badge variant="outline" className="text-[10px]">
                        Qualquer Lead (Global Match)
                      </Badge>
                    ) : (
                      <>
                        {cond.planTypes?.map((pt) => (
                          <Badge key={pt} variant="secondary" className="text-[10px]">
                            Plano: {availablePlanTypes.find((p) => p.id === pt)?.label ?? pt}
                          </Badge>
                        ))}
                        {cond.sources?.map((sc) => (
                          <Badge key={sc} variant="secondary" className="text-[10px]">
                            Origem: {availableSources.find((s) => s.id === sc)?.label ?? sc}
                          </Badge>
                        ))}
                        {cond.cities?.map((ct) => (
                          <Badge key={ct} variant="secondary" className="text-[10px]">
                            Cidade: {ct}
                          </Badge>
                        ))}
                        {(typeof cond.minLives === "number" || typeof cond.maxLives === "number") && (
                          <Badge variant="secondary" className="text-[10px]">
                            Vidas: {cond.minLives ?? 1} a {cond.maxLives ?? "∞"}
                          </Badge>
                        )}
                        {cond.qualificationStatuses?.map((st) => (
                          <Badge key={st} variant="secondary" className="text-[10px]">
                            IA: {availableIAStatuses.find((s) => s.id === st)?.label ?? st}
                          </Badge>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogPopup className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              {editingRule ? "Editar Regra de Roteamento" : "Nova Regra de Roteamento"}
            </DialogTitle>
            <DialogDescription>
              Configure os filtros e selecione o destino exato para onde os leads correspondentes devem ser enviados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Rule Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">Nome da Regra</Label>
              <Input
                id="rule-name"
                placeholder="Ex: Leads PME 5+ vidas para Equipe Corporativa"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Target Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de Destino</Label>
                <Select
                  value={targetType}
                  onValueChange={(val: any) => {
                    setTargetType(val);
                    if (val === "queue" && queues[0]) setTargetId(queues[0].id);
                    if (val === "branch" && branches[0]) setTargetId(branches[0].id);
                    if (val === "specific_broker" && brokers[0]) setTargetId(brokers[0].id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queue">Fila Específica</SelectItem>
                    <SelectItem value="branch">Unidade / Filial Específica</SelectItem>
                    <SelectItem value="specific_broker">Corretor Específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destino Selecionado</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetType === "queue" &&
                      queues.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
                    {targetType === "branch" &&
                      branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    {targetType === "specific_broker" &&
                      brokers.map((br) => (
                        <SelectItem key={br.id} value={br.id}>
                          {br.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fallback Queue */}
            <div className="space-y-2">
              <Label htmlFor="fallback-queue">Fila de Segurança / Fallback (Opcional)</Label>
              <Select value={fallbackQueueId} onValueChange={setFallbackQueueId}>
                <SelectTrigger id="fallback-queue">
                  <SelectValue placeholder="Fila Geral do Tenant (Padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Fila Geral do Tenant (Padrão)</SelectItem>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Se os corretores do destino primário estiverem lotados ou ausentes, o lead irá para esta fila.
              </p>
            </div>

            <hr className="border-border/60" />

            {/* Filter Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                Filtros e Condições de Entrada (Deixe em branco para qualquer lead)
              </h4>

              {/* Plan Types */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Tipos de Plano Aceitos</Label>
                <div className="flex flex-wrap gap-2">
                  {availablePlanTypes.map((pt) => {
                    const isSelected = selectedPlans.includes(pt.id);
                    return (
                      <Button
                        key={pt.id}
                        type="button"
                        size="xs"
                        variant={isSelected ? "primary" : "outline"}
                        onClick={() => toggleArrayItem(selectedPlans, pt.id, setSelectedPlans)}
                      >
                        {pt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Origens / Canais de Entrada</Label>
                <div className="flex flex-wrap gap-2">
                  {availableSources.map((sc) => {
                    const isSelected = selectedSources.includes(sc.id);
                    return (
                      <Button
                        key={sc.id}
                        type="button"
                        size="xs"
                        variant={isSelected ? "primary" : "outline"}
                        onClick={() => toggleArrayItem(selectedSources, sc.id, setSelectedSources)}
                      >
                        {sc.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Cities */}
              <div className="space-y-2">
                <Label htmlFor="cities-input" className="text-xs font-medium">Cidades / Localidades (Separadas por vírgula)</Label>
                <Input
                  id="cities-input"
                  placeholder="Ex: São Paulo, Campinas, Guarulhos"
                  value={citiesText}
                  onChange={(e) => setCitiesText(e.target.value)}
                />
              </div>

              {/* Number of Lives */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-lives" className="text-xs font-medium">Mínimo de Vidas</Label>
                  <Input
                    id="min-lives"
                    type="number"
                    placeholder="Ex: 5"
                    value={minLives}
                    onChange={(e) => setMinLives(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-lives" className="text-xs font-medium">Máximo de Vidas</Label>
                  <Input
                    id="max-lives"
                    type="number"
                    placeholder="Ex: 50"
                    value={maxLives}
                    onChange={(e) => setMaxLives(e.target.value)}
                  />
                </div>
              </div>

              {/* IA Statuses */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Status da Qualificação por IA</Label>
                <div className="flex flex-wrap gap-2">
                  {availableIAStatuses.map((st) => {
                    const isSelected = selectedIAStatuses.includes(st.id);
                    return (
                      <Button
                        key={st.id}
                        type="button"
                        size="xs"
                        variant={isSelected ? "primary" : "outline"}
                        onClick={() => toggleArrayItem(selectedIAStatuses, st.id, setSelectedIAStatuses)}
                      >
                        {st.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRule} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingRule ? "Atualizar Regra" : "Salvar Regra"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </Card>
  );
}
