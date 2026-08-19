"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogPopup as DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAutomationAction,
  updateAutomationAction,
  deleteAutomationAction,
  retryAutomationLogAction,
} from "../actions";
import { type AutomationStatus } from "@/shared/db/schema";

type Automation = {
  id: string;
  name: string;
  triggerType: string;
  status: AutomationStatus;
  templateBody: string;
  configuration: unknown;
  description: string | null;
  createdAt: Date;
};

type AutomationLog = {
  id: string;
  automationId: string;
  leadId: string | null;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  runAfter: Date;
  createdAt: Date;
  updatedAt: Date;
};

interface AutomationsClientProps {
  initialAutomations: Automation[];
  initialLogs: AutomationLog[];
  isAdmin: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_parado: "Lead Parado",
  retorno_agendado: "Retorno Agendado",
  documento_pendente: "Documento Pendente",
  proposta_sem_resposta: "Proposta sem Resposta",
  lead_perdido: "Lead Perdido",
  venda_realizada: "Venda Realizada",
  alerta_primeiro_atendimento: "Alerta de Primeiro Atendimento",
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  teste: "Teste",
  publicado: "Publicado",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export function AutomationsClient({ initialAutomations, initialLogs, isAdmin }: AutomationsClientProps) {
  const automations = initialAutomations;
  const logs = initialLogs;
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingAutomation, setEditingAutomation] = React.useState<Automation | null>(null);

  // Form states
  const [name, setName] = React.useState("");
  const [triggerType, setTriggerType] = React.useState("lead_parado");
  const [templateBody, setTemplateBody] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [hours, setHours] = React.useState("24");

  const handleStartEdit = (aut: Automation) => {
    setEditingAutomation(aut);
    setName(aut.name);
    setTriggerType(aut.triggerType);
    setTemplateBody(aut.templateBody);
    setDescription(aut.description || "");
    const config = aut.configuration as { hours?: number } | null;
    setHours(config?.hours?.toString() || "24");
  };

  const handleCancelEdit = () => {
    setEditingAutomation(null);
    setName("");
    setTriggerType("lead_parado");
    setTemplateBody("");
    setDescription("");
    setHours("24");
  };

  const handleCreate = async () => {
    if (!name || !templateBody) {
      toast.error("Preencha todos os campos obrigatorios.");
      return;
    }

    const res = await createAutomationAction({
      name,
      triggerType,
      templateBody,
      configuration: { hours: Number(hours) },
      description,
    });

    if (res.success) {
      toast.success("Automacao criada com sucesso.");
      setIsCreateOpen(false);
      setName("");
      setTemplateBody("");
      setDescription("");
      // Realreload or state update
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao criar automacao.");
    }
  };

  const handleUpdate = async () => {
    if (!editingAutomation) return;
    if (!name || !templateBody) {
      toast.error("Preencha todos os campos obrigatorios.");
      return;
    }

    const res = await updateAutomationAction(editingAutomation.id, {
      name,
      templateBody,
      configuration: { hours: Number(hours) },
    });

    if (res.success) {
      toast.success("Automacao atualizada com sucesso.");
      setEditingAutomation(null);
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao atualizar automacao.");
    }
  };

