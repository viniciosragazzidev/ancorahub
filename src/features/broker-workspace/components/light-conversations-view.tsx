"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection, PeopleStats, peopleHue, peopleInitials } from "@/components/light/people-list/people-list";
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

/** Refresh after realtime events at most once every 2s, grouped (trailing). */
const REFRESH_DEBOUNCE_MS = 2000;

const primaryAction =
  "inline-flex h-11 flex-1 items-center justify-center rounded-full bg-(--accent) px-4 text-sm font-semibold text-(--accent-foreground)";
const secondaryAction =
  "inline-flex h-11 flex-1 items-center justify-center rounded-full bg-(--surface-muted) px-4 text-sm font-semibold text-(--foreground)";

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data registrada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}
/** Row meta: the hour when it is today, the day otherwise. */
function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? formatTime(value)
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}
function isOutbound(direction: string) { return direction === "outgoing" || direction === "outbound"; }
function pendingLabel(value?: string | null) {
  return ({ BROKER: "Você precisa responder", CUSTOMER: "Aguardando o cliente", INTERNAL: "Há uma pendência interna", NONE: "A IA ainda não identificou pendência" } as Record<string, string>)[value ?? ""] ?? "Análise em andamento";
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

function conversationHref(item: BrokerConversationInsight) {
  return `/conversas/broker?leadId=${encodeURIComponent(item.id)}`;
}

/**
 * Dicas de Atendimento de uma conversa (Lite, corretor). Uma coluna só, no padrão das listas do Lite:
 * a conversa escolhida no topo (o que a IA leu e a próxima ação), depois a lista das outras conversas
 * no desenho "agenda telefônica". Sem a conversa escolhida, o topo vira um resumo da carteira.
 */
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
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  // The open conversation follows ?leadId (each row is a link to it; the app header back button clears it).
  const selectedId = searchParams.get("leadId") ?? initialLeadId ?? null;

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

  const selected = useMemo(() => (selectedId ? insights.find((item) => item.id === selectedId) : null) ?? null, [insights, selectedId]);

  const others = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const rest = ordered.filter((item) => item.id !== selected?.id);
    return term ? rest.filter((item) => `${item.name} ${item.phone ?? ""} ${item.status}`.toLocaleLowerCase("pt-BR").includes(term)) : rest;
  }, [ordered, query, selected]);

  const attention = insights.filter((item) => temperatureFor(item).rank === 0).length;
  const yourMove = insights.filter((item) => temperatureFor(item).rank === 1).length;
  const searching = query.trim().length > 0;

  const subtitle = (
    <>
      {insights.length === 1 ? "1 conversa ativa" : `${insights.length} conversas ativas`}
      <span className="mx-2" aria-hidden="true">·</span>
      <span style={{ color: whatsappConnected ? "var(--success)" : "var(--text-muted)" }}>
        {whatsappConnected ? "WhatsApp conectado" : `WhatsApp ${connectionStatus === "disconnected" ? "desconectado" : connectionStatus}`}
      </span>
      {whatsappConnected ? null : (
        <Link href="/settings?tab=whatsapp" className="ml-2 font-medium" style={{ color: "var(--accent-strong)" }}>
          Conectar
        </Link>
      )}
    </>
  );

  return (
    <PeoplePage title="Dicas de Atendimento" hideTitle subtitle={subtitle}>
      {selected ? (
        <SelectedInsight key={selected.id} item={selected} />
      ) : insights.length > 0 ? (
        <PeopleStats
          label="Resumo das conversas"
          items={[
            { value: attention, label: "Exigem atenção", alert: attention > 0 },
            { value: yourMove, label: "Esperam você" },
            { value: insights.length, label: "Conversas" },
          ]}
        />
      ) : null}

      {insights.length > (selected ? 1 : 0) ? (
        <PeopleFilters
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Buscar por nome ou telefone"
          searchLabel="Buscar conversa"
        />
      ) : null}

      {others.length > 0 ? (
        <PeopleSection id="conversas-lista" title={selected ? "Outras conversas" : "Suas conversas"} count={others.length} label="Conversas">
          {others.map((item, index) => {
            const temperature = temperatureFor(item);
            return (
              <PeopleRow
                key={item.id}
                index={index}
                href={conversationHref(item)}
                name={item.name}
                chip={<Badge tone={temperature.tone} size="sm">{temperature.label}</Badge>}
                preview={item.intelligence
                  ? nextActionLabel(item)
                  : item.latestMessage
                    ? `${isOutbound(item.latestMessage.direction) ? "Você" : "Cliente"}: ${item.latestMessage.body}`
                    : "Sem mensagens ainda"}
                previewTone={temperature.rank === 0 ? "alert" : temperature.rank === 1 ? "waiting" : "muted"}
                meta={formatWhen(item.latestMessage?.sentAt)}
                dot={temperature.rank === 0 ? "alert" : temperature.rank === 1 ? "waiting" : null}
                dotLabel={temperature.rank <= 1 ? temperature.label : undefined}
              />
            );
          })}
        </PeopleSection>
      ) : searching ? (
        <PeopleEmpty
          title={`Nenhum resultado para "${query.trim()}"`}
          description="Confira o nome ou telefone, ou limpe a busca para ver sua lista."
          action={<Button variant="secondary" onClick={() => setQuery("")}>Limpar busca</Button>}
        />
      ) : !selected ? (
        <PeopleEmpty
          title="Nenhuma conversa ainda"
          description="Converse com seus leads pelo WhatsApp conectado e o resumo aparece aqui."
          action={<Button variant="secondary" onClick={() => router.push("/settings?tab=whatsapp")}>Conectar WhatsApp</Button>}
        />
      ) : null}
    </PeoplePage>
  );
}

