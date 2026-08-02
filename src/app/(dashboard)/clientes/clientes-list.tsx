"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, UserList } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnershipContext } from "@/components/ownership-context";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { StatCard } from "@/components/dashboard/metric-card";

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
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contato" />
    ),
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
  const conversionTrend = clients.reduce<number[]>((acc, client) => {
    const convertedAt = new Date(client.convertedAt).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      if (convertedAt >= dayStart && convertedAt < dayEnd) acc[index] += 1;
    }

    return acc;
  }, Array.from({ length: 7 }, () => 0));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total de clientes" value={metrics.totalClients} sublabel={`${metrics.recentConversions} nos últimos 30 dias`} sparklineData={conversionTrend} sparklineColor="var(--chart-1)" />
        <StatCard label="Taxa de conversão" value={`${metrics.conversionRate}%`} sublabel="Clientes por lead" sparklineData={conversionTrend.map((value) => Math.round(value * Number(metrics.conversionRate)))} sparklineColor="var(--chart-3)" />
        <StatCard label="Média por corretor" value={metrics.avgClientsPerBroker} sublabel={`${metrics.totalBrokers} responsável(is)`} sparklineData={conversionTrend.map((value) => Math.max(0, value / Math.max(1, metrics.totalBrokers)))} sparklineColor="var(--chart-4)" />
        <StatCard label="Renovações próximas" value={metrics.upcomingRenewals} sublabel="Próximos 30 dias" sparklineData={conversionTrend.map((value) => Math.max(0, metrics.upcomingRenewals ? value + 1 : value))} sparklineColor="var(--chart-2)" />
      </div>

      {/* Container de Tabela - Padrão /equipe */}
      <Card className="border-transparent bg-transparent shadow-none">
        <CardHeader className="border-b border-border/50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserList size={17} />
                Carteira de clientes ativos
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {clients.length} cliente(s) ativo(s) vinculados · ordenados pela conversão mais recente.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={clients}
            searchKey="name"
            searchPlaceholder="Buscar cliente por nome..."
            showColumnToggle={true}
            showPagination={true}
            pageSize={10}
            emptyState={
              <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15">
                  <UserList className="size-6 text-primary" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Nenhum cliente convertido ainda</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Aqui ficará o histórico de todos os seus clientes convertidos. Para adicionar um, feche um lead como vendido.
                  </p>
                </div>
                <a href="/leads" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
                  <ArrowRight className="size-3.5" /> Ir para Leads
                </a>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
