"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { 
  Sparkle, 
  Warning, 
  Fire, 
  CheckCircle, 
  Clock, 
  User, 
  Buildings, 
  ArrowUpRight, 
  Copy, 
  Check, 
  MagnifyingGlass, 
  ArrowsClockwise,
  ShieldCheck,
  ChatCircleDots
} from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { cn } from "@/lib/utils";
import { triggerManualConversationAnalysisAction } from "../actions";

export interface RadarDealItem {
  id: string;
  nome: string;
  telefone: string | null;
  status: string;
  corretorId: string | null;
  corretorNome: string | null;
  branchId: string | null;
  branchName: string | null;
  createdAt: Date | string;
  stageEnteredAt: Date | string | null;
  qualificationDetails?: Record<string, unknown> | null;
}

interface NegotiationsRadarTabProps {
  leads: RadarDealItem[];
  branches?: Array<{ id: string; name: string }>;
  brokers?: Array<{ id: string; name: string; branchId: string | null }>;
  contextRole: string;
}

const intentColorMap: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  VERY_HIGH: "success",
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "secondary",
  NONE: "destructive",
  UNKNOWN: "secondary",
};

const intentLabelMap: Record<string, string> = {
  VERY_HIGH: "Fechamento iminente",
  HIGH: "Alta Intenção",
  MEDIUM: "Intenção Média",
  LOW: "Baixa Intenção",
  NONE: "Desinteresse",
  UNKNOWN: "Intenção Pendente",
};

const stageLabelMap: Record<string, string> = {
  INITIAL_CONTACT: "1º Contato",
  DISCOVERY: "Descoberta",
  QUALIFICATION: "Qualificação",
  QUOTE_PREPARATION: "Montagem de Cotação",
  QUOTE_PRESENTED: "Cotação Apresentada",
  NEGOTIATION: "Negociação",
  DOCUMENT_COLLECTION: "Coleta de Documentos",
  CLOSING: "Fechamento",
  POST_SALE: "Pós-Venda",
  UNKNOWN: "Em Andamento",
};

