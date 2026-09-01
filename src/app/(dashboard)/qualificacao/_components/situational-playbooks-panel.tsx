"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  CheckCircle2,
  Trash2,
  Phone,
  ArrowRight,
  Zap,
  HelpCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  Tag,
  Copy,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchSituationalPlaybooksAction,
  saveSituationalPlaybooksAction,
  resetSituationalPlaybooksAction,
} from "@/features/ai-qualification/actions";
import {
  interpolatePlaybookVariables,
  getDefaultPlaybooks,
} from "@/features/ai-qualification/situations-catalog";
import type { SituationalPlaybookItem } from "@/shared/domain-root/situational-playbooks-root";

interface SituationalPlaybooksPanelProps {
  assistantName?: string;
  onTestInSimulator?: (initialText: string) => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  first_contact: { label: "Primeiro Contato", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  inquiry: { label: "Dúvidas & Preços", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  objection: { label: "Objeções", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  followup: { label: "Reengajamento", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  handoff: { label: "Handoff Humano", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  timing: { label: "Horários", color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  custom: { label: "Customizado", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

const AVAILABLE_VARIABLES = [
  { tag: "{cliente_nome}", label: "Nome do Cliente", example: "Carlos" },
  { tag: "{assistente_nome}", label: "Nome da Assistente", example: "Ana" },
  { tag: "{corretora_nome}", label: "Nome da Corretora", example: "Âncora Corretora" },
  { tag: "{operadoras_principais}", label: "Operadoras Parceiras", example: "Amil, SulAmérica..." },
  { tag: "{cidade_cliente}", label: "Cidade do Lead", example: "Campinas" },
  { tag: "{vidas_cliente}", label: "Qtd. Vidas", example: "3" },
  { tag: "{tipo_plano}", label: "Tipo de Plano", example: "PME / Individual" },
  { tag: "{horario_atendimento}", label: "Horário Comercial", example: "08h às 18h" },
];

export function SituationalPlaybooksPanel({
  assistantName = "Ana",
  onTestInSimulator,
}: SituationalPlaybooksPanelProps) {
  const [playbooks, setPlaybooks] = useState<SituationalPlaybookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingPlaybookId, setEditingPlaybookId] = useState<string | null>(null);

  // New situation dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<SituationalPlaybookItem["category"]>("custom");
  const [newTrigger, setNewTrigger] = useState("");
  const [newExampleInput, setNewExampleInput] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchSituationalPlaybooksAction();
        setPlaybooks(data && data.length > 0 ? data : getDefaultPlaybooks());
      } catch (err) {
        toast.error("Não foi possível carregar os roteiros situacionais.");
        setPlaybooks(getDefaultPlaybooks());
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleTogglePlaybook = (id: string, enabled: boolean) => {
    setPlaybooks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled } : p))
    );
  };

  const handleUpdateField = (id: string, field: keyof SituationalPlaybookItem, value: any) => {
    setPlaybooks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleInsertVariable = (id: string, variableTag: string) => {
    setPlaybooks((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          recommendedResponse: `${p.recommendedResponse} ${variableTag}`,
        };
      })
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSituationalPlaybooksAction(playbooks);
      toast.success("Roteiros e respostas da IA salvos com sucesso!");
    } catch (err) {
      console.error("[situational-playbooks] save error:", err);
      toast.error("Erro ao salvar os roteiros situacionais.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("Deseja restaurar todos os roteiros situacionais para os padrões de fábrica?")) {
      return;
    }
    try {
      setSaving(true);
      const res = await resetSituationalPlaybooksAction();
      if (res.playbooks) {
        setPlaybooks(res.playbooks);
      }
      toast.success("Roteiros restaurados para os padrões de fábrica!");
    } catch (err) {
      toast.error("Erro ao restaurar padrões.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = () => {
    if (!newTitle.trim() || !newResponse.trim()) {
      toast.error("Preencha o título e a resposta recomendada.");
      return;
    }

    const newItem: SituationalPlaybookItem = {
      id: `pb_custom_${Date.now()}`,
      key: `CUSTOM_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      description: newTrigger.trim() || "Situação personalizada criada pelo usuário.",
      triggerCondition: newTrigger.trim() || "Condição customizada.",
      exampleCustomerInput: newExampleInput.trim() || "Exemplo de mensagem do cliente.",
      recommendedResponse: newResponse.trim(),
      enabled: true,
      toneOverride: "friendly",
      keywords: newKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    };

    setPlaybooks((prev) => [newItem, ...prev]);
    setIsDialogOpen(false);
    setNewTitle("");
    setNewTrigger("");
    setNewExampleInput("");
    setNewResponse("");
    setNewKeywords("");
    toast.success("Nova situação adicionada! Não se esqueça de salvar as alterações.");
  };

  const handleDeletePlaybook = (id: string) => {
    setPlaybooks((prev) => prev.filter((p) => p.id !== id));
    toast.info("Roteiro removido.");
  };

  const filteredPlaybooks = selectedCategory === "all"
    ? playbooks
    : playbooks.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <Card variant="subtle" className="rounded-2xl border-border/80">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold gap-1.5 py-0.5">
                  <Sparkles className="size-3" />
                  Central de Respostas & Situações
                </Badge>
                <Badge variant="outline" className="text-xs font-medium">
                  {playbooks.filter((p) => p.enabled).length} ativas / {playbooks.length} total
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">
                Roteiros de Atendimento & Perguntas Humanizadas
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed max-w-3xl">
                Configure exatamente como a assistente de IA ({assistantName}) deve se apresentar, responder a dúvidas de preços, acolher mensagens diretas no WhatsApp e reagir com empatia sem disparar perguntas brutas ou robóticas.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                disabled={saving || loading}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="size-3.5 text-muted-foreground" />
                Padrões de Fábrica
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(true)}
                disabled={saving || loading}
                className="gap-1.5 text-xs"
              >
                <Plus className="size-3.5" />
                Nova Situação
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || loading}
                className="gap-1.5 text-xs font-semibold"
              >
                <Save className="size-3.5" />
                {saving ? "Salvando..." : "Salvar Roteiros"}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* CATEGORY FILTER CHIPS */}
        <CardContent className="pt-0 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
            <Button
              variant={selectedCategory === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="text-xs h-7 px-2.5 rounded-lg"
            >
              Todas ({playbooks.length})
            </Button>
            {Object.entries(CATEGORY_LABELS).map(([catKey, { label }]) => {
              const count = playbooks.filter((p) => p.category === catKey).length;
              if (count === 0 && catKey !== "custom") return null;
              return (
                <Button
                  key={catKey}
                  variant={selectedCategory === catKey ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(catKey)}
                  className="text-xs h-7 px-2.5 rounded-lg gap-1.5"
                >
                  {label}
                  <span className="text-[10px] opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* PLAYBOOKS LIST */}
      <div className="grid gap-4">
        {filteredPlaybooks.map((playbook) => {
          const categoryMeta = CATEGORY_LABELS[playbook.category] || CATEGORY_LABELS.custom;
          const isExpanded = editingPlaybookId === playbook.id;
          const simulatedPreview = interpolatePlaybookVariables(playbook.recommendedResponse, {
            assistente_nome: assistantName,
            cliente_nome: "Carlos",
            corretora_nome: "Âncora Corretora",
          });

          return (
            <Card
              key={playbook.id}
              className={cn(
                "rounded-2xl transition-all border-border/80",
                !playbook.enabled && "opacity-60 bg-muted/20",
                isExpanded && "border-primary/50 shadow-md ring-1 ring-primary/20"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={playbook.enabled}
                      onCheckedChange={(checked) => handleTogglePlaybook(playbook.id, checked)}
                      id={`switch-${playbook.id}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`switch-${playbook.id}`} className="text-sm font-bold cursor-pointer">
                          {playbook.title}
                        </Label>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium", categoryMeta.color)}>
                          {categoryMeta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {playbook.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {onTestInSimulator && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTestInSimulator(playbook.exampleCustomerInput)}
                        className="text-xs h-7 text-primary hover:text-primary gap-1"
                      >
                        <Zap className="size-3" />
                        Testar no Simulador
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPlaybookId(isExpanded ? null : playbook.id)}
                      className="text-xs h-7"
                    >
                      {isExpanded ? "Fechar Edição" : "Editar Roteiro"}
                    </Button>

                    {playbook.category === "custom" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePlaybook(playbook.id)}
                        className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                {/* WHATSAPP VISUAL PREVIEW BOX */}
                <div className="rounded-xl border bg-emerald-950/10 dark:bg-emerald-950/20 p-3.5 space-y-2.5 font-sans">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3.5" />
                      Simulação da Conversa no WhatsApp
                    </span>
                    <span className="text-[10px] text-muted-foreground">Gatilho: {playbook.triggerCondition}</span>
                  </div>

                  {/* Customer Message Bubble */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tl-xs bg-muted/80 dark:bg-muted/50 px-3.5 py-2 text-xs shadow-2xs border text-foreground">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Cliente</p>
                      <p className="leading-relaxed">{playbook.exampleCustomerInput}</p>
                    </div>
                  </div>

                  {/* AI Response Message Bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-2 text-xs shadow-2xs text-foreground">
                      <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center justify-between">
                        <span>{assistantName} (IA)</span>
                        <span className="text-[9px] opacity-70">Agora</span>
                      </p>
                      <p className="leading-relaxed whitespace-pre-wrap">{simulatedPreview}</p>
                    </div>
                  </div>
                </div>

                {/* EDITING FORM (EXPANDABLE) */}
                {isExpanded && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 animate-in fade-in-50 duration-200">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Título da Situação</Label>
                        <Input
                          value={playbook.title}
                          onChange={(e) => handleUpdateField(playbook.id, "title", e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Tom de Resposta</Label>
                        <Select
                          value={playbook.toneOverride ?? "friendly"}
                          onValueChange={(val) => handleUpdateField(playbook.id, "toneOverride", val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="friendly">Acolhedor & Empático (Recomendado)</SelectItem>
                            <SelectItem value="consultative">Consultivo & Comercial</SelectItem>
                            <SelectItem value="professional">Profissional & Executivo</SelectItem>
                            <SelectItem value="direct">Direto & Objetivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Resposta Recomendada da IA</Label>
                        <span className="text-[10px] text-muted-foreground">Clique nas variáveis abaixo para inserir</span>
                      </div>
                      <Textarea
                        value={playbook.recommendedResponse}
                        onChange={(e) => handleUpdateField(playbook.id, "recommendedResponse", e.target.value)}
                        rows={3}
                        className="text-xs bg-background leading-relaxed font-sans"
                      />
                    </div>

                    {/* VARIABLE CHIPS */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground">Variáveis Dinâmicas Disponíveis:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_VARIABLES.map((v) => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => handleInsertVariable(playbook.id, v.tag)}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[10px] font-mono hover:bg-muted transition-colors text-primary"
                            title={`Exemplo: ${v.example}`}
                          >
                            <Plus className="size-2.5" />
                            {v.tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Gatilho / Condição de Ativação</Label>
                        <Input
                          value={playbook.triggerCondition}
                          onChange={(e) => handleUpdateField(playbook.id, "triggerCondition", e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Palavras-chave Relacionadas (separadas por vírgula)</Label>
                        <Input
                          value={playbook.keywords.join(", ")}
                          onChange={(e) =>
                            handleUpdateField(
                              playbook.id,
                              "keywords",
                              e.target.value.split(",").map((k) => k.trim()).filter(Boolean)
                            )
                          }
                          className="h-8 text-xs bg-background"
                          placeholder="preço, cotação, tabela, quanto custa"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CREATE NEW SITUATION DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Criar Nova Situação de Atendimento</DialogTitle>
            <DialogDescription className="text-xs">
              Adicione um novo roteiro para orientar como a assistente de IA deve reagir a um cenário comercial específico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título da Situação</Label>
              <Input
                placeholder="Ex: Dúvida sobre carência em parto"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={newCategory} onValueChange={(val: any) => setNewCategory(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_contact">Primeiro Contato</SelectItem>
                    <SelectItem value="inquiry">Dúvidas & Preços</SelectItem>
                    <SelectItem value="objection">Objeções</SelectItem>
                    <SelectItem value="followup">Reengajamento</SelectItem>
                    <SelectItem value="handoff">Handoff Humano</SelectItem>
                    <SelectItem value="timing">Horários</SelectItem>
                    <SelectItem value="custom">Customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Gatilho</Label>
                <Input
                  placeholder="Ex: Quando perguntar sobre carência"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Exemplo de Mensagem do Cliente</Label>
              <Input
                placeholder="Ex: O plano cobre parto imediato?"
                value={newExampleInput}
                onChange={(e) => setNewExampleInput(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resposta Polida Recomendada</Label>
              <Textarea
                placeholder="Ex: Para parto a carência padrão da ANS é de 300 dias, mas temos opções com redução de carência por compra de carência anterior! Quantas semanas você está?"
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Palavras-chave (separadas por vírgula)</Label>
              <Input
                placeholder="carencia, parto, gravida, gestante"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateNew} className="font-semibold">
              Criar Situação
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

    </div>
  );
}
