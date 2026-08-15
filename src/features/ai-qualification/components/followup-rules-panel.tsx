"use client";

import { useState } from "react";
import { Clock, Plus, Trash2, CheckCircle, Sliders, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { saveFollowUpRuleAction, deleteFollowUpRuleAction } from "@/features/ai-qualification/actions";

const followUpTriggerValues = [
  "no_first_response",
  "qualification_abandoned",
  "partially_qualified",
  "waiting_broker",
  "quote_without_response",
  "scheduled_return",
  "cold_lead_reactivation",
  "custom",
] as const;

type FollowUpRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  delayMinutes: number;
  maxAttempts: number;
  minimumIntervalMinutes: number;
  allowedDays: number[] | string[];
  allowedStartTime: string;
  allowedEndTime: string;
  timezone: string;
  messageMode: string;
  fixedMessage: string | null;
  templateId: string | null;
  stopConditions: string[];
};

type FollowUpRulesPanelProps = {
  rules: FollowUpRule[];
  canEdit?: boolean;
};

const triggerLabels: Record<string, string> = {
  no_first_response: "Cliente não respondeu primeira abordagem",
  qualification_abandoned: "Lead abandonou qualificação no meio",
  partially_qualified: "Parcialmente qualificado (pendência)",
  waiting_broker: "Aguardando atendimento do corretor",
  quote_without_response: "Cotação enviada sem resposta",
  scheduled_return: "Retorno agendado",
  cold_lead_reactivation: "Reativação de lead frio",
  custom: "Personalizado",
};