/** The chosen conversation: who, what the AI read, the next step and the two actions. One card, one column. */
function SelectedInsight({ item }: { item: BrokerConversationInsight }) {
  const temperature = temperatureFor(item);
  const intent = intentLabel(item.intelligence?.customerIntent);
  const risk = item.intelligence?.risk ?? null;
  const whatsappUrl = buildWhatsAppUrl(item.phone);
  const messages = [...item.messages].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));

  return (
    <article
      className="grid min-w-0 gap-4 p-4 sm:p-5"
      style={{ background: "var(--surface)", borderRadius: "var(--radius-surface)", boxShadow: "var(--shadow-resting)" }}
      aria-label={`Dicas da conversa com ${item.name}`}
    >
      <header className="flex min-w-0 items-center gap-3">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-full font-semibold"
          style={{ background: `hsl(${peopleHue(item.name)} 52% 91%)`, color: `hsl(${peopleHue(item.name)} 42% 30%)` }}
          aria-hidden="true"
        >
          {peopleInitials(item.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="min-w-0 truncate text-lg font-semibold" style={{ color: "var(--foreground)" }}>{item.name}</h2>
            <Badge tone={temperature.tone} size="sm">{temperature.label}</Badge>
          </div>
          <p className="truncate text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {item.kind === "lead" ? "Lead" : "Cliente"} · último contato {formatDateTime(item.latestMessage?.sentAt)}
          </p>
        </div>
      </header>

      <div className="px-4 py-3" style={{ background: "var(--accent-subtle)", borderRadius: "var(--radius-panel)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--accent-strong)" }}>Próxima ação</p>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground)" }}>{nextActionLabel(item)}</p>
      </div>

      {(risk || intent) && (
        <div className={cn("grid gap-2", risk && intent && "sm:grid-cols-2")}>
          {risk && (
            <div className="min-w-0 px-4 py-3" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-panel)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--warning)" }}>Atenção</p>
              <p className="mt-1 text-sm" style={{ color: "var(--foreground)" }}>{risk}</p>
            </div>
          )}
          {intent && (
            <div className="min-w-0 px-4 py-3" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-panel)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Intenção de compra</p>
              <p className="mt-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>{intent}</p>
            </div>
          )}
        </div>
      )}

      <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {item.intelligence?.summary || "A Âncora ainda não leu mensagens suficientes. Continue no WhatsApp que o resumo aparece aqui."}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => { if (item.kind === "lead") void recordWhatsAppOpenedAction(item.id); }}
            className={primaryAction}
          >
            Responder no WhatsApp
          </a>
        ) : (
          <Button className="flex-1" disabled>Sem telefone cadastrado</Button>
        )}
        <Link href={item.href} className={secondaryAction}>
          {item.kind === "client" ? "Ver cliente" : "Ver lead"}
        </Link>
      </div>

      <details className="group min-w-0" style={{ borderTop: "1px solid var(--border)" }}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 pt-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Histórico de mensagens
          <span className="text-xs font-normal tabular-nums" style={{ color: "var(--text-muted)" }}>
            {messages.length === 1 ? "1 mensagem" : `${messages.length} mensagens`}
          </span>
        </summary>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Somente leitura. Para responder, use o WhatsApp no seu aparelho.</p>
        <div className="mt-3 space-y-2">
          {messages.length ? messages.map((message) => (
            <div key={message.id} className={cn("flex", isOutbound(message.direction) ? "justify-end" : "justify-start")}>
              <div
                className="max-w-[85%] min-w-0 px-3 py-2 text-sm"
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
              Ainda não chegou mensagem deste contato. Converse pelo WhatsApp e ela aparece aqui.
            </p>
          )}
        </div>
      </details>
    </article>
  );
}
