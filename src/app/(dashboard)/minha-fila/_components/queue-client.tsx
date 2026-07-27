"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  MagnifyingGlass,
} from "@/components/huge-icons";

import { LeadStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Novo", color: "bg-chart-1 text-chart-1" },
  distributed: { label: "Distribuído", color: "bg-chart-2 text-chart-2" },
  in_contact: { label: "Em contato", color: "bg-chart-3 text-chart-3" },
  quote_sent: { label: "Cotação enviada", color: "bg-accent text-warning" },
  negotiation: { label: "Negociação", color: "bg-chart-4 text-chart-4" },
  documentation_pending: {
    label: "Documentação",
    color: "bg-chart-5 text-chart-5",
  },
  under_analysis: { label: "Em análise", color: "bg-muted-foreground text-muted-foreground" },
  converted: { label: "Convertido", color: "bg-success text-success" },
  lost: { label: "Perdido", color: "bg-destructive text-destructive" },
};

const sourceLabels: Record<string, string> = {
  webhook: "Automático",
  manual: "Manual",
};

export function BrokerQueueClient({
  leads,
}: {
  leads: Array<{
    id: string;
    name: string;
    phone: string;
    source: string;
    status: string;
    maskPhone: string;
    createdAt: Date;
    lastInteractionAt: Date | null;
    taskCount: number;
  }>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search);
      const matchesStatus =
        statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:px-0">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar leads por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/leads" />}
          >
            Ver todos
          </Button>
        </div>
      </div>

      {/* Mobile List */}
      <div className="divide-y divide-border sm:hidden">
        {filteredLeads.map((lead, i) => {
          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12, delay: Math.min(i * 0.02, 0.2) }}
            >
              <Link
                href={`/leads/${lead.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{lead.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {lead.maskPhone}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <LeadStatusBadge status={lead.status} />
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {sourceLabels[lead.source] ?? lead.source}
                    </span>
                    {lead.taskCount > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-medium text-primary">
                          {lead.taskCount} tarefa{lead.taskCount > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </Link>
            </motion.div>
          );
        })}
        {filteredLeads.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Nenhum lead encontrado para essa busca."
              : "Nenhum lead na sua fila ainda."}
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <Table className="max-sm:hidden">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Lead</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="hidden md:table-cell">Criado em</TableHead>
            <TableHead className="hidden md:table-cell">Última interação</TableHead>
            <TableHead className="pr-5 text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLeads.map((lead, i) => {
            return (
              <motion.tr
                key={lead.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, delay: Math.min(i * 0.01, 0.15) }}
                className="group"
              >
                <TableCell className="pl-5">
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.maskPhone}
                    {lead.taskCount > 0 && (
                      <span className="ml-2 text-primary">
                        · {lead.taskCount} tarefa{lead.taskCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {sourceLabels[lead.source] ?? lead.source}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                  }).format(lead.createdAt)}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {lead.lastInteractionAt
                    ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(lead.lastInteractionAt)
                    : "—"}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button
                    render={<Link href={`/leads/${lead.id}`} />}
                    size="sm"
                    variant="ghost"
                  >
                    Abrir <ArrowRight />
                  </Button>
                </TableCell>
              </motion.tr>
            );
          })}
        </TableBody>
      </Table>

      {/* Empty state */}
      {filteredLeads.length === 0 && (
        <div className="hidden flex-col items-center gap-2 border-t border-border px-6 py-12 text-center sm:flex">
          <p className="font-medium">Nenhum lead encontrado</p>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Tente ajustar os filtros ou a busca."
              : "Você ainda não tem leads atribuídos. Entre em contato com seu gestor."}
          </p>
        </div>
      )}
    </div>
  );
}
