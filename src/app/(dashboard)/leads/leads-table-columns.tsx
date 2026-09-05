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

import { UserAvatar } from "@/components/ui/user-avatar";
import { WhatsappLogo } from "@/components/huge-icons";
import Link from "next/link";

const STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string; className: string }
> = {
  new: {
    label: "Novo Lead",
    dotColor: "bg-sky-500",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  novo: {
    label: "Novo Lead",
    dotColor: "bg-sky-500",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  distributed: {
    label: "Distribuído",
    dotColor: "bg-blue-500",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  distribuido: {
    label: "Distribuído",
    dotColor: "bg-blue-500",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  in_contact: {
    label: "Em Atendimento",
    dotColor: "bg-amber-500",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  in_service: {
    label: "Em Atendimento",
    dotColor: "bg-amber-500",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  em_atendimento: {
    label: "Em Atendimento",
    dotColor: "bg-amber-500",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  quote_sent: {
    label: "Cotação Enviada",
    dotColor: "bg-purple-500",
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  cotacao_enviada: {
    label: "Cotação Enviada",
    dotColor: "bg-purple-500",
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  negotiation: {
    label: "Em Negociação",
    dotColor: "bg-orange-500",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  negociacao: {
    label: "Em Negociação",
    dotColor: "bg-orange-500",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  documentation_pending: {
    label: "Pend. Documentos",
    dotColor: "bg-pink-500",
    className: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
  },
  pendente_documentacao: {
    label: "Pend. Documentos",
    dotColor: "bg-pink-500",
    className: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
  },
  under_analysis: {
    label: "Em Análise",
    dotColor: "bg-cyan-500",
    className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  },
  em_analise: {
    label: "Em Análise",
    dotColor: "bg-cyan-500",
    className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  },
  qualified: {
    label: "Qualificado",
    dotColor: "bg-emerald-500",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  qualificado: {
    label: "Qualificado",
    dotColor: "bg-emerald-500",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  converted: {
    label: "Venda Realizada",
    dotColor: "bg-emerald-500",
    className: "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/40",
  },
  venda_realizada: {
    label: "Venda Realizada",
    dotColor: "bg-emerald-500",
    className: "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/40",
  },
  ganho: {
    label: "Venda Realizada",
    dotColor: "bg-emerald-500",
    className: "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/40",
  },
  lost: {
    label: "Perdido",
    dotColor: "bg-red-500",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
  perdido: {
    label: "Perdido",
    dotColor: "bg-red-500",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
};

const QUALIFICATION_CONFIG: Record<string, { label: string; className: string }> = {
  alta: {
    label: "Alta Aptidão",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
  },
  high: {
    label: "Alta Aptidão",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
  },
  hot: {
    label: "Alta Aptidão",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
  },
  quente: {
    label: "Alta Aptidão",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
  },
  media: {
    label: "Média Aptidão",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold",
  },
  medium: {
    label: "Média Aptidão",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold",
  },
  warm: {
    label: "Média Aptidão",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold",
  },
  morno: {
    label: "Média Aptidão",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold",
  },
  baixa: {
    label: "Baixa Aptidão",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
  },
  low: {
    label: "Baixa Aptidão",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
  },
  cold: {
    label: "Baixa Aptidão",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
  },
  frio: {
    label: "Baixa Aptidão",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
  },
  unqualified: {
    label: "Desqualificado",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-medium",
  },
  desqualificado: {
    label: "Desqualificado",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-medium",
  },
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lead / Contato" />,
    cell: ({ row }) => {
      const lead = row.original;
      const phoneDigits = lead.phone ? lead.phone.replace(/\D/g, "") : "";
      return (
        <div className="flex items-center gap-3 py-0.5">
          <UserAvatar
            seed={lead.email || lead.name}
            name={lead.name}
            className="size-8 rounded-lg shrink-0 border border-border/60 text-[11px] font-bold"
          />
          <div className="min-w-0 flex flex-col gap-0.5">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer(lead);
              }}
              className="h-auto max-w-full justify-start truncate p-0 text-left text-xs font-semibold text-foreground"
              variant="link"
            >
              {lead.name}
            </Button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono tabular-nums">{lead.phone}</span>
              {phoneDigits && (
                <a
                  href={`https://wa.me/55${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Conversar no WhatsApp"
                  className="text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  <WhatsappLogo className="size-3" weight="fill" />
                </a>
              )}
            </div>
          </div>
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Etapa Comercial" />,
    cell: ({ row }) => {
      const statusKey = (row.getValue("status") as string || "").toLowerCase();
      const config = STATUS_CONFIG[statusKey] ?? {
        label: row.getValue("status") as string,
        dotColor: "bg-muted-foreground",
        className: "bg-muted/50 text-muted-foreground border-border/50",
      };
      return (
        <Badge
          variant="outline"
          className={`gap-1.5 px-2.5 py-0.5 text-[11px] rounded-full inline-flex items-center font-medium transition-all ${config.className}`}
        >
          <span className={`size-1.5 rounded-full shrink-0 ${config.dotColor}`} />
          {config.label}
        </Badge>
      );
    },
    meta: {
      label: "Etapa Comercial",
      variant: "select",
      options: [
        { label: "Novo Lead", value: "new" },
        { label: "Distribuído", value: "distributed" },
        { label: "Em Atendimento", value: "in_service" },
        { label: "Cotação Enviada", value: "quote_sent" },
        { label: "Em Negociação", value: "negotiation" },
        { label: "Pend. Documentos", value: "documentation_pending" },
        { label: "Em Análise", value: "under_analysis" },
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
      if (!qual) return <span className="text-muted-foreground text-[11px] font-mono">—</span>;

      const config = QUALIFICATION_CONFIG[qual.toLowerCase()] ?? {
        label: qual,
        className: "bg-muted/50 text-muted-foreground border-border/50",
      };

      return (
        <Badge
          variant="outline"
          className={`gap-1 px-2 py-0.5 text-[11px] rounded-md inline-flex items-center transition-all ${config.className}`}
        >
          <Sparkles className="h-3 w-3 shrink-0" />
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
        { label: "Desqualificado", value: "desqualificado" },
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
      return (
        <span className="inline-flex text-[11px] font-medium text-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
          {plan || "Não informado"}
        </span>
      );
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
        <span className="inline-flex items-center gap-1 font-semibold text-xs tabular-nums text-foreground">
          <Users className="size-3 text-muted-foreground shrink-0" />
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Corretor Responsável" />,
    cell: ({ row }) => {
      const broker = row.original.assignedBrokerName;
      return (
        <span className="text-xs text-foreground font-medium flex items-center gap-1.5">
          <User className="size-3 text-muted-foreground shrink-0" />
          {broker || <span className="text-muted-foreground/70 italic font-normal">Sem atribuição</span>}
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
      if (!date) return <span className="text-muted-foreground font-mono text-[11px]">—</span>;
      return (
        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
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
      const phoneDigits = lead.phone ? lead.phone.replace(/\D/g, "") : "";
      return (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {phoneDigits && (
            <a
              href={`https://wa.me/55${phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir WhatsApp"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/60 bg-card hover:bg-emerald-500/10 hover:border-emerald-500/40 text-muted-foreground hover:text-emerald-500 transition-colors"
            >
              <WhatsappLogo className="size-3.5 text-emerald-500" weight="fill" />
            </a>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={() => onOpenDrawer(lead)}
            className="h-7 px-2 text-xs font-medium"
          >
            Ver Detalhes
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-muted/60">
                  <span className="sr-only">Mais opções</span>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Opções do Lead</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onOpenDrawer(lead)} className="text-xs font-medium">
                Abrir Drawer de Gestão
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/leads/${lead.id}`} />} className="text-xs font-medium">
                Abrir Página Completa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {phoneDigits && (
                <DropdownMenuItem
                  onClick={() => {
                    window.open(`https://wa.me/55${phoneDigits}`, "_blank");
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold"
                >
                  Abrir no WhatsApp
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];