export function NegotiationsRadarTab({
  leads,
  branches = [],
  brokers = [],
  contextRole,
}: NegotiationsRadarTabProps) {
  const [filterType, setFilterType] = useState<"all" | "hot" | "risk" | "broker_pending">("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  // Mapear e enriquecer os dados dos leads com a inteligência da IA
  const enrichedLeads = useMemo(() => {
    return leads.map((lead) => {
      const qual = (lead.qualificationDetails as Record<string, any>) || {};
      const ai = (qual.aiIntelligence as Record<string, any>) || null;
      const policy = (qual.aiPolicyResult as Record<string, any>) || null;
      const lastAnalyzedAt = qual.aiLastAnalyzedAt ? new Date(qual.aiLastAnalyzedAt) : null;

      const isHot = ai?.customerIntent === "VERY_HIGH" || ai?.customerIntent === "HIGH" || ai?.conversationStage === "CLOSING";
      const hasRisk = Boolean(ai?.risk) || ai?.sentiment === "NEGATIVE";
      const isBrokerPending = ai?.pendingFrom === "BROKER";

      return {
        ...lead,
        ai,
        policy,
        lastAnalyzedAt,
        isHot,
        hasRisk,
        isBrokerPending,
        intent: ai?.customerIntent || "UNKNOWN",
        sentiment: ai?.sentiment || "NEUTRAL",
        stage: ai?.conversationStage || "UNKNOWN",
        summary: ai?.summary || null,
        nextBestAction: ai?.nextBestAction || null,
        objections: Array.isArray(ai?.objections) ? ai.objections : [],
        riskReason: ai?.risk || null,
        buyingSignals: Array.isArray(ai?.buyingSignals) ? ai.buyingSignals : [],
      };
    });
  }, [leads]);

  // Contadores para os Cards de KPI de Supervisão
  const stats = useMemo(() => {
    const total = enrichedLeads.length;
    const hotCount = enrichedLeads.filter((l) => l.isHot).length;
    const riskCount = enrichedLeads.filter((l) => l.hasRisk).length;
    const brokerPendingCount = enrichedLeads.filter((l) => l.isBrokerPending).length;
    return { total, hotCount, riskCount, brokerPendingCount };
  }, [enrichedLeads]);

  // Filtros aplicados
  const filteredDeads = useMemo(() => {
    return enrichedLeads.filter((lead) => {
      // 1. Filtro de Tipo/Temperatura
      if (filterType === "hot" && !lead.isHot) return false;
      if (filterType === "risk" && !lead.hasRisk) return false;
      if (filterType === "broker_pending" && !lead.isBrokerPending) return false;

      // 2. Filtro de Unidade
      if (branchFilter !== "all" && lead.branchId !== branchFilter) return false;

      // 3. Filtro de Corretor
      if (brokerFilter !== "all" && lead.corretorId !== brokerFilter) return false;

      // 4. Busca textual
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = lead.nome?.toLowerCase().includes(query);
        const matchesPhone = lead.telefone?.toLowerCase().includes(query);
        const matchesBroker = lead.corretorNome?.toLowerCase().includes(query);
        const matchesSummary = lead.summary?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesBroker && !matchesSummary) return false;
      }

      return true;
    });
  }, [enrichedLeads, filterType, branchFilter, brokerFilter, searchQuery]);

  const handleCopyScript = (leadId: string, scriptText: string) => {
    navigator.clipboard.writeText(scriptText);
    setCopiedId(leadId);
    toast.success("Script de orientação copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleReanalyze = (leadId: string) => {
    startTransition(async () => {
      toast.info("Atualizando leitura da conversa com IA...");
      const res = await triggerManualConversationAnalysisAction(leadId);
      if (res.success) {
        toast.success("Diagnóstico da IA atualizado com sucesso!");
      } else {
        toast.error(res.error || "Falha ao analisar a conversa.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* ─── 1. CARDS DE KPI PARA SUPERVISÃO / DIREÇÃO ─── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            filterType === "all" && "border-primary bg-primary/[0.03] shadow-sm"
          )}
          onClick={() => setFilterType("all")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total em Negociação</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Leads monitorados por IA</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ChatCircleDots className="size-5" />
            </span>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-emerald-500/50",
            filterType === "hot" && "border-emerald-500 bg-emerald-500/[0.04] shadow-sm"
          )}
          onClick={() => setFilterType("hot")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Fechamento Iminente</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.hotCount}</p>
              <p className="text-[11px] text-muted-foreground">Alta intenção de compra</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Fire className="size-5" />
            </span>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-destructive/50",
            filterType === "risk" && "border-destructive bg-destructive/[0.04] shadow-sm"
          )}
          onClick={() => setFilterType("risk")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Risco de Perda</p>
              <p className="mt-1 text-2xl font-bold text-destructive">{stats.riskCount}</p>
              <p className="text-[11px] text-muted-foreground">Objeções severas ou atrito</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Warning className="size-5" />
            </span>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-amber-500/50",
            filterType === "broker_pending" && "border-amber-500 bg-amber-500/[0.04] shadow-sm"
          )}
          onClick={() => setFilterType("broker_pending")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pendente no Corretor</p>
              <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.brokerPendingCount}</p>
              <p className="text-[11px] text-muted-foreground">Aguardando ação da equipe</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </span>
          </CardContent>
        </Card>
      </div>

      {/* ─── 2. BARRA DE FILTROS E BUSCA ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, corretor ou diagnóstico..."
              className="pl-9 h-8.5 text-xs rounded-lg"
            />
          </div>

          {branches.length > 0 && contextRole === "director" && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-8.5 text-xs w-[160px] rounded-lg">
                <SelectValue placeholder="Todas as Unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Unidades</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {brokers.length > 0 && (
            <Select value={brokerFilter} onValueChange={setBrokerFilter}>
              <SelectTrigger className="h-8.5 text-xs w-[160px] rounded-lg">
                <SelectValue placeholder="Todos os Corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Corretores</SelectItem>
                {brokers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground font-mono">
            {filteredDeads.length} {filteredDeads.length === 1 ? "negociação" : "negociações"}
          </Badge>
        </div>
      </div>

      {/* ─── 3. GRID DE CARDS DO RADAR DE NEGOCIAÇÃO ─── */}
      {filteredDeads.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <Sparkle className="mx-auto size-8 text-muted-foreground/60" />
          <h3 className="mt-2 text-sm font-semibold">Nenhuma negociação encontrada</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Não há negociações correspondentes ao filtro selecionado. Quando o corretor e cliente conversarem pelo WhatsApp, a IA atualizará o radar automaticamente.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {filteredDeads.map((lead) => {
            const whatsappUrl = lead.telefone ? buildWhatsAppUrl(lead.telefone) : null;
            const scriptSuggestion = lead.nextBestAction || `Acompanhar negociação com ${lead.nome}.`;

            return (
              <Card 
                key={lead.id} 
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden border transition-all hover:shadow-md",
                  lead.isHot && "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.02] to-card",
                  lead.hasRisk && "border-destructive/30 bg-gradient-to-br from-destructive/[0.02] to-card",
                  !lead.isHot && !lead.hasRisk && "border-border/80 bg-card"
                )}
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <CardHeader className="p-4 pb-2.5 flex-row items-start justify-between space-y-0 gap-3 border-b border-border/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-bold">{lead.nome}</h4>
                        <Badge variant={intentColorMap[lead.intent] || "secondary"} className="text-[10px] shrink-0 font-medium">
                          {intentLabelMap[lead.intent] || "Intenção Pendente"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {lead.corretorNome && (
                          <span className="flex items-center gap-1">
                            <User className="size-3.5 text-primary" />
                            {lead.corretorNome}
                          </span>
                        )}
                        {lead.branchName && (
                          <span className="flex items-center gap-1">
                            <Buildings className="size-3.5" />
                            {lead.branchName}
                          </span>
                        )}
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                          Estágio: {stageLabelMap[lead.stage] || lead.status}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="Reanalisar conversa com IA"
                      disabled={isRefreshing}
                      onClick={() => handleReanalyze(lead.id)}
                    >
                      <ArrowsClockwise className={cn("size-3.5", isRefreshing && "animate-spin")} />
                    </Button>
                  </CardHeader>

                  {/* Conteúdo da Inteligência de Negociação */}
                  <CardContent className="p-4 pt-3 space-y-3">
                    {lead.summary ? (
                      <div className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground border border-border/30">
                        <span className="font-semibold text-primary block mb-0.5">Leitura Comercial da IA:</span>
                        {lead.summary}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Aguardando novas mensagens para gerar o resumo da negociação.
                      </p>
                    )}

                    {lead.riskReason && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                        <span className="font-semibold block flex items-center gap-1">
                          <Warning className="size-3.5" /> Alerta de Risco para a Supervisão:
                        </span>
                        {lead.riskReason}
                      </div>
                    )}

                    {lead.nextBestAction && (
                      <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-primary">Ação / Resposta Sugerida:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyScript(lead.id, scriptSuggestion)}
                            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            {copiedId === lead.id ? (
                              <>
                                <Check className="size-3 text-emerald-500" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copiar Script</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-foreground">{lead.nextBestAction}</p>
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Rodapé de Ações Rápidas da Supervisão */}
                <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-2.5">
                  <div className="text-[11px] text-muted-foreground">
                    {lead.isBrokerPending ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">⏳ Corretor precisa agir</span>
                    ) : (
                  <span>Aguardando retorno do cliente</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ size: "xs", variant: "outline" }), "gap-1 text-[11px]")}
                      >
                        <span>WhatsApp</span>
                        <ArrowUpRight className="size-3" />
                      </a>
                    )}
                    <Link
                      href={`/leads/${lead.id}`}
                      className={cn(buttonVariants({ size: "xs", variant: "default" }), "gap-1 text-[11px]")}
                    >
                      <span>Ver Ficha</span>
                      <ArrowUpRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
