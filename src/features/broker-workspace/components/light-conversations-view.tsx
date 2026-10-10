"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageSquareText } from "lucide-react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { recordWhatsAppOpenedAction } from "@/features/leads/whatsapp-open-action";
import { cn } from "@/lib/utils";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

export type BrokerInsightMessage = { id: string; body: string; direction: string; sentAt: string; providerStatus?: string | null };
export type BrokerConversationInsight = {
  id: string; kind: "lead" | "client"; name: string; phone: string | null; status: string; href: string;
  firstContactAt?: string | null; serviceStartedAt?: string | null;
  latestMessage: BrokerInsightMessage | null; messages: BrokerInsightMessage[];
  intelligence?: { summary?: string | null; nextBestAction?: string | null; pendingFrom?: string | null; sentiment?: string | null; customerIntent?: string | null; risk?: string | null; lastAnalyzedAt?: string | null; conversationStage?: string | null; engagement?: string | null; opportunity?: string | null; objections?: string[]; buyingSignals?: string[] } | null;
};

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-surface)",
  boxShadow: "var(--shadow-resting)",
};

const SUBCARD_STYLE: React.CSSProperties = {
  background: "var(--surface-muted)",
  borderRadius: "var(--radius-panel)",
};

/** Refresh after realtime events at most once every 2s, grouped (trailing). */
const REFRESH_DEBOUNCE_MS = 2000;

