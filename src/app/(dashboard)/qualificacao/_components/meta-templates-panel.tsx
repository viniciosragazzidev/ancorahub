"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Search,
  Check,
  Plus,
  Trash2,
  Zap,
  SlidersHorizontal,
  Edit,
  Copy,
  Clock,
  MessageSquare,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchMetaTemplatesAction,
  syncMetaTemplatesAction,
  setDefaultMetaTemplateAction,
  deleteMetaTemplateAction,
  setMetaTemplateSituationsAction,
  recreateMetaTemplateAction,
  fetchFreeMessageTemplatesAction,
  saveFreeMessageTemplateAction,
  deleteFreeMessageTemplateAction,
} from "@/features/ai-qualification/actions";
import { UploadCloud } from "lucide-react";

export const CRM_SITUATIONS = [
  {
    key: "FIRST_CONTACT",
    label: "Primeiro Atendimento",
    description: "Mensagem inicial disparada automaticamente para iniciar a qualificação do lead.",
    badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    key: "LEAD_ACCEPTED",
    label: "Lead Aceito",
    description: "Mensagem de boas-vindas disparada quando o corretor aceita o lead no CRM.",
    badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    key: "FOLLOW_UP",
    label: "Lembrete / Follow-up",
    description: "Mensagem de retomada enviada quando o lead fica sem responder.",
    badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  {
    key: "REENGAGEMENT",
    label: "Re-engajamento",
    description: "Mensagem de reativação para resgatar leads inativos ou antigos.",
    badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    key: "OUT_OF_HOURS",
    label: "Fora do Horário",
    description: "Resposta automática quando o lead entra em contato fora do expediente comercial.",
    badgeColor: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  {
    key: "QUOTE_READY",
    label: "Proposta Concluída",
    description: "Mensagem enviada com o resumo e link da cotação/tabela calculada.",
    badgeColor: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  },
] as const;

type MetaTemplateItem = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  componentsJson?: unknown;
  buttonsJson?: unknown;
  syncedAt?: Date | string | null;
  isDefault?: boolean;
  assignedSituations?: string[];
};

type RecreateButton = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
};

function getTemplateButtons(template: MetaTemplateItem | null): RecreateButton[] | undefined {
  if (!template) return undefined;
  const directButtons = Array.isArray(template.buttonsJson) ? template.buttonsJson : null;
  const componentButtons = Array.isArray(template.componentsJson)
    ? template.componentsJson.find(
        (component): component is { type?: unknown; buttons?: unknown } =>
          typeof component === "object" && component !== null && "type" in component &&
          String(component.type).toUpperCase() === "BUTTONS",
      )?.buttons
    : null;
  const source = directButtons ?? componentButtons;
  if (!Array.isArray(source)) return undefined;

  const supportedTypes = new Set<RecreateButton["type"]>(["QUICK_REPLY", "URL", "PHONE_NUMBER"]);
  const buttons = source.flatMap((button): RecreateButton[] => {
    if (typeof button !== "object" || button === null) return [];
    const record = button as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type.toUpperCase() : "";
    const text = typeof record.text === "string" ? record.text : "";
    if (!supportedTypes.has(type as RecreateButton["type"]) || !text) return [];
    return [{
      type: type as RecreateButton["type"],
      text,
      ...(typeof record.url === "string" ? { url: record.url } : {}),
      ...(typeof record.phone_number === "string" ? { phone_number: record.phone_number } : {}),
    }];
  });
  return buttons.length > 0 ? buttons : undefined;
}

