"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  MoreHorizontal,
  Phone,
  Sparkles,
  User,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { LeadRow } from "./leads-table-config";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  new: { label: "Novo Lead", variant: "default", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  distributed: { label: "Distribuído", variant: "secondary", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  in_service: { label: "Em Atendimento", variant: "outline", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  qualified: { label: "Qualificado", variant: "outline", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  converted: { label: "Venda Realizada", variant: "default", className: "bg-emerald-600 text-white" },
  lost: { label: "Perdido", variant: "destructive" },
};

const QUALIFICATION_CONFIG: Record<string, { label: string; className: string }> = {
  alta: { label: "Alta Aptidão", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  media: { label: "Média Aptidão", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  baixa: { label: "Baixa Aptidão", className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};

export const getLeadsColumns = (
  onOpenDrawer: (lead: LeadRow) => void,
): ColumnDef<LeadRow>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar tudo"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Selecionar linha"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    id: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lead / Cliente" />,
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground hover:underline">
            {lead.name}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3 opacity-70" />
            {lead.phone}
          </span>
        </div>
      );
    },
    meta: {
      label: "Nome do Lead",
      placeholder: "Buscar por nome...",
      variant: "text",
      icon: User,
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status Comercial" />,
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" };
      return (
        <Badge variant={config.variant} className={config.className}>
          {config.label}
        </Badge>
      );
    },
    meta: {
      label: "Status Comercial",
      variant: "select",
      options: [
        { label: "Novo Lead", value: "new" },
        { label: "Distribuído", value: "distributed" },
        { label: "Em Atendimento", value: "in_service" },
        { label: "Qualificado", value: "qualified" },
        { label: "Venda Realizada", value: "converted" },
        { label: "Perdido", value: "lost" },
      ],
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "qualificationStatus",
    id: "qualificationStatus",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Qualificação IA" />,
    cell: ({ row }) => {
      const qual = row.getValue("qualificationStatus") as string | null;
      if (!qual) return <span className="text-muted-foreground text-[11px]">—</span>;

      const config = QUALIFICATION_CONFIG[qual.toLowerCase()] ?? {
        label: qual,
        className: "bg-muted text-muted-foreground",
      };

      return (
        <Badge variant="outline" className={`gap-1 ${config.className}`}>
          <Sparkles className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    },
    meta: {
      label: "Qualificação IA",
      variant: "select",
      options: [
        { label: "Alta Aptidão", value: "alta" },
        { label: "Média Aptidão", value: "media" },
        { label: "Baixa Aptidão", value: "baixa" },
      ],
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: "planType",
    id: "planType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plano / Produto" />,
    cell: ({ row }) => {
      const plan = row.getValue("planType") as string;
      return <span className="font-medium">{plan || "Não informado"}</span>;
    },
    meta: {
      label: "Plano / Produto",
      variant: "select",
      options: [
        { label: "Individual", value: "Individual" },
        { label: "Familiar", value: "Familiar" },
        { label: "Empresarial (PME)", value: "Empresarial" },
      ],
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "lives",
    id: "lives",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vidas" />,
    cell: ({ row }) => {
      const lives = row.getValue("lives") as number;
      return (
        <span className="font-semibold tabular-nums text-foreground">
          {lives} {lives === 1 ? "vida" : "vidas"}
        </span>
      );
    },
    meta: {
      label: "Quantidade de Vidas",
      variant: "number",
      icon: Users,
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "assignedBrokerName",
    id: "assignedBrokerName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Corretor / Responsável" />,
    cell: ({ row }) => {
      const broker = row.original.assignedBrokerName;
      return (
        <span className="text-muted-foreground font-medium">
          {broker || "Aguardando atribuição"}
        </span>
      );
    },
    meta: {
      label: "Corretor Responsável",
      variant: "text",
      icon: User,
    },
  },
  {
    accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Recebido em" />,
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      if (!date) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="text-muted-foreground tabular-nums">
          {format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      );
    },
    meta: {
      label: "Data de Criação",
      variant: "date",
      icon: Calendar,
    },
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-muted">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Ações do Lead</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onOpenDrawer(lead)} className="text-xs">
              Ver Detalhes do Lead
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const phoneDigits = lead.phone.replace(/\D/g, "");
                window.open(`https://wa.me/55${phoneDigits}`, "_blank");
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
            >
              Abrir no WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];
