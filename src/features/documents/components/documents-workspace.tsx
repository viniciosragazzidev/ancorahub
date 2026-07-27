"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash,
  CheckCircle,
  XCircle,
  Eye,
} from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { OwnershipContext } from "@/components/ownership-context";
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

  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
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
    if (selectedDocs.length === 0) return;
    startTransition(async () => {
      try {
        const res = await bulkReviewDocumentsAction(selectedDocs, status);
        if (res.error) toast.error(res.error);
        else {
          toast.success(`Processamento em lote concluído (${selectedDocs.length} itens).`);
          setPendingDocs((current) => current.filter((d) => !selectedDocs.includes(d.id)));
          setSelectedDocs([]);
        }
      } catch (error) {
        if (isVersionSkewError(error)) reloadAfterDeploymentUpdate();
        else toast.error("Não foi possível atualizar os documentos. Tente novamente.");
      }
    });
  };

  const toggleSelectDoc = (id: string) => {
    setSelectedDocs((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  };

  const toggleSelectAll = () => {
    if (selectedDocs.length === pendingDocs.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(pendingDocs.map((d) => d.id));
    }
  };

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
          {role !== "broker" && selectedDocs.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20">
              <span className="text-xs font-medium">
                {selectedDocs.length} documento(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-600 border-emerald-500/20" onClick={() => handleBulkReview("approved")}>
                  <CheckCircle className="size-4 mr-1" /> Aprovar selecionados
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkReview("rejected")}>
                  <XCircle className="size-4 mr-1" /> Rejeitar selecionados
                </Button>
              </div>
            </div>
          )}

          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Fila de Pendências</CardTitle>
              <CardDescription>
                Abaixo estão listados os documentos aguardando revisão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingDocs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center border border-dashed rounded-lg">
                  <CheckCircle className="size-8 text-emerald-500 mb-2" />
                  <p className="font-semibold text-sm">Tudo em dia!</p>
                  <p className="text-xs text-muted-foreground">Nenhum documento aguardando aprovação.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        {role !== "broker" && <TableHead className="w-10">
                          <Checkbox
                            checked={selectedDocs.length === pendingDocs.length && pendingDocs.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>}
                        <TableHead>Lead</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Tipo Requisitado</TableHead>
                        <TableHead>Responsável / unidade</TableHead>
                        <TableHead>Data de Envio</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDocs.map((doc) => (
                        <TableRow key={doc.id}>
                          {role !== "broker" && <TableCell>
                            <Checkbox
                              checked={selectedDocs.includes(doc.id)}
                              onCheckedChange={() => toggleSelectDoc(doc.id)}
                            />
                          </TableCell>}
                          <TableCell className="font-medium">
                            <a href={`/leads/${doc.leadId}`} className="text-primary hover:underline">
                              {doc.leadNome}
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {doc.filename} <Eye className="size-3" />
                            </a>
                          </TableCell>
                          <TableCell>{doc.requirementName ?? "Avulso"}</TableCell>
                          <TableCell><OwnershipContext brokerName={doc.corretorNome} branchName={doc.branchName} emptyLabel="Não informado" /></TableCell>
                          <TableCell>
                            {new Intl.DateTimeFormat("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(doc.createdAt))}
                          </TableCell>
                          <TableCell className={role === "broker" ? "text-sm capitalize" : "text-right"}>
                            {role === "broker" ? doc.status : (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="icon-xs"
                                variant="outline"
                                className="text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10"
                                onClick={() => handleReviewDoc(doc.id, doc.leadId, "approved")}
                                title="Aprovar"
                              >
                                <CheckCircle className="size-3.5" />
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="destructive"
                                onClick={() => handleReviewDoc(doc.id, doc.leadId, "rejected")}
                                title="Rejeitar"
                              >
                                <XCircle className="size-3.5" />
                              </Button>
                            </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
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
