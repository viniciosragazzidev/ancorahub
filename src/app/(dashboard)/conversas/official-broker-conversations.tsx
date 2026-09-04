"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ContextNote } from "@/components/ui/context-note";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Buildings,
  ChatCircleText,
  InfoIcon,
  MagnifyingGlass,
  ShieldCheck,
  WhatsappLogo,
} from "@/components/huge-icons";
import { FileText, Send, Sparkles, Users, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  sendBrokerTemplateAction,
  sendBrokerDirectMessageAction,
} from "@/features/broker-workspace/broker-template-actions";
import {
  fetchMetaTemplatesAction,
  fetchFreeMessageTemplatesAction,
} from "@/features/ai-qualification/actions";

export type OfficialBrokerMessage = {
  id: string;
  direction: "incoming" | "outgoing";
  body: string;
  sentAt: string;
  status: "pending" | "queued" | "sent" | "delivered" | "read" | "failed" | "received";
  purpose?: string;
  templateName?: string;
  attempts?: number;
  error?: string | null;
};

export type OfficialBrokerConversation = {
  brokerProfileId: string;
  name: string;
  phoneMasked: string;
  phoneRaw?: string;
  branchName: string | null;
  invitationStatus: string | null;
  invitationDeliveryStatus: string | null;
  messages: OfficialBrokerMessage[];
};

type TemplateOption = {
  id: string;
  name: string;
  category: string;
  content: string;
  type: "meta" | "free";
};

const deliveryLabels: Record<OfficialBrokerMessage["status"], string> = {
  pending: "Pendente",
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  received: "Recebida",
};

const invitationLabels: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" | "secondary" }> = {
  PENDING: { label: "Convite pendente", variant: "warning" },
  ACCEPTED: { label: "Convite aceito", variant: "success" },
  EXPIRED: { label: "Convite expirado", variant: "outline" },
  REVOKED: { label: "Convite revogado", variant: "destructive" },
  REPLACED: { label: "Substituído", variant: "secondary" },
};

