"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { toast } from "sonner";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from "@/components/ui/message";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContextNote } from "@/components/ui/context-note";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OwnershipContext } from "@/components/ownership-context";
import {
  ArrowLeft,
  ArrowSquareOut,
  ChatCircleText,
  Clock,
  FileText,
  LinkSimple,
  MagnifyingGlass,
  PanelLeftIcon,
  Phone,
  UserList,
  WhatsappLogo,
  PaperPlaneTilt,
  RotateCcw,
  Sparkle,
} from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { Sparkles, RefreshCw, PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  takeoverConversationAction,
  closeConversationAction,
  resetAiConversationAction,
  resumeAiQualificationAction,
  syncSingleLeadConversationAction,
} from "@/features/ai-agent/actions";
import { sendLeadMessageAction } from "@/features/leads/actions/send-lead-message";
import { manuallyChangeQualificationStageAction } from "@/features/leads/qualification-tab-actions";
import { ManualQualificationDialog } from "../leads/_components/manual-qualification-dialog";

export type ConversationMessage = {
  id: string;
  leadId: string | null;
  body: string;
  direction: string;
  sentAt: string;
  senderRole?: string | null;
  providerStatus?: string | null;
};

export type AiConversationData = {
  id: string;
  status: "NEW" | "AI_ACTIVE" | "WAITING_CUSTOMER" | "WAITING_HUMAN" | "HUMAN_ACTIVE" | "CLOSED" | "FAILED";
  aiModel: string | null;
  transferReason: string | null;
  qualificationSummary: string | null;
  assignedUserId: string | null;
};

export type ConversationItem = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  status: string;
  qualificationStatus?: string | null;
  origem: string;
  branchId: string | null;
  corretorId: string | null;
  corretorNome: string | null;
  branchName: string | null;
  consentimentoLgpd: boolean;
  createdAt: string;
  stageEnteredAt: string;
  planName: string | null;
  carrierName: string | null;
  latestMessage: Pick<ConversationMessage, "body" | "direction" | "sentAt"> | null;
  messages: ConversationMessage[];
  documents: {
    id: string;
    filename: string;
    fileUrl: string;
    status: string;
    requirementName: string | null;
    createdAt: string;
  }[];
  aiConversation?: AiConversationData | null;
};

type ViewFilter = "all" | "qualified" | "ai_active" | "human_active" | "with_messages" | "without_messages";

