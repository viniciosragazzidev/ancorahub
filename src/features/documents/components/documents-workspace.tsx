"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Trash,
  CheckCircle,
  XCircle,
  Eye,
} from "@/components/huge-icons";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { OwnershipContext } from "@/components/ownership-context";
import { VoxelIllustration } from "@/components/illustrations/voxel-illustration";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createRequirementAction,
  deleteRequirementAction,
  reviewDocumentAction,
  bulkReviewDocumentsAction,
} from "@/features/documents/actions";

type Carrier = { id: string; name: string };
type Plan = { id: string; name: string; carrierName: string };
type Requirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  appliesPerBeneficiary: boolean;
  carrierId: string | null;
  carrierName: string | null;
  planId: string | null;
  planName: string | null;
};
type PendingDoc = {
  id: string;
  filename: string;
  fileUrl: string;
  status: string;
  createdAt: Date;
  leadId: string;
  leadNome: string;
  corretorNome: string | null;
  branchName: string | null;
  requirementName: string | null;
};

function isVersionSkewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to find server action|older or newer deployment|version skew/i.test(message);
}

function reloadAfterDeploymentUpdate() {
  toast.info("O sistema foi atualizado. Recarregando esta tela…");
  window.setTimeout(() => window.location.reload(), 250);
}

