"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Filter,
  MessageSquare,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";

import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
} from "@/app/(dashboard)/settings/whatsapp-actions";
import {
  sendLeadMessageAction,
  sendTenantOfficialChannelMessageAction,
  sendTenantOfficialNumberMessageAction,
} from "@/features/leads/actions/send-lead-message";
import { cn } from "@/lib/utils";
import {
  REALTIME_SYNC_BROWSER_EVENT,
  type RealtimeSyncBrowserDetail,
} from "@/components/providers/realtime-events";
import { toast } from "sonner";

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
  kind: "lead" | "client" | "tenant_number";
  sendTarget:
    | { kind: "lead"; leadId: string }
    | { kind: "tenant_number"; numberId: string }
    | { kind: "tenant_channel"; channelId: string };
  nome: string;
  telefone: string;
  status: string;
  latestMessage: { body: string; direction: string; sentAt: string } | null;
  messages: LightConversationMessage[];
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return formatTime(value);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function isOutbound(direction: string) {
  return direction === "outgoing" || direction === "outbound";
}

function formatPhoneNumber(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

const QUICK_REPLIES = [
  {
    label: "Apresentação",
    text: "Olá! Sou o corretor responsável pelo seu atendimento no Âncora. Como posso te ajudar a escolher o plano ideal hoje?",
  },
  {
    label: "Solicitar docs",
    text: "Para darmos andamento na sua proposta, pode me enviar a foto do RG/CPF ou CNH e um comprovante de residência?",
  },
  {
    label: "Cotação pronta",
    text: "Montei o comparativo dos melhores planos para o seu perfil. Posso te enviar os valores agora?",
  },
];

export function LightConversationsView({
  conversations: serverConversations,
  initialLeadId,
  initialDraft,
  whatsappConnected,
}: {
  conversations: LightConversationItem[];
  initialLeadId?: string;
  initialDraft?: string;
  whatsappConnected: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(serverConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId ?? null);
  const [query, setQuery] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState<"all" | "lead" | "client">("all");
  const [connection, setConnection] = useState<Awaited<
    ReturnType<typeof getWhatsAppConnection>
  > | null>(null);
  const connectionPollInFlight = useRef(false);
  const connectionReadyRef = useRef(whatsappConnected);
  const refreshConversations = useCallback(() => router.refresh(), [router]);

  useEffect(() => setConversations(serverConversations), [serverConversations]);
  useEffect(
    () =>
      setSelectedId(
        initialLeadId && serverConversations.some((item) => item.id === initialLeadId)
          ? initialLeadId
          : null,
      ),
    [initialLeadId, serverConversations],
  );

  const refreshConnection = useCallback(
    async ({ announce = false }: { announce?: boolean } = {}) => {
      const next = await getWhatsAppConnection();
      const wasReady = connectionReadyRef.current;
      const isReady = next.status === "ready" && next.chatInternoAtivo;
      connectionReadyRef.current = isReady;
      setConnection(next);
      if (announce && isReady && !wasReady) {
        toast.success("WhatsApp conectado. Sua carteira está pronta para atendimento.");
      }
      return next;
    },
    [],
  );

  useEffect(() => {
    void refreshConnection().catch(() => undefined);
  }, [refreshConnection]);

  useEffect(() => {
    const onConversationInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.kind !== "domain.invalidated") return;
      if (detail.domain === "whatsapp_connection") {
        void refreshConnection({ announce: true })
          .then(() => refreshConversations())
          .catch(() => refreshConversations());
        return;
      }
      if (detail.domain === "conversations") {
        refreshConversations();
      }
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onConversationInvalidated);
    return () => window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onConversationInvalidated);
  }, [refreshConnection, refreshConversations]);

  useEffect(() => {
    if (!connection?.sessionId || connection.status !== "initializing") return;
    const reconcile = async () => {
      if (document.visibilityState !== "visible" || connectionPollInFlight.current) return;
      connectionPollInFlight.current = true;
      try {
        const result = await getWhatsAppSessionStatus();
        if (result.success) await refreshConnection({ announce: true });
      } catch {
        // Fallback webhook
      } finally {
        connectionPollInFlight.current = false;
      }
    };
    void reconcile();
    const interval = window.setInterval(() => void reconcile(), 2_000);
    return () => window.clearInterval(interval);
  }, [connection?.sessionId, connection?.status, refreshConnection]);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return conversations.filter((item) => {
      const matchesSearch =
        !term ||
        item.nome.toLocaleLowerCase("pt-BR").includes(term) ||
        item.telefone.includes(term);
      const matchesFilter =
        activeTabFilter === "all" ||
        (activeTabFilter === "lead" && item.kind === "lead") ||
        (activeTabFilter === "client" && item.kind === "client");
      return matchesSearch && matchesFilter;
    });
  }, [conversations, query, activeTabFilter]);

  function selectConversation(leadId: string | null) {
    setSelectedId(leadId);
    const params = new URLSearchParams(searchParams.toString());
    if (leadId) params.set("leadId", leadId);
    else params.delete("leadId");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  function appendMessage(leadId: string, message: LightConversationMessage) {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id !== leadId || conversation.messages.some((item) => item.id === message.id)
            ? conversation
            : {
                ...conversation,
                messages: [...conversation.messages, message],
                latestMessage: {
                  body: message.body,
                  direction: message.direction,
                  sentAt: message.sentAt,
                },
              },
        )
        .sort(
          (a, b) =>
            Date.parse(b.latestMessage?.sentAt ?? "") - Date.parse(a.latestMessage?.sentAt ?? ""),
        ),
    );
  }

  const hasActiveConnection =
    whatsappConnected || (connection?.status === "ready" && connection.chatInternoAtivo);

  if (!hasActiveConnection) {
    return (
      <ConnectionEmptyState
        connection={connection}
        onConnectionChanged={() => refreshConnection({ announce: true })}
      />
    );
  }

  return (
    <section className="flex h-[calc(100dvh-var(--header-height,3.5rem))] min-h-[38rem] max-lg:min-h-0 overflow-hidden border-y border-border/70 bg-background lg:border">
      {/* SIDEBAR DA CARTEIRA DE CONVERSAS */}
      <aside
        className={cn(
          "flex min-w-0 flex-1 flex-col border-r border-border/60 bg-card/60 backdrop-blur-xs lg:max-w-[24rem] lg:flex-none",
          selected && "max-lg:hidden",
        )}
        aria-label="Lista de conversas"
      >
        {/* HEADER DA SIDEBAR */}
        <div className="space-y-3.5 border-b border-border/60 p-4 sm:p-5 bg-card/90">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Atendimento WhatsApp
                </span>
              </div>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-foreground">
                Sua Carteira
              </h1>
            </div>

            {connection ? (
              <WhatsAppConnectDialog
                initial={connection}
                triggerLabel="Status WA"
                connectedLabel="Status WA"
                onConnectionChanged={() => refreshConnection({ announce: true })}
              />
            ) : (
              <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                Carregando...
              </Button>
            )}
          </div>

          {/* BUSCA DE ATENDIMENTOS */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              aria-label="Buscar conversas"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nome ou telefone..."
              className="pl-9 h-9 text-xs bg-background/80 border-border/70 rounded-lg focus-visible:ring-1"
            />
          </div>

          {/* FILTROS DE CARTEIRA */}
          <div className="flex gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setActiveTabFilter("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                activeTabFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Todas ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter("lead")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                activeTabFilter === "lead"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Leads ({conversations.filter((c) => c.kind === "lead").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter("client")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                activeTabFilter === "client"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Clientes ({conversations.filter((c) => c.kind === "client").length})
            </button>
          </div>
        </div>

        {/* LISTA DE CONVERSAS */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {filtered.map((conversation) => {
              const active = conversation.id === selectedId;
              const isClient = conversation.kind === "client";
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left outline-none transition-all border border-transparent hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-primary/10 border-primary/20 font-semibold shadow-2xs",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold shadow-2xs",
                      isClient
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-primary/10 text-primary dark:bg-primary/20",
                    )}
                    aria-hidden="true"
                  >
                    {conversation.nome.trim().slice(0, 1).toLocaleUpperCase("pt-BR")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-foreground">
                        {conversation.nome}
                      </span>
                      {conversation.latestMessage ? (
                        <time
                          className="shrink-0 text-[10px] font-medium text-muted-foreground"
                          dateTime={conversation.latestMessage.sentAt}
                        >
                          {formatDay(conversation.latestMessage.sentAt)}
                        </time>
                      ) : null}
                    </span>

                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground font-normal">
                        {conversation.latestMessage
                          ? `${isOutbound(conversation.latestMessage.direction) ? "Você: " : ""}${conversation.latestMessage.body}`
                          : "Iniciar conversa..."}
                      </span>
                      <Badge
                        variant={isClient ? "success" : "secondary"}
                        className="text-[9px] px-1.5 py-0 h-4 font-semibold uppercase tracking-wider shrink-0"
                      >
                        {conversation.status}
                      </Badge>
                    </span>
                  </span>
                </button>
              );
            })}
            {!filtered.length ? (
              <div className="m-4 rounded-xl border border-dashed border-border/80 p-6 text-center">
                <MessageSquare className="mx-auto size-6 text-muted-foreground/60" />
                <p className="mt-2 text-xs font-semibold text-foreground">Nenhuma conversa encontrada</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Refine a busca ou aguarde novas mensagens.
                </p>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      {/* PAINEL CENTRAL DE CONVERSA */}
      {selected ? (
        <ConversationPanel
          conversation={selected}
          initialDraft={selected.id === initialLeadId ? initialDraft : undefined}
          onBack={() => selectConversation(null)}
          onMessageSent={(message) => appendMessage(selected.id, message)}
        />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center bg-card/20 px-6 text-center lg:flex">
          <div className="grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary shadow-2xs border border-primary/20">
            <MessageSquare className="size-8" />
          </div>
          <h2 className="mt-4 text-base font-bold text-foreground">Selecione uma conversa</h2>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
            Escolha um atendimento da sua carteira à esquerda para visualizar o histórico de mensagens e responder via WhatsApp.
          </p>
        </div>
      )}
    </section>
  );
}

function ConnectionEmptyState({
  connection,
  onConnectionChanged,
}: {
  connection: Awaited<ReturnType<typeof getWhatsAppConnection>> | null;
  onConnectionChanged: () => void;
}) {
  const [pairingActive, setPairingActive] = useState(false);
  const pollRef = useRef(false);

  useEffect(() => {
    if (!connection?.sessionId || connection.status === "ready") {
      setPairingActive(false);
      return;
    }
    setPairingActive(true);
    const check = async () => {
      if (pollRef.current) return;
      pollRef.current = true;
      try {
        await getWhatsAppSessionStatus();
        onConnectionChanged();
      } catch {
        // Silent
      } finally {
        pollRef.current = false;
      }
    };
    void check();
    const timer = window.setInterval(check, 2_000);
    return () => window.clearInterval(timer);
  }, [connection?.sessionId, connection?.status, onConnectionChanged]);

  const isPairing = pairingActive && connection?.sessionId && connection.status !== "ready";

  return (
    <div className="mx-auto flex min-h-[34rem] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        <span
          className={cn(
            "grid size-16 place-items-center rounded-3xl transition-all duration-500 border shadow-md",
            connection?.status === "ready"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 scale-110"
              : "bg-primary/10 text-primary border-primary/20",
          )}
        >
          {connection?.status === "ready" ? (
            <ShieldCheck className="size-8" />
          ) : (
            <MessageSquare className={cn("size-8", isPairing && "animate-pulse")} />
          )}
        </span>
      </div>

      {connection?.status === "ready" ? (
        <>
          <h1 className="mt-5 text-lg font-bold tracking-tight text-foreground">WhatsApp Conectado!</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sua carteira de conversas está ativa e pronta para atendimento.
          </p>
        </>
      ) : isPairing ? (
        <>
          <h1 className="mt-5 text-lg font-bold tracking-tight text-foreground">Conectando WhatsApp...</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Abra o WhatsApp no celular e escaneie o QR Code. A tela atualizará automaticamente.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-lg font-bold tracking-tight text-foreground">Conexão WhatsApp Necessária</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Conecte seu número para iniciar a troca de mensagens com seus leads e clientes.
          </p>
        </>
      )}

      {connection ? (
        <div className="mt-6">
          <WhatsAppConnectDialog
            initial={connection}
            triggerLabel="Conectar WhatsApp Agora"
            connectedLabel="Gerenciar Conexão"
            onConnectionChanged={onConnectionChanged}
          />
        </div>
      ) : (
        <Button className="mt-6" disabled size="sm">
          Carregando conexão...
        </Button>
      )}
    </div>
  );
}

function getMessageDateGroup(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return "Hoje";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function getContextualQuickReplies(status?: string) {
  if (status === "quote_sent") {
    return [
      { label: "Acompanhar cotação", text: "Olá! Conseguiu dar uma olhada na cotação que enviei? Ficou alguma dúvida sobre os valores ou a rede?" },
      { label: "Tirar dúvidas", text: "Estou à disposição para esclarecer qualquer dúvida sobre o plano e as coberturas." },
      { label: "Apresentação", text: "Olá! Sou seu corretor responsável e estou por aqui para te auxiliar com o plano." },
    ];
  }
  if (status === "documentation_pending") {
    return [
      { label: "Solicitar docs", text: "Para darmos andamento na contratação, por favor envie a foto do documento de identificação (RG/CNH) e comprovante de residência." },
      { label: "Status da análise", text: "Seus documentos foram enviados e estão em análise. Te aviso assim que tivermos a confirmação!" },
      { label: "Apresentação", text: "Olá! Sou seu corretor responsável e estou por aqui para te auxiliar." },
    ];
  }
  if (status === "negotiation") {
    return [
      { label: "Confirmar proposta", text: "Podemos seguir com o fechamento da proposta conforme conversamos?" },
      { label: "Tirar dúvidas", text: "Ficou alguma dúvida sobre as opções que comparamos?" },
      { label: "Apresentação", text: "Olá! Sou seu corretor responsável e estou por aqui." },
    ];
  }
  return QUICK_REPLIES;
}

function ConversationPanel({
  conversation,
  initialDraft,
  onBack,
  onMessageSent,
}: {
  conversation: LightConversationItem;
  initialDraft?: string;
  onBack: () => void;
  onMessageSent: (message: LightConversationMessage) => void;
}) {
  return (
    <article
      className="flex min-w-0 flex-1 flex-col bg-card/40"
      aria-label={`Conversa com ${conversation.nome}`}
    >
      {/* HEADER DO CHAT ATIVO */}
      <header className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden shrink-0"
            onClick={onBack}
            aria-label="Voltar para conversas"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-bold text-primary shadow-2xs"
            aria-hidden="true"
          >
            {conversation.nome.trim().slice(0, 1).toLocaleUpperCase("pt-BR")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-foreground">{conversation.nome}</h2>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                {conversation.status}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {formatPhoneNumber(conversation.telefone)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.sendTarget.kind === "lead" ? (
            <Link
              href={`/leads/${conversation.sendTarget.leadId}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
                "text-xs gap-1.5 font-semibold shrink-0 border-border/80 hover:bg-muted",
              )}
            >
              <span>Ver Ficha</span>
              <ExternalLink className="size-3" />
            </Link>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Canal Oficial
            </Badge>
          )}
        </div>
      </header>

      {/* HISTÓRICO DE MENSAGENS */}
      <ChatHistory messages={conversation.messages} clientName={conversation.nome} />

      {/* DIGITAÇÃO E RESPOSTAS RÁPIDAS */}
      <ChatInput
        key={conversation.id}
        status={conversation.status}
        initialText={initialDraft}
        target={conversation.sendTarget}
        onMessageSent={onMessageSent}
      />
    </article>
  );
}

function ChatHistory({
  messages,
  clientName,
}: {
  messages: LightConversationMessage[];
  clientName: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)),
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages.length]);

  if (!sortedMessages.length)
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center bg-card/20">
        <div className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
          <MessageSquare className="size-6" />
        </div>
        <p className="mt-3 text-xs font-semibold text-foreground">Sem histórico com {clientName}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Envie uma mensagem abaixo para iniciar o atendimento.
        </p>
      </div>
    );

  return (
    <ScrollArea className="min-h-0 flex-1 bg-muted/15 dark:bg-card/10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
        {sortedMessages.map((message, idx) => {
          const outbound = isOutbound(message.direction);
          const currentDateGroup = getMessageDateGroup(message.sentAt);
          const prevDateGroup = idx > 0 ? getMessageDateGroup(sortedMessages[idx - 1].sentAt) : null;
          const showDateDivider = currentDateGroup && currentDateGroup !== prevDateGroup;

          return (
            <div key={message.id} className="space-y-3">
              {showDateDivider && (
                <div className="my-2 flex items-center justify-center">
                  <span className="rounded-full bg-muted/70 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-2xs">
                    {currentDateGroup}
                  </span>
                </div>
              )}
              <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs border transition-all",
                    outbound
                      ? "rounded-tr-xs bg-primary text-primary-foreground border-primary/20"
                      : "rounded-tl-xs bg-card dark:bg-muted/80 text-foreground border-border/60",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <div
                    className={cn(
                      "mt-1.5 flex items-center justify-end gap-1 text-[10px]",
                      outbound ? "text-primary-foreground/75" : "text-muted-foreground",
                    )}
                  >
                    <time dateTime={message.sentAt}>{formatTime(message.sentAt)}</time>
                    {outbound && (
                      message.providerStatus === "read" ? (
                        <CheckCheck className="size-3 text-primary-foreground font-bold shrink-0" />
                      ) : message.providerStatus === "failed" ? (
                        <span className="text-[9px] font-bold text-destructive-foreground bg-destructive/30 px-1 rounded">!</span>
                      ) : (
                        <Check className="size-3 text-primary-foreground/80 shrink-0" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function ChatInput({
  target,
  status,
  initialText = "",
  onMessageSent,
}: {
  target: LightConversationItem["sendTarget"];
  status?: string;
  initialText?: string;
  onMessageSent: (message: LightConversationMessage) => void;
}) {
  const [text, setText] = useState(initialText);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickReplies = useMemo(() => getContextualQuickReplies(status), [status]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const result =
        target.kind === "lead"
          ? await sendLeadMessageAction(target.leadId, body)
          : target.kind === "tenant_channel"
            ? await sendTenantOfficialChannelMessageAction(target.channelId, body)
            : await sendTenantOfficialNumberMessageAction(target.numberId, body);
      if (!result.success || !result.message) {
        setError(result.error ?? "Não foi possível enviar a mensagem.");
        return;
      }
      setText("");
      onMessageSent({
        id: result.message.id,
        body: result.message.body,
        direction: result.message.direction,
        sentAt: result.message.sentAt.toISOString(),
      });
    } catch {
      setError("Não foi possível enviar a mensagem. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="border-t border-border/60 bg-card p-3 sm:px-5 max-lg:pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-3 space-y-2.5">
      {/* ATALHOS DE RESPOSTAS RÁPIDAS CONTEXTUAIS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] [scrollbar-width:none]">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 pr-1 shrink-0">
          <Zap className="size-3 text-amber-500" /> Respostas Rápidas:
        </span>
        {quickReplies.map((reply, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setText(reply.text)}
            className="shrink-0 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
          >
            {reply.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Digite sua mensagem (Pressione Enter para enviar)..."
            disabled={isPending}
            className="h-10 text-xs bg-background border-border/70 focus-visible:ring-1"
            aria-describedby={error ? "message-error" : undefined}
          />
          {error ? (
            <p id="message-error" role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !text.trim()}
          className="h-10 px-4 font-semibold text-xs gap-1.5 shadow-2xs"
          aria-label="Enviar mensagem"
        >
          <span>Enviar</span>
          <Send className={cn("size-3.5", isPending && "animate-pulse")} />
        </Button>
      </form>
    </div>
  );
}