  const handleStatusChange = async (id: string, status: AutomationStatus) => {
    const res = await updateAutomationAction(id, { status });
    if (res.success) {
      toast.success(`Status atualizado para ${STATUS_LABELS[status]}.`);
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao alterar status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta automacao?")) return;
    const res = await deleteAutomationAction(id);
    if (res.success) {
      toast.success("Automacao excluida com sucesso.");
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao excluir automacao.");
    }
  };

  const handleRetryLog = async (logId: string) => {
    const res = await retryAutomationLogAction(logId);
    if (res.success) {
      toast.success("Log reenviado para a fila de execucao.");
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao tentar reprocessar.");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Automacoes CRM</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie disparos automaticos de mensagens baseados em eventos do pipeline comercial.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Criar Automacao
          </Button>
        )}
      </div>

      <Tabs defaultValue="automations" variant="segment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="automations">Regras de Automacao</TabsTrigger>
          <TabsTrigger value="history">Fila e Historico</TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {automations.map((aut) => (
              <Card key={aut.id} className="border-slate-200 dark:border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-md font-semibold text-slate-900 dark:text-slate-100">
                    {aut.name}
                  </CardTitle>
                  <Badge variant={aut.status === "publicado" ? "default" : "secondary"}>
                    {STATUS_LABELS[aut.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Gatilho</p>
                    <p className="text-sm font-medium">{TRIGGER_LABELS[aut.triggerType] || aut.triggerType}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Mensagem</p>
                    <p className="text-xs line-clamp-3 bg-slate-50 dark:bg-slate-950 p-2 rounded text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-900">
                      {aut.templateBody}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Select
                      defaultValue={aut.status}
                      onValueChange={(val) => handleStatusChange(aut.id, val as AutomationStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Mudar Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="teste">Teste</SelectItem>
                        <SelectItem value="publicado">Publicado</SelectItem>
                        <SelectItem value="pausado">Pausado</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleStartEdit(aut)}>
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => handleDelete(aut.id)}>
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {automations.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500">
                Nenhuma automacao configurada.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execucoes Recentes</CardTitle>
              <CardDescription>Fila de processamento, tentativas de envio e logs de erro/excecoes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro / Observacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{log.leadId || "Nao identificado"}</TableCell>
                      <TableCell className="text-xs">
                        {log.attemptCount} / {log.maxAttempts}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "completed"
                              ? "default"
                              : log.status === "dead_letter"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate text-slate-500 dark:text-slate-400">
                        {log.lastError || "Nenhum erro registrado"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(log.status === "failed" || log.status === "dead_letter") && (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => handleRetryLog(log.id)}>
                            Reprocessar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        Nenhum log de execucao encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Automacao CRM</DialogTitle>
            <DialogDescription>Defina as configuracoes para a nova regra de disparo comercial.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome da Automacao</label>
              <Input
                placeholder="Ex: Alerta de Lead Parado"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Gatilho de Ativacao</label>
              <Select value={triggerType} onValueChange={(val) => setTriggerType(val || "lead_parado")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gatilho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_parado">Lead Parado</SelectItem>
                  <SelectItem value="retorno_agendado">Retorno Agendado</SelectItem>
                  <SelectItem value="documento_pendente">Documento Pendente</SelectItem>
                  <SelectItem value="proposta_sem_resposta">Proposta sem Resposta</SelectItem>
                  <SelectItem value="lead_perdido">Lead Perdido</SelectItem>
                  <SelectItem value="venda_realizada">Venda Realizada</SelectItem>
                  <SelectItem value="alerta_primeiro_atendimento">Alerta de Primeiro Atendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {triggerType === "lead_parado" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold">Horas de Inatividade</label>
                <Input
                  type="number"
                  placeholder="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold">Descricao (Opcional)</label>
              <Input
                placeholder="Descreva o objetivo desta regra"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Template de Mensagem</label>
              <Textarea
                placeholder="Ola {{nome}}, notamos seu interesse em..."
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={4}
              />
              <p className="text-[10px] text-slate-400">Use {"{{nome}}"} para inserir dinamicamente o nome do lead.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editingAutomation !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Automacao</DialogTitle>
            <DialogDescription>Altere as configuracoes da regra selecionada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome da Automacao</label>
              <Input
                placeholder="Ex: Alerta de Lead Parado"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {triggerType === "lead_parado" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold">Horas de Inatividade</label>
                <Input
                  type="number"
                  placeholder="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold">Template de Mensagem</label>
              <Textarea
                placeholder="Ola {{nome}}, tudo bem?"
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={4}
              />
              <p className="text-[10px] text-slate-400">Use {"{{nome}}"} para inserir dinamicamente o nome do lead.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>Cancelar</Button>
            <Button onClick={handleUpdate} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salvar Alteracoes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