export function DocumentsWorkspace({
  role,
  carriers,
  plans,
  initialRequirements,
  initialPendingDocs,
}: {
  role: "director" | "manager" | "broker";
  carriers: Carrier[];
  plans: Plan[];
  initialRequirements: Requirement[];
  initialPendingDocs: PendingDoc[];
}) {
  const [activeTab, setActiveTab] = useState<"queue" | "config">(
    role === "director" ? "queue" : "queue"
  );
  const [requirements, setRequirements] = useState(initialRequirements);
  const [pendingDocs, setPendingDocs] = useState(initialPendingDocs);

  const pendingIds = useMemo(() => pendingDocs.map((d) => d.id), [pendingDocs]);
  const multiSelect = useMultiSelect(pendingIds);
  const [reqState, reqFormAction, reqPending] = useActionState(createRequirementAction, {});
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (reqState.success) {
      toast.success("Requisito criado com sucesso!");
      window.location.reload();
    }
    if (reqState.error) {
      toast.error(reqState.error);
    }
  }, [reqState]);

  const handleDeleteReq = (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este requisito?")) return;
    startTransition(async () => {
      const res = await deleteRequirementAction(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Requisito removido.");
        setRequirements((current) => current.filter((r) => r.id !== id));
      }
    });
  };

  const handleReviewDoc = (docId: string, leadId: string, status: "approved" | "rejected") => {
    startTransition(async () => {
      try {
        const res = await reviewDocumentAction({ documentId: docId, leadId, status });
        if (res.error) toast.error(res.error);
        else {
          toast.success(status === "approved" ? "Documento aprovado." : "Documento rejeitado.");
          setPendingDocs((current) => current.filter((d) => d.id !== docId));
        }
      } catch (error) {
        if (isVersionSkewError(error)) reloadAfterDeploymentUpdate();
        else toast.error("Não foi possível atualizar o documento. Tente novamente.");
      }
    });
  };

  const handleBulkReview = (status: "approved" | "rejected") => {
    const ids = multiSelect.selectedIds;
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        const res = await bulkReviewDocumentsAction(ids, status);
        if (res.error) toast.error(res.error);
        else {
          toast.success(`Processamento em lote concluído (${ids.length} itens).`);
          setPendingDocs((current) => current.filter((d) => !ids.includes(d.id)));
          multiSelect.clear();
        }
      } catch (error) {
        if (isVersionSkewError(error)) reloadAfterDeploymentUpdate();
        else toast.error("Não foi possível atualizar os documentos. Tente novamente.");
      }
    });
  };

  const columns: ColumnDef<PendingDoc>[] = [
    ...(role !== "broker"
      ? [
          {
            id: "select",
            header: () => (
              <Checkbox
                aria-label="Selecionar todos"
                checked={multiSelect.isAllSelected}
                onCheckedChange={multiSelect.selectAll}
                onClick={(event) => event.stopPropagation()}
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                aria-label={`Selecionar ${row.original.leadNome}`}
                checked={multiSelect.isSelected(row.original.id)}
                onCheckedChange={() => multiSelect.toggle(row.original.id)}
                onClick={(event) => event.stopPropagation()}
              />
            ),
            enableSorting: false,
            enableHiding: false,
          } satisfies ColumnDef<PendingDoc>,
        ]
      : []),
    {
      accessorKey: "leadNome",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lead" />,
      cell: ({ row }) => (
        <a
          href={`/leads/${row.original.leadId}`}
          className="text-xs font-semibold text-foreground hover:text-primary hover:underline leading-snug"
        >
          {row.original.leadNome}
        </a>
      ),
    },
    {
      accessorKey: "filename",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Documento" />,
      cell: ({ row }) => (
        <a
          href={row.original.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-foreground hover:text-primary hover:underline"
        >
          {row.original.filename} <Eye className="size-3" />
        </a>
      ),
    },
    {
      accessorKey: "requirementName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo Requisitado" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.requirementName ?? "Avulso"}</span>
      ),
    },
    {
      id: "ownership",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Responsável / unidade" />,
      cell: ({ row }) => (
        <OwnershipContext
          brokerName={row.original.corretorNome}
          branchName={row.original.branchName}
          emptyLabel="Não informado"
          className="text-xs"
        />
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Data de Envio" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          {role === "broker" ? (
            <span className="text-xs capitalize text-muted-foreground">{row.original.status}</span>
          ) : (
            <div className="flex justify-end gap-1.5">
              <Button
                size="icon-xs"
                variant="outline"
                className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                onClick={() => handleReviewDoc(row.original.id, row.original.leadId, "approved")}
                title="Aprovar"
              >
                <CheckCircle className="size-3.5" />
              </Button>
              <Button
                size="icon-xs"
                variant="destructive"
                onClick={() => handleReviewDoc(row.original.id, row.original.leadId, "rejected")}
                title="Rejeitar"
              >
                <XCircle className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {role === "director" && (
        <div className="flex gap-2 border-b pb-px">
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "queue"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Fila de Aprovação
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "config"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Configuração de Requisitos
          </button>
        </div>
      )}

      {activeTab === "queue" && (
        <div className="space-y-4">
          {role !== "broker" && (
            <SelectionToolbar
              selectedCount={multiSelect.count}
              totalCount={pendingDocs.length}
              onClear={multiSelect.clear}
            >
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-500 hover:text-emerald-600 border-emerald-500/20"
                disabled={multiSelect.count === 0}
                onClick={() => handleBulkReview("approved")}
              >
                <CheckCircle className="size-4" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={multiSelect.count === 0}
                onClick={() => handleBulkReview("rejected")}
              >
                <XCircle className="size-4" />
                Rejeitar
              </Button>
            </SelectionToolbar>
          )}

          <DataTable
            columns={columns}
            data={pendingDocs}
            searchPlaceholder="Buscar por lead, documento ou tipo..."
            showColumnToggle={true}
            showPagination={true}
            pageSize={10}
            emptyState={
              pendingDocs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <VoxelIllustration className="size-20" name="document-review" />
                  <div className="max-w-sm space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Nenhum documento aguardando aprovação.
                    </p>
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
      )}

      {activeTab === "config" && role === "director" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Checklist de Documentos</CardTitle>
              <CardDescription>
                Requisitos globais de documentos obrigatórios parametrizados por operadora/plano.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requirements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  Nenhum requisito de documento configurado.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Operadora</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Obrigatório</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requirements.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <span className="font-semibold">{req.name}</span>
                            {req.description && (
                              <span className="block text-[10px] text-muted-foreground">
                                {req.description}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{req.carrierName ?? "Todas"}</TableCell>
                          <TableCell>{req.planName ?? "Todos"}</TableCell>
                          <TableCell>
                            {req.required ? (
                              <span className="text-xs text-primary font-bold">Sim</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Não</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteReq(req.id)}
                            >
                              <Trash className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4 text-primary" /> Novo Requisito
              </CardTitle>
              <CardDescription>Defina as regras de documentos obrigatórios.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={reqFormAction} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome do documento</Label>
                  <Input id="name" name="name" placeholder="Ex.: RG / CNH do Titular" required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição/Instruções</Label>
                  <Input id="description" name="description" placeholder="Instruções para o corretor" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="carrierId">Operadora vinculada (Opcional)</Label>
                  <select
                    id="carrierId"
                    name="carrierId"
                    className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Todas as operadoras</option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="planId">Plano específico (Opcional)</Label>
                  <select
                    id="planId"
                    name="planId"
                    className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Todos os planos</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.carrierName} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="required" name="required" value="true" defaultChecked />
                    <Label htmlFor="required" className="text-xs cursor-pointer select-none">
                    Este documento é obrigatório para fechamento
                  </Label>
                  </div>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="appliesPerBeneficiary" name="appliesPerBeneficiary" value="true" />
                  <Label htmlFor="appliesPerBeneficiary" className="text-xs cursor-pointer select-none">Exigir este documento para cada beneficiário</Label>
                </div>

                <Button className="w-full mt-4" type="submit" disabled={reqPending}>
                  {reqPending ? "Criando..." : "Criar Requisito"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
