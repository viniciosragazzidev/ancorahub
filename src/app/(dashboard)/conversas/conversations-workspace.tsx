"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/utils/supabase/client";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { cn } from "@/lib/utils";
import {
  takeoverConversationAction,
  closeConversationAction,
  resetAiConversationAction,
} from "@/features/ai-agent/actions";
import { sendLeadMessageAction } from "@/features/leads/actions/send-lead-message";

export type ConversationMessage = {
  id: string;
  leadId: string | null;
  body: string;
  direction: string;
  sentAt: string;
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

type ViewFilter = "all" | "ai_active" | "waiting_human" | "human_active" | "with_messages" | "without_messages";

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

  // ── Real-time: sync when server re-renders (e.g. after router.refresh()) ──
  // Only add new conversations that don't exist yet, preserve real-time message state
  useEffect(() => {
    setConversations((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newOnes = initialConversations.filter((c) => !existingIds.has(c.id));
      if (!newOnes.length) return prev;
      return [...prev, ...newOnes];
    });
  }, [initialConversations]);

  // ── Real-time: subscribe to new whatsapp_messages ──
  useEffect(() => {
    if (!tenantId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`conversas:messages:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const msg = payload.new as {
            id: string;
            lead_id: string | null;
            body: string;
            direction: string;
            sent_at: string;
          } | null;
          if (!msg?.lead_id) return;

          setConversations((prev) =>
            prev.map((conversation) => {
              if (conversation.id !== msg.lead_id) return conversation;
              if (conversation.messages.some((m) => m.id === msg.id)) return conversation;

              const newMessage: ConversationMessage = {
                id: msg.id,
                leadId: msg.lead_id,
                body: msg.body,
                direction: msg.direction,
                sentAt: msg.sent_at,
              };

              return {
                ...conversation,
                messages: [...conversation.messages, newMessage],
                latestMessage: {
                  body: msg.body,
                  direction: msg.direction,
                  sentAt: msg.sent_at,
                },
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // ── Real-time: subscribe to ai_conversations status changes ──
  useEffect(() => {
    if (!tenantId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`conversas:ai:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            lead_id: string | null;
            status: string;
            ai_model: string | null;
            transfer_reason: string | null;
            qualification_summary: string | null;
            assigned_user_id: string | null;
          } | null;
          if (!row?.lead_id) return;

          setConversations((prev) =>
            prev.map((conversation) => {
              if (conversation.id !== row.lead_id) return conversation;
              return {
                ...conversation,
                aiConversation: {
                  id: row.id,
                  status: row.status as AiConversationData["status"],
                  aiModel: row.ai_model,
                  transferReason: row.transfer_reason,
                  qualificationSummary: row.qualification_summary,
                  assignedUserId: row.assigned_user_id,
                },
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

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
        (filter === "ai_active"
          ? conversation.aiConversation?.status === "AI_ACTIVE" || conversation.aiConversation?.status === "WAITING_CUSTOMER"
          : filter === "waiting_human"
            ? conversation.aiConversation?.status === "WAITING_HUMAN"
            : filter === "human_active"
              ? conversation.aiConversation?.status === "HUMAN_ACTIVE"
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

  return (
    <section
      aria-label="Central de conversas"
      className="flex h-[calc(100dvh-var(--header-height,3.5rem))] w-full flex-col overflow-hidden bg-card"
    >
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 lg:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Atendimentos</h2>
              <Badge className="tabular-nums" variant="secondary">
                {conversations.length}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Histórico e contexto de cada lead no seu escopo.</p>
          </div>

          {role === "director" && branches.length > 0 ? (
            <Select
              labels={{ all: "Todas as unidades", ...Object.fromEntries(branches.map((branch) => [branch.id, branch.name])) }}
              onValueChange={(value) => setBranchFilter(value ?? "all")}
              value={branchFilter}
            >
              <SelectTrigger aria-label="Filtrar atendimentos por unidade" className="ml-auto w-full sm:ml-0 sm:w-52" size="sm">
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

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            <FilterChip active={filter === "all"} count={conversations.length} label="Todos" onClick={() => setFilter("all")} />
            <FilterChip active={filter === "ai_active"} count={conversations.filter((c) => c.aiConversation?.status === "AI_ACTIVE" || c.aiConversation?.status === "WAITING_CUSTOMER").length} label="Atendente Virtual" onClick={() => setFilter("ai_active")} />
            <FilterChip active={filter === "waiting_human"} count={conversations.filter((c) => c.aiConversation?.status === "WAITING_HUMAN").length} label="Aguardando Humano" onClick={() => setFilter("waiting_human")} />
            <FilterChip active={filter === "human_active"} count={conversations.filter((c) => c.aiConversation?.status === "HUMAN_ACTIVE").length} label="Atendimento Humano" onClick={() => setFilter("human_active")} />
          </div>

        </div>
      </header>

      <div
          className={cn(
            "grid min-h-0 flex-1 lg:grid-cols-[minmax(16rem,0.68fr)_minmax(0,1.65fr)]",
            profileOpen && "2xl:grid-cols-[minmax(16rem,0.68fr)_minmax(0,1.65fr)_20rem]",
          )}
      >
        <section
          aria-label="Lista de atendimentos"
          className={cn("flex min-h-0 flex-col border-r border-border bg-card", selected && "max-lg:hidden")}
        >
          <div className="space-y-3 border-b border-border px-3 py-3">
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
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar atendimentos">
              <FilterChip active={filter === "all"} count={conversations.length} label="Todos" onClick={() => setFilter("all")} />
              <FilterChip active={filter === "with_messages"} count={messagesWithHistory} label="Com histórico" onClick={() => setFilter("with_messages")} />
              <FilterChip active={filter === "without_messages"} count={conversations.length - messagesWithHistory} label="Sem histórico" onClick={() => setFilter("without_messages")} />
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
                profileOpen={profileOpen}
                userId={userId}
                tenantId={tenantId}
                role={role}
              />
              <ConversationHistory client={selected} />
              <ConversationChannelNotice phone={selected.telefone} />
            </>
          ) : (
            <EmptyConversation />
          )}
        </section>

        <aside
          aria-label="Perfil do cliente"
          className={cn("hidden min-h-0 overflow-y-auto border-l border-border bg-card 2xl:flex 2xl:flex-col", !profileOpen && "2xl:hidden")}
        >
          {selected ? <ClientProfile client={selected} /> : null}
        </aside>
      </div>

      <Sheet onOpenChange={setProfileSheetOpen} open={profileSheetOpen}>
        <SheetContent className="gap-0 p-0 2xl:hidden" side="right">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Perfil do atendimento</SheetTitle>
                <SheetDescription>Contexto e ações disponíveis para {selected.nome}.</SheetDescription>
              </SheetHeader>
              <ClientProfile client={selected} />
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
  profileOpen,
  userId,
  tenantId,
  role,
}: {
  client: ConversationItem;
  onBack: () => void;
  onOpenProfile: () => void;
  onToggleProfile: () => void;
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
    if (!tenantId || !client.aiConversation?.id || !userId) return;
    setIsPending(true);
    await takeoverConversationAction(client.aiConversation.id);
    setIsPending(false);
    router.refresh();
  }

  async function handleResetChat() {
    if (!tenantId || !client.aiConversation?.id) return;
    if (!confirm("Tem certeza que deseja resetar a qualificação da inteligência artificial e limpar a memória deste lead? O robô de IA iniciará a conversa do zero.")) return;
    setIsPending(true);
    await resetAiConversationAction(client.aiConversation.id);
    setIsPending(false);
    router.refresh();
  }

  return (
    <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
      <Button aria-label="Voltar para atendimentos" className="lg:hidden" onClick={onBack} size="icon-sm" type="button" variant="ghost">
        <ArrowLeft className="size-3.5" />
      </Button>
      <ContactAvatar name={client.nome} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 flex-wrap">
          <h2 className="truncate text-sm font-semibold tracking-tight">{client.nome}</h2>
          <Badge className="hidden shrink-0 sm:inline-flex" variant="outline">
            {LEAD_STATUS_LABELS[client.status] ?? client.status}
          </Badge>
          {isAiActive ? (
            <Badge className="bg-primary/10 text-primary border-primary/25" variant="outline">
              Atendente Virtual
            </Badge>
          ) : isWaitingHuman ? (
            <Badge className="bg-warning/15 text-warning border-warning/30 font-semibold" variant="outline">
              Aguardando Humano
            </Badge>
          ) : isHumanActive ? (
            <Badge className="bg-success/15 text-success border-success/30 font-semibold" variant="outline">
              Atendimento Humano
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.telefone}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {role === "director" && client.aiConversation?.id && (
          <Button
            className="h-8 text-xs font-semibold gap-1.5 border-destructive text-destructive hover:bg-destructive/10"
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
                className="h-8 text-xs font-semibold gap-1.5 bg-primary/90 text-primary-foreground hover:bg-primary"
                disabled={isPending}
                onClick={handleTakeover}
                size="sm"
              >
                Assumir e pausar automação
              </Button>
            ) : null
          ) : (
            <Button
              className="h-8 text-xs font-semibold gap-1.5 bg-primary/90 text-primary-foreground hover:bg-primary"
              disabled={isPending}
              onClick={handleTakeover}
              size="sm"
            >
              Assumir e pausar automação
            </Button>
          )
        )}
        <Tooltip>
          <TooltipTrigger render={<Button aria-label="Ligar para cliente" render={<a href={`tel:${client.telefone.replace(/\D/g, "")}`} />} size="icon-sm" variant="ghost"><Phone className="size-3.5" /></Button>} />
          <TooltipContent>Ligar</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button aria-label="Abrir WhatsApp do cliente" render={<a href={getWhatsAppUrl(client.telefone)} rel="noreferrer" target="_blank" />} size="icon-sm" variant="ghost"><WhatsappLogo className="size-3.5" /></Button>} />
          <TooltipContent>Abrir WhatsApp</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button aria-label="Abrir perfil do atendimento" className="2xl:hidden" onClick={onOpenProfile} size="icon-sm" type="button" variant="ghost"><UserList className="size-3.5" /></Button>} />
          <TooltipContent>Ver perfil</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button aria-label="Abrir lead completo" render={<Link href={`/leads/${client.id}`} />} size="icon-sm" variant="ghost"><ArrowSquareOut className="size-3.5" /></Button>} />
          <TooltipContent>Abrir lead</TooltipContent>
        </Tooltip>
        <div className="ml-1 hidden border-l border-border pl-2 2xl:block">
          <Tooltip>
            <TooltipTrigger render={<Button aria-label={profileOpen ? "Recolher perfil do cliente" : "Mostrar perfil do cliente"} onClick={onToggleProfile} size="icon-sm" type="button" variant="ghost"><PanelLeftIcon className={cn("size-3.5", profileOpen && "rotate-180")} /></Button>} />
            <TooltipContent>{profileOpen ? "Recolher perfil" : "Mostrar perfil"}</TooltipContent>
          </Tooltip>
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
      <span className="tabular-nums text-[11px] opacity-75">{count}</span>
    </button>
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
          <Badge className="max-w-32 truncate px-1.5 text-[10px]" variant="outline">
            {LEAD_STATUS_LABELS[conversation.status] ?? conversation.status}
          </Badge>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock aria-hidden="true" className="size-3" />
            {hasHistory ? `${conversation.messages.length} mensagens` : "Aguardando histórico"}
          </span>
        </span>
      </span>
    </button>
  );
}

function ConversationHistory({ client }: { client: ConversationItem }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [client.messages.length]);

  if (!client.messages.length) {
    return <HistoryEmptyState phone={client.telefone} />;
  }

  const getGroupKey = (dir: string) => {
    return dir === "outgoing" || dir === "outbound" ? "system" : "client";
  };

  // Group consecutive messages by sender type for BubbleGroup
  const grouped = client.messages.reduce<{ type: "system" | "client"; messages: ConversationMessage[] }[]>(
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
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
        <p className="mb-1 self-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Histórico sincronizado
        </p>
        {grouped.map((group, gi) => (
          <BubbleGroup key={gi}>
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </BubbleGroup>
        ))}
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

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isSystem = message.direction === "outgoing" || message.direction === "outbound";

  return (
    <Bubble variant={isSystem ? "default" : "secondary"} align={isSystem ? "end" : "start"}>
      <BubbleContent className="[&>p]:whitespace-pre-wrap text-xs">
        <p className="leading-5">{message.body}</p>
        <div className={cn("mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground", isSystem && "justify-end")}>
          <span>
            {message.direction === "outbound"
              ? "Enviada (IA)"
              : message.direction === "outgoing"
                ? "Enviada"
                : "Recebida"}
          </span>
          <span aria-hidden="true">•</span>
          <time dateTime={message.sentAt}>{formatMessageDateTime(message.sentAt)}</time>
        </div>
      </BubbleContent>
    </Bubble>
  );
}

function HistoryEmptyState({ phone }: { phone: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-5 sm:p-8">
      <EmptyState
        animated
        icon={ChatCircleText}
        title="Nenhuma mensagem sincronizada"
        description="Este atendimento ainda não possui histórico na plataforma. Continue o contato pelo WhatsApp e o histórico aparecerá quando a sincronização estiver disponível."
        action={
          <Button render={<a href={getWhatsAppUrl(phone)} rel="noreferrer" target="_blank" />} size="sm">
            <WhatsappLogo className="size-4" />
            Abrir WhatsApp
            <ArrowSquareOut className="size-4" />
          </Button>
        }
      />
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

function ClientProfile({ client }: { client: ConversationItem }) {
  const approvedDocuments = client.documents.filter((document) => document.status === "approved").length;
  const pendingDocuments = client.documents.filter((document) => document.status === "pending").length;
  const sharedMedia = getSharedMedia(client.messages);

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

          <ProfileSection action={<span className="text-xs tabular-nums text-muted-foreground">{sharedMedia.length}</span>} title="Links compartilhados">
            {sharedMedia.length ? (
              <div className="space-y-1.5">
                {sharedMedia.slice(0, 3).map((media) => (
                  <a className="flex items-center gap-2 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" href={media.url} key={media.url} rel="noreferrer" target="_blank">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><LinkSimple className="size-3.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{media.label}</span><span className="block truncate text-[11px] text-muted-foreground">Compartilhado {formatRelative(media.sentAt)}</span></span>
                    <ArrowSquareOut className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            ) : <EmptyState variant="inline" icon={LinkSimple} title="Nenhum link identificado." />}
          </ProfileSection>

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

function ProfileAction({ children, label, render }: { children: ReactNode; label: string; render: React.ReactElement }) {
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
