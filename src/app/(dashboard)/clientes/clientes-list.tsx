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
  return (
    <div className="flex flex-col gap-6">
      {/* 4 Cards Compactos - Padrão /equipe */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card size="sm" className="border-border bg-card shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de clientes</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{metrics.totalClients}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-border bg-card shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Taxa de conversão</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-blue-500">{metrics.conversionRate}%</p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-border bg-card shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Média por corretor</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-purple-500">{metrics.avgClientsPerBroker}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-border bg-card shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Renovações próximas</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-amber-500">{metrics.upcomingRenewals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Container de Tabela - Padrão /equipe */}
      <Card className="border-border bg-card shadow-xs">
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
