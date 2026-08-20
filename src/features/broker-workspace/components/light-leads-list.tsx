"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, HelpCircle, MagnifyingGlass, SlidersHorizontal } from "@/components/huge-icons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import { cn } from "@/lib/utils";

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
};

type FilterTab = "all" | "awaiting" | "active" | "finished";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

export function LightLeadsList({ leads, initialFilter = "all" }: { leads: LightLeadItem[]; initialFilter?: FilterTab }) {
  const [filter, setFilter] = useState<FilterTab>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAndSortedLeads = useMemo(() => {
    let list = [...leads];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || (l.phone && l.phone.includes(q)) || (l.productName && l.productName.toLowerCase().includes(q)));
    }

    // Status filter
    if (filter === "awaiting") {
      list = list.filter((l) => l.status === "distributed" || l.status === "new");
    } else if (filter === "active") {
      list = list.filter((l) => l.status === "in_contact" || l.status === "quote_sent" || l.status === "negotiation" || l.status === "documentation_pending");
    } else if (filter === "finished") {
      list = list.filter((l) => l.status === "converted" || l.status === "lost");
    }

    // Priority auto-sorting
    list.sort((a, b) => {
      const rank = (item: LightLeadItem) => {
        if (item.status === "distributed" || item.status === "new") return 1;
        if (item.isOverdue) return 2;
        if (item.dueAt) return 3;
        if (item.status === "in_contact" || item.status === "quote_sent" || item.status === "negotiation") return 4;
        return 5;
      };
      return rank(a) - rank(b);
    });

    return list;
  }, [leads, filter, searchQuery]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 pb-24 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Meus Leads</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Atendimentos ({leads.length})
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Reportar problema"
            title="Reportar problema"
            onClick={() => window.dispatchEvent(new CustomEvent("open-system-feedback"))}
            className="grid size-9 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <HelpCircle className="size-4" />
          </button>
          <ExperienceModeToggle variant="badge" />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            filter === "all"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Todos ({leads.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter("awaiting")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1",
            filter === "awaiting"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Aguardando aceite
          <Badge variant="warning" className="h-4 min-w-4 rounded-full px-1 text-[9px] font-bold">
            {leads.filter((l) => l.status === "distributed" || l.status === "new").length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setFilter("active")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            filter === "active"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Em atendimento ({leads.filter((l) => ["in_contact", "quote_sent", "negotiation", "documentation_pending"].includes(l.status)).length})
        </button>

        <button
          type="button"
          onClick={() => setFilter("finished")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            filter === "finished"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Finalizados ({leads.filter((l) => l.status === "converted" || l.status === "lost").length})
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou produto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-xs shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredAndSortedLeads.length > 0 ? (
          filteredAndSortedLeads.map((lead) => {
            const isDistributed = lead.status === "distributed" || lead.status === "new";
            const isConverted = lead.status === "converted";
            const isLost = lead.status === "lost";

            const statusBadge = isDistributed
              ? { variant: "warning" as const, label: "Novo lead" }
              : isConverted
                ? { variant: "success" as const, label: "Venda concluída" }
                : isLost
                  ? { variant: "secondary" as const, label: "Finalizado" }
                  : lead.isOverdue
                    ? { variant: "destructive" as const, label: "Atualização pendente" }
                    : { variant: "outline" as const, label: "Em atendimento" };

            return (
              <Card
                key={lead.id}
                variant="subtle"
                className={cn(
                  "bg-card/95 transition-colors hover:border-primary/30",
                  isDistributed && "border-l-[3px] border-l-warning",
                  isConverted && "border-l-[3px] border-l-success",
                  lead.isOverdue && !isDistributed && "border-l-[3px] border-l-destructive"
                )}
              >
                <div className="space-y-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                      {lead.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={statusBadge.variant} className="text-[10px] font-semibold">
                        {statusBadge.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Produto
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                        {lead.productName || "—"}
                      </span>
                    </div>
                    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Vidas
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                        {lead.livesCount ?? "—"}
                      </span>
                    </div>
                    <div className="col-span-2 min-w-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 sm:col-span-1">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Cidade
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                        {lead.city || "—"}
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
                        href={`/conversas?leadId=${lead.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-9 flex-1 gap-1.5 px-3 text-xs font-semibold sm:flex-none"
                        )}
                      >
                        Chat
                      </Link>
                      <Link
                        href={`/leads/${lead.id}`}
                        className={cn(
                          buttonVariants({ variant: isDistributed ? "default" : "outline", size: "sm" }),
                          "h-9 flex-1 gap-1.5 px-4 text-xs font-semibold sm:w-auto"
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
          <Card variant="subtle" className="flex flex-col items-center justify-center p-8 text-center bg-card/95 border-dashed">
            <SlidersHorizontal className="size-8 text-muted-foreground/60" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">Nenhum lead encontrado</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Não há atendimentos para o filtro selecionado no momento.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
