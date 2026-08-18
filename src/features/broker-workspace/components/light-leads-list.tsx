"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Clock, MagnifyingGlass, Lightning, SlidersHorizontal } from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Meus Leads</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Atendimentos ({leads.length})
          </h1>
        </div>
        <div className="flex items-center gap-2">
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

            return (
              <Card key={lead.id} variant="subtle" className="p-4 bg-card/95 hover:border-primary/30 transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground truncate">{lead.name}</h3>
                      <Badge
                        variant={isDistributed ? "warning" : isConverted ? "success" : isLost ? "secondary" : lead.isOverdue ? "destructive" : "outline"}
                        className="text-[10px] font-semibold"
                      >
                        {isDistributed ? "Novo lead" : isConverted ? "Venda concluída ✓" : isLost ? "Finalizado" : lead.isOverdue ? "Atualização pendente" : "Em atendimento"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {lead.productName ? <span>{lead.productName}</span> : null}
                      {lead.livesCount ? <span>· {lead.livesCount} vidas</span> : null}
                      {lead.city ? <span>· {lead.city}</span> : null}
                    </div>

                    {lead.summary ? (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{lead.summary}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/leads/${lead.id}`}
                      className={cn(
                        buttonVariants({ variant: isDistributed ? "default" : "outline", size: "sm" }),
                        "w-full sm:w-auto h-9 px-4 text-xs font-semibold gap-1.5"
                      )}
                    >
                      {isDistributed ? "ACEITAR LEAD" : isConverted ? "VER" : "ABRIR"}
                      <ArrowRight className="size-3.5" />
                    </Link>
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
