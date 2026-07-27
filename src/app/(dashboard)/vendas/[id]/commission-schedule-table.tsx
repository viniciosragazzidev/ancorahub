"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, XCircle } from "lucide-react";
import { CalendarBlank } from "@/components/huge-icons";

import { ScheduleStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  markCommissionPaidAction,
  markCommissionUnpaidAction,
  type SaleActionState,
} from "@/features/sales/actions";

export type ScheduleItem = {
  id: string;
  saleId: string;
  monthNumber: number;
  referenceMonth: string;
  dueDate: string | null;
  percentage: string;
  amount: string;
  status: "pending" | "paid" | "cancelled" | "chargeback_pending";
  paidAt: string | null;
  paidBy: string | null;
  paidByName: string | null;
  notes: string | null;
};

import { formatCurrency, formatDate } from "@/features/quotes/utils";

// ScheduleStatusBadge compartilhado de @/components/status-badges

function ActionCell({ item, canManage }: { item: ScheduleItem; canManage: boolean }) {
  const [payState, payAction, payPending] = useActionState<SaleActionState, FormData>(
    markCommissionPaidAction,
    {},
  );

  const [unpayState, unpayAction, unpayPending] = useActionState<SaleActionState, FormData>(
    markCommissionUnpaidAction,
    {},
  );

  if (payState.success) toast.success("Comissão marcada como paga.");
  if (payState.error) toast.error(payState.error);
  if (unpayState.success) toast.success("Pagamento revertido.");
  if (unpayState.error) toast.error(unpayState.error);

  if (!canManage) return null;

  return (
    <div className="text-right">
      {item.status === "pending" && (
        <form action={payAction} className="inline-block">
          <input type="hidden" name="scheduleId" value={item.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={payPending}
            className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 font-medium transition-all"
          >
            <CheckCircle className="size-3.5" /> {payPending ? "Salvando..." : "Marcar Paga"}
          </Button>
        </form>
      )}
      {item.status === "paid" && (
        <form action={unpayAction} className="inline-block">
          <input type="hidden" name="scheduleId" value={item.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={unpayPending}
            className="h-8 gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 font-medium transition-all"
          >
            <XCircle className="size-3.5" /> {unpayPending ? "Revertendo..." : "Reverter"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function CommissionScheduleTable({
  schedule,
  canManage,
}: {
  schedule: ScheduleItem[];
  canManage: boolean;
}) {
  const columns: ColumnDef<ScheduleItem>[] = [
    {
      accessorKey: "monthNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parcela" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 pl-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-mono font-medium text-primary">
            {row.original.monthNumber}
          </span>
          <span className="font-semibold text-xs">{row.original.monthNumber}º mês</span>
        </div>
      ),
    },
    {
      accessorKey: "referenceMonth",
      header: "Mês ref.",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-xs">{row.original.referenceMonth}</span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vencimento" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{formatDate(row.original.dueDate)}</span>
      ),
    },
    {
      accessorKey: "percentage",
      header: "%",
      cell: ({ row }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">{row.original.percentage}%</span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Valor" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-xs font-semibold tracking-tight text-foreground">
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <ScheduleStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "paymentInfo",
      header: "Pagamento",
      cell: ({ row }) => {
        const item = row.original;
        if (item.status === "paid") {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="cursor-help underline decoration-dotted underline-offset-4 text-xs text-muted-foreground">
                    {item.paidByName ? item.paidByName.split(" ")[0] : "Confirmado"} em {formatDate(item.paidAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Pago por {item.paidByName ?? "Diretoria"} em {formatDate(item.paidAt)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return <span className="text-xs text-muted-foreground">{item.status === "cancelled" ? "Cancelado" : "—"}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => <ActionCell item={row.original} canManage={canManage} />,
    },
  ];

  if (schedule.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
          <CalendarBlank className="size-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Nenhuma parcela gerada</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          O cronograma de repasse será gerado automaticamente com base na regra de comissionamento associada a esta venda.
        </p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={schedule}
      showColumnToggle={false}
      showPagination={false}
    />
  );
}