type FreeTemplateItem = {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: any;
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export function MetaTemplatesPanel() {
  const [subTab, setSubTab] = useState<"meta" | "free">("meta");

  // State for Meta Templates
  const [templates, setTemplates] = useState<MetaTemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);

  // Situation binding modal
  const [bindingTemplate, setBindingTemplate] = useState<MetaTemplateItem | null>(null);
  const [selectedSituations, setSelectedSituations] = useState<string[]>([]);
  const [savingSituations, setSavingSituations] = useState<boolean>(false);

  // State for Free Templates (Janela 24h)
  const [freeTemplates, setFreeTemplates] = useState<FreeTemplateItem[]>([]);
  const [loadingFree, setLoadingFree] = useState<boolean>(false);
  const [searchQueryFree, setSearchQueryFree] = useState<string>("");
  const [freeModalOpen, setFreeModalOpen] = useState<boolean>(false);
  const [editingFreeTemplate, setEditingFreeTemplate] = useState<FreeTemplateItem | null>(null);
  const [savingFree, setSavingFree] = useState<boolean>(false);

  // Free template form state
  const [freeName, setFreeName] = useState("");
  const [freeCategory, setFreeCategory] = useState("Primeiro Atendimento");
  const [freeContent, setFreeContent] = useState("");

  // Recreate & Edit Meta Template State
  const [recreateModalOpen, setRecreateModalOpen] = useState<boolean>(false);
  const [recreatingTemplate, setRecreatingTemplate] = useState<MetaTemplateItem | null>(null);
  const [recreateName, setRecreateName] = useState<string>("");
  const [recreateLanguage, setRecreateLanguage] = useState<string>("pt_BR");
  const [recreateCategory, setRecreateCategory] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [recreateBodyText, setRecreateBodyText] = useState<string>("");
  const [recreateHeaderText, setRecreateHeaderText] = useState<string>("");
  const [recreateFooterText, setRecreateFooterText] = useState<string>("");
  const [submittingRecreate, setSubmittingRecreate] = useState<boolean>(false);

  function handleOpenRecreateModal(item?: MetaTemplateItem) {
    if (item) {
      setRecreatingTemplate(item);
      setRecreateName(item.name || "");
      setRecreateLanguage(item.language === "en" ? "pt_BR" : (item.language || "pt_BR"));
      setRecreateCategory((item.category as "MARKETING" | "UTILITY") || "MARKETING");
      setRecreateBodyText(item.bodyText || "");
      setRecreateHeaderText(item.headerText || "");
      setRecreateFooterText(item.footerText || "");
    } else {
      setRecreatingTemplate(null);
      setRecreateName("lead_first_contact");
      setRecreateLanguage("pt_BR");
      setRecreateCategory("MARKETING");
      setRecreateBodyText("Olá {{nome}}! Me chamo {{nome_bot}} da Âncora Saúde. Como podemos te ajudar com a sua cotação hoje?");
      setRecreateHeaderText("");
      setRecreateFooterText("");
    }
    setRecreateModalOpen(true);
  }

  async function handleExecuteRecreate() {
    const formattedName = recreateName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!formattedName) {
      toast.error("Informe um nome válido para o modelo (apenas letras minúsculas e sublinhados).");
      return;
    }
    if (!recreateBodyText.trim()) {
      toast.error("O corpo da mensagem é obrigatório.");
      return;
    }

    setSubmittingRecreate(true);
    try {
      const result = await recreateMetaTemplateAction({
        templateId: recreatingTemplate?.id,
        name: formattedName,
        language: recreateLanguage,
        category: recreateCategory,
        headerType: recreateHeaderText.trim() ? "TEXT" : "NONE",
        headerText: recreateHeaderText.trim() || undefined,
        bodyText: recreateBodyText.trim(),
        footerText: recreateFooterText.trim() || undefined,
        buttons: getTemplateButtons(recreatingTemplate),
      });

      if (!result.success) {
        toast.error(result.error || "Erro ao enviar modelo para a Meta.");
        return;
      }

      toast.success(
        result.synced === false
          ? `Modelo "${formattedName}" enviado à Meta. A sincronização local será tentada novamente ao atualizar a lista.`
          : `Modelo "${formattedName}" enviado com sucesso para a Meta! A nova empresa já registrou o modelo.`,
      );
      setRecreateModalOpen(false);
      await loadTemplates();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar modelo para a Meta.";
      toast.error(msg);
    } finally {
      setSubmittingRecreate(false);
    }
  }

  function handleInsertRecreateVariable(variable: string) {
    setRecreateBodyText((prev) => `${prev} {{${variable}}}`);
  }

  useEffect(() => {
    loadTemplates();
    loadFreeTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await fetchMetaTemplatesAction();
      setTemplates(data as MetaTemplateItem[]);
    } catch (err) {
      console.error("Erro ao carregar modelos Meta:", err);
      toast.error("Não foi possível carregar os modelos Meta.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFreeTemplates() {
    setLoadingFree(true);
    try {
      const data = await fetchFreeMessageTemplatesAction();
      setFreeTemplates(data as FreeTemplateItem[]);
    } catch (err) {
      console.error("Erro ao carregar modelos livres:", err);
      toast.error("Não foi possível carregar os modelos livres de 24h.");
    } finally {
      setLoadingFree(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncMetaTemplatesAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.syncedCount} modelo(s) sincronizado(s) com a Meta.`);
      await loadTemplates();
    } catch (err) {
      toast.error("Erro ao sincronizar com a Meta API.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(item: MetaTemplateItem) {
    if (!confirm(`Deseja realmente remover o modelo "${item.name}" da lista?`)) return;
    try {
      await deleteMetaTemplateAction(item.id);
      toast.success(`Modelo "${item.name}" removido com sucesso!`);
      await loadTemplates();
    } catch (err) {
      toast.error("Erro ao remover modelo.");
    }
  }

  function handleOpenSituationModal(item: MetaTemplateItem) {
    setBindingTemplate(item);
    setSelectedSituations(item.assignedSituations || (item.isDefault ? ["FIRST_CONTACT"] : []));
  }

  async function handleSaveSituations() {
    if (!bindingTemplate) return;
    setSavingSituations(true);
    try {
      await setMetaTemplateSituationsAction(bindingTemplate.id, selectedSituations);
      toast.success(`Situações de uso do modelo "${bindingTemplate.name}" atualizadas!`);
      setBindingTemplate(null);
      await loadTemplates();
    } catch (err) {
      toast.error("Erro ao salvar situações de uso do modelo.");
    } finally {
      setSavingSituations(false);
    }
  }

  function toggleSituationKey(key: string) {
    setSelectedSituations((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Free Template handlers
  function handleOpenNewFreeModal() {
    setEditingFreeTemplate(null);
    setFreeName("");
    setFreeCategory("Primeiro Atendimento");
    setFreeContent(
      "Olá {{nome}}! Me chamo {{nome_bot}} da Âncora Saúde. Como posso ajudar com a cotação do seu plano hoje?"
    );
    setFreeModalOpen(true);
  }

  function handleOpenEditFreeModal(item: FreeTemplateItem) {
    setEditingFreeTemplate(item);
    setFreeName(item.name);
    setFreeCategory(item.category || "geral");
    setFreeContent(item.content);
    setFreeModalOpen(true);
  }

  async function handleSaveFreeTemplate() {
    if (!freeName.trim()) {
      toast.error("Informe o nome do modelo.");
      return;
    }
    if (!freeContent.trim()) {
      toast.error("Informe o conteúdo da mensagem.");
      return;
    }
    setSavingFree(true);
    try {
      await saveFreeMessageTemplateAction({
        id: editingFreeTemplate?.id,
        name: freeName,
        category: freeCategory,
        content: freeContent,
      });
      toast.success(
        editingFreeTemplate
          ? `Modelo livre "${freeName}" atualizado!`
          : `Modelo livre "${freeName}" criado com sucesso!`
      );
      setFreeModalOpen(false);
      await loadFreeTemplates();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar modelo livre.";
      toast.error(msg);
    } finally {
      setSavingFree(false);
    }
  }

  async function handleDeleteFreeTemplate(item: FreeTemplateItem) {
    if (!confirm(`Deseja realmente remover o modelo livre "${item.name}"?`)) return;
    try {
      await deleteFreeMessageTemplateAction(item.id);
      toast.success(`Modelo livre "${item.name}" removido com sucesso!`);
      await loadFreeTemplates();
    } catch (err) {
      toast.error("Erro ao remover modelo livre.");
    }
  }

  function handleCopyContent(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Conteúdo do modelo copiado!");
  }

  function handleInsertVariable(variable: string) {
    setFreeContent((prev) => `${prev} {{${variable}}}`);
  }

  const filteredMeta = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.bodyText && t.bodyText.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFree = freeTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQueryFree.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQueryFree.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQueryFree.toLowerCase())
  );

  return (
    <div className="grid gap-6">
      {/* Navigation Switcher: Meta Templates vs Modelos Livres 24h */}
      <div className="flex items-center justify-between border-b pb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={subTab === "meta" ? "default" : "outline"}
            onClick={() => setSubTab("meta")}
            className="h-10 gap-2 text-xs font-semibold"
          >
            <ShieldCheck className="size-4" />
            Modelos Meta (Aprovados)
            <Badge variant="secondary" className="ml-1 text-[10px] bg-background/20 font-mono">
              {templates.length}
            </Badge>
          </Button>

          <Button
            variant={subTab === "free" ? "default" : "outline"}
            onClick={() => setSubTab("free")}
            className="h-10 gap-2 text-xs font-semibold"
          >
            <Zap className="size-4 text-amber-500 fill-amber-500/20" />
            Modelos Livres (Janela de 24h)
            <Badge variant="secondary" className="ml-1 text-[10px] bg-background/20 font-mono">
              {freeTemplates.length}
            </Badge>
          </Button>
        </div>

        {subTab === "meta" ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-9 gap-2 text-xs"
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar com Meta"}
            </Button>
            <Button size="sm" onClick={() => handleOpenRecreateModal()} className="h-9 gap-2 text-xs">
              <Plus className="size-3.5" />
              Novo Modelo Meta
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleOpenNewFreeModal} className="h-9 gap-2 text-xs bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="size-3.5" />
            Novo Modelo Livre
          </Button>
        )}
      </div>

      {/* ─── ABA 1: MODELOS META ─── */}
      {subTab === "meta" && (
        <div className="space-y-6">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  Modelos de Mensagem Meta (WhatsApp Templates)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Clique em "Editar & Recriar" para enviar um modelo diretamente para a nova empresa/WABA na Meta, ou em "Situações" para vincular aos eventos automáticos do CRM.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou conteúdo do modelo Meta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-2">
              <RefreshCw className="size-4 animate-spin text-primary" />
              Carregando modelos de mensagem Meta...
            </div>
          ) : filteredMeta.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <FileText className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Nenhum modelo Meta encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Sincronizar com Meta" para importar os modelos aprovados da sua conta WABA.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMeta.map((item) => {
                const assigned = item.assignedSituations || (item.isDefault ? ["FIRST_CONTACT"] : []);
                return (
                  <Card
                    key={item.id}
                    className={`relative transition-all border cursor-pointer hover:border-primary/50 ${
                      assigned.length > 0 ? "border-primary/40 shadow-sm bg-primary/[0.01]" : "hover:border-border/80"
                    }`}
                    onClick={() => handleOpenSituationModal(item)}
                  >
                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                      <div className="grid gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm tracking-tight">{item.name}</span>
                          <Badge
                            variant={item.status === "APPROVED" ? "default" : "secondary"}
                            className={`text-[10px] ${
                              item.status === "APPROVED"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {item.status === "APPROVED" ? "APROVADO" : item.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Portuguese (BR) ({item.language})</span>
                          <span>•</span>
                          <span>{item.category || "MARKETING"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRecreateModal(item);
                          }}
                          className="h-8 text-xs text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 gap-1.5 px-2.5 font-semibold"
                        >
                          <UploadCloud className="size-3.5" />
                          Editar & Recriar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSituationModal(item);
                          }}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                        >
                          <SlidersHorizontal className="size-3.5" />
                          Situações
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs">
                      {/* Situations Assigned Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-muted-foreground">Uso em:</span>
                        {assigned.length === 0 ? (
                          <Badge variant="outline" className="text-[10px] border-dashed text-muted-foreground font-normal">
                            Sem situação vinculada (Clique para configurar)
                          </Badge>
                        ) : (
                          assigned.map((key) => {
                            const sit = CRM_SITUATIONS.find((s) => s.key === key);
                            return (
                              <Badge key={key} className={`text-[10px] font-semibold gap-1 ${sit?.badgeColor || "bg-muted text-foreground"}`}>
                                <Check className="size-3" />
                                {sit?.label || key}
                              </Badge>
                            );
                          })
                        )}
                      </div>

                      {/* Body Text Box */}
                      <div className="rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                        {item.bodyText || "Conteúdo do modelo sem prévia disponível."}
                      </div>

                      {/* Footer actions */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">Variáveis:</span>
                          <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">
                            {"{{nome}}"}
                          </code>
                          <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">
                            {"{{nome_bot}}"}
                          </code>
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item)}
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                          >
                            <Trash2 className="size-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── ABA 2: MODELOS LIVRES (JANELA DE 24 HORAS) ─── */}
      {subTab === "free" && (
        <div className="space-y-6">
          <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-background to-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Zap className="size-5 text-amber-500 fill-amber-500/20" />
                  Modelos de Mensagem Livres (Janela de 24 Horas)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Crie e gerencie modelos de mensagem sem necessidade de aprovação da Meta. Estes modelos podem ser editados livremente e usados para envio rápido durante a janela ativa de 24 horas do cliente.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar modelos livres por nome, categoria ou texto..."
                  value={searchQueryFree}
                  onChange={(e) => setSearchQueryFree(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {loadingFree ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-2">
              <RefreshCw className="size-4 animate-spin text-amber-500" />
              Carregando modelos de mensagem livres...
            </div>
          ) : filteredFree.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <MessageSquare className="size-8 text-amber-500/50 mx-auto mb-2" />
              <p className="text-sm font-semibold">Nenhum modelo livre cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Crie modelos de mensagem para disparo rápido dentro da janela de 24h sem depender de aprovação da Meta.
              </p>
              <Button size="sm" onClick={handleOpenNewFreeModal} className="gap-2 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="size-3.5" />
                Criar Primeiros Modelos Livres
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFree.map((item) => (
                <Card key={item.id} className="relative border transition-all hover:border-amber-500/40">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm tracking-tight">{item.name}</span>
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-semibold">
                          <Zap className="size-3 fill-current" />
                          Janela 24h (Sem Aprovação)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Categoria/Situação:</span>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {item.category || "Geral"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyContent(item.content)}
                        title="Copiar texto"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditFreeModal(item)}
                        className="h-8 text-xs text-primary gap-1 px-2"
                      >
                        <Edit className="size-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFreeTemplate(item)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1 px-2"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs">
                    {/* Content Box */}
                    <div className="rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {item.content}
                    </div>

                    {/* Detected Variables */}
                    {Array.isArray(item.variables) && item.variables.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Variáveis detectadas:</span>
                        {item.variables.map((v: string) => (
                          <code key={v} className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-amber-600 dark:text-amber-400">
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: VÍNCULO DE SITUAÇÃO DE MODELO META ─── */}
      <Dialog open={Boolean(bindingTemplate)} onOpenChange={(open) => !open && setBindingTemplate(null)}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <SlidersHorizontal className="size-5 text-primary" />
              Configurar Situações de Uso
            </DialogTitle>
            <DialogDescription className="text-xs">
              Escolha em quais situações do CRM o modelo Meta <strong className="font-mono text-foreground">{bindingTemplate?.name}</strong> será utilizado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-md border bg-muted/30 p-2.5 font-mono text-[11px] leading-snug line-clamp-3 text-muted-foreground">
              "{bindingTemplate?.bodyText}"
            </div>

            <Label className="text-xs font-semibold block pt-1">Selecione as Situações de Uso:</Label>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {CRM_SITUATIONS.map((sit) => {
                const checked = selectedSituations.includes(sit.key);
                return (
                  <div
                    key={sit.key}
                    onClick={() => toggleSituationKey(sit.key)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      checked ? "border-primary bg-primary/5" : "hover:border-border/80 bg-background"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSituationKey(sit.key)}
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{sit.label}</span>
                        <code className="text-[10px] text-muted-foreground font-mono">({sit.key})</code>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{sit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const target = bindingTemplate;
                setBindingTemplate(null);
                if (target) handleOpenRecreateModal(target);
              }}
              className="text-xs gap-1.5 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 mr-auto"
            >
              <UploadCloud className="size-3.5" />
              Editar & Recriar na Meta
            </Button>
            <div className="flex items-center gap-2">
              <DialogClose render={<Button variant="ghost" size="sm">Cancelar</Button>} />
              <Button
                size="sm"
                onClick={handleSaveSituations}
                disabled={savingSituations}
                className="gap-2"
              >
                {savingSituations && <RefreshCw className="size-3.5 animate-spin" />}
                Salvar Situações
              </Button>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* ─── MODAL: NOVO / EDITAR MODELO LIVRE (JANELA 24H) ─── */}
      <Dialog open={freeModalOpen} onOpenChange={setFreeModalOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Zap className="size-5 text-amber-500 fill-amber-500/20" />
              {editingFreeTemplate ? "Editar Modelo Livre" : "Novo Modelo Livre (Janela de 24h)"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre um modelo de mensagem sem aprovação Meta para disparo livre durante a janela de 24 horas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-xs">
            <div className="grid gap-1.5">
              <Label htmlFor="free-name" className="text-xs font-semibold">Nome do Modelo</Label>
              <Input
                id="free-name"
                value={freeName}
                onChange={(e) => setFreeName(e.target.value)}
                placeholder="ex.: Apresentação Inicial de Tabela"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="free-category" className="text-xs font-semibold">Categoria / Situação Comercial</Label>
              <Input
                id="free-category"
                value={freeCategory}
                onChange={(e) => setFreeCategory(e.target.value)}
                placeholder="ex.: Primeiro Atendimento, Lead Aceito, Follow-up, Geral"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="free-content" className="text-xs font-semibold">Conteúdo da Mensagem</Label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">⚡ Sem Aprovação Meta</span>
              </div>
              <textarea
                id="free-content"
                rows={5}
                value={freeContent}
                onChange={(e) => setFreeContent(e.target.value)}
                placeholder="Digite o texto da mensagem..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            {/* Quick Insertion Chips for Variables */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-amber-500" />
                Inserir Variáveis Dinâmicas:
              </Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["nome", "nome_bot", "empresa", "plano", "cidade", "telefone"].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable(v)}
                    className="h-6 text-[10px] font-mono gap-1 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  >
                    + {`{{${v}}}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="ghost" size="sm">Cancelar</Button>} />
            <Button
              size="sm"
              onClick={handleSaveFreeTemplate}
              disabled={savingFree}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {savingFree && <RefreshCw className="size-3.5 animate-spin" />}
              {editingFreeTemplate ? "Salvar Alterações" : "Criar Modelo Livre"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* ─── MODAL: EDITAR & RECRIAR MODELO NA META ─── */}
      <Dialog open={recreateModalOpen} onOpenChange={setRecreateModalOpen}>
        <DialogPopup className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <UploadCloud className="size-5 text-primary" />
              {recreatingTemplate ? "Editar & Recriar Modelo na Meta" : "Novo Modelo de Mensagem Meta"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Este modelo será enviado e registrado diretamente na <strong>conta WhatsApp (WABA) atualmente conectada na Meta</strong>. Assim que aprovado pela Meta, o CRM o utilizará automaticamente nos disparos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-xs">
            {/* Template Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rec-name" className="text-xs font-semibold">Nome do Modelo (na Meta)</Label>
                <Input
                  id="rec-name"
                  value={recreateName}
                  onChange={(e) => setRecreateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="ex.: lead_first_contact"
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Apenas letras minúsculas e sublinhados (_).</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="rec-lang" className="text-xs font-semibold">Idioma</Label>
                  <select
                    id="rec-lang"
                    value={recreateLanguage}
                    onChange={(e) => setRecreateLanguage(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="pt_BR">Português (BR) - pt_BR</option>
                    <option value="en">Inglês - en</option>
                    <option value="es">Espanhol - es</option>
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="rec-cat" className="text-xs font-semibold">Categoria</Label>
                  <select
                    id="rec-cat"
                    value={recreateCategory}
                    onChange={(e) => setRecreateCategory(e.target.value as "MARKETING" | "UTILITY")}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITY (Serviço)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Header Text (Optional) */}
            <div className="grid gap-1.5">
              <Label htmlFor="rec-header" className="text-xs font-semibold flex items-center justify-between">
                <span>Cabeçalho (Opcional)</span>
                <span className="text-[10px] text-muted-foreground">Texto em negrito no topo da mensagem</span>
              </Label>
              <Input
                id="rec-header"
                value={recreateHeaderText}
                onChange={(e) => setRecreateHeaderText(e.target.value)}
                placeholder="ex.: Âncora Saúde ou Lead Atribuído!"
                className="h-9 text-xs"
              />
            </div>

            {/* Body Text (Required) */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="rec-body" className="text-xs font-semibold">Corpo da Mensagem (Body)</Label>
                <span className="text-[10px] text-primary font-medium">Obrigatório</span>
              </div>
              <textarea
                id="rec-body"
                rows={5}
                value={recreateBodyText}
                onChange={(e) => setRecreateBodyText(e.target.value)}
                placeholder="Digite o texto da mensagem. Use {{nome}}, {{corretor_nome}}, {{empresa}} etc..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Quick Insertion Chips for Variables */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-primary" />
                Variáveis Dinâmicas Rápidas (Clique para inserir no texto):
              </Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  "nome",
                  "nome_bot",
                  "empresa",
                  "corretor_nome",
                  "cargo",
                  "lead_nome",
                  "produto_interesse",
                  "telefone_cliente",
                  "interesse",
                  "tipo",
                  "n_dependentes",
                ].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertRecreateVariable(v)}
                    className="h-6 text-[10px] font-mono gap-1 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
                  >
                    + {`{{${v}}}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Footer Text (Optional) */}
            <div className="grid gap-1.5">
              <Label htmlFor="rec-footer" className="text-xs font-semibold flex items-center justify-between">
                <span>Rodapé (Opcional)</span>
                <span className="text-[10px] text-muted-foreground">Texto em cinza discreto no fim</span>
              </Label>
              <Input
                id="rec-footer"
                value={recreateFooterText}
                onChange={(e) => setRecreateFooterText(e.target.value)}
                placeholder="ex.: Responda PARAR para sair."
                className="h-9 text-xs"
              />
            </div>

            {/* Live Preview Card */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <MessageSquare className="size-3 text-primary" />
                Prévia da Mensagem no WhatsApp:
              </span>
              <div className="rounded-lg border bg-background p-3 shadow-sm max-w-md font-sans text-xs space-y-1.5 text-foreground">
                {recreateHeaderText && <p className="font-bold text-xs text-foreground">{recreateHeaderText}</p>}
                <p className="whitespace-pre-wrap leading-relaxed text-xs text-foreground/90 font-mono">
                  {recreateBodyText || "O texto do modelo aparecerá aqui..."}
                </p>
                {recreateFooterText && <p className="text-[10px] text-muted-foreground italic">{recreateFooterText}</p>}
              </div>
            </div>
            {getTemplateButtons(recreatingTemplate) ? (
              <p className="text-[11px] text-muted-foreground">
                {getTemplateButtons(recreatingTemplate)?.length} botão(ões) do modelo original serão preservados ao recriar.
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="ghost" size="sm">Cancelar</Button>} />
            <Button
              size="sm"
              onClick={handleExecuteRecreate}
              disabled={submittingRecreate}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {submittingRecreate ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Enviando para a Meta...
                </>
              ) : (
                <>
                  <UploadCloud className="size-3.5" />
                  Recriar e Enviar para a Meta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
