"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  HelpCircle,
  MagnifyingGlass,
  SlidersHorizontal,
  X,
} from "@/components/huge-icons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";

export type LightLeadItem = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  qualificationStatus?: string | null;
  productName?: string | null;
  livesCount?: number | null;
  city?: string | null;
  summary?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  dueAt?: Date | string | null;
  isOverdue?: boolean;
  isAwaitingResponse?: boolean;
  isLost?: boolean;
  lostReason?: string | null;
};

type FilterTab = "all" | "awaiting" | "active" | "finished" | "lost";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

export function LightLeadsList({
  leads,
  initialFilter = "all",
  availabilityStatus = "available",
}: {
  leads: LightLeadItem[];
  initialFilter?: FilterTab;
  availabilityStatus?: "available" | "paused" | "offline";
}) {
  const [filter, setFilter] = useState<FilterTab>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");

  const awaitingResponseCount = useMemo(
    () => leads.filter((l) => l.isAwaitingResponse).length,
    [leads],
  );

  const criticalCount = useMemo(
    () => leads.filter((l) => l.isOverdue || l.status === "distributed" || l.status === "new").length,
    [leads],
  );

  const filteredAndSortedLeads = useMemo(() => {
    let list = [...leads];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.phone && l.phone.includes(q)) ||
          (l.productName && l.productName.toLowerCase().includes(q)),
      );
    }

    // Status filter
    if (filter === "awaiting") {
      list = list.filter((l) => (l.status === "distributed" || l.status === "new") && !l.isLost);
    } else if (filter === "active") {
      list = list.filter(
        (l) =>
          !l.isLost &&
          (l.status === "in_contact" ||
          l.status === "quote_sent" ||
          l.status === "negotiation" ||
          l.status === "documentation_pending"),
      );
    } else if (filter === "finished") {
      list = list.filter((l) => l.status === "converted" && !l.isLost);
    } else if (filter === "lost") {
      list = list.filter((l) => l.status === "lost" || l.isLost);
    } else if (filter === "all") {
      list = list.filter((l) => !l.isLost && l.status !== "lost");
    }

    // Priority auto-sorting
    list.sort((a, b) => {
      const rank = (item: LightLeadItem) => {
        if (item.isAwaitingResponse) return 0;
        if (item.status === "distributed" || item.status === "new") return 1;
        if (item.isOverdue) return 2;
        if (item.dueAt) return 3;
        if (
          item.status === "in_contact" ||
          item.status === "quote_sent" ||
          item.status === "negotiation"
        )
          return 4;
        return 5;
      };
      return rank(a) - rank(b);
    });

    return list;
  }, [leads, filter, searchQuery]);

  return (
    <div className="min-h-full bg-background text-foreground flex flex-col">
      {/* Banner de status quando pausado */}
      <LightAvailabilityBanner initialStatus={availabilityStatus} />

      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 pb-[max(1.5rem,var(--mobile-safe-bottom))] sm:px-6 sm:py-6 flex-1">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Meus Leads
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Atendimentos ({leads.filter((l) => !l.isLost && l.status !== "lost").length})
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {availabilityStatus !== "available" && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                ⏸ Pausado
              </span>
            )}
            <button
              type="button"
              aria-label="Reportar problema"
              title="Reportar problema"
              onClick={() => window.dispatchEvent(new CustomEvent("open-system-feedback"))}
              className="grid size-9 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <HelpCircle className="size-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div role="tablist" aria-label="Filtros de leads" className="flex snap-x snap-mandatory flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              filter === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            Todos ({leads.filter((l) => !l.isLost && l.status !== "lost").length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === "awaiting"}
            onClick={() => setFilter("awaiting")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer",
              filter === "awaiting"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            Aguardando aceite
            <Badge variant="warning" className="h-4 min-w-4 rounded-full px-1 text-[9px] font-bold">
              {leads.filter((l) => (l.status === "distributed" || l.status === "new") && !l.isLost).length}
            </Badge>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === "active"}
            onClick={() => setFilter("active")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              filter === "active"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            Em atendimento (
            {
              leads.filter((l) =>
                !l.isLost &&
                ["in_contact", "quote_sent", "negotiation", "documentation_pending"].includes(
                  l.status,
                ),
              ).length
            }
            )
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === "finished"}
            onClick={() => setFilter("finished")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              filter === "finished"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            Ganhos ({leads.filter((l) => l.status === "converted" && !l.isLost).length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === "lost"}
            onClick={() => setFilter("lost")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              filter === "lost"
                ? "bg-destructive text-destructive-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            Perdidos ({leads.filter((l) => l.status === "lost" || l.isLost).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Buscar leads por nome, telefone ou produto"
            placeholder="Buscar por nome, telefone ou produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-9 text-xs shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Leads List */}
        <div className="space-y-3">
          {filteredAndSortedLeads.length > 0 ? (
            filteredAndSortedLeads.map((lead) => {
              const isDistributed = (lead.status === "distributed" || lead.status === "new") && !lead.isLost;
              const isConverted = lead.status === "converted" && !lead.isLost;
              const isLost = lead.status === "lost" || lead.isLost;

              const statusBadge = isLost
                ? { variant: "destructive" as const, label: "Perdido / Inativo" }
                : isDistributed
                  ? { variant: "warning" as const, label: "Novo lead" }
                  : isConverted
                    ? { variant: "success" as const, label: "Venda concluída" }
                    : lead.isAwaitingResponse
                      ? { variant: "warning" as const, label: "Nova mensagem" }
                      : lead.isOverdue
                        ? { variant: "destructive" as const, label: "Atualização pendente" }
                        : { variant: "outline" as const, label: "Em atendimento" };

              return (
                <Card
                  key={lead.id}
                  variant="subtle"
                  aria-label={`Lead ${lead.name}`}
                  className={cn(
                    "bg-card/95 transition-colors hover:border-primary/30",
                    isLost && "border-l-[3px] border-l-destructive/80 opacity-90",
                    isDistributed && "border-l-[3px] border-l-warning",
                    isConverted && "border-l-[3px] border-l-success",
                    lead.isAwaitingResponse && !isLost && "border-l-[3px] border-l-primary",
                    lead.isOverdue && !isDistributed && !lead.isAwaitingResponse && !isLost && "border-l-[3px] border-l-destructive",
                  )}
                >
                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
                          {lead.name}
                        </h2>
                        <Badge variant={statusBadge.variant} className="text-[10px] font-semibold shrink-0">
                          {statusBadge.label}
                        </Badge>
                      </div>

                      {/* Próxima ação em destaque simples */}
                      <p
                        className={cn(
                          "mt-1 text-[11px] font-medium",
                          isLost && "text-destructive font-semibold",
                          !isLost && lead.isAwaitingResponse && "text-primary font-semibold",
                          !isLost && !lead.isAwaitingResponse && lead.isOverdue && "text-destructive font-semibold",
                          !isLost && !lead.isAwaitingResponse && !lead.isOverdue && isDistributed && "text-warning font-semibold",
                          !isLost && !lead.isAwaitingResponse && !lead.isOverdue && !isDistributed && "text-muted-foreground",
                        )}
                      >
                        {isLost
                          ? lead.lostReason || "⚠️ Redistribuído por inatividade / tempo limite estourado"
                          : lead.isAwaitingResponse
                          ? "💬 Cliente aguardando sua resposta"
                          : lead.isOverdue
                            ? "⚡ Atualização pendente necessária"
                            : isDistributed
                              ? "🆕 Aguardando seu aceite inicial"
                              : lead.status === "quote_sent"
                                ? "📄 Cotação enviada — acompanhe"
                                : lead.status === "documentation_pending"
                                  ? "📁 Documentação pendente"
                                  : lead.status === "negotiation"
                                    ? "🔵 Em negociação"
                                    : lead.status === "in_contact"
                                      ? "✅ Em atendimento ativo"
                                      : lead.status === "converted"
                                        ? "✓ Venda concluída"
                                        : "Em andamento"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="min-w-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Produto
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {lead.productName || "Plano de Saúde"}
                        </span>
                      </div>
                      <div className="min-w-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Vidas
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {lead.livesCount ?? "1"}
                        </span>
                      </div>
                      <div className="col-span-2 min-w-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 sm:col-span-1">
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Cidade
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {lead.city || "Não informada"}
                        </span>
                      </div>
                    </div>

                    {lead.summary ? (
                      <p className="line-clamp-2 rounded-lg border border-border/40 bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        {lead.summary}
                      </p>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Entrada {formatDate(lead.createdAt)}
                        {lead.dueAt ? ` · Retorno ${formatDate(lead.dueAt)}` : ""}
                      </span>
                      <div className="flex gap-2">
                        <Link
                          href={`/conversas/broker?leadId=${lead.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-9 flex-1 gap-1.5 px-3 text-xs font-semibold sm:flex-none",
                          )}
                        >
                          Insights
                        </Link>
                        <Link
                          href={`/leads/${lead.id}`}
                          className={cn(
                            buttonVariants({
                              variant: isDistributed ? "default" : "outline",
                              size: "sm",
                            }),
                            "h-9 flex-1 gap-1.5 px-4 text-xs font-semibold sm:w-auto",
                          )}
                        >
                          {isDistributed ? "ACEITAR LEAD" : isConverted ? "VER" : "ABRIR"}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card
              variant="subtle"
              className="flex flex-col items-center justify-center p-8 text-center bg-card/95 border-dashed"
            >
              <SlidersHorizontal className="size-8 text-muted-foreground/60" />
              <h2 className="mt-2 text-sm font-semibold text-foreground">
                {searchQuery.trim() ? `Nenhum resultado para "${searchQuery.trim()}"` : "Nenhum lead encontrado"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? "Tente outro nome, telefone ou produto."
                  : "Não há atendimentos para o filtro selecionado no momento."}
              </p>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Limpar busca
                </button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
