"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, PaperPlaneTilt, WhatsappLogo } from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { cn } from "@/lib/utils";
import { sendLeadMessageAction } from "@/features/leads/actions/send-lead-message";

export type LightConversationMessage = {
  id: string;
  body: string;
  direction: string;
  sentAt: string;
  senderRole?: string | null;
  providerStatus?: string | null;
};

export type LightConversationItem = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  latestMessage: { body: string; direction: string; sentAt: string } | null;
  messages: LightConversationMessage[];
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

export function LightConversationsView({
  conversations,
  initialLeadId,
  whatsappConnected,
}: {
  conversations: LightConversationItem[];
  initialLeadId?: string;
  whatsappConnected: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLeadId && conversations.some((c) => c.id === initialLeadId)
      ? initialLeadId
      : null,
  );
  const [query, setQuery] = useState("");
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof getWhatsAppConnection>> | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter(
      (c) =>
        !q ||
        c.nome.toLowerCase().includes(q) ||
        c.telefone.includes(q),
    );
  }, [conversations, query]);

  // Load connection data client-side for the dialog
  useEffect(() => {
    getWhatsAppConnection().then(setConnection).catch(() => {});
  }, []);

  // If WhatsApp is not connected, show connection flow
  if (!whatsappConnected) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-primary/10">
          <WhatsappLogo className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Conectar WhatsApp
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Para enviar e receber mensagens, você precisa conectar seu WhatsApp.
          </p>
        </div>
        {connection ? (
          <WhatsAppConnectDialog
            initial={connection}
            triggerLabel="Conectar WhatsApp"
            connectedLabel="WhatsApp conectado"
          />
        ) : (
          <Button disabled className="gap-2">
            <WhatsappLogo className="size-4" />
            Carregando...
          </Button>
        )}
      </div>
    );
  }

  // List view
  if (!selected) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 pb-24 sm:px-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Atendimento
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Conversas ({conversations.length})
            </h1>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2 pl-4 pr-4 text-xs shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          {filtered.length > 0 ? (
            filtered.map((conv) => (
              <Card
                key={conv.id}
                variant="subtle"
                className="cursor-pointer bg-card/95 transition-colors hover:border-primary/30"
                onClick={() => setSelectedId(conv.id)}
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {conv.nome}
                    </h3>
                    {conv.latestMessage ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {conv.latestMessage.direction === "outgoing" || conv.latestMessage.direction === "outbound"
                          ? "Você: "
                          : ""}
                        {conv.latestMessage.body}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Sem mensagens</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {conv.latestMessage ? (
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(conv.latestMessage.sentAt)}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(conv.id)}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card variant="subtle" className="flex flex-col items-center justify-center p-8 text-center bg-card/95 border-dashed">
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex h-[calc(100dvh-var(--header-height,3.5rem))] flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => setSelectedId(null)}
          className="grid size-8 place-items-center rounded-full hover:bg-muted"
          aria-label="Voltar para lista"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{selected.nome}</h2>
          <p className="text-xs text-muted-foreground">{selected.telefone}</p>
        </div>
        <Link
          href={`/leads/${selected.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
        >
          Ver lead
        </Link>
      </div>

      {/* Messages */}
      <ChatHistory messages={selected.messages} clientName={selected.nome} />

      {/* Input */}
      <ChatInput
        leadId={selected.id}
        onMessageSent={(msg) => {
          // Optimistic update — message will be visible immediately
          // The parent component will reconcile on next refresh
        }}
      />
    </div>
  );
}

// ── Chat History ─────────────────────────────────────────────────────────

function ChatHistory({
  messages,
  clientName,
}: {
  messages: LightConversationMessage[];
  clientName: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()),
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages.length]);

  if (!sortedMessages.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5">
        {sortedMessages.map((message) => {
          const isOutbound = message.direction === "outgoing" || message.direction === "outbound";
          return (
            <div
              key={message.id}
              className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  isOutbound
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    isOutbound ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {formatTime(message.sentAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

// ── Chat Input ───────────────────────────────────────────────────────────

function ChatInput({
  leadId,
  onMessageSent,
}: {
  leadId: string;
  onMessageSent: (msg: LightConversationMessage) => void;
}) {
  const [text, setText] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    setIsPending(true);
    setError(null);
    try {
      const res = await sendLeadMessageAction(leadId, trimmed);
      if (res.success && res.message) {
        setText("");
        onMessageSent({
          id: res.message.id,
          body: res.message.body,
          direction: res.message.direction,
          sentAt: res.message.sentAt.toISOString(),
        });
      } else {
        setError(res.error ?? "Erro ao enviar mensagem.");
      }
    } catch {
      setError("Erro de rede ao enviar mensagem.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <form onSubmit={handleSend} className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={isPending}
            className="h-10 text-sm"
          />
          {error && (
            <p className="absolute -top-6 left-1 text-[11px] font-medium text-destructive truncate max-w-full">
              {error}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isPending || !text.trim()}
          size="icon-sm"
          className="h-10 w-10 shrink-0"
        >
          <PaperPlaneTilt className={cn("size-4", isPending && "animate-pulse")} />
        </Button>
      </form>
    </div>
  );
}
