"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowLeft, ArrowUpRight, Bot, CheckCircle2, Clock3, ExternalLink, MessageSquareText, Search, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { cn } from "@/lib/utils";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

export type BrokerInsightMessage = { id: string; body: string; direction: string; sentAt: string; providerStatus?: string | null };
export type BrokerConversationInsight = {
  id: string; kind: "lead" | "client"; name: string; phone: string; status: string; href: string;
  firstContactAt?: string | null; serviceStartedAt?: string | null;
  latestMessage: BrokerInsightMessage | null; messages: BrokerInsightMessage[];
  intelligence?: { summary?: string | null; nextBestAction?: string | null; pendingFrom?: string | null; sentiment?: string | null; customerIntent?: string | null; risk?: string | null; lastAnalyzedAt?: string | null } | null;
};

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
function healthVariant(item: BrokerConversationInsight): "success" | "warning" | "destructive" | "secondary" {
  if (item.intelligence?.risk || item.intelligence?.sentiment === "NEGATIVE") return "destructive";
  if (item.intelligence?.pendingFrom === "BROKER") return "warning";
  if (item.intelligence?.sentiment === "POSITIVE" || ["HIGH", "VERY_HIGH"].includes(item.intelligence?.customerIntent ?? "")) return "success";
  return "secondary";
}
function healthLabel(item: BrokerConversationInsight) {
  return ({ destructive: "Exige atenção", warning: "Sua ação", success: "Bom avanço", secondary: "Acompanhar" } as const)[healthVariant(item)];
}

export function LightConversationsView({ insights, initialLeadId, whatsappConnected, connectionStatus }: { insights: BrokerConversationInsight[]; initialLeadId?: string; whatsappConnected: boolean; connectionStatus: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  // Estado local para seleção instantânea (0ms) sem re-render do Server Component
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("leadId") ?? initialLeadId ?? insights[0]?.id ?? null);

  useEffect(() => {
    const urlLeadId = searchParams.get("leadId");
    if (urlLeadId && urlLeadId !== selectedId) {
      setSelectedId(urlLeadId);
    }
  }, [searchParams, selectedId]);

  const selected = useMemo(() => {
    return (selectedId ? insights.find((item) => item.id === selectedId) : null) ?? insights[0] ?? null;
  }, [insights, selectedId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term ? insights.filter((item) => `${item.name} ${item.phone} ${item.status}`.toLocaleLowerCase("pt-BR").includes(term)) : insights;
  }, [insights, query]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.domain === "conversations" || detail?.domain === "whatsapp_connection") {
        router.refresh();
      }
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    return () => window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
  }, [router]);

  const select = (item: BrokerConversationInsight) => {
    setSelectedId(item.id);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("leadId", item.id);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    }
  };

  const handleBack = () => {
    setSelectedId(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("leadId");
      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(null, "", `${pathname}${newQuery}`);
    }
  };

  return <section className="flex h-full min-h-0 flex-col bg-background" aria-label="Central de insights do WhatsApp">
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.75fr)]">
      <aside className={cn("min-h-0 border-r border-border bg-card", selected ? "hidden lg:block" : "block")}>
        <div className="border-b border-border p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Buscar na sua carteira" aria-label="Buscar lead ou cliente" />
          </label>
        </div>
        <ScrollArea className="h-[calc(100%-4.1rem)]">
          <div className="space-y-1 p-2">
            {filtered.map((item) => {
              const active = item.id === selected?.id;
              return <button key={item.id} type="button" onClick={() => select(item)} className={cn("w-full rounded-lg border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary/30 bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/50")} aria-current={active ? "page" : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{item.name}</span>
                  <Badge variant={healthVariant(item)} className="shrink-0 text-[10px]">{healthLabel(item)}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.latestMessage ? `${isOutbound(item.latestMessage.direction) ? "Você: " : "Cliente: "}${item.latestMessage.body}` : "Sem conversa sincronizada"}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{item.latestMessage ? `Última interação ${formatDateTime(item.latestMessage.sentAt)}` : "Aguardando primeira interação"}</p>
              </button>;
            })}
            {!filtered.length ? <EmptyPortfolioView /> : null}
          </div>
        </ScrollArea>
      </aside>
      {selected ? <InsightDetail item={selected} onBack={handleBack} /> : <EmptyPortfolioView />}
    </div>
  </section>;
}

