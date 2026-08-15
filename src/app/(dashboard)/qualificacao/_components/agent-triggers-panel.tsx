"use client";

import { useState } from "react";
import { toast } from "sonner";
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
  User,
  Users,
  MapPin,
  FileText,
  Clock,
  ShieldCheck,
} from "@/components/huge-icons";
import { Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogPopup, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INITIAL_AGENT_TRIGGERS, type AgentTriggerItem, type AgentTriggerActionType, type AgentTriggerCategory } from "@/features/ai-agent/trigger-registry";

export function AgentTriggersPanel() {
  const [triggers, setTriggers] = useState<AgentTriggerItem[]>(INITIAL_AGENT_TRIGGERS);
  const [editingTrigger, setEditingTrigger] = useState<AgentTriggerItem | null>(null);
  const [openModal, setOpenModal] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<AgentTriggerCategory>("action");
  const [formActionType, setFormActionType] = useState<AgentTriggerActionType>("TAG_WARM");
  const [formKeywords, setFormKeywords] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");

  const intakeTriggers = triggers.filter((t) => t.category === "intake");
  const actionTriggers = triggers.filter((t) => t.category !== "intake");

  function handleOpenCreateModal() {
    setEditingTrigger(null);
    setFormName("");
    setFormDescription("");
    setFormCategory("action");
    setFormActionType("WEBHOOK_AUTOMATION");
    setFormKeywords("novo_gatilho, automacao");
    setFormWebhookUrl("https://api.ancorasaude.cloud/webhooks/my-automation");
    setOpenModal(true);
  }

  function handleOpenEditModal(trigger: AgentTriggerItem) {
    setEditingTrigger(trigger);
    setFormName(trigger.name);
    setFormDescription(trigger.description);
    setFormCategory(trigger.category);
    setFormActionType(trigger.actionType);
    setFormKeywords(trigger.keywords.join(", "));
    setFormWebhookUrl(trigger.webhookUrl || "");
    setOpenModal(true);
  }

  function handleToggleTrigger(id: string) {
    setTriggers((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.enabled;
          toast.success(`Gatilho "${item.name}" ${next ? "ativado" : "desativado"}.`);
          return { ...item, enabled: next, updatedAt: new Date().toISOString() };
        }
        return item;
      })
    );
  }

  function handleDeleteTrigger(id: string) {
    setTriggers((prev) => prev.filter((item) => item.id !== id));
    toast.success("Gatilho removido com sucesso!");
  }

  function handleSaveTriggerForm(e: React.FormEvent) {
    e.preventDefault();

    const parsedKeywords = formKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (editingTrigger) {
      setTriggers((prev) =>
        prev.map((item) =>
          item.id === editingTrigger.id
            ? {
                ...item,
                name: formName,
                description: formDescription,
                category: formCategory,
                actionType: formActionType,
                keywords: parsedKeywords,
                webhookUrl: formWebhookUrl,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      toast.success(`Gatilho "${formName}" atualizado com sucesso!`);
    } else {
      const newTrigger: AgentTriggerItem = {
        id: `trg_${Date.now()}`,
        key: formName.toUpperCase().replace(/\s+/g, "_"),
        name: formName,
        description: formDescription,
        category: formCategory,
        actionType: formActionType,
        enabled: true,
        keywords: parsedKeywords,
        webhookUrl: formWebhookUrl,
        updatedAt: new Date().toISOString(),
      };
      setTriggers((prev) => [newTrigger, ...prev]);
      toast.success(`Novo gatilho "${formName}" criado e registrado!`);
    }

    setOpenModal(false);
  }

  function renderCategoryBadge(category: AgentTriggerCategory) {
    if (category === "intake") {
      return <Badge variant="secondary" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300">Atendimento / Intake</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">Ação / Transbordo</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER & DEDUPLICATION BANNER */}
      <Card variant="subtle" className="rounded-xl border-border/80">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lightning className="size-4 text-amber-500" />
                Central de Triggers do Agente (Atendimento & Ações)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Todas as ações do robô são centralizadas aqui. O agente consulta essa lista, executa a ação e <strong>registra a execução por lead</strong> para prevenir repetições indevidas.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs font-medium gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                Deduplicação Ativa (100% Protegido)
              </Badge>
              <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5">
                <Plus className="size-4" />
                Criar Gatilho
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* SEÇÃO 1: TRIGGERS DE ATENDIMENTO (INTAKE DE DADOS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <User className="size-4 text-sky-500" />
            1. Triggers de Atendimento (Coleta & Intake)
          </h3>
          <span className="text-xs text-muted-foreground">{intakeTriggers.length} Regras Ativas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {intakeTriggers.map((trigger) => (
            <div
              key={trigger.id}
              className={`rounded-xl border p-3.5 space-y-3 flex flex-col justify-between transition-all ${
                trigger.enabled ? "border-border/80 bg-card" : "border-border/40 bg-muted/20 opacity-70"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground tracking-tight">{trigger.name}</h4>
                    {renderCategoryBadge(trigger.category)}
                  </div>
                  <Switch
                    checked={trigger.enabled}
                    onCheckedChange={() => handleToggleTrigger(trigger.id)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {trigger.description}
                </p>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Palavras-Chave:</span>
                  <div className="flex flex-wrap gap-1">
                    {trigger.keywords.map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {trigger.actionType}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => handleOpenEditModal(trigger)}>
                    <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEÇÃO 2: TRIGGERS DE AÇÕES (TRANSFERIR, ETICKETAR, AUTOMAÇÃO) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            2. Triggers de Ações & Automações (Transbordo & Regras)
          </h3>
          <span className="text-xs text-muted-foreground">{actionTriggers.length} Regras Ativas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {actionTriggers.map((trigger) => (
            <div
              key={trigger.id}
              className={`rounded-xl border p-3.5 space-y-3 flex flex-col justify-between transition-all ${
                trigger.enabled ? "border-border/80 bg-card" : "border-border/40 bg-muted/20 opacity-70"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground tracking-tight">{trigger.name}</h4>
                    {renderCategoryBadge(trigger.category)}
                  </div>
                  <Switch
                    checked={trigger.enabled}
                    onCheckedChange={() => handleToggleTrigger(trigger.id)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {trigger.description}
                </p>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Palavras-Chave:</span>
                  <div className="flex flex-wrap gap-1">
                    {trigger.keywords.map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {trigger.webhookUrl ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono pt-1">
                    <Globe className="size-3 shrink-0" />
                    <span className="truncate">{trigger.webhookUrl}</span>
                  </div>
                ) : null}
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                  {trigger.actionType}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => handleOpenEditModal(trigger)}>
                    <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-rose-500 hover:text-rose-600" onClick={() => handleDeleteTrigger(trigger.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL EDITAR / CRIAR GATILHO */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogPopup className="max-w-lg">
          <form onSubmit={handleSaveTriggerForm}>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                {editingTrigger ? "Editar Gatilho do Robô" : "Criar Novo Gatilho do Robô"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Defina o comportamento do robô, palavras-chave e ação de transbordo/qualificação.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Gatilho</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Ação: Coletar Quantidade de Vidas"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrição do Comportamento</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Explique o que essa função do robô faz quando acionada..."
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Categoria do Gatilho</Label>
                  <Select value={formCategory} onValueChange={(val: any) => setFormCategory(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Atendimento (Coleta de Dados)</SelectItem>
                      <SelectItem value="action">Ação (Transbordo & Tags)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Ação</Label>
                  <Select value={formActionType} onValueChange={(val: any) => setFormActionType(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COLLECT_NAME">Coletar Nome</SelectItem>
                      <SelectItem value="COLLECT_DEPENDENTS">Coletar Vidas</SelectItem>
                      <SelectItem value="COLLECT_CITY">Coletar Cidade</SelectItem>
                      <SelectItem value="COLLECT_PLAN_TYPE">Coletar Tipo de Plano</SelectItem>
                      <SelectItem value="TRANSFER_HUMAN">Transferir p/ Humano</SelectItem>
                      <SelectItem value="TAG_HOT">Etiquetar Quente (Hot)</SelectItem>
                      <SelectItem value="TAG_WARM">Etiquetar Morno (Warm)</SelectItem>
                      <SelectItem value="TAG_COLD">Etiquetar Frio (Cold)</SelectItem>
                      <SelectItem value="TAG_DISQUALIFIED">Desqualificar Lead</SelectItem>
                      <SelectItem value="WEBHOOK_AUTOMATION">Disparar Webhook Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Palavras-Chave de Disparo (separadas por vírgula)</Label>
                <Input
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="falar com atendente, cotação urgente, quantas vidas..."
                  className="h-9 text-xs"
                />
              </div>

              {formActionType === "WEBHOOK_AUTOMATION" ? (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <Globe className="size-3.5" />
                    URL do Webhook de Automação
                  </Label>
                  <Input
                    value={formWebhookUrl}
                    onChange={(e) => setFormWebhookUrl(e.target.value)}
                    placeholder="https://api.meusistema.com/webhooks/leadin"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">
                Salvar Gatilho
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
