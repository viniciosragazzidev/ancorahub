"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ArrowUpRight, ChatCircleText, FileText, ListChecks, Phone, SquaresFour, UserList, WhatsappLogo, X } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { BulkStatusDialog } from "@/components/ui/bulk-status-dialog";
import { BulkReassignDialog } from "@/components/ui/bulk-reassign-dialog";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkChangeLeadStatusAction } from "./status-actions";
import { LeadDrawerManagementActions } from "./_components/lead-drawer-management-actions";
import { LeadQualificationBadge, LeadStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetSection,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { maskPhone, maskName, formatDate } from "@/features/quotes/utils";
import { OwnershipContext } from "@/components/ownership-context";
import { LeadHealthBadge, computeLeadHealth } from "@/features/leads/components/lead-health-badge";
import { LeadQuickNote } from "@/features/leads/components/lead-quick-note";
import { LeadReminder } from "@/features/leads/components/lead-reminder";

export type LeadWorkspaceItem = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  qualificationStatus: string;
  distributionStatus?: string;
  origem: string;
  sourceCampaign: string | null;
  tipo: string;
  createdAt: string;
  assignedAt: string | null;
  stageEnteredAt: string | null;
  serviceStartedAt: string | null;
  firstContactAt: string | null;
  corretorId: string | null;
  corretorNome: string | null;
  branchId: string | null;
  branchName: string | null;
};

const kanbanStatuses = ["new", "in_contact", "quote_sent", "negotiation", "converted"];