function InsightDetail({ item, onBack }: { item: BrokerConversationInsight; onBack: () => void }) {
  const messages = [...item.messages].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  const whatsappUrl = buildWhatsAppUrl(item.phone);
  return <article className="flex min-h-0 flex-1 flex-col bg-muted/15">
    <header className="flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Voltar para carteira"><ArrowLeft className="size-4" /></Button>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{item.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold">{item.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{item.kind === "lead" ? "Lead da sua carteira" : "Cliente da sua carteira"}</p>
        </div>
      </div>
      <Link href={item.href} className={cn(buttonVariants({ variant: "outline", size: "xs" }), "gap-1.5")}><span>Ver ficha</span><ExternalLink className="size-3" /></Link>
    </header>
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Último contato" value={formatDateTime(item.latestMessage?.sentAt)} icon={<Clock3 className="size-4" />} />
          <Metric label="Início do atendimento" value={formatDateTime(item.serviceStartedAt ?? item.firstContactAt)} icon={<CheckCircle2 className="size-4" />} />
          <Metric label="Quem deve agir" value={pendingLabel(item.intelligence?.pendingFrom)} icon={<Activity className="size-4" />} />
        </div>
        <Card className="border-border/60">
          <CardHeader className="flex-row items-start gap-3 space-y-0 p-4 pb-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></span>
            <div>
              <CardTitle className="text-sm">Leitura da IA</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Análise baseada apenas nas mensagens sincronizadas desta conversa.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-2">
            <p className="text-sm leading-relaxed">{item.intelligence?.summary || "Ainda não há análise suficiente. Continue atendendo pelo WhatsApp; quando houver mensagens vinculadas a este lead, os insights serão atualizados."}</p>
            {item.intelligence?.nextBestAction ? <div className="rounded-lg border border-primary/20 bg-primary/[0.06] p-3 text-sm"><span className="font-semibold text-primary">Próxima melhor ação: </span>{item.intelligence.nextBestAction}</div> : null}
            {item.intelligence?.risk ? <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-sm text-destructive"><span className="font-semibold">Atenção: </span>{item.intelligence.risk}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
            <div>
              <CardTitle className="text-sm">Histórico sincronizado</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Somente leitura. Conversas pessoais não são trazidas para o CRM.</p>
            </div>
            <Badge variant="outline">{messages.length} mensagens</Badge>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-2">
            {messages.length ? messages.map((message) => <div key={message.id} className={cn("flex", isOutbound(message.direction) ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-lg border px-3 py-2 text-sm", isOutbound(message.direction) ? "border-primary/20 bg-primary text-primary-foreground" : "border-border bg-card")}><p className="whitespace-pre-wrap break-words">{message.body}</p><time className={cn("mt-1 block text-right text-[10px]", isOutbound(message.direction) ? "text-primary-foreground/75" : "text-muted-foreground")} dateTime={message.sentAt}>{formatTime(message.sentAt)}</time></div></div>) : <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma mensagem vinculada a este contato foi sincronizada ainda.</p>}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
    <footer className="border-t border-border bg-card p-3 sm:px-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Smartphone className="size-4 text-primary" />Para responder, use o WhatsApp no seu aparelho.</p>
        {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}><MessageSquareText className="size-4" />Abrir WhatsApp<ArrowUpRight className="size-3.5" /></a> : <Button size="sm" disabled>Telefone indisponível</Button>}
      </div>
    </footer>
  </article>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{value}</p>
    </Card>
  );
}

function EmptyPortfolioView() {
  return (
    <div className="flex min-h-64 flex-1 items-center justify-center p-6">
      <EmptyState
        icon={MessageSquareText}
        title="Nenhum insight disponível"
        description="Assim que houver uma conversa vinculada a um lead ou cliente da sua carteira, ela aparecerá aqui."
      />
    </div>
  );
}