export function ConversationsWorkspace({
  role,
  branches,
  conversations: initialConversations,
  initialLeadId,
  userId,
  tenantId,
}: {
  role: string;
  branches: { id: string; name: string }[];
  conversations: ConversationItem[];
  initialLeadId?: string;
  userId?: string;
  tenantId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLeadId && initialConversations.some((item) => item.id === initialLeadId)
      ? initialLeadId
      : initialConversations.find((item) => item.messages.length > 0)?.id ?? initialConversations[0]?.id ?? null,
  );

  // Server data becomes authoritative after the authenticated shell refreshes.
  // Conversation content is never streamed as raw database rows to the browser.
  useEffect(() => {
    const sync = window.setTimeout(() => setConversations(initialConversations), 0);
    return () => window.clearTimeout(sync);
  }, [initialConversations]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [profileOpen, setProfileOpen] = useState(true);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const messagesWithHistory = useMemo(
    () => conversations.filter((conversation) => conversation.messages.length > 0).length,
    [conversations],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");

    return conversations.filter((conversation) => {
      const matchesQuery =
        !normalized ||
        [conversation.nome, conversation.telefone, conversation.email ?? ""].some((value) =>
          value.toLocaleLowerCase("pt-BR").includes(normalized),
        );
      const matchesFilter =
        filter === "all" ||
        (filter === "qualified"
          ? conversation.status === "distributed" ||
            conversation.aiConversation?.status === "CLOSED" ||
            ["hot", "warm", "cold", "qualified", "disqualified"].includes(conversation.status)
          : filter === "ai_active"
            ? Boolean(conversation.aiConversation) && conversation.messages.some((m) => m.direction === "incoming" || m.direction === "inbound" || (m.direction !== "outgoing" && m.direction !== "outbound"))
            : filter === "human_active"
              ? conversation.aiConversation?.status === "HUMAN_ACTIVE" || conversation.aiConversation?.status === "WAITING_HUMAN"
              : filter === "with_messages"
                ? conversation.messages.length > 0
                : conversation.messages.length === 0);
      const matchesBranch = branchFilter === "all" || conversation.branchId === branchFilter;

      return matchesQuery && matchesFilter && matchesBranch;
    });
  }, [branchFilter, conversations, filter, query]);

  function updateSelectedLeadInUrl(leadId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (leadId) params.set("leadId", leadId);
    else params.delete("leadId");
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    updateSelectedLeadInUrl(id);
  }

  function returnToList() {
    setSelectedId(null);
    updateSelectedLeadInUrl(null);
  }

  function handleUpdateConversation(leadId: string, updates: Partial<ConversationItem>) {
    setConversations((prev) =>
      prev.map((item) => {
        if (item.id === leadId) {
          const nextAi = updates.aiConversation
            ? { ...item.aiConversation, ...updates.aiConversation }
            : item.aiConversation;
          return { ...item, ...updates, aiConversation: nextAi as any };
        }
        return item;
      })
    );
  }

  return (
    <section
      aria-label="Central de conversas"
      className="flex h-[calc(100dvh-var(--header-height,3.5rem))] w-full flex-col overflow-hidden bg-card"
    >
      <header className="shrink-0 border-b border-border bg-card px-4 py-2.5 sm:px-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Atendimentos</h2>
              <Badge className="tabular-nums" variant="secondary">
                {conversations.length}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Histórico e contexto de cada lead no seu escopo.</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 overflow-x-auto max-w-full no-scrollbar py-0.5">
            {role === "director" && branches.length > 0 ? (
              <Select
                labels={{ all: "Todas as unidades", ...Object.fromEntries(branches.map((branch) => [branch.id, branch.name])) }}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
                value={branchFilter}
              >
                <SelectTrigger aria-label="Filtrar atendimentos por unidade" className="w-auto min-w-[140px] shrink-0" size="sm">
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <div className="flex items-center gap-1.5 shrink-0">
              <FilterChip active={filter === "all"} count={conversations.length} label="Todos" onClick={() => setFilter("all")} />
              <FilterChip active={filter === "qualified"} count={conversations.filter((c) => c.status === "distributed" || c.aiConversation?.status === "CLOSED" || ["hot", "warm", "cold", "qualified"].includes(c.status)).length} label="Qualificados" onClick={() => setFilter("qualified")} />
              <FilterChip active={filter === "ai_active"} count={conversations.filter((c) => Boolean(c.aiConversation) && c.messages.some((m) => m.direction === "incoming" || m.direction === "inbound" || (m.direction !== "outgoing" && m.direction !== "outbound"))).length} label="Atendente Virtual" onClick={() => setFilter("ai_active")} />
              <FilterChip active={filter === "human_active"} count={conversations.filter((c) => c.aiConversation?.status === "HUMAN_ACTIVE" || c.aiConversation?.status === "WAITING_HUMAN").length} label="Atendimento Humano" onClick={() => setFilter("human_active")} />
            </div>
          </div>
        </div>
      </header>

      <div
          className={cn(
            "grid min-h-0 flex-1 lg:grid-cols-[minmax(16rem,0.68fr)_minmax(0,1.65fr)]",
            profileOpen && "lg:grid-cols-[minmax(16rem,0.68fr)_minmax(0,1.65fr)_20rem]",
          )}
      >
        <section
          aria-label="Lista de atendimentos"
          className={cn("flex min-h-0 flex-col border-r border-border bg-card", selected && "max-lg:hidden")}
        >
          <div className="border-b border-border px-3 py-2.5">
            <div className="relative">
              <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar atendimento por nome, telefone ou e-mail"
                className="h-8 pl-8 text-xs"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, telefone ou e-mail"
                value={query}
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {filtered.map((conversation) => (
                <ConversationRow
                  active={conversation.id === selected?.id}
                  conversation={conversation}
                  key={conversation.id}
                  onClick={() => selectConversation(conversation.id)}
                />
              ))}
              {!filtered.length ? <EmptyConversationList hasQuery={Boolean(query || filter !== "all" || branchFilter !== "all")} /> : null}
            </div>
          </ScrollArea>
        </section>

        <section aria-live="polite" className={cn("flex min-h-0 flex-col bg-muted/15", !selected && "max-lg:hidden")}>
          {selected ? (
            <>
              <ConversationHeader
                client={selected}
                onBack={returnToList}
                onOpenProfile={() => setProfileSheetOpen(true)}
                onToggleProfile={() => setProfileOpen((open) => !open)}
                onUpdateConversation={handleUpdateConversation}
                profileOpen={profileOpen}
                userId={userId}
                tenantId={tenantId}
                role={role}
              />
              <ConversationHistory client={selected} />
              <ChatInput
                leadId={selected.id}
                onMessageSent={(msg) => {
                  setConversations((prev) =>
                    prev.map((item) =>
                      item.id === selected.id
                        ? {
                            ...item,
                            latestMessage: { body: msg.body, direction: msg.direction, sentAt: msg.sentAt },
                            messages: [...item.messages, msg],
                          }
                        : item,
                    ),
                  );
                }}
              />
            </>
          ) : (
            <EmptyConversation />
          )}
        </section>

        <aside
          aria-label="Perfil do cliente"
          className={cn("hidden min-h-0 overflow-y-auto border-l border-border bg-card lg:flex lg:flex-col", !profileOpen && "lg:hidden")}
        >
          {selected ? <ClientProfile client={selected} onUpdateConversation={handleUpdateConversation} /> : null}
        </aside>
      </div>

      <Sheet onOpenChange={setProfileSheetOpen} open={profileSheetOpen}>
        <SheetContent className="gap-0 p-0 lg:hidden" side="right">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Perfil do atendimento</SheetTitle>
                <SheetDescription>Contexto e ações disponíveis para {selected.nome}.</SheetDescription>
              </SheetHeader>
              <ClientProfile client={selected} onUpdateConversation={handleUpdateConversation} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function ConversationHeader({
  client,
  onBack,
  onOpenProfile,
  onToggleProfile,
  onUpdateConversation,
  profileOpen,
  userId,
  tenantId,
  role,
}: {
  client: ConversationItem;
  onBack: () => void;
  onOpenProfile: () => void;
  onToggleProfile: () => void;
  onUpdateConversation?: (leadId: string, updates: Partial<ConversationItem>) => void;
  profileOpen: boolean;
  userId?: string;
  tenantId?: string;
  role?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const aiStatus = client.aiConversation?.status ?? "NEW";
  const isHumanActive = aiStatus === "HUMAN_ACTIVE";
  const isWaitingHuman = aiStatus === "WAITING_HUMAN";
  const isAiActive = aiStatus === "AI_ACTIVE" || aiStatus === "WAITING_CUSTOMER";
  const isAssignedToMe = client.aiConversation?.assignedUserId === userId;

  async function handleTakeover() {
    if (!client.aiConversation?.id) return;
    onUpdateConversation?.(client.id, {
      aiConversation: { ...client.aiConversation, status: "HUMAN_ACTIVE" },
    });
    setIsPending(true);
    await takeoverConversationAction(client.aiConversation.id);
    setIsPending(false);
    router.refresh();
  }

  async function handleResetChat() {
    if (!client.aiConversation?.id) return;
    if (!confirm("Tem certeza que deseja resetar a qualificação da inteligência artificial e limpar a memória deste lead? O robô de IA iniciará a conversa do zero.")) return;
    onUpdateConversation?.(client.id, {
      messages: [],
      aiConversation: { ...client.aiConversation, status: "AI_ACTIVE" },
    });
    setIsPending(true);
    const toastId = toast.loading("Resetando qualificação da IA...");
    try {
      const res = await resetAiConversationAction(client.aiConversation.id);
      if (res.success) {
        toast.success("Conversa e memória da IA resetadas com sucesso!", { id: toastId });
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao resetar conversa.", { id: toastId });
      }
    } catch {
      toast.error("Erro inesperado ao resetar conversa.", { id: toastId });
    } finally {
      setIsPending(false);
    }
  }

  async function handleResumeAi() {
    if (client.aiConversation) {
      onUpdateConversation?.(client.id, {
        aiConversation: { ...client.aiConversation, status: "AI_ACTIVE" },
      });
    }
    setIsPending(true);
    const toastId = toast.loading("Iniciando/retomando qualificação por IA...");
    try {
      const result = await resumeAiQualificationAction(client.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao iniciar qualificação da IA.", { id: toastId });
      } else {
        toast.success("Qualificação por IA iniciada! Primeira mensagem enviada.", { id: toastId });
        router.refresh();
      }
    } catch {
      toast.error("Erro inesperado ao iniciar atendimento da IA.", { id: toastId });
    } finally {
      setIsPending(false);
    }
  }

  async function handleSyncChat() {
    setIsPending(true);
    const toastId = toast.loading("Sincronizando histórico do chat...");
    try {
      const result = await syncSingleLeadConversationAction(client.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao sincronizar histórico.", { id: toastId });
      } else {
        toast.success(`Chat sincronizado com sucesso! (${result.messagesCount ?? 0} mensagens)`, { id: toastId });
        router.refresh();
      }
    } catch {
      toast.error("Erro inesperado ao sincronizar chat.", { id: toastId });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <header className="shrink-0 border-b border-border bg-card px-4 py-2.5 sm:px-5">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button aria-label="Voltar para atendimentos" className="lg:hidden shrink-0" onClick={onBack} size="icon-sm" type="button" variant="ghost">
            <ArrowLeft className="size-3.5" />
          </Button>
          <ContactAvatar name={client.nome} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground truncate" title={client.nome}>{client.nome}</h2>
              <Badge className="hidden shrink-0 md:inline-flex" variant="outline">
                {LEAD_STATUS_LABELS[client.status] ?? client.status}
              </Badge>
              {isAiActive ? (
                <Badge className="hidden shrink-0 bg-primary/10 text-primary border-primary/25 sm:inline-flex" variant="outline">
                  Atendente Virtual
                </Badge>
              ) : isWaitingHuman ? (
                <Badge className="hidden shrink-0 bg-warning/15 text-warning border-warning/30 font-semibold sm:inline-flex" variant="outline">
                  Aguardando Humano
                </Badge>
              ) : isHumanActive ? (
                <Badge className="hidden shrink-0 bg-success/15 text-success border-success/30 font-semibold sm:inline-flex" variant="outline">
                  Atendimento Humano
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.telefone}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 shrink-0"
              disabled={isPending}
              onClick={handleResumeAi}
              size="sm"
              type="button"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden md:inline">Continuar Atendimento IA</span>
              <span className="md:hidden">Retomar IA</span>
            </Button>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Sincronizar chat deste lead"
                    disabled={isPending}
                    onClick={handleSyncChat}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
                  </Button>
                }
              />
              <TooltipContent>Sincronizar todo o chat</TooltipContent>
            </Tooltip>

            {role === "director" && client.aiConversation?.id && (
              <Button
                className="hidden xl:inline-flex h-8 text-xs font-semibold gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                disabled={isPending}
                onClick={handleResetChat}
                size="sm"
                variant="outline"
              >
                Resetar Chat IA
              </Button>
            )}

            {client.aiConversation?.id && (
              isHumanActive ? (
                !isAssignedToMe && (role === "director" || role === "manager") ? (
                  <Button
                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                    disabled={isPending}
                    onClick={handleTakeover}
                    size="sm"
                  >
                    <span className="hidden lg:inline">Assumir e pausar automação</span>
                    <span className="lg:hidden">Assumir</span>
                  </Button>
                ) : null
              ) : (
                <Button
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                  disabled={isPending}
                  onClick={handleTakeover}
                  size="sm"
                >
                  <span className="hidden lg:inline">Assumir e pausar automação</span>
                  <span className="lg:hidden">Assumir</span>
                </Button>
              )
            )}
          </div>

          <div className="flex items-center gap-1 border-l border-border/60 pl-1.5 sm:pl-2">
            <Tooltip>
              <TooltipTrigger render={<a href={`tel:${client.telefone.replace(/\D/g, "")}`} aria-label="Ligar para cliente" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} />} />
              <TooltipContent>Ligar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<a href={getWhatsAppUrl(client.telefone)} rel="noreferrer" target="_blank" aria-label="Abrir WhatsApp do cliente" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}><WhatsappLogo className="size-3.5" /></a>} />
              <TooltipContent>Abrir WhatsApp</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button aria-label="Abrir perfil do atendimento" className="lg:hidden" onClick={onOpenProfile} size="icon-sm" type="button" variant="ghost"><UserList className="size-3.5" /></Button>} />
              <TooltipContent>Ver perfil</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Link href={`/leads/${client.id}`} aria-label="Abrir lead completo" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}><ArrowSquareOut className="size-3.5" /></Link>} />
              <TooltipContent>Abrir lead</TooltipContent>
            </Tooltip>
            <div className="hidden border-l border-border/60 pl-1 lg:block">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={profileOpen ? "Recolher painel lateral" : "Expandir painel lateral"}
                      onClick={onToggleProfile}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      {profileOpen ? (
                        <PanelRightClose className="size-4 text-muted-foreground hover:text-foreground" />
                      ) : (
                        <PanelRightOpen className="size-4 text-muted-foreground hover:text-foreground" />
                      )}
                    </Button>
                  }
                />
                <TooltipContent>{profileOpen ? "Recolher painel" : "Expandir painel"}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function FilterChip({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "border-primary/20 bg-primary/[0.08] text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
    </button>
  );
}

function ConversationHistory({ client }: { client: ConversationItem }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Chronological order: oldest first, newest at bottom ("o mais recente no fim")
  const sortedMessages = useMemo(() => {
    return [...client.messages].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
  }, [client.messages]);

  // Group messages by Date ("Hoje", "Ontem", "15 de Agosto de 2026")
  const messagesByDate = useMemo(() => {
    const map = new Map<string, ConversationMessage[]>();
    for (const msg of sortedMessages) {
      const dateKey = formatDateDivider(msg.sentAt);
      const list = map.get(dateKey) ?? [];
      list.push(msg);
      map.set(dateKey, list);
    }
    return Array.from(map.entries());
  }, [sortedMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages.length, client.id]);

  if (!sortedMessages.length) {
    return <HistoryEmptyState client={client} />;
  }

  const getGroupKey = (dir: string) => {
    return dir === "outgoing" || dir === "outbound" ? "system" : "client";
  };

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
        {messagesByDate.map(([dateLabel, msgs], dateIdx) => {
          const grouped = msgs.reduce<{ type: "system" | "client"; messages: ConversationMessage[] }[]>(
            (acc, msg) => {
              const type = getGroupKey(msg.direction);
              const last = acc[acc.length - 1];
              if (last && last.type === type) {
                last.messages.push(msg);
              } else {
                acc.push({ type, messages: [msg] });
              }
              return acc;
            },
            [],
          );

          return (
            <div key={dateLabel || dateIdx} className="flex flex-col gap-3">
              {/* Date Separator Pill */}
              <div className="my-2 flex items-center justify-center gap-3">
                <div className="h-[1px] flex-1 bg-border/50" />
                <span className="rounded-full bg-muted/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-2xs border border-border/60">
                  {dateLabel}
                </span>
                <div className="h-[1px] flex-1 bg-border/50" />
              </div>

              {grouped.map((group, gi) => (
                <MessageGroup key={gi}>
                  {group.messages.map((message, mi) => (
                    <MessageRow
                      clientName={client.nome}
                      key={message.id}
                      message={message}
                      showAvatar={mi === group.messages.length - 1}
                      showHeader={mi === 0}
                    />
                  ))}
                </MessageGroup>
              ))}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function ChatInput({
  leadId,
  onMessageSent,
}: {
  leadId: string;
  onMessageSent: (msg: ConversationMessage) => void;
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
          leadId,
          body: res.message.body,
          direction: res.message.direction,
          sentAt: res.message.sentAt.toISOString(),
        });
      } else {
        setError(res.error ?? "Erro ao enviar mensagem.");
      }
    } catch (err) {
      setError("Erro de rede ou permissão ao enviar mensagem.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3 sm:px-5">
      <form onSubmit={handleSend} className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem para o cliente..."
            disabled={isPending}
            className="pr-10 h-10 text-sm"
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

function MessageSenderBadge({
  direction,
  senderRole,
}: {
  direction: string;
  senderRole?: string | null;
}) {
  const isOutbound = direction === "outgoing" || direction === "outbound";

  if (isOutbound) {
    if (senderRole === "assistant" || direction === "outbound") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/[0.08] px-1.5 py-0.5 text-[10px] font-semibold tracking-tight text-primary">
          <Sparkles className="size-2.5" />
          IA Assistente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-tight text-foreground">
        Atendente Humano
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/40" />
      Cliente
    </span>
  );
}

function MessageStatusIndicator({
  status,
  direction,
}: {
  status?: string | null;
  direction: string;
}) {
  const isOutbound = direction === "outgoing" || direction === "outbound";
  if (!isOutbound) return null;

  switch (status) {
    case "read":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success" title="Mensagem lida pelo cliente (WhatsApp)">
          <span aria-hidden="true" className="text-xs font-extrabold leading-none">✓✓</span>
          Lida
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground" title="Entregue no WhatsApp do cliente">
          <span aria-hidden="true" className="text-xs font-bold leading-none">✓✓</span>
          Entregue
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive" title="Falha ao entregar mensagem">
          <span aria-hidden="true" className="grid size-3 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive text-[9px] font-bold">!</span>
          Falha
        </span>
      );
    case "queued":
    case "sending":
      return (
        <Marker className="min-h-0 w-auto gap-1.5 text-[10px] font-medium text-muted-foreground" role="status">
          <MarkerIcon>
            <Clock className="size-2.5 animate-spin" />
          </MarkerIcon>
          <MarkerContent>Enviando...</MarkerContent>
        </Marker>
      );
    case "sent":
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground" title="Enviada ao servidor Meta">
          <span aria-hidden="true" className="text-xs font-bold leading-none">✓</span>
          Enviada
        </span>
      );
  }
}

function MessageRow({
  message,
  clientName,
  showAvatar,
  showHeader,
}: {
  message: ConversationMessage;
  clientName: string;
  showAvatar: boolean;
  showHeader: boolean;
}) {
  const isOutbound = message.direction === "outgoing" || message.direction === "outbound";

  return (
    <Message align={isOutbound ? "end" : "start"} className="ct-reveal-fast">
      {isOutbound ? null : (
        <MessageAvatar aria-hidden={!showAvatar} className={cn(!showAvatar && "invisible")}>
          {showAvatar ? <ContactAvatar className="size-8" name={clientName} /> : null}
        </MessageAvatar>
      )}

      <MessageContent>
        {showHeader ? (
          <MessageHeader>
            <MessageSenderBadge direction={message.direction} senderRole={message.senderRole} />
          </MessageHeader>
        ) : null}

        <Bubble align={isOutbound ? "end" : "start"} variant={isOutbound ? "default" : "outline"}>
          <BubbleContent
            className={cn(
              "max-w-lg text-xs leading-relaxed",
              isOutbound ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <p className="whitespace-pre-wrap leading-5">{message.body}</p>
          </BubbleContent>
        </Bubble>

        <MessageFooter>
          <time dateTime={message.sentAt} className="tabular-nums">
            {formatTime(message.sentAt)}
          </time>
          {isOutbound ? (
            <>
              <span aria-hidden="true" className="opacity-60">•</span>
              <MessageStatusIndicator status={message.providerStatus} direction={message.direction} />
            </>
          ) : null}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

function HistoryEmptyState({ client }: { client: ConversationItem }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const isAi = client.aiConversation?.status === "AI_ACTIVE" || client.aiConversation?.status === "WAITING_CUSTOMER";
  const summary = client.aiConversation?.qualificationSummary;

  async function handleStartAi() {
    setIsPending(true);
    const toastId = toast.loading("Iniciando qualificação por IA...");
    try {
      const result = await resumeAiQualificationAction(client.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao iniciar qualificação.", { id: toastId });
      } else {
        toast.success("Qualificação por IA iniciada! Primeira mensagem enviada.", { id: toastId });
        router.refresh();
      }
    } catch {
      toast.error("Erro inesperado ao iniciar qualificação.", { id: toastId });
    } finally {
      setIsPending(false);
    }
  }

  async function handleSync() {
    setIsPending(true);
    const toastId = toast.loading("Sincronizando histórico do chat...");
    try {
      const result = await syncSingleLeadConversationAction(client.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao sincronizar.", { id: toastId });
      } else {
        toast.success(`Chat sincronizado! (${result.messagesCount ?? 0} mensagens)`, { id: toastId });
        router.refresh();
      }
    } catch {
      toast.error("Erro inesperado ao sincronizar chat.", { id: toastId });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md space-y-4 text-center">
        <EmptyState
          animated
          icon={ChatCircleText}
          title={isAi ? "Qualificação por IA em andamento" : "Aguardando histórico de mensagens"}
          description={
            summary
              ? `Resumo da qualificação: ${summary}`
              : isAi
                ? "A Inteligência Artificial está qualificando o lead via WhatsApp. Caso envie uma mensagem abaixo, você assumirá a conversa."
                : "Este atendimento ainda não possui histórico sincronizado. Você pode forçar a sincronização ou iniciar o atendimento por IA."
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                disabled={isPending}
                onClick={handleStartAi}
                size="sm"
                type="button"
              >
                <Sparkles className="size-4" />
                {isAi ? "Continuar Qualificação IA" : "Iniciar Qualificação por IA"}
              </Button>
              <Button
                disabled={isPending}
                onClick={handleSync}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
                Sincronizar Chat
              </Button>
              <Button render={<a href={getWhatsAppUrl(client.telefone)} rel="noreferrer" target="_blank" />} size="sm" variant="ghost">
                <WhatsappLogo className="size-4" />
                Abrir WhatsApp
                <ArrowSquareOut className="size-4" />
              </Button>
            </div>
          }
        />
        {client.aiConversation?.transferReason && (
          <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground text-left">
            <strong>Contexto do Atendimento Virtual:</strong> {client.aiConversation.transferReason}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationChannelNotice({ phone }: { phone: string }) {
  return (
    <div className="border-t border-border bg-card px-4 py-3 sm:px-5">
      <ContextNote className="bg-muted/80 border-border/70" title="Envio no chat interno ainda indisponível" variant="warning">
        Use o WhatsApp para enviar novas mensagens. O histórico exibido aqui é somente leitura nesta etapa.
        <Button className="ml-2 align-middle" render={<a href={getWhatsAppUrl(phone)} rel="noreferrer" target="_blank" />} size="xs" variant="outline">
          <WhatsappLogo className="size-3.5" />
          Abrir WhatsApp
        </Button>
      </ContextNote>
    </div>
  );
}

function EmptyConversationList({ hasQuery }: { hasQuery: boolean }) {
  return (
    <EmptyState
      animated
      icon={MagnifyingGlass}
      title="Nenhum atendimento encontrado"
      description={hasQuery ? "Ajuste a busca ou os filtros para encontrar outro atendimento." : "Os atendimentos disponíveis no seu escopo aparecerão aqui."}
      className="px-5 py-12"
    />
  );
}

function EmptyConversation() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <EmptyState
        animated
        variant="ghost"
        icon={ChatCircleText}
        title="Selecione um atendimento"
        description="Escolha um contato na lista para consultar o histórico, o contexto do lead e as próximas ações."
      />
    </div>
  );
}

function renderRowQualificationBadge(conversation: ConversationItem) {
  const qualStatus = (conversation.qualificationStatus || "").toLowerCase();
  const leadStatus = (conversation.status || "").toLowerCase();
  const isDistributedOrQualified =
    leadStatus === "distributed" ||
    conversation.aiConversation?.status === "CLOSED" ||
    Boolean(qualStatus && qualStatus !== "pending" && qualStatus !== "qualifying");

  if (isDistributedOrQualified) {
    const targetStatus = qualStatus || leadStatus;
    if (targetStatus.includes("hot") || targetStatus.includes("quente")) {
      return (
        <Badge variant="outline" className="max-w-32 truncate px-1.5 text-[10px] border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
          Quente 🔥
        </Badge>
      );
    }
    if (targetStatus.includes("warm") || targetStatus.includes("morno")) {
      return (
        <Badge variant="outline" className="max-w-32 truncate px-1.5 text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
          Morno ☀️
        </Badge>
      );
    }
    if (targetStatus.includes("cold") || targetStatus.includes("frio")) {
      return (
        <Badge variant="outline" className="max-w-32 truncate px-1.5 text-[10px] border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
          Frio ❄️
        </Badge>
      );
    }
    if (targetStatus.includes("disqualified") || targetStatus.includes("desqualificado") || targetStatus.includes("wrong") || targetStatus.includes("opt")) {
      return (
        <Badge variant="outline" className="max-w-32 truncate px-1.5 text-[10px] border-gray-500/30 bg-gray-500/10 text-muted-foreground font-medium">
          Desqualificado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="max-w-32 truncate px-1.5 text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
        Qualificado ✓
      </Badge>
    );
  }

  return (
    <Badge className="max-w-32 truncate px-1.5 text-[10px]" variant="outline">
      {LEAD_STATUS_LABELS[conversation.status] ?? conversation.status}
    </Badge>
  );
}

function ConversationRow({ active, conversation, onClick }: { active: boolean; conversation: ConversationItem; onClick: () => void }) {
  const hasHistory = conversation.messages.length > 0;
  const preview = conversation.latestMessage?.body ?? "Nenhuma mensagem sincronizada.";

  return (
    <button
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "bg-muted/80" : "hover:bg-muted/65",
      )}
      onClick={onClick}
      type="button"
    >
      <ContactAvatar className="mt-0.5 shrink-0" name={conversation.nome} />
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="truncate text-sm font-medium">{conversation.nome}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {formatRelative(conversation.latestMessage?.sentAt ?? conversation.stageEnteredAt)}
          </span>
        </span>
        <span className="truncate text-xs leading-5 text-muted-foreground">
          {conversation.latestMessage?.direction === "outgoing" || conversation.latestMessage?.direction === "outbound" ? "Você: " : ""}
          {preview}
        </span>
        <span className="flex items-center gap-2 pt-0.5">
          {renderRowQualificationBadge(conversation)}
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock aria-hidden="true" className="size-3" />
            {hasHistory ? `${conversation.messages.length} mensagens` : "Aguardando histórico"}
          </span>
        </span>
      </span>
    </button>
  );
}

function formatDateDivider(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return "Hoje";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function renderQualificationRatingBadge(status: string, qualStatus?: string | null) {
  const norm = (qualStatus || status || "").toLowerCase();
  if (norm.includes("hot") || norm.includes("quente")) {
    return (
      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs gap-1">
        🔥 Quente (Alta Prioridade)
      </Badge>
    );
  }
  if (norm.includes("warm") || norm.includes("morno")) {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs gap-1">
        ☀️ Morno (Interessado)
      </Badge>
    );
  }
  if (norm.includes("cold") || norm.includes("frio")) {
    return (
      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium text-xs gap-1">
        ❄️ Frio / Sem Resposta
      </Badge>
    );
  }
  if (norm.includes("disqualified") || norm.includes("wrong") || norm.includes("opt")) {
    return (
      <Badge variant="outline" className="border-gray-500/30 bg-gray-500/10 text-muted-foreground font-medium text-xs gap-1">
        Desqualificado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs gap-1">
      ✓ Lead Qualificado
    </Badge>
  );
}

function ClientProfile({
  client,
  onUpdateConversation,
}: {
  client: ConversationItem;
  onUpdateConversation?: (leadId: string, updates: Partial<ConversationItem>) => void;
}) {
  const approvedDocuments = client.documents.filter((document) => document.status === "approved").length;
  const pendingDocuments = client.documents.filter((document) => document.status === "pending").length;
  const sharedMedia = getSharedMedia(client.messages);

  const [openQualifyDialog, setOpenQualifyDialog] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const router = useRouter();

  const isQualified =
    client.status === "distributed" ||
    client.aiConversation?.status === "CLOSED" ||
    ["hot", "warm", "cold", "qualified", "disqualified"].includes(client.status);

  async function handleRevertToQualifying() {
    onUpdateConversation?.(client.id, {
      status: "new",
      qualificationStatus: "pending",
      aiConversation: client.aiConversation ? { ...client.aiConversation, status: "AI_ACTIVE" } : null,
    });
    setIsReverting(true);
    const res = await manuallyChangeQualificationStageAction({
      leadId: client.id,
      targetStage: "qualificacoes",
    });
    setIsReverting(false);
    if (res.success) {
      toast.success("Lead movido de volta para a fila de qualificação!");
      router.refresh();
    } else {
      toast.error(res.error ?? "Erro ao mover lead para qualificação.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-start gap-3">
          <ContactAvatar className="size-11 text-sm" name={client.nome} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight">{client.nome}</h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.telefone}</p>
              </div>
              <Badge className="shrink-0" variant="outline">
                {LEAD_STATUS_LABELS[client.status] ?? client.status}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              <OwnershipContext brokerName={client.corretorNome} branchName={client.branchName} />
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ProfileAction label="Ligar" render={<a href={`tel:${client.telefone.replace(/\D/g, "")}`} />}><Phone className="size-4" /></ProfileAction>
          <ProfileAction label="WhatsApp" render={<a href={getWhatsAppUrl(client.telefone)} rel="noreferrer" target="_blank" />}><WhatsappLogo className="size-4" /></ProfileAction>
          <ProfileAction label="Abrir lead" render={<Link href={`/leads/${client.id}`} />}><ArrowSquareOut className="size-4" /></ProfileAction>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          {isQualified ? (
            <ProfileSection title="Status de Qualificação">
              <div className="rounded-lg border border-border/80 bg-card p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Classificação</span>
                  {renderQualificationRatingBadge(client.status, client.qualificationStatus)}
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground">Fila de Atendimento</span>
                  <span className="text-xs font-semibold text-foreground">Distribuição Geral</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 justify-center mt-1"
                  disabled={isReverting}
                  onClick={handleRevertToQualifying}
                >
                  <RotateCcw className="size-3 text-amber-500 shrink-0" />
                  <span>{isReverting ? "Revertendo..." : "Reabrir Qualificação por IA"}</span>
                </Button>
              </div>
            </ProfileSection>
          ) : (
            <ProfileSection title="Estágio & Qualificação">
              <div className="rounded-lg border border-border/80 bg-card p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Altere manualmente a etapa de qualificação do lead.
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 justify-center"
                    disabled={isReverting}
                    onClick={handleRevertToQualifying}
                  >
                    <RotateCcw className="size-3.5 text-amber-500 shrink-0" />
                    <span>{isReverting ? "Movendo..." : "Mover p/ Qualificação"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 justify-center font-medium"
                    onClick={() => setOpenQualifyDialog(true)}
                  >
                    <Sparkle className="size-3.5 shrink-0" />
                    <span>Qualificar Lead</span>
                  </Button>
                </div>
              </div>
            </ProfileSection>
          )}

          <ManualQualificationDialog
            open={openQualifyDialog}
            onOpenChange={setOpenQualifyDialog}
            leadId={client.id}
            leadName={client.nome}
          />

          {client.aiConversation ? (
            <ProfileSection title="Atendimento Virtual">
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Status</span>
                  <Badge variant="outline" className="text-[11px] font-medium">
                    {client.aiConversation.status === "HUMAN_ACTIVE"
                      ? "Humano Assumiu"
                      : client.aiConversation.status === "WAITING_HUMAN"
                        ? "Aguardando Humano"
                        : "IA Ativa"}
                  </Badge>
                </div>
                {client.aiConversation.transferReason ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Motivo da Transferência</p>
                    <p className="text-xs text-foreground mt-0.5">{client.aiConversation.transferReason}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Modelo</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{client.aiConversation.aiModel || "openrouter/auto"}</p>
                </div>
              </div>
            </ProfileSection>
          ) : null}

          {/* Exibe tarefas e documentos apenas para leads em fases comerciais avançadas */}
          {["documentation_pending", "under_analysis", "converted", "negotiation"].includes(client.status) ? (
            <>
              <ProfileSection title="Próximas ações">
                <div className="flex flex-col gap-2">
                  <Button className="w-full justify-start gap-2" render={<Link href={`/leads/${client.id}`} />} size="sm" variant="outline">
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">Ver tarefas e documentos</span>
                  </Button>
                  <Button className="w-full justify-start gap-2" render={<Link href={`/leads/${client.id}#documentos`} />} size="sm" variant="outline">
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">Adicionar documento</span>
                  </Button>
                </div>
              </ProfileSection>

              <ProfileSection action={<Link className="text-xs font-medium text-primary hover:underline" href={`/leads/${client.id}`}>Ver todos</Link>} title="Documentos">
                <div className="grid grid-cols-2 gap-2">
                  <ProfileMetric label="Aprovados" value={approvedDocuments} />
                  <ProfileMetric label="Em análise" tone="warning" value={pendingDocuments} />
                </div>
                {client.documents.length ? (
                  <div className="mt-3 space-y-1.5">
                    {client.documents.slice(0, 3).map((document) => (
                      <a className="flex items-center gap-2 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" href={document.fileUrl} key={document.id} rel="noreferrer" target="_blank">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/[0.08] text-primary"><FileText className="size-3.5" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{document.requirementName ?? document.filename}</span><span className="block truncate text-[11px] text-muted-foreground">{document.requirementName ? document.filename : documentStatusLabel(document.status)}</span></span>
                        <ArrowSquareOut className="size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                ) : <EmptyState variant="inline" icon={FileText} title="Nenhum documento importado." />}
              </ProfileSection>
            </>
          ) : null}

          {sharedMedia.length ? (
            <ProfileSection action={<span className="text-xs tabular-nums text-muted-foreground">{sharedMedia.length}</span>} title="Links compartilhados">
              <div className="space-y-1.5">
                {sharedMedia.slice(0, 3).map((media) => (
                  <a className="flex items-center gap-2 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" href={media.url} key={media.url} rel="noreferrer" target="_blank">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><LinkSimple className="size-3.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{media.label}</span><span className="block truncate text-[11px] text-muted-foreground">Compartilhado {formatRelative(media.sentAt)}</span></span>
                    <ArrowSquareOut className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </ProfileSection>
          ) : null}

          <ProfileSection title="Resumo do atendimento">
            <dl className="grid grid-cols-2 gap-2">
              <ProfileTag label="Origem" value={client.origem} />
              <ProfileTag label="Plano" value={client.planName ?? "Não informado"} />
              {client.carrierName ? <ProfileTag label="Operadora" value={client.carrierName} /> : null}
              <ProfileTag label="Consentimento" tone={client.consentimentoLgpd ? "success" : "warning"} value={client.consentimentoLgpd ? "Registrado" : "Não registrado"} />
            </dl>
          </ProfileSection>
        </div>
      </ScrollArea>
    </div>
  );
}

function ProfileSection({ action, children, title }: { action?: ReactNode; children: ReactNode; title: string }) {
  return <section><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-foreground">{title}</h3>{action}</div><div className="mt-2.5">{children}</div></section>;
}

function ProfileAction({ children, label, render }: { children: ReactNode; label: string; render: React.ReactElement<any> }) {
  return <Button className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-[11px]" render={render} size="sm" variant="outline">{children}<span className="truncate">{label}</span></Button>;
}

function ProfileMetric({ label, tone, value }: { label: string; tone?: "warning"; value: number }) {
  return <div className={cn("min-w-0 rounded-lg border border-border px-2.5 py-2", tone === "warning" && "border-warning/25 bg-accent/[0.06]")}><p className="truncate text-[11px] text-muted-foreground">{label}</p><p className={cn("mt-1 text-lg font-semibold tabular-nums", tone === "warning" && "text-warning")}>{value}</p></div>;
}

function ProfileTag({ label, tone, value }: { label: string; tone?: "success" | "warning"; value: string }) {
  return <div className="min-w-0 rounded-lg border border-border bg-muted/25 px-2.5 py-2"><dt className="truncate text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</dt><dd className={cn("mt-1 truncate text-xs font-medium", tone === "success" && "text-success", tone === "warning" && "text-warning")}>{value}</dd></div>;
}

function ContactAvatar({ className, name }: { className?: string; name: string }) {
  return <UserAvatar seed={name} name={name} className={className} />;
}

function documentStatusLabel(status: string) {
  return status === "approved" ? "Aprovado" : status === "pending" ? "Em análise" : status === "rejected" ? "Rejeitado" : status;
}

function getSharedMedia(messages: ConversationMessage[]) {
  const found = new Map<string, { url: string; label: string; sentAt: string }>();
  for (const message of messages) {
    for (const match of message.body.matchAll(/https?:\/\/[^\s<]+/g)) {
      const url = match[0].replace(/[),.!?]+$/, "");
      if (found.has(url)) continue;
      try {
        found.set(url, { url, label: new URL(url).hostname.replace(/^www\./, ""), sentAt: message.sentAt });
      } catch {
        // Ignore malformed URLs found in message text.
      }
    }
  }
  return [...found.values()];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMessageDateTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday ? formatTime(value) : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatRelative(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60_000))} min`;
  if (diff < 24 * 60 * 60 * 1000) return formatTime(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function getWhatsAppUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
