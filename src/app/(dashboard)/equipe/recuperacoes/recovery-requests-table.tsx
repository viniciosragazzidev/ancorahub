"use client";

import { useActionState, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, X, Loader2, Eye, Ban } from "lucide-react";
import { RecoveryStatusBadge } from "@/components/status-badges";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { approveResetAction, rejectResetAction, type RecoveryActionState } from "./actions";

type ResetRequest = {
  id: string;
  userId: string;
  userEmail: string;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
  directorNotes: string | null;
  userName: string;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// RecoveryStatusBadge compartilhado de @/components/status-badges

export function RecoveryRequestsTable({ requests }: { requests: ResetRequest[] }) {
  const [rejectDialog, setRejectDialog] = useState<{ id: string; email: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailsDialog, setDetailsDialog] = useState<ResetRequest | null>(null);

  const [approveState, approveAction, approvePending] = useActionState<RecoveryActionState, FormData>(
    approveResetAction,
    {},
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<RecoveryActionState, FormData>(
    rejectResetAction,
    {},
  );

  if (approveState.message) { toast.success(approveState.message); approveState.message = undefined; }
  if (approveState.error) { toast.error(approveState.error); approveState.error = undefined; }
  if (rejectState.message) { toast.success(rejectState.message); rejectState.message = undefined; }
  if (rejectState.error) { toast.error(rejectState.error); rejectState.error = undefined; }

  const columns: ColumnDef<ResetRequest>[] = [
    {
      accessorKey: "userName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nome" />
      ),
      cell: ({ row }) => (
        <span className="font-semibold text-xs text-foreground pl-2">{row.original.userName}</span>
      ),
    },
    {
      accessorKey: "userEmail",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="E-mail" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.userEmail}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <RecoveryStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Solicitada em" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: "reviewedAt",
      header: "Análise",
      cell: ({ row }) => {
        const req = row.original;
        return (
          <div className="text-xs text-muted-foreground">
            {req.reviewedAt ? formatDate(req.reviewedAt) : "—"}
            {req.directorNotes && (
              <button
                type="button"
                onClick={() => setDetailsDialog(req)}
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
              >
                <Eye className="size-3" />
                Ver justificativa
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const req = row.original;
        return (
          <div className="text-right pr-2">
            {req.status === "requested" ? (
              <div className="flex items-center justify-end gap-2">
                <form action={approveAction}>
                  <input type="hidden" name="requestId" value={req.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="default"
                    disabled={approvePending}
                    className="h-8 gap-1 text-xs"
                  >
                    {approvePending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Check className="size-3" />
                    )}
                    Aprovar
                  </Button>
                </form>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs text-red-600 hover:text-red-700"
                  onClick={() => setRejectDialog({ id: req.id, email: req.userEmail })}
                >
                  <X className="size-3" />
                  Rejeitar
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {req.status === "approved" ? "Link enviado" :
                 req.status === "completed" ? "Senha redefinida" :
                 req.status === "rejected" ? (req.directorNotes ? "Com justificativa" : "Sem justificativa") :
                 "—"}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={requests}
        searchKey="userName"
        searchPlaceholder="Buscar por nome ou e-mail..."
        showColumnToggle={true}
        showPagination={true}
        pageSize={10}
      />

      {/* Reject dialog with reason */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectReason(""); } }}>
        <DialogPopup overlayClassName="z-50">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Rejeitar solicitação</DialogTitle>
              <DialogDescription>
                Deseja rejeitar a solicitação de <strong>{rejectDialog?.email}</strong>?
                Você pode opcionalmente informar uma justificativa.
              </DialogDescription>
            </DialogHeader>
            <form
              action={async (formData: FormData) => {
                if (rejectReason) formData.set("reason", rejectReason);
                await rejectAction(formData);
                setRejectDialog(null);
                setRejectReason("");
              }}
            >
              <input type="hidden" name="requestId" value={rejectDialog?.id ?? ""} />
              <div className="space-y-4">
                <div>
                  <label htmlFor="reject-reason" className="text-sm font-medium">
                    Justificativa <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <Textarea
                    id="reject-reason"
                    placeholder="Ex: O colaborador deve procurar o RH presencialmente..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setRejectDialog(null); setRejectReason(""); }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="destructive" disabled={rejectPending}>
                    {rejectPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Ban className="size-4" />
                    )}
                    Rejeitar solicitação
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* Details dialog for director notes */}
      <Dialog open={!!detailsDialog} onOpenChange={(open) => { if (!open) setDetailsDialog(null); }}>
        <DialogPopup overlayClassName="z-50">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Detalhes da rejeição</DialogTitle>
              <DialogDescription>
                Solicitação de <strong>{detailsDialog?.userName}</strong> ({detailsDialog?.userEmail})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Justificativa do diretor</p>
                <p className="mt-1 rounded-md bg-muted p-3 text-sm">{detailsDialog?.directorNotes ?? "Nenhuma justificativa fornecida."}</p>
              </div>
              {detailsDialog?.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  Analisada em {formatDate(detailsDialog.reviewedAt)}
                </p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Fechar</Button>} />
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
