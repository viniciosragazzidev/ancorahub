"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ContextNote } from "@/components/ui/context-note";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Buildings,
  ChatCircleText,
  InfoIcon,
  MagnifyingGlass,
  ShieldCheck,
  UserCheck,
  WhatsappLogo,
} from "@/components/huge-icons";
import { cn } from "@/lib/utils";

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
  branchName: string | null;
  invitationStatus: string | null;
  invitationDeliveryStatus: string | null;
  messages: OfficialBrokerMessage[];
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
  conversations,
}: {
  enabled: boolean;
  conversations: OfficialBrokerConversation[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.brokerProfileId ?? null,
  );

  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = useMemo(() => {
    const list = conversations.filter((conversation) => {
      const matchesSearch =
        !normalized ||
        [conversation.name, conversation.branchName ?? "", conversation.phoneMasked].some((val) =>
          val.toLocaleLowerCase("pt-BR").includes(normalized),
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
      aria-label="Conversas oficiais com corretores"
      className="flex h-[calc(100dvh-var(--header-height,3.5rem))] w-full flex-col overflow-hidden bg-card"
    >
      {/* Visual Header matching Lead Workspace */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <WhatsappLogo className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Canal Oficial com Corretores
                </h2>
                <Badge variant="secondary">{conversations.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Histórico de convites, ofertas de leads e respostas enviadas pelo número oficial da corretora.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
              <ShieldCheck className="size-3.5" /> Canal Oficial Meta
            </Badge>
            <Badge variant="secondary">Visão da Direção</Badge>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.8fr)]">
        {/* Sidebar - Lista de Corretores */}
        <section
          aria-label="Corretores com histórico no canal oficial"
          className={cn(
            "flex min-h-0 flex-col border-r border-border bg-card",
            selected && "max-lg:hidden",
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
                Todos
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
                        : "hover:bg-muted/40",
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
            !selected && "max-lg:hidden",
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

                <div className="hidden sm:flex items-center gap-2">
                  <Badge variant="outline" className="gap-1.5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                    <WhatsappLogo className="size-3.5" /> Número Oficial
                  </Badge>
                </div>
              </header>

              {/* Banner Informativo */}
              <div className="border-b border-border bg-card/50 px-4 py-2">
                <ContextNote variant="info" icon={InfoIcon} className="py-1.5 text-[11px]">
                  <span>
                    Canal Oficial de Comunicação com a Equipe. As mensagens deste chat registram interações automáticas de convite, alertas de SLA e ofertas de leads.
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
                      description="As mensagens enviadas pelo número oficial ou recebidas deste corretor aparecerão neste espaço."
                    />
                  ) : null}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={ChatCircleText}
                title="Selecione um corretor"
                description="Escolha um corretor da lista ao lado para visualizar o histórico de mensagens enviadas pelo canal oficial."
              />
            </div>
          )}
        </section>
      </div>
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
  const outgoing = message.direction === "outgoing";
  const statusVariant =
    message.status === "failed"
      ? "destructive"
      : message.status === "delivered" ||
          message.status === "read" ||
          message.status === "received"
        ? "success"
        : "secondary";

  return (
    <Message align={outgoing ? "end" : "start"} className="ct-reveal-fast">
      {outgoing ? null : (
        <MessageAvatar>
          <UserAvatar
            name={brokerName}
            seed={brokerName}
            size="sm"
            className="shrink-0"
          />
        </MessageAvatar>
      )}

      <MessageContent>
        <MessageHeader>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-tight",
              outgoing ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {outgoing ? (
              <>
                <WhatsappLogo className="size-3 text-emerald-500" aria-hidden="true" />
                <span>Número Oficial da Corretora</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>{brokerName}</span>
              </>
            )}
          </span>
        </MessageHeader>

        <Bubble align={outgoing ? "end" : "start"} variant="outline">
          <BubbleContent
            className={cn(
              "max-w-lg text-xs leading-relaxed shadow-2xs transition-all",
              outgoing
                ? "border-emerald-500/20 bg-emerald-500/[0.06] dark:bg-emerald-500/10 text-foreground"
                : "bg-card border-border text-foreground",
            )}
          >
            <p className="whitespace-pre-wrap break-words leading-5 font-sans">
              {message.body}
            </p>

            {message.status === "failed" && message.error ? (
              <div className="mt-2 rounded bg-destructive/10 p-2 text-[11px] font-medium text-destructive">
                {message.error}
              </div>
            ) : null}
          </BubbleContent>
        </Bubble>

        <MessageFooter>
          <time dateTime={message.sentAt} className="tabular-nums text-[10px]">
            {formatFullDate(message.sentAt)}
          </time>
          <span aria-hidden="true" className="opacity-40">
            •
          </span>
          <Badge variant={statusVariant} className="text-[9px] px-1.5 py-0 font-medium">
            {deliveryLabels[message.status]}
          </Badge>
          {message.templateName ? (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
              {message.templateName}
            </Badge>
          ) : null}
          {message.attempts && message.attempts > 1 ? (
            <span className="text-[10px] text-muted-foreground">
              {message.attempts} tentativas
            </span>
          ) : null}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatFullDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
