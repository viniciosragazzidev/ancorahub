"use client";

import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import {
  Lightning,
  Sparkle,
  Phone,
  ShieldX,
  SlidersHorizontal,
  Flame,
  ThermometerCold,
  Plus,
  CheckCircle,
  Globe,
  Users,
  FileText,
  Clock,
  ShieldCheck,
} from "@/components/huge-icons";
import { Pencil, Trash2, Zap, User, MapPin, ShieldAlert, Activity, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogPopup, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AGENT_CAPABILITIES, type AgentCapabilityDefinition, type AgentRiskLevel } from "@/features/ai-agent/capability-registry";

export function AgentTriggersPanel() {
  const [capabilities, setCapabilities] = useState<AgentCapabilityDefinition[]>(AGENT_CAPABILITIES);
  const [editingCap, setEditingCap] = useState<AgentCapabilityDefinition | null>(null);
  const [openModal, setOpenModal] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<any>("intake");
  const [formRiskLevel, setFormRiskLevel] = useState<AgentRiskLevel>("LOW");
  const [formScope, setFormScope] = useState<any>("QUALIFICATION_SESSION");
  const [formRepeatPolicy, setFormRepeatPolicy] = useState<any>("UNTIL_VALID");
  const [formKeywords, setFormKeywords] = useState("");

  const intakeCapabilities = capabilities.filter((c) => c.category === "intake");
  const actionCapabilities = capabilities.filter((c) => c.category !== "intake");

  function handleOpenCreateModal() {
    setEditingCap(null);
    setFormName("");
    setFormDescription("");
    setFormCategory("automation");
    setFormRiskLevel("MEDIUM");
    setFormScope("LEAD");
    setFormRepeatPolicy("REPEATABLE");
    setFormKeywords("nova_capacidade, webhook");
    setOpenModal(true);
  }

  function handleOpenEditModal(cap: AgentCapabilityDefinition) {
    setEditingCap(cap);
    setFormName(cap.name);
    setFormDescription(cap.description);
    setFormCategory(cap.category);
    setFormRiskLevel(cap.riskLevel);
    setFormScope(cap.executionScope);
    setFormRepeatPolicy(cap.repeatPolicy);
    setFormKeywords(cap.keywords.join(", "));
    setOpenModal(true);
  }

  function handleToggleCapability(key: string) {
    setCapabilities((prev) =>
      prev.map((item) => {
        if (item.key === key) {
          const next = !item.enabled;
          toast.success(`Capacidade "${item.name}" ${next ? "ativada" : "desativada"}.`);
          return { ...item, enabled: next, version: item.version + 1 };
        }
        return item;
      })
    );
  }

  function handleSaveCapability() {
    if (!formName.trim()) {
      toast.error("Informe o nome da capacidade.");
      return;
    }
    if (editingCap) {
      setCapabilities((prev) =>
        prev.map((item) =>
          item.key === editingCap.key
            ? {
                ...item,
                name: formName.trim(),
                description: formDescription.trim(),
                category: formCategory,
                riskLevel: formRiskLevel,
                executionScope: formScope,
                repeatPolicy: formRepeatPolicy,
                keywords: formKeywords.split(",").map((k) => k.trim()).filter(Boolean),
                version: item.version + 1,
              }
            : item,
        ),
      );
      toast.success(`Capacidade "${formName.trim()}" atualizada no Registry.`);
    } else {
      const key = `CUSTOM_${formName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
      const capability: AgentCapabilityDefinition = {
        key,
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        riskLevel: formRiskLevel,
        executionScope: formScope,
        repeatPolicy: formRepeatPolicy,
        keywords: formKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        allowedConversationStates: [],
        requiredPermissions: [],
        requiredFacts: [],
        producedFacts: [],
        preconditions: [],
        postconditions: [],
        idempotencyStrategy: `${key.toLowerCase()}:{eventId}`,
        canRunWhenHumanActive: true,
        canRunAfterOptOut: false,
        enabled: true,
        version: 1,
      };
      setCapabilities((prev) => [...prev, capability]);
      toast.success(`Capacidade "${formName.trim()}" registrada no Engine.`);
    }
    setOpenModal(false);
  }

  function renderRiskBadge(risk: AgentRiskLevel) {
    switch (risk) {
      case "LOW":
        return <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Risco Baixo</Badge>;
      case "MEDIUM":
        return <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-600 dark:text-sky-400">Risco Médio</Badge>;
      case "HIGH":
        return <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">Risco Alto</Badge>;
      case "CRITICAL":
        return <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold">Crítico</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER & POLICY ENGINE SUMMARY */}
      <Card variant="subtle" className="rounded-xl border-border/80">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-500" />
                Agent Capability Registry & Policy Engine
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Motor determinístico de capacidades do robô. O LLM apenas solicita uma capacidade; o backend valida Guards, escopo, nivel de risco e idempotência antes de executar.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs font-medium gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                Guard Pipeline Ativo
              </Badge>
              <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5">
                <Plus className="size-4" />
                Registrar Capacidade
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* SEÇÃO 1: CAPACIDADES DE INTAKE DE FATOS (QUALIFICATION FACTS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <User className="size-4 text-sky-500" />
            1. Capacidades de Coleta & Fatos (Intake Facts)
          </h3>
          <span className="text-xs text-muted-foreground">{intakeCapabilities.length} Capacidades Ativas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {intakeCapabilities.map((cap) => (
            <div
              key={cap.key}
              className={`rounded-xl border p-3.5 space-y-3 flex flex-col justify-between transition-all ${
                cap.enabled ? "border-border/80 bg-card" : "border-border/40 bg-muted/20 opacity-70"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground tracking-tight">{cap.name}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {renderRiskBadge(cap.riskLevel)}
                      <Badge variant="secondary" className="text-[10px] font-mono">{cap.repeatPolicy}</Badge>
                    </div>
                  </div>
                  <Switch
                    checked={cap.enabled}
                    onCheckedChange={() => handleToggleCapability(cap.key)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cap.description}
                </p>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fatos Produzidos:</span>
                  <div className="flex flex-wrap gap-1">
                    {cap.producedFacts.map((fact, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono border-sky-500/30 text-sky-600 dark:text-sky-400">
                        +{fact}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  Scope: {cap.executionScope}
                </Badge>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => handleOpenEditModal(cap)}>
                  <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEÇÃO 2: CAPACIDADES DE AÇÕES & TRANSBORDO */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            2. Capacidades de Ação & Políticas de Segurança
          </h3>
          <span className="text-xs text-muted-foreground">{actionCapabilities.length} Capacidades Regradas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {actionCapabilities.map((cap) => (
            <div
              key={cap.key}
              className={`rounded-xl border p-3.5 space-y-3 flex flex-col justify-between transition-all ${
                cap.enabled ? "border-border/80 bg-card" : "border-border/40 bg-muted/20 opacity-70"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground tracking-tight">{cap.name}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {renderRiskBadge(cap.riskLevel)}
                      <Badge variant="secondary" className="text-[10px] font-mono">{cap.repeatPolicy}</Badge>
                    </div>
                  </div>
                  <Switch
                    checked={cap.enabled}
                    onCheckedChange={() => handleToggleCapability(cap.key)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cap.description}
                </p>

                {cap.requiredFacts.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Fatos Exigidos:</span>
                    <div className="flex flex-wrap gap-1">
                      {cap.requiredFacts.map((fact, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-mono border-amber-500/30">
                          {fact}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  Scope: {cap.executionScope}
                </Badge>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => handleOpenEditModal(cap)}>
                  <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE EDITAR / CRIAR CAPACIDADE */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogPopup className="max-w-lg">
          <form onSubmit={(e) => { e.preventDefault(); handleSaveCapability(); }}>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                {editingCap ? "Editar Capacidade do Agente" : "Registrar Nova Capacidade"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure os parâmetros de execução, política de repetição e escopo da capacidade.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome da Capacidade</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrição</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nível de Risco</Label>
                  <Select value={formRiskLevel} onValueChange={(val: any) => setFormRiskLevel(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baixo</SelectItem>
                      <SelectItem value="MEDIUM">Médio</SelectItem>
                      <SelectItem value="HIGH">Alto</SelectItem>
                      <SelectItem value="CRITICAL">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Política de Repetição</Label>
                  <Select value={formRepeatPolicy} onValueChange={(val: any) => setFormRepeatPolicy(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNTIL_VALID">Até Válido (UNTIL_VALID)</SelectItem>
                      <SelectItem value="ONCE">Apenas Uma Vez (ONCE)</SelectItem>
                      <SelectItem value="ONCE_PER_SESSION">1 Vez por Sessão</SelectItem>
                      <SelectItem value="REPEATABLE">Repetível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">
                Salvar no Registry
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