function formatDateTime(value?: string | null) {
  if (!value) return "Ainda não registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda não registrado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}
function isOutbound(direction: string) { return direction === "outgoing" || direction === "outbound"; }
function pendingLabel(value?: string | null) {
  return ({ BROKER: "Você precisa responder", CUSTOMER: "Aguardando o cliente", INTERNAL: "Há uma pendência interna", NONE: "Sem pendência identificada" } as Record<string, string>)[value ?? ""] ?? "Análise pendente";
}
function intentLabel(value?: string | null) {
  return ({ VERY_HIGH: "Muito alta", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" } as Record<string, string>)[value ?? ""] ?? value ?? null;
}
type Temperature = { tone: "warning" | "info" | "success" | "neutral"; label: string; rank: number };
function temperatureFor(item: BrokerConversationInsight): Temperature {
  if (item.intelligence?.risk || item.intelligence?.sentiment === "NEGATIVE") return { tone: "warning", label: "Exige atenção", rank: 0 };
  if (item.intelligence?.pendingFrom === "BROKER") return { tone: "info", label: "Sua ação", rank: 1 };
  if (item.intelligence?.sentiment === "POSITIVE" || ["HIGH", "VERY_HIGH"].includes(item.intelligence?.customerIntent ?? "")) return { tone: "success", label: "Bom avanço", rank: 2 };
  return { tone: "neutral", label: "Acompanhar", rank: 3 };
}

function nextActionLabel(item: BrokerConversationInsight) {
  return item.intelligence?.nextBestAction || pendingLabel(item.intelligence?.pendingFrom);
}

export function LightConversationsView({
  insights,
  initialLeadId,
  whatsappConnected,
  connectionStatus,
}: {
  insights: BrokerConversationInsight[];
  initialLeadId?: string;
  whatsappConnected: boolean;
  connectionStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");

  // The open conversation follows ?leadId (the app header back button clears it). A pick is kept
  // locally until the URL catches up, so selecting stays instant without a server render.
  const urlLeadId = searchParams.get("leadId");
  const [pick, setPick] = useState<{ url: string | null; id: string | null }>(() => ({ url: urlLeadId, id: urlLeadId ?? initialLeadId ?? null }));
  const selectedId = pick.url === urlLeadId ? pick.id : urlLeadId;

  // Realtime: agrupa os eventos e atualiza a lista no máximo uma vez a cada 2s.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.domain !== "conversations" && detail?.domain !== "whatsapp_connection") return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    return () => {
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [router]);

  // Prioridade de atenção primeiro (exige atenção, sua ação, bom avanço, acompanhar), depois a mais recente.
  const ordered = useMemo(
    () => [...insights].sort((a, b) => {
      const byTemperature = temperatureFor(a).rank - temperatureFor(b).rank;
      if (byTemperature !== 0) return byTemperature;
      return Date.parse(b.latestMessage?.sentAt ?? "") - Date.parse(a.latestMessage?.sentAt ?? "");
    }),
    [insights],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term ? ordered.filter((item) => `${item.name} ${item.phone ?? ""} ${item.status}`.toLocaleLowerCase("pt-BR").includes(term)) : ordered;
  }, [ordered, query]);

  const selected = useMemo(() => {
    return (selectedId ? insights.find((item) => item.id === selectedId) : null) ?? null;
  }, [insights, selectedId]);

  const select = (item: BrokerConversationInsight) => {
    setPick({ url: urlLeadId, id: item.id });
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("leadId", item.id);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="arc-venancor flex min-h-full flex-col" style={{ color: "var(--foreground)" }}>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-6 pt-2 sm:px-6">
        <header className={cn("space-y-1", selected && "hidden md:block")}>
          <h1 className="sr-only">Insights</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {insights.length === 1 ? "1 conversa ativa" : `${insights.length} conversas ativas`}
            <span className="mx-2" aria-hidden="true">·</span>
            <span style={{ color: whatsappConnected ? "var(--success)" : "var(--text-muted)" }}>
              {whatsappConnected ? "WhatsApp conectado" : `WhatsApp ${connectionStatus === "disconnected" ? "desconectado" : connectionStatus}`}
            </span>
            {whatsappConnected ? null : (
              <Link href="/settings?tab=whatsapp" className="ml-2 inline-flex min-h-11 items-center font-medium" style={{ color: "var(--accent-strong)" }}>
                Conectar
              </Link>
            )}
          </p>
        </header>

        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
          <aside className={cn(selected ? "hidden md:block" : "block")} aria-label="Carteira de conversas">
            <SearchField
              label="Buscar conversa"
              placeholder="Nome ou telefone"
              value={query}
              onValueChange={setQuery}
            />
            {filtered.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <InsightCard item={item} active={item.id === selected?.id} onSelect={() => select(item)} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 px-4 py-10" style={CARD_STYLE}>
                <EmptyState
                  label="Nenhuma conversa encontrada"
                  icon={<MessageSquareText width={24} height={24} strokeWidth={1.5} />}
                  title={query.trim() ? `Nenhum resultado para "${query.trim()}"` : "Nenhum insight disponível"}
                  description={query.trim()
                    ? "Tente outro nome ou telefone."
                    : "Assim que houver uma conversa vinculada a um lead ou cliente da sua carteira, ela aparecerá aqui."}
                  action={query.trim() ? <Button variant="secondary" onClick={() => setQuery("")}>Limpar busca</Button> : undefined}
                />
              </div>
            )}
          </aside>

          <AnimatePresence initial={false} mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.exit] } }}
                transition={reduceMotion ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
              >
                <InsightDetail item={selected} />
              </motion.div>
            ) : (
              <motion.div key="empty" className="hidden md:block" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: motionTokens.duration.fast }}>
                <div className="px-4 py-16" style={CARD_STYLE}>
                  <EmptyState
                    label="Selecione uma conversa"
                    icon={<MessageSquareText width={24} height={24} strokeWidth={1.5} />}
                    title="Escolha uma conversa"
                    description="Toque em um item da lista para ver o resumo da IA e a próxima ação."
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ item, active, onSelect }: { item: BrokerConversationInsight; active: boolean; onSelect: () => void }) {
  const temperature = temperatureFor(item);
  const intent = intentLabel(item.intelligence?.customerIntent);
  const risk = item.intelligence?.risk ?? null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className="w-full cursor-pointer p-4 text-left transition-transform active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
      style={{
        ...CARD_STYLE,
        borderRadius: "var(--radius-panel)",
        background: active ? "var(--accent-subtle)" : CARD_STYLE.background,
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={item.name} size="lg" className="light-avatar shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{item.name}</span>
            <Badge tone={temperature.tone} size="sm" className="shrink-0">{temperature.label}</Badge>
          </div>
          <p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {item.latestMessage
              ? `${isOutbound(item.latestMessage.direction) ? "Você" : "Cliente"}: ${item.latestMessage.body}`
              : "Sem conversa sincronizada"}
          </p>
          <p className="mt-1 text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {item.latestMessage ? `Última interação ${formatDateTime(item.latestMessage.sentAt)}` : "Aguardando primeira interação"}
          </p>
        </div>
      </div>

      {(intent || risk) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {intent && (
            <div className="min-w-0 px-3 py-2" style={SUBCARD_STYLE}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Intenção</p>
              <p className="mt-0.5 truncate text-xs font-medium" style={{ color: "var(--foreground)" }}>{intent}</p>
            </div>
          )}
          {risk && (
            <div className="min-w-0 px-3 py-2" style={SUBCARD_STYLE}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Atenção</p>
              <p className="mt-0.5 line-clamp-2 text-xs font-medium" style={{ color: "var(--warning)" }}>{risk}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 px-3 py-2" style={{ background: "var(--accent-subtle)", borderRadius: "var(--radius-panel)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--accent-strong)" }}>Próxima ação</p>
        <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--foreground)" }}>{nextActionLabel(item)}</p>
      </div>
    </button>
  );
}

function InsightDetail({ item }: { item: BrokerConversationInsight }) {
  const messages = [...item.messages].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  const whatsappUrl = buildWhatsAppUrl(item.phone);

  return (
    <article className="flex flex-col gap-4" aria-label={`Detalhe da conversa com ${item.name}`}>
      <div className="p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex items-start gap-3">
          <Avatar name={item.name} size="xl" className="light-avatar shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold" style={{ color: "var(--foreground)" }}>{item.name}</h2>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {item.kind === "lead" ? "Lead da sua carteira" : "Cliente da sua carteira"}
            </p>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>Último contato: </span>
                <span className="tabular-nums">{formatDateTime(item.latestMessage?.sentAt)}</span>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>Início do atendimento: </span>
                <span className="tabular-nums">{formatDateTime(item.serviceStartedAt ?? item.firstContactAt)}</span>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>Quem deve agir: </span>
                {pendingLabel(item.intelligence?.pendingFrom)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => { if (item.kind === "lead") void recordWhatsAppOpenedAction(item.id); }}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Abrir WhatsApp
            </a>
          ) : (
            <Button className="flex-1" disabled>
              Telefone indisponível
            </Button>
          )}
          <Link
            href={item.href}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold"
            style={{ background: "var(--surface-muted)", color: "var(--foreground)" }}
          >
            Ver lead
          </Link>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Para responder, use o WhatsApp no seu aparelho.
        </p>
      </div>

      <div className="p-4 sm:p-5" style={CARD_STYLE}>
        <h3 className="text-sm font-semibold">Leitura da IA</h3>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
          {item.intelligence?.summary || "Ainda não há análise suficiente. Continue atendendo pelo WhatsApp; quando houver mensagens vinculadas a este lead, os insights serão atualizados."}
        </p>
        <div className="mt-3 px-3 py-2" style={{ background: "var(--accent-subtle)", borderRadius: "var(--radius-panel)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--accent-strong)" }}>Próxima ação</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--foreground)" }}>{nextActionLabel(item)}</p>
        </div>
        {item.intelligence?.risk && (
          <div className="mt-2 px-3 py-2" style={{ background: "color-mix(in srgb, var(--warning) 10%, var(--surface))", borderRadius: "var(--radius-panel)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--warning)" }}>Atenção</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--foreground)" }}>{item.intelligence.risk}</p>
          </div>
        )}
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Análise baseada apenas nas mensagens sincronizadas desta conversa.
        </p>
      </div>

      <div className="p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Histórico sincronizado</h3>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{messages.length} mensagens</span>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Somente leitura. Conversas pessoais não são trazidas para o CRM.</p>
        <div className="mt-3 space-y-2">
          {messages.length ? messages.map((message) => (
            <div key={message.id} className={cn("flex", isOutbound(message.direction) ? "justify-end" : "justify-start")}>
              <div
                className="max-w-[85%] px-3 py-2 text-sm"
                style={isOutbound(message.direction)
                  ? { background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "var(--radius-panel) var(--radius-panel) 6px var(--radius-panel)" }
                  : { background: "var(--surface-muted)", color: "var(--foreground)", borderRadius: "var(--radius-panel) var(--radius-panel) var(--radius-panel) 6px" }}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <time className="mt-1 block text-right text-xs tabular-nums opacity-70" dateTime={message.sentAt}>{formatTime(message.sentAt)}</time>
              </div>
            </div>
          )) : (
            <p className="px-4 py-4 text-center text-xs" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-panel)", color: "var(--text-muted)" }}>
              Nenhuma mensagem vinculada a este contato foi sincronizada ainda.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