const kanbanTone: Record<string, { dot: string; column: string; count: string }> = {
  new: {
    dot: "bg-sky-500",
    column: "border-sky-500/20 bg-sky-500/[0.035]",
    count: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  in_contact: {
    dot: "bg-violet-500",
    column: "border-violet-500/20 bg-violet-500/[0.035]",
    count: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  quote_sent: {
    dot: "bg-amber-500",
    column: "border-amber-500/20 bg-amber-500/[0.035]",
    count: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  negotiation: {
    dot: "bg-orange-500",
    column: "border-orange-500/20 bg-orange-500/[0.035]",
    count: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  converted: {
    dot: "bg-emerald-500",
    column: "border-emerald-500/20 bg-emerald-500/[0.035]",
    count: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export function LeadsWorkspace({
  leads,
  contextRole,
  contextJobTitle,
  contextBranchId,
  slaFirstContactMinutes = 15,
  slaStagnantDays = 3,
  brokers = [],
  branches = [],
}: {
  leads: LeadWorkspaceItem[];
  contextRole: string;
  contextJobTitle?: string | null;
  contextBranchId?: string | null;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
  brokers?: Array<{ id: string; name: string; branchId: string | null }>;
  branches?: Array<{ id: string; name: string }>;
}) {
  const [selectedLead, setSelectedLead] = useState<LeadWorkspaceItem | null>(null);
  const leadsIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const multiSelect = useMultiSelect(leadsIds);
  const isMarketing = contextJobTitle === "marketing";
  const shouldMask = (lead: LeadWorkspaceItem) => {
    return isMarketing && lead.branchId !== contextBranchId;
  };
  const groupedLeads = useMemo(
    () =>
      Object.fromEntries(
        kanbanStatuses.map((status) => [status, leads.filter((lead) => lead.status === status)]),
      ),
    [leads],
  );
  const filteredBrokers = useMemo(() => {
    if (!selectedLead || !brokers) return [];
    return brokers.filter((b) => b.branchId === selectedLead.branchId);
  }, [selectedLead, brokers]);

  const canCall =
    selectedLead && !(contextRole === "broker" && selectedLead.status === "distributed");

  const selectionActions = useMemo(() => (
    <>
      {(contextRole === "director" || contextRole === "manager") && (
        <>
          <BulkStatusDialog
            leadIds={multiSelect.selectedIds}
            role={contextRole}
            bulkStatusAction={bulkChangeLeadStatusAction}
          />
          <BulkReassignDialog
            leadIds={multiSelect.selectedIds}
            brokers={brokers}
          />
        </>
      )}
      {contextRole === "broker" && (
        <Button
          size="sm"
          variant="outline"
          disabled={multiSelect.count === 0}
          onClick={() => {
            toast("Funcionalidade em desenvolvimento.");
          }}
        >
          Iniciar atendimento
        </Button>
      )}
    </>
  ), [contextRole, multiSelect.selectedIds, multiSelect.count, brokers]);

  const unassignedCount = useMemo(() => leads.filter((l) => !l.corretorId).length, [leads]);
  const activeCount = useMemo(() => leads.filter((l) => l.status === "in_contact" || l.status === "negotiation").length, [leads]);
  const convertedCount = useMemo(() => leads.filter((l) => l.status === "converted").length, [leads]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">



      <Card variant="overview" aria-label="Resumo da operação de leads">
        <div className="grid divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <LeadOverviewMetric label="Sem responsável" value={unassignedCount} description="Aguardando distribuição" />
          <LeadOverviewMetric label="Em atendimento" value={activeCount} description="Contatos em negociação" />
          <LeadOverviewMetric label="Finalizados" value={convertedCount} description="Vendas convertidas" />
        </div>
      </Card>

      {/* ─── 4. TABS E CONTEÚDO PRINCIPAL ─── */}
      <Tabs defaultValue="list" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <TabsList aria-label="Visualização de leads">
            <TabsTrigger value="list" className="text-xs gap-1.5">
              <UserList className="size-4" />
              Lista de Atendimento
            </TabsTrigger>
            <TabsTrigger value="kanban" className="text-xs gap-1.5">
              <SquaresFour className="size-4" />
              Kanban do Funil
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="mt-4">
          <Card className="border-border bg-card shadow-xs">
            <CardContent className="p-0">
              <div className="hidden divide-y divide-border max-[559px]:block">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLead(lead)}
                    className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[var(--duration-quick)] ease-out active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-medium ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                        {shouldMask(lead) ? maskName(lead.nome) : lead.nome}
                      </span>
                      <span className={`mt-1 block truncate text-xs text-muted-foreground ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                        {shouldMask(lead) ? "••••-••••" : (contextRole === "broker" && lead.status === "distributed" ? maskPhone(lead.telefone) : lead.telefone)}
                      </span>
                        <span className="mt-2 flex items-center gap-2">
                          <LeadStatusBadge status={lead.status} />
                          <LeadQualificationBadge status={lead.qualificationStatus} />
                          <LeadHealthBadge health={computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays)} />
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <OwnershipContext brokerName={lead.corretorNome} branchName={lead.branchName} className="truncate text-xs" />
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
              <SelectionToolbar
                selectedCount={multiSelect.count}
                totalCount={leads.length}
                onClear={multiSelect.clear}
              >
                {selectionActions}
              </SelectionToolbar>
              <Table className="max-[559px]:hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        aria-label="Selecionar todos"
                        checked={multiSelect.isAllSelected}
                        onCheckedChange={multiSelect.selectAll}
                      />
                    </TableHead>
                    <TableHead className="pl-0">Lead</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Qualificação</TableHead>
                    <TableHead className="hidden md:table-cell">Saúde</TableHead>
                    <TableHead className="hidden md:table-cell">Responsável</TableHead>
                    <TableHead className="hidden lg:table-cell">Entrada</TableHead>
                    <TableHead className="pr-5 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer group/row data-[selected]:bg-muted/40 data-[active]:bg-muted/15"
                      data-selected={multiSelect.isSelected(lead.id) || undefined}
                      data-active={lead.status !== "converted" && lead.status !== "lost" || undefined}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell className="w-10 pl-4">
                        <div onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            aria-label={`Selecionar ${lead.nome}`}
                            checked={multiSelect.isSelected(lead.id)}
                            onCheckedChange={() => {
                              multiSelect.toggle(lead.id);
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="pl-0">
                        <p className={`font-medium ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                          {shouldMask(lead) ? maskName(lead.nome) : lead.nome}
                        </p>
                        <p className={`text-xs text-muted-foreground ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                          {shouldMask(lead) ? "••••-••••" : (contextRole === "broker" && lead.status === "distributed" ? maskPhone(lead.telefone) : lead.telefone)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${lead.tipo === "PME" ? "bg-indigo-400/10 text-indigo-400 ring-indigo-400/20" : "bg-sky-400/10 text-sky-400 ring-sky-400/20"}`}>
                          {lead.tipo}
                        </span>
                      </TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell>
                        <LeadQualificationBadge status={lead.qualificationStatus} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <LeadHealthBadge
                          health={computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays)}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <OwnershipContext brokerName={lead.corretorNome} branchName={lead.branchName} className="text-sm" />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatDate(lead.createdAt, { day: "2-digit", month: "short" })}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedLead(lead);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Detalhes <ArrowUpRight />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4 min-h-0 min-w-0 flex-1 overflow-hidden">
          <SelectionToolbar
            selectedCount={multiSelect.count}
            totalCount={leads.length}
            onClear={multiSelect.clear}
          >
            {selectionActions}
          </SelectionToolbar>
          <ScrollArea className="h-full w-full" aria-label="Funil de leads em Kanban">
            <div className="flex min-w-max items-start gap-4 pr-4">
              {kanbanStatuses.map((status) => (
                <KanbanColumn
                  key={status}
                  leads={groupedLeads[status] ?? []}
                  onOpen={setSelectedLead}
                  status={status}
                  isSelected={multiSelect.isSelected}
                  onToggle={multiSelect.toggle}
                  slaFirstContactMinutes={slaFirstContactMinutes}
                  slaStagnantDays={slaStagnantDays}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <p className="mt-3 text-xs text-muted-foreground">
            Deslize horizontalmente para acompanhar todas as etapas do funil.
          </p>
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalhes do lead</SheetTitle>
            <SheetDescription>
              Contexto rápido para decidir o próximo passo sem sair da fila.
            </SheetDescription>
          </SheetHeader>
          {selectedLead ? (
            <SheetBody>
              <div className="space-y-5">
                <SheetSection>
                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={`truncate text-lg font-semibold tracking-tight ${shouldMask(selectedLead) ? "blur-[3px] select-none" : ""}`}>
                          {shouldMask(selectedLead) ? maskName(selectedLead.nome) : selectedLead.nome}
                        </p>
                        <p className={`mt-1 truncate text-sm text-muted-foreground ${shouldMask(selectedLead) ? "blur-[3px] select-none" : ""}`}>
                          {shouldMask(selectedLead) ? "••••-••••" : (contextRole === "broker" && selectedLead.status === "distributed" ? maskPhone(selectedLead.telefone) : selectedLead.telefone)}
                        </p>
                      </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <LeadStatusBadge status={selectedLead.status} />
                          <LeadQualificationBadge status={selectedLead.qualificationStatus} />
                          <LeadHealthBadge
                          health={computeLeadHealth(selectedLead, slaFirstContactMinutes, slaStagnantDays)}
                        />
                      </div>
                    </div>
                  </div>
                </SheetSection>

                {/* ── Alerta de corretor excluído ─────────────────────────── */}
                {(contextRole === "director" || contextRole === "manager") && !selectedLead.corretorId && selectedLead.distributionStatus === "returned_to_queue" && (
                  <div className="mx-4 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-warning">
                      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      Lead aguardando reatribuição
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      O corretor responsável por este lead foi excluído. O lead foi devolvido à fila da unidade e precisa ser reatribuído manualmente por um gestor ou diretor.
                    </p>
                  </div>
                )}
                <Tabs defaultValue="summary" className="min-h-0">
                  <TabsList aria-label="Informações do lead no drawer" className="w-full justify-start" variant="line">
                    <TabsTrigger value="summary">Resumo</TabsTrigger>
                    {!shouldMask(selectedLead) && <TabsTrigger value="actions">Ações</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="summary" className="mt-4 space-y-4">
                    <SheetSection className="p-4">
                      <div>
                        <div>
                          <p className="text-sm font-semibold">Dados do atendimento</p>
                          <p className="mt-1 text-xs text-muted-foreground">Contexto essencial para continuar o lead.</p>
                        </div>
                      </div>
                      <dl className="mt-4 space-y-3">
                        <DetailRow
                          label="Saúde"
                          value={
                            <LeadHealthBadge
                              health={computeLeadHealth(selectedLead, slaFirstContactMinutes, slaStagnantDays)}
                            />
                          }
                        />
                        <DetailRow label="Responsável" value={[selectedLead.corretorNome ?? "Aguardando distribuição", selectedLead.branchName ?? "Sem unidade"].join(" · ")} />
                        <DetailRow label="Tipo" value={
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${selectedLead.tipo === "PME" ? "bg-indigo-400/10 text-indigo-400 ring-indigo-400/20" : "bg-sky-400/10 text-sky-400 ring-sky-400/20"}`}>
                            {selectedLead.tipo === "PME" ? "PME (Pessoa Jurídica)" : "PF (Pessoa Física)"}
                          </span>
                        } />
                        <DetailRow label="Origem" value={selectedLead.sourceCampaign || (selectedLead.origem === "manual" ? "Manual" : "Webhook")} />
                        <DetailRow label="Entrada" value={formatDate(selectedLead.createdAt, { day: "2-digit", month: "short" })} />
                      </dl>
                    </SheetSection>
                    <Button className="w-full" render={<Link href={`/leads/${selectedLead.id}`} />} variant="outline">
                      Ver detalhe completo
                      <ArrowUpRight />
                    </Button>
                  </TabsContent>
                  <TabsContent value="actions" className="mt-4 space-y-3">
                    {contextRole === "manager" || contextRole === "director" ? (
                      <LeadDrawerManagementActions
                        leadId={selectedLead.id}
                        brokers={filteredBrokers}
                        branches={branches}
                        leadBranchId={selectedLead.branchId}
                        contextRole={contextRole}
                        currentStatus={selectedLead.status}
                        currentOwner={selectedLead.corretorNome}
                        onSuccess={() => setSelectedLead(null)}
                      />
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button className="w-full" render={<Link href={`/leads/${selectedLead.id}`} />}>
                            <ArrowUpRight />
                            Abrir atendimento
                          </Button>
                          <Button className="w-full" render={<Link href={`/conversas?leadId=${selectedLead.id}`} />} variant="outline">
                            <ChatCircleText />
                            Conversas
                          </Button>
                        </div>
                        <Button className="w-full" render={<a href="https://cotadorsimplificado.com.br/" rel="noreferrer" target="_blank" />}>
                          <ArrowUpRight />
                          Nova cotação
                        </Button>
                        {canCall ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Button className="w-full" render={<a href={`tel:${selectedLead.telefone}`} />} variant="outline">
                              <Phone />
                              Ligar
                            </Button>
                            <Button className="w-full" render={<a href={`https://wa.me/${selectedLead.telefone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank" />} variant="outline">
                              <WhatsappLogo />
                              WhatsApp
                            </Button>
                          </div>
                        ) : (
                          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-muted-foreground">
                            Os dados de contato serão liberados quando você iniciar este atendimento.
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button className="w-full" render={<Link href={`/tarefas?leadId=${selectedLead.id}`} />} variant="outline">
                            <ListChecks />
                            Tarefas
                          </Button>
                          <Button className="w-full" render={<Link href="#documentos" />} variant="outline">
                            <FileText />
                            Documentos
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                          <LeadQuickNote leadId={selectedLead.id} />
                          <LeadReminder leadId={selectedLead.id} />
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </SheetBody>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KanbanColumn({
  leads,
  onOpen,
  status,
  isSelected,
  onToggle,
  slaFirstContactMinutes = 15,
  slaStagnantDays = 3,
}: {
  leads: LeadWorkspaceItem[];
  onOpen: (lead: LeadWorkspaceItem) => void;
  status: string;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
}) {
  const tone = kanbanTone[status] ?? kanbanTone.new;

  return (
    <section
      className={`w-72 shrink-0 rounded-xl border p-3 sm:w-80 ${tone.column}`}
      aria-labelledby={`kanban-${status}`}
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-border/70 pb-3">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tone.dot}`} />
        <h2 id={`kanban-${status}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {statusLabel(status)}
        </h2>
        <Badge variant="outline" className={`shrink-0 ${tone.count}`}>
          {leads.length}
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        {leads.map((lead) => (
          <KanbanLeadCard key={lead.id} lead={lead} onOpen={onOpen} isSelected={isSelected} onToggle={onToggle} slaFirstContactMinutes={slaFirstContactMinutes} slaStagnantDays={slaStagnantDays} />
        ))}
        {!leads.length ? (
          <div className="rounded-lg border border-dashed border-border bg-background/40 px-4 py-8 text-center">
            <p className="text-xs font-medium text-muted-foreground">Sem leads nesta etapa</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function KanbanLeadCard({
  lead,
  onOpen,
  isSelected,
  onToggle,
  slaFirstContactMinutes = 15,
  slaStagnantDays = 3,
}: {
  lead: LeadWorkspaceItem;
  onOpen: (lead: LeadWorkspaceItem) => void;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
}) {
  const selected = isSelected(lead.id);

  return (
    <Card
      variant="kanban"
      className={`group w-full text-left outline-none ${
        selected
          ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/20"
          : "border-border hover:border-primary/30 hover:bg-muted/30"
      }`}
    >
      {/* Checkbox row */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
        <Checkbox
          aria-label={`Selecionar ${lead.nome}`}
          checked={selected}
          onCheckedChange={() => onToggle(lead.id)}
          onClick={(event) => event.stopPropagation()}
        />
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Card body */}
      <button
        className="w-full p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
        onClick={() => onOpen(lead)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 break-words font-medium leading-5 text-foreground">
              {lead.nome}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              <OwnershipContext brokerName={lead.corretorNome} branchName={lead.branchName} className="text-xs" />
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <LeadStatusBadge status={lead.status} />
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${lead.tipo === "PME" ? "bg-indigo-400/10 text-indigo-400 ring-indigo-400/20" : "bg-sky-400/10 text-sky-400 ring-sky-400/20"}`}>
              {lead.tipo}
            </span>
            <LeadHealthBadge health={computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays)} />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(lead.createdAt, { day: "2-digit", month: "short" })}</span>
        </div>
      </button>
    </Card>
  );
}

function LeadOverviewMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right font-medium break-words">
        {value}
      </div>
    </div>
  );
}

// StatusBadge removido — usar LeadStatusBadge diretamente

function statusLabel(status: string) {
  return (LEAD_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

