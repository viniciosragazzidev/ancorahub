"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatCircleText, Clock, MagnifyingGlass, PaperPlaneTilt, WhatsappLogo } from "@/components/huge-icons";
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

const invitationLabels: Record<string, string> = {
  PENDING: "Convite pendente",
  ACCEPTED: "Convite aceito",
  EXPIRED: "Convite expirado",
  REVOKED: "Convite revogado",
  REPLACED: "Convite substituído",
};

export function OfficialBrokerConversations({ enabled, conversations }: { enabled: boolean; conversations: OfficialBrokerConversation[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.brokerProfileId ?? null);
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = useMemo(
    () => conversations.filter((conversation) => !normalized || [conversation.name, conversation.branchName ?? ""].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized))),
    [conversations, normalized],
  );
  const selected = filtered.find((conversation) => conversation.brokerProfileId === selectedId) ?? filtered[0] ?? null;

  if (!enabled) {
    return (
      <section className="flex min-h-[26rem] items-center justify-center rounded-xl border border-border bg-card p-6">
        <EmptyState icon={WhatsappLogo} title="Canal oficial desativado" description="O Super-admin desativou o canal Meta. Ative-o para consultar as mensagens oficiais enviadas à equipe." />
      </section>
    );
  }

  return (
    <section aria-label="Conversas oficiais com corretores" className="flex h-[calc(100dvh-var(--header-height,3.5rem))] max-[559px]:h-full w-full flex-col overflow-hidden bg-card">
      <header className="shrink-0 border-b border-border px-4 py-3 lg:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><WhatsappLogo className="size-4 text-success" aria-hidden="true" /><h2 className="text-sm font-semibold">Canal oficial com corretores</h2><Badge variant="secondary">{conversations.length}</Badge></div>
            <p className="mt-0.5 text-xs text-muted-foreground">Acompanhe convites, ofertas e respostas recebidas pelo número oficial. Esta visão não envia mensagens.</p>
          </div>
          <Badge className="ml-auto" variant="outline">Somente Diretor</Badge>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.7fr)]">
        <section aria-label="Corretores com histórico no canal oficial" className={cn("flex min-h-0 flex-col border-r border-border bg-card", selected && "max-lg:hidden")}>
          <div className="border-b border-border p-3">
            <div className="relative"><MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar corretor ou unidade" className="h-8 pl-8 text-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar corretor ou unidade" value={query} /></div>
          </div>
          <ScrollArea className="min-h-0 flex-1"><div className="p-2">
            {filtered.map((conversation) => {
              const last = conversation.messages.at(-1);
              return <button key={conversation.brokerProfileId} type="button" onClick={() => setSelectedId(conversation.brokerProfileId)} className={cn("w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected?.brokerProfileId === conversation.brokerProfileId && "bg-muted") }>
                <div className="flex items-start gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-xs font-semibold text-success">{initials(conversation.name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{conversation.name}</span>{conversation.invitationStatus ? <Badge className="shrink-0 text-[10px]" variant="outline">{invitationLabels[conversation.invitationStatus] ?? conversation.invitationStatus}</Badge> : null}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{last ? last.body : "Sem mensagens no canal oficial"}</span><span className="mt-1 block text-[11px] text-muted-foreground">{conversation.branchName ?? "Unidade não informada"} · {last ? formatDate(last.sentAt) : conversation.phoneMasked}</span></span></div>
              </button>;
            })}
            {!filtered.length ? <div className="px-3 py-10 text-center text-xs text-muted-foreground">Nenhum corretor encontrado.</div> : null}
          </div></ScrollArea>
        </section>

        <section aria-live="polite" className={cn("flex min-h-0 flex-col bg-muted/15", !selected && "max-lg:hidden")}>
          {selected ? <>
            <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3"><Button aria-label="Voltar para a lista" className="lg:hidden" onClick={() => setSelectedId(null)} size="icon-sm" variant="ghost">←</Button><span className="flex size-9 items-center justify-center rounded-full bg-success/10 text-sm font-semibold text-success">{initials(selected.name)}</span><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.phoneMasked} · {selected.branchName ?? "Sem unidade"}</p></div>{selected.invitationStatus ? <Badge className="ml-auto" variant={selected.invitationStatus === "ACCEPTED" ? "success" : "secondary"}>{invitationLabels[selected.invitationStatus] ?? selected.invitationStatus}</Badge> : null}</header>
            <ScrollArea className="min-h-0 flex-1"><div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4 lg:p-5">
              {selected.messages.map((message) => <MessageBubble brokerName={selected.name} key={message.id} message={message} />)}
              {!selected.messages.length ? <EmptyState icon={ChatCircleText} title="Nenhuma mensagem registrada" description="Quando o número oficial enviar ou receber uma mensagem deste corretor, ela aparecerá aqui." /> : null}
            </div></ScrollArea>
          </> : <div className="flex h-full items-center justify-center"><EmptyState icon={ChatCircleText} title="Selecione um corretor" description="Escolha um item da lista para consultar o histórico oficial." /></div>}
        </section>
      </div>
    </section>
  );
}

function MessageBubble({ message, brokerName }: { message: OfficialBrokerMessage; brokerName: string }) {
  const outgoing = message.direction === "outgoing";
  const statusVariant = message.status === "failed" ? "destructive" : message.status === "delivered" || message.status === "read" || message.status === "received" ? "success" : "secondary";

  return (
    <Message align={outgoing ? "end" : "start"} className="ct-reveal-fast">
      {outgoing ? null : (
        <MessageAvatar>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-[11px] font-semibold text-success">{initials(brokerName)}</span>
        </MessageAvatar>
      )}

      <MessageContent>
        <MessageHeader>
          <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-tight", outgoing ? "text-success" : "text-muted-foreground")}>
            {outgoing ? <PaperPlaneTilt className="size-3" aria-hidden="true" /> : <ChatCircleText className="size-3" aria-hidden="true" />}
            {outgoing ? "Número oficial" : "Corretor"}
          </span>
        </MessageHeader>

        <Bubble align={outgoing ? "end" : "start"} variant="outline">
          <BubbleContent
            className={cn(
              "max-w-lg text-xs leading-relaxed",
              outgoing ? "border-success/20 bg-success/5" : "bg-card",
            )}
          >
            <p className="whitespace-pre-wrap break-words leading-5">{message.body}</p>
            {message.status === "failed" && message.error ? (
              <p className="mt-2 text-[11px] font-medium text-destructive">{message.error}</p>
            ) : null}
          </BubbleContent>
        </Bubble>

        <MessageFooter>
          <time dateTime={message.sentAt} className="tabular-nums">
            {formatDate(message.sentAt)}
          </time>
          <span aria-hidden="true" className="opacity-60">•</span>
          <Badge variant={statusVariant}>{deliveryLabels[message.status]}</Badge>
          {message.templateName ? <Badge variant="outline">{message.templateName}</Badge> : null}
          {message.attempts && message.attempts > 1 ? (
            <span className="text-[11px] text-muted-foreground">{message.attempts} tentativas</span>
          ) : null}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