export function OfficialBrokerConversations({
  enabled,
  deliveryChannel,
  conversations,
}: {
  enabled: boolean;
  /** The outbound transport for internal system-to-broker notices. */
  deliveryChannel: "meta" | "waha_direct";
  conversations: OfficialBrokerConversation[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.brokerProfileId ?? null
  );

  // Input individual chat
  const [directMessageText, setDirectMessageText] = useState("");
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  // Dialogs State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSingleTemplateModal, setShowSingleTemplateModal] = useState(false);

  // Template Options
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Bulk Target Selection
  const [selectedBrokerIds, setSelectedBrokerIds] = useState<string[]>([]);
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // Carregar templates do banco
  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const [metaRes, freeRes] = await Promise.all([
        fetchMetaTemplatesAction().catch(() => []),
        fetchFreeMessageTemplatesAction().catch(() => []),
      ]);

      const formattedMeta: TemplateOption[] = (metaRes || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category || "Oficial Meta",
        content: t.components?.find((c: any) => c.type === "BODY")?.text || `[Modelo Meta: ${t.name}]`,
        type: "meta",
      }));

      const formattedFree: TemplateOption[] = (freeRes || []).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category || "Livre 24h",
        content: t.content,
        type: "free",
      }));

      const combined = [...formattedFree, ...formattedMeta];
      setTemplates(combined);
      if (combined.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(combined[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar templates:", err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = useMemo(() => {
    const list = conversations.filter((conversation) => {
      const matchesSearch =
        !normalized ||
        [conversation.name, conversation.branchName ?? "", conversation.phoneMasked].some((val) =>
          val.toLocaleLowerCase("pt-BR").includes(normalized)
        );

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACCEPTED"
            ? conversation.invitationStatus === "ACCEPTED"
            : statusFilter === "PENDING"
              ? conversation.invitationStatus === "PENDING"
              : true;

      return matchesSearch && matchesStatus;
    });

    return list.sort((a, b) => {
      const lastA = a.messages.at(-1)?.sentAt;
      const lastB = b.messages.at(-1)?.sentAt;
      const timeA = lastA ? new Date(lastA).getTime() : 0;
      const timeB = lastB ? new Date(lastB).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [conversations, normalized, statusFilter]);

  const selected =
    filtered.find((item) => item.brokerProfileId === selectedId) ?? filtered[0] ?? null;

  // Selecionar todos os visíveis no disparo em massa
  const handleOpenBulkModal = () => {
    setSelectedBrokerIds(filtered.map((c) => c.brokerProfileId));
    setShowBulkModal(true);
  };

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Envio Direto de Mensagem Texto para 1 corretor
  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !directMessageText.trim()) return;
    setIsSendingDirect(true);
    try {
      const res = await sendBrokerDirectMessageAction({
        brokerProfileId: selected.brokerProfileId,
        body: directMessageText,
      });
      if (res.success) {
        toast.success(`Mensagem enviada para ${selected.name}`);
        setDirectMessageText("");
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao enviar mensagem.");
      }
    } catch (err) {
      toast.error("Erro inesperado ao enviar mensagem.");
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Envio de Template Individual para o corretor selecionado
  const handleSendSingleTemplate = async () => {
    if (!selected || !activeTemplate) return;
    setIsSendingDirect(true);
    try {
      const res = await sendBrokerTemplateAction({
        brokerProfileIds: [selected.brokerProfileId],
        templateType: activeTemplate.type,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        content: activeTemplate.content,
      });

      if (res.success) {
        toast.success(`Modelo enviado com sucesso para ${selected.name}!`);
        setShowSingleTemplateModal(false);
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao enviar modelo.");
      }
    } catch (err) {
      toast.error("Falha ao enviar modelo de mensagem.");
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Envio em Massa de Template para Múltiplos Corretores
  const handleSendBulkTemplate = async () => {
    if (!selectedBrokerIds.length || !activeTemplate) {
      toast.error("Selecione ao menos um corretor e um modelo de mensagem.");
      return;
    }
    setIsSendingBulk(true);
    try {
      const res = await sendBrokerTemplateAction({
        brokerProfileIds: selectedBrokerIds,
        templateType: activeTemplate.type,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        content: activeTemplate.content,
      });

      if (res.success) {
        toast.success(res.message);
        setShowBulkModal(false);
        router.refresh();
      } else {
        toast.error(res.error || "Erro no disparo em massa.");
      }
    } catch (err) {
      toast.error("Erro ao realizar disparo em massa.");
    } finally {
      setIsSendingBulk(false);
    }
  };

  if (!enabled) {
    return (
      <section className="flex min-h-[26rem] items-center justify-center rounded-xl border border-border bg-card p-6">
        <EmptyState
          icon={WhatsappLogo}
          title="Canal oficial desativado"
          description="O Super-admin desativou o canal Meta. Ative-o nas configurações para consultar as mensagens oficiais enviadas à equipe."
        />
      </section>
    );
  }

  return (
    <section
      aria-label="Central de mensagens oficiais com corretores"
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card"
    >
      {/* Header com Ações de Disparo */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <WhatsappLogo className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  {deliveryChannel === "waha_direct" ? "Canal Interno com Corretores" : "Canal Oficial com Corretores"}
                </h2>
                <Badge variant="secondary">{conversations.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {deliveryChannel === "waha_direct"
                  ? "Histórico centralizado no CRM; avisos internos são enviados pelo número WAHA selecionado."
                  : "Envio individual ou em massa de mensagens e modelos oficiais para a equipe."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenBulkModal}
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Zap className="size-3.5 fill-current" />
              Disparo em Massa
            </Button>
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
              <ShieldCheck className="size-3.5" /> {deliveryChannel === "waha_direct" ? "WAHA interno direto" : "Canal Oficial Meta"}
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.8fr)]">
        {/* Sidebar - Lista de Corretores */}
        <section
          aria-label="Corretores com histórico no canal oficial"
          className={cn(
            "flex min-h-0 flex-col border-r border-border bg-card",
            selected && "max-lg:hidden"
          )}
        >
          <div className="grid gap-2 border-b border-border p-3">
            <div className="relative">
              <MagnifyingGlass
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Buscar corretor ou unidade"
                className="h-8 pl-8 text-xs bg-muted/30"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar corretor ou unidade..."
                value={query}
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={statusFilter === "ALL" ? "default" : "ghost"}
                className="h-6 px-2 text-[11px] font-medium"
                onClick={() => setStatusFilter("ALL")}
              >
                Todos ({conversations.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "ACCEPTED" ? "default" : "ghost"}
                className="h-6 px-2 text-[11px] font-medium"
                onClick={() => setStatusFilter("ACCEPTED")}
              >
                Aceitos
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "PENDING" ? "default" : "ghost"}
                className="h-6 px-2 text-[11px] font-medium"
                onClick={() => setStatusFilter("PENDING")}
              >
                Pendentes
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2 space-y-1">
              {filtered.map((item) => {
                const last = item.messages.at(-1);
                const isSelected = selected?.brokerProfileId === item.brokerProfileId;
                const invConfig = item.invitationStatus
                  ? invitationLabels[item.invitationStatus]
                  : null;

                return (
                  <button
                    key={item.brokerProfileId}
                    type="button"
                    onClick={() => setSelectedId(item.brokerProfileId)}
                    className={cn(
                      "w-full rounded-lg p-3 text-left transition-all duration-150 relative",
                      isSelected
                        ? "bg-muted/90 shadow-xs border-l-2 border-primary pl-2.5"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={item.name}
                        seed={item.name}
                        size="sm"
                        className="shrink-0 mt-0.5"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-semibold text-foreground">
                            {item.name}
                          </span>
                          {last ? (
                            <time className="shrink-0 text-[10px] text-muted-foreground font-mono">
                              {formatTime(last.sentAt)}
                            </time>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          {invConfig ? (
                            <Badge
                              variant={invConfig.variant}
                              className="px-1.5 py-0 text-[9px] font-normal shrink-0"
                            >
                              {invConfig.label}
                            </Badge>
                          ) : null}
                          <span className="truncate text-[11px] text-muted-foreground">
                            {item.branchName ?? "Sem unidade"}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/90">
                          {last ? last.body : "Nenhuma mensagem registrada"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!filtered.length ? (
                <div className="px-3 py-12 text-center text-xs text-muted-foreground">
                  Nenhum corretor encontrado.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </section>

        {/* Chat Area - Conversa Selecionada */}
        <section
          aria-live="polite"
          className={cn(
            "flex min-h-0 flex-col bg-muted/10 dark:bg-muted/5",
            !selected && "max-lg:hidden"
          )}
        >
          {selected ? (
            <>
              {/* Header do Chat Selecionado */}
              <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-5">
                <div className="flex items-center gap-3 min-w-0">
                  <Button
                    aria-label="Voltar para a lista"
                    className="lg:hidden"
                    onClick={() => setSelectedId(null)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    ←
                  </Button>

                  <UserAvatar
                    name={selected.name}
                    seed={selected.name}
                    size="default"
                    className="shrink-0"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{selected.name}</h3>
                      {selected.invitationStatus ? (
                        <Badge
                          variant={
                            invitationLabels[selected.invitationStatus]?.variant ?? "outline"
                          }
                          className="text-[10px]"
                        >
                          {invitationLabels[selected.invitationStatus]?.label ??
                            selected.invitationStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{selected.phoneMasked}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Buildings className="size-3" />
                        {selected.branchName ?? "Sem unidade atribuída"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowSingleTemplateModal(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <FileText className="size-3.5 text-blue-500" />
                    Enviar Modelo
                  </Button>
                </div>
              </header>

              {/* Banner Informativo */}
              <div className="border-b border-border bg-card/50 px-4 py-2">
                <ContextNote variant="info" icon={InfoIcon} className="py-1.5 text-[11px]">
                  <span>
                    {deliveryChannel === "waha_direct"
                      ? "Canal interno de comunicação. O CRM preserva este histórico e envia os avisos pelo número WAHA selecionado."
                      : "Canal Oficial de Comunicação. Envie mensagens diretas ou escolha um modelo cadastrado no sistema."}
                  </span>
                </ContextNote>
              </div>

              {/* Lista de Mensagens do Chat */}
              <ScrollArea className="min-h-0 flex-1">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-6">
                  <Marker variant="separator" className="my-1">
                    <MarkerContent className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
                      Histórico Oficial de Comunicação
                    </MarkerContent>
                  </Marker>

                  {selected.messages.map((message) => (
                    <MessageBubble
                      brokerName={selected.name}
                      key={message.id}
                      message={message}
                    />
                  ))}

                  {!selected.messages.length ? (
                    <EmptyState
                      icon={ChatCircleText}
                      title="Nenhuma mensagem no histórico"
                      description={deliveryChannel === "waha_direct"
                        ? "As mensagens enviadas pelo número WAHA selecionado aparecerão neste espaço."
                        : "As mensagens enviadas pelo número oficial aparecerão neste espaço."}
                    />
                  ) : null}
                </div>
              </ScrollArea>

              {/* Input Footer para envio de mensagem rápida ao corretor */}
              <footer className="border-t border-border bg-card p-3 lg:px-4">
                <form onSubmit={handleSendDirectMessage} className="flex items-center gap-2">
                  <Input
                    value={directMessageText}
                    onChange={(e) => setDirectMessageText(e.target.value)}
                    placeholder={`Enviar mensagem no WhatsApp para ${selected.name}...`}
                    className="flex-1 text-xs"
                    disabled={isSendingDirect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSingleTemplateModal(true)}
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Escolher modelo pré-cadastrado"
                  >
                    <FileText className="size-4" />
                    <span className="hidden sm:inline">Modelos</span>
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSendingDirect || !directMessageText.trim()}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Send className="size-3.5" />
                    Enviar
                  </Button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={ChatCircleText}
                title="Selecione um corretor"
                description="Escolha um corretor da lista ao lado para enviar mensagens pelo canal oficial."
              />
            </div>
          )}
        </section>
      </div>

      {/* MODAL 1: Envio Individual de Template */}
      <Dialog open={showSingleTemplateModal} onOpenChange={setShowSingleTemplateModal}>
        <DialogPopup className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="size-5 text-blue-500" />
              Enviar Modelo para {selected?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Escolha um modelo de mensagem Meta ou Modelo Livre (janela 24h) para enviar diretamente a este corretor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Selecione o Modelo de Mensagem</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione um modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      {tpl.name} ({tpl.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTemplate && (
              <div className="space-y-1.5 rounded-lg border p-3 bg-muted/20">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Prévia com dados de {selected?.name}:</span>
                  <Badge variant={activeTemplate.type === "meta" ? "default" : "success"} className="text-[10px]">
                    {activeTemplate.type === "meta" ? "Modelo Meta (Aprovado)" : "Modelo Livre (Janela 24h)"}
                  </Badge>
                </div>
                <div className="rounded border bg-background p-3 text-xs font-mono whitespace-pre-wrap">
                  {activeTemplate.content
                    .replace(/\{\{\s*nome\s*\}\}/gi, selected?.name || "Corretor")
                    .replace(/\{\{\s*empresa\s*\}\}/gi, "Âncora Corretora")
                    .replace(/\{\{\s*telefone\s*\}\}/gi, selected?.phoneMasked || "")}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowSingleTemplateModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendSingleTemplate}
              disabled={isSendingDirect || !activeTemplate}
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="size-3.5" />
              {isSendingDirect ? "Enviando..." : "Confirmar e Enviar"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* MODAL 2: Disparo em Massa de Templates */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="size-5 text-emerald-500 fill-current" />
              Disparo de Mensagens em Massa para Corretores
            </DialogTitle>
            <DialogDescription className="text-xs">
              Envie um modelo pré-aprovado ou de envio livre para múltiplos corretores da equipe de uma só vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seleção de Template */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">1. Modelo de Mensagem a Disparar</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione um modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      {tpl.name} ({tpl.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prévia do Template */}
            {activeTemplate && (
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Prévia da Mensagem (exemplo com variáveisl):</span>
                  <Badge variant={activeTemplate.type === "meta" ? "default" : "success"} className="text-[10px]">
                    {activeTemplate.type === "meta" ? "Meta Aprovado" : "Livre 24h"}
                  </Badge>
                </div>
                <div className="rounded border bg-background p-2.5 text-xs font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                  {activeTemplate.content
                    .replace(/\{\{\s*nome\s*\}\}/gi, "Nome do Corretor")
                    .replace(/\{\{\s*empresa\s*\}\}/gi, "Âncora Corretora")}
                </div>
              </div>
            )}

            {/* Seleção de Corretores Destinatários */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  2. Selecione os Corretores ({selectedBrokerIds.length} selecionados)
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setSelectedBrokerIds(filtered.map((c) => c.brokerProfileId))}
                  >
                    Selecionar Todos ({filtered.length})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-muted-foreground"
                    onClick={() => setSelectedBrokerIds([])}
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1 bg-background">
                {filtered.map((b) => {
                  const isChecked = selectedBrokerIds.includes(b.brokerProfileId);
                  return (
                    <label
                      key={b.brokerProfileId}
                      className="flex items-center justify-between rounded p-2 text-xs hover:bg-muted/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBrokerIds((prev) => [...prev, b.brokerProfileId]);
                            } else {
                              setSelectedBrokerIds((prev) => prev.filter((id) => id !== b.brokerProfileId));
                            }
                          }}
                        />
                        <div>
                          <span className="font-semibold text-foreground">{b.name}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">({b.branchName ?? "Sem unidade"})</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {b.phoneMasked}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowBulkModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendBulkTemplate}
              disabled={isSendingBulk || !selectedBrokerIds.length || !activeTemplate}
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Zap className="size-3.5 fill-current" />
              {isSendingBulk
                ? "Disparando..."
                : `Disparar para ${selectedBrokerIds.length} Corretor(es)`}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}

function MessageBubble({
  message,
  brokerName,
}: {
  message: OfficialBrokerMessage;
  brokerName: string;
}) {
  const isOutgoing = message.direction === "outgoing";

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      {!isOutgoing ? (
        <UserAvatar name={brokerName} seed={brokerName} size="sm" className="mb-1 shrink-0" />
      ) : null}

      <div className={cn("flex max-w-[85%] sm:max-w-[75%] flex-col gap-1", isOutgoing && "items-end")}>
        <Bubble variant={isOutgoing ? "default" : "muted"}>
          <BubbleContent className="text-xs leading-relaxed whitespace-pre-wrap">
            {message.body}
          </BubbleContent>
        </Bubble>

        <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <time>{formatTime(message.sentAt)}</time>
          {isOutgoing && message.status ? (
            <>
              <span>•</span>
              <span className={cn(message.status === "failed" && "text-rose-500 font-semibold")}>
                {deliveryLabels[message.status] ?? message.status}
              </span>
            </>
          ) : null}
        </div>

        {message.error ? (
          <p className="px-1 text-[10px] text-rose-500 font-medium">{message.error}</p>
        ) : null}
      </div>
    </div>
  );
}

function formatTime(isoDate: string) {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
