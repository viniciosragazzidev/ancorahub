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
import { INITIAL_AGENT_TRIGGERS, type AgentTriggerItem, type AgentTriggerActionType } from "@/features/ai-agent/trigger-registry";

export function AgentTriggersPanel() {
  const [triggers, setTriggers] = useState<AgentTriggerItem[]>(INITIAL_AGENT_TRIGGERS);
  const [editingTrigger, setEditingTrigger] = useState<AgentTriggerItem | null>(null);
  const [openModal, setOpenModal] = useState(false);

  // Form State for Trigger Editing / Creation
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<"transfer" | "qualification" | "opt_out" | "question" | "automation">("qualification");
  const [formActionType, setFormActionType] = useState<AgentTriggerActionType>("TAG_WARM");
  const [formKeywords, setFormKeywords] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");

  function handleOpenCreateModal() {
    setEditingTrigger(null);
    setFormName("");
    setFormDescription("");
    setFormCategory("automation");
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
      // Update existing trigger
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
      // Create new trigger
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
      toast.success(`Novo gatilho "${formName}" criado e pronto para uso!`);
    }

    setOpenModal(false);
  }

  function renderCategoryBadge(category: string) {
    switch (category) {
      case "transfer":
        return <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Transferência</Badge>;
      case "qualification":
        return <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">Qualificação</Badge>;
      case "opt_out":
        return <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-300">Recusa / Opt-out</Badge>;
      case "automation":
        return <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">Automação Externa</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">Geral</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* PAINEL DE LOJA DE TRIGGERS E AUTOMACÕES */}
      <Card variant="subtle" className="rounded-xl border-border/80">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lightning className="size-4 text-amber-500" />
                Loja de Triggers & Automações do Agente
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Gatilhos dinâmicos e editáveis que controlam as ações do robô em tempo real e integram com automações futuras.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5 shrink-0">
              <Plus className="size-4" />
              Criar Novo Gatilho
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {triggers.map((trigger) => (
              <div
                key={trigger.id}
                className={`rounded-xl border p-4 transition-all space-y-3 flex flex-col justify-between ${
                  trigger.enabled
                    ? "border-border/80 bg-card"
                    : "border-border/40 bg-muted/20 opacity-70"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-foreground tracking-tight">{trigger.name}</h4>
                        {renderCategoryBadge(trigger.category)}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {trigger.description}
                      </p>
                    </div>
                    <Switch
                      checked={trigger.enabled}
                      onCheckedChange={() => handleToggleTrigger(trigger.id)}
                    />
                  </div>

                  {/* Keywords list */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Palavras-Chave de Disparo:</span>
                    <div className="flex flex-wrap gap-1">
                      {trigger.keywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-mono">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Webhook if any */}
                  {trigger.webhookUrl ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono pt-1">
                      <Globe className="size-3 shrink-0" />
                      <span className="truncate">{trigger.webhookUrl}</span>
                    </div>
                  ) : null}
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    Ação: {trigger.actionType}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => handleOpenEditModal(trigger)}
                    >
                      <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-rose-500 hover:text-rose-600"
                      onClick={() => handleDeleteTrigger(trigger.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DIALOG DE EDITAR / CRIAR GATILHO */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogPopup className="max-w-lg">
          <form onSubmit={handleSaveTriggerForm}>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                {editingTrigger ? "Editar Gatilho de Automação" : "Criar Novo Gatilho Reutilizável"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure os parâmetros de disparo, palavras-chave e ação executada pelo agente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Gatilho</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Gatilho de Automação Zapier / Webhook"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrição</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Explique quando esse gatilho deve ser acionado pelo robô..."
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Categoria</Label>
                  <Select value={formCategory} onValueChange={(val: any) => setFormCategory(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">Transferência Humana</SelectItem>
                      <SelectItem value="qualification">Qualificação</SelectItem>
                      <SelectItem value="opt_out">Recusa / Opt-out</SelectItem>
                      <SelectItem value="automation">Automação Externa</SelectItem>
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
                      <SelectItem value="TRANSFER_HUMAN">Transferir p/ Humano</SelectItem>
                      <SelectItem value="TAG_HOT">Etiquetar como Quente (Hot)</SelectItem>
                      <SelectItem value="TAG_WARM">Etiquetar como Morno (Warm)</SelectItem>
                      <SelectItem value="TAG_COLD">Etiquetar como Frio (Cold)</SelectItem>
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
                  placeholder="falar com atendente, cotação urgente, automação..."
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