export function FollowUpRulesPanel({ rules: initialRules, canEdit = true }: FollowUpRulesPanelProps) {
  const [rules, setRules] = useState<FollowUpRule[]>(initialRules);
  const [editingRule, setEditingRule] = useState<Partial<FollowUpRule> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggleEnabled(rule: FollowUpRule) {
    if (!canEdit) return;
    try {
      const updated = await saveFollowUpRuleAction({
        id: rule.id,
        name: rule.name,
        enabled: !rule.enabled,
        trigger: rule.trigger as any,
        delayMinutes: rule.delayMinutes,
        maxAttempts: rule.maxAttempts,
        minimumIntervalMinutes: rule.minimumIntervalMinutes,
        allowedDays: Array.isArray(rule.allowedDays) ? rule.allowedDays.map(Number) : [1, 2, 3, 4, 5],
        allowedStartTime: rule.allowedStartTime,
        allowedEndTime: rule.allowedEndTime,
        timezone: rule.timezone,
        messageMode: rule.messageMode as any,
        fixedMessage: rule.fixedMessage ?? undefined,
        templateId: rule.templateId ?? undefined,
        stopConditions: rule.stopConditions ?? ["client_responded"],
      });
      if (Array.isArray(updated)) {
        setRules(updated as any);
        toast.success(`Regra "${rule.name}" ${!rule.enabled ? "ativada" : "desativada"}.`);
      }
    } catch {
      toast.error("Erro ao atualizar regra.");
    }
  }

  async function handleDelete(ruleId: string) {
    if (!canEdit || !confirm("Tem certeza que deseja excluir esta regra de follow-up?")) return;
    try {
      const updated = await deleteFollowUpRuleAction(ruleId);
      if (Array.isArray(updated)) {
        setRules(updated as any);
        toast.success("Regra removida.");
      }
    } catch {
      toast.error("Erro ao remover regra.");
    }
  }

  async function handleSaveEditing() {
    if (!editingRule || !editingRule.name?.trim()) {
      toast.error("Informe o nome da regra.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await saveFollowUpRuleAction({
        id: editingRule.id,
        name: editingRule.name.trim(),
        enabled: editingRule.enabled ?? true,
        trigger: (editingRule.trigger as any) ?? "qualification_abandoned",
        delayMinutes: Number(editingRule.delayMinutes) || 120,
        maxAttempts: Number(editingRule.maxAttempts) || 3,
        minimumIntervalMinutes: Number(editingRule.minimumIntervalMinutes) || 60,
        allowedDays: [1, 2, 3, 4, 5],
        allowedStartTime: editingRule.allowedStartTime || "08:00",
        allowedEndTime: editingRule.allowedEndTime || "18:00",
        timezone: "America/Sao_Paulo",
        messageMode: "fixed",
        fixedMessage: editingRule.fixedMessage ?? "Olá! Gostaria de continuar sua cotação?",
        stopConditions: ["client_responded", "human_taken", "lead_closed"],
      });

      if (Array.isArray(updated)) {
        setRules(updated as any);
        setEditingRule(null);
        toast.success("Regra de follow-up salva com sucesso.");
      } else {
        toast.error("Erro ao salvar regra.");
      }
    } catch {
      toast.error("Erro ao salvar regra.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Regras Operacionais de Follow-up Automático
          </CardTitle>
          <CardDescription className="text-xs">
            Parâmetros de régua de cobrança e reagendamento para leads que pararam de responder.
          </CardDescription>
        </div>
        {canEdit && !editingRule && (
          <Button
            size="sm"
            onClick={() =>
              setEditingRule({
                name: "Novo Follow-up",
                enabled: true,
                trigger: "qualification_abandoned",
                delayMinutes: 120,
                maxAttempts: 3,
                minimumIntervalMinutes: 60,
                allowedStartTime: "08:00",
                allowedEndTime: "18:00",
                fixedMessage: "Olá! Ainda posso te ajudar a encontrar o melhor plano?",
              })
            }
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Criar Regra
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {editingRule && (
          <div className="rounded-lg border border-primary/30 bg-muted/20 p-4 space-y-4">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
              {editingRule.id ? "Editar Regra de Follow-up" : "Nova Regra de Follow-up"}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome da Regra</Label>
                <Input
                  className="h-8 text-xs"
                  value={editingRule.name ?? ""}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Gatilho de Disparo</Label>
                <Select
                  value={editingRule.trigger ?? "qualification_abandoned"}
                  onValueChange={(val) => val && setEditingRule({ ...editingRule, trigger: val })}
                >
                  <SelectTrigger size="sm" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {followUpTriggerValues.map((val) => (
                      <SelectItem key={val} value={val}>
                        {triggerLabels[val] ?? val}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tempo de Espera (minutos)</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={editingRule.delayMinutes ?? 120}
                  onChange={(e) => setEditingRule({ ...editingRule, delayMinutes: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Máximo de Tentativas</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={editingRule.maxAttempts ?? 3}
                  onChange={(e) => setEditingRule({ ...editingRule, maxAttempts: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mensagem de Acompanhamento</Label>
              <Textarea
                className="text-xs min-h-[60px]"
                value={editingRule.fixedMessage ?? ""}
                onChange={(e) => setEditingRule({ ...editingRule, fixedMessage: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setEditingRule(null)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEditing} disabled={isSaving} className="font-semibold gap-1">
                {isSaving ? <RefreshCw className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                Salvar Regra
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rules.length > 0 ? (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{rule.name}</span>
                    <Badge variant={rule.enabled ? "default" : "outline"} className="text-[10px]">
                      {rule.enabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gatilho: <span className="font-medium text-foreground">{triggerLabels[rule.trigger] ?? rule.trigger}</span> · Aguarda {rule.delayMinutes}m · Max {rule.maxAttempts}x
                  </p>
                  {rule.fixedMessage && (
                    <p className="text-xs italic text-muted-foreground truncate max-w-lg">
                      &quot;{rule.fixedMessage}&quot;
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleEnabled(rule)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRule(rule)}
                      className="text-xs h-8"
                    >
                      <Sliders className="size-3.5" /> Editar
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleDelete(rule.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma regra de follow-up cadastrada.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
