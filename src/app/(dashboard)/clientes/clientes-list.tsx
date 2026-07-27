"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CalendarCheck, Handshake, TrendUp, Users } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatCard } from "@/components/dashboard/metric-card";
import { OwnershipContext } from "@/components/ownership-context";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

/* ─── Types ─── */

type ClientItem = {
  id: string;
  leadId: string;
  name: string;
  phone: string;
  email: string | null;
  convertedAt: Date;
  brokerName: string | null;
  branchName: string | null;
};

type ClientsMetrics = {
  totalClients: number;
  conversionRate: string;
  avgClientsPerBroker: number;
  upcomingRenewals: number;
  recentConversions: number;
  totalBrokers: number;
};

/* ─── Column Definitions ─── */

export const columns: ColumnDef<ClientItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cliente" />
    ),
    cell: ({ row }) => {
      const client = row.original;
      const initials = client.name
        ? client.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "CL";

      return (
        <div className="flex items-center gap-3 pl-2">
          <UserAvatar seed={client.email || client.name} name={client.name} size="sm" className="size-8" />
          <div>
            <p className="text-xs font-semibold text-foreground leading-snug">{client.name}</p>
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-medium text-muted-foreground mt-0.5">
              Cliente Ativo
            </Badge>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "contact",
    header: "Contato",
    cell: ({ row }) => {
      const client = row.original;
      return (
        <div className="flex flex-col text-xs text-muted-foreground">
          {client.email && <span className="font-mono text-foreground/80 truncate max-w-[220px]">{client.email}</span>}
          <span className="font-mono">{client.phone}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "brokerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Responsável / Filial" />
    ),
    cell: ({ row }) => {
      const client = row.original;
      return (
        <OwnershipContext
          brokerName={client.brokerName}
          branchName={client.branchName}
          className="text-xs text-muted-foreground"
        />
      );
    },
  },
  {
    accessorKey: "convertedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Data Conversão" />
    ),
    cell: ({ row }) => {
      const client = row.original;
      const convertedDate = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(client.convertedAt));

      return <span className="text-xs text-muted-foreground font-mono">{convertedDate}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const client = row.original;
      return (
        <div className="text-right pr-2">
          <Button
            render={<Link href={`/clientes/${client.id}`} />}
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs opacity-80 group-hover/row:opacity-100 transition-all"
          >
            Ver Perfil <ArrowRight className="size-3.5" />
          </Button>
        </div>
      );
    },
  },
];

/* ─── Main Component ─── */

export function ClientesList({
  clients,
  metrics,
}: {
  clients: ClientItem[];
  metrics: ClientsMetrics;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Metrics Section */}
      <section aria-label="Indicadores de clientes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Handshake}
          label="Total de Clientes"
          value={String(metrics.totalClients)}
          sublabel={`${metrics.recentConversions} convertidos nos últimos 30 dias`}
          chartSegments={[
            { name: "recentes", value: metrics.recentConversions, color: "var(--chart-2)" },
            { name: "demais", value: Math.max(0, metrics.totalClients - metrics.recentConversions), color: "var(--primary)" },
          ]}
          animated
        />
        <StatCard
          icon={TrendUp}
          label="Taxa de Conversão"
          value={`${metrics.conversionRate}%`}
          sublabel={`${metrics.totalClients} cliente(s) convertidos no pipeline`}
          trend={Number.parseFloat(metrics.conversionRate) > 10 ? "up" : "down"}
          chartSegments={[
            { name: "convertidos", value: Number.parseFloat(metrics.conversionRate), color: "hsl(217 91% 60%)" },
            { name: "restante", value: Math.max(0, 100 - Number.parseFloat(metrics.conversionRate)), color: "var(--muted)" },
          ]}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          animated
          animationDelay={0.06}
        />
        <StatCard
          icon={Users}
          label="Média por Corretor"
          value={String(metrics.avgClientsPerBroker)}
          sublabel={`${metrics.totalBrokers} corretor(es) com carteira ativa`}
          chartSegments={[
            { name: "carteira", value: metrics.avgClientsPerBroker, color: "hsl(270 60% 60%)" },
          ]}
          iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          animated
          animationDelay={0.12}
        />
        <StatCard
          icon={CalendarCheck}
          label="Renovações Próximas"
          value={String(metrics.upcomingRenewals)}
          sublabel="Aniversário de contrato nos próximos 30 dias"
          trend={metrics.upcomingRenewals > 0 ? "up" : "down"}
          change={metrics.upcomingRenewals > 0 ? "Alta" : "Atenção"}
          chartSegments={
            metrics.upcomingRenewals > 0
              ? [{ name: "pendentes", value: metrics.upcomingRenewals, color: "hsl(38 92% 50%)" }]
              : [{ name: "sem_pendencias", value: 1, color: "var(--muted)" }]
          }
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          animated
          animationDelay={0.18}
        />
      </section>

      {/* TanStack Data Table Container */}
      <DataTable
        columns={columns}
        data={clients}
        searchPlaceholder="Buscar por nome de cliente..."
        searchKey="name"
        showColumnToggle={true}
        showPagination={true}
        pageSize={10}
      />
    </div>
  );
}
