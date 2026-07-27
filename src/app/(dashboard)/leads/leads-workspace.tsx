"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ArrowUpRight, ChatCircleText, FileText, ListChecks, Phone, SquaresFour, UserList, WhatsappLogo } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { LeadDrawerManagementActions } from "./_components/lead-drawer-management-actions";
import { LeadStatusBadge } from "@/components/status-badges";
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

const kanbanTone: Record<string, { warning: string; count: string }> = {
  new: {
    warning: "bg-sky-500",
    count: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  in_contact: {
    warning: "bg-violet-500",
    count: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  quote_sent: {
    warning: "bg-amber-500",
    count: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  negotiation: {
    warning: "bg-orange-500",
    count: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  converted: {
    warning: "bg-emerald-500",
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
}: {
  leads: LeadWorkspaceItem[];
  contextRole: string;
  contextJobTitle?: string | null;
  contextBranchId?: string | null;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
  brokers?: Array<{ id: string; name: string; branchId: string | null }>;
}) {
  const [selectedLead, setSelectedLead] = useState<LeadWorkspaceItem | null>(null);
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

  const unworkedCount = useMemo(() => leads.filter((l) => l.status === "new").length, [leads]);
  const unassignedCount = useMemo(() => leads.filter((l) => !l.corretorId).length, [leads]);
  const activeCount = useMemo(() => leads.filter((l) => l.status === "in_contact" || l.status === "negotiation").length, [leads]);
  const convertedCount = useMemo(() => leads.filter((l) => l.status === "converted").length, [leads]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">



      {/* ─── 3. CARDS SECUNDÁRIOS NEUTROS ─── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Sem Responsável</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{unassignedCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Aguardando fila de distribuição</p>
        </Card>
        <Card className="border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Em Atendimento</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{activeCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Contatos em negociação</p>
        </Card>
        <Card className="border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Finalizados</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{convertedCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Vendas convertidas</p>
        </Card>
      </div>

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
              <Table className="max-[559px]:hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Lead</TableHead>
                    <TableHead>Status</TableHead>
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
                      className="cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell className="pl-5">
                        <p className={`font-medium ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                          {shouldMask(lead) ? maskName(lead.nome) : lead.nome}
                        </p>
                        <p className={`text-xs text-muted-foreground ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                          {shouldMask(lead) ? "••••-••••" : (contextRole === "broker" && lead.status === "distributed" ? maskPhone(lead.telefone) : lead.telefone)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
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
          <ScrollArea className="h-full w-full" aria-label="Funil de leads em Kanban">
            <div className="flex min-w-max items-start gap-4 pr-4">
              {kanbanStatuses.map((status) => (
                <KanbanColumn
                  key={status}
                  leads={groupedLeads[status] ?? []}
                  onOpen={setSelectedLead}
                  status={status}
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
                        <LeadHealthBadge
                          health={computeLeadHealth(selectedLead, slaFirstContactMinutes, slaStagnantDays)}
                        />
                      </div>
                    </div>
                  </div>
                </SheetSection>
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
                        <DetailRow label="Tipo" value={selectedLead.tipo === "PME" ? "PME (Pessoa Jurídica)" : "PF (Pessoa Física)"} />
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
  slaFirstContactMinutes = 15,
  slaStagnantDays = 3,
}: {
  leads: LeadWorkspaceItem[];
  onOpen: (lead: LeadWorkspaceItem) => void;
  status: string;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
}) {
  const tone = kanbanTone[status] ?? kanbanTone.new;

  return (
    <section
      className="w-72 shrink-0 rounded-xl border border-border bg-muted/30 p-3.5 sm:w-80"
      aria-labelledby={`kanban-${status}`}
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-border/70 pb-3">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tone.warning}`} />
        <h2 id={`kanban-${status}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {statusLabel(status)}
        </h2>
        <Badge variant="outline" className={`shrink-0 ${tone.count}`}>
          {leads.length}
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        {leads.map((lead) => (
          <KanbanLeadCard key={lead.id} lead={lead} onOpen={onOpen} slaFirstContactMinutes={slaFirstContactMinutes} slaStagnantDays={slaStagnantDays} />
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
  slaFirstContactMinutes = 15,
  slaStagnantDays = 3,
}: {
  lead: LeadWorkspaceItem;
  onOpen: (lead: LeadWorkspaceItem) => void;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
}) {
  return (
    <button
      className="group w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm outline-none transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(lead)}
      type="button"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 break-words font-medium leading-5 text-foreground">
            {lead.nome}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            <OwnershipContext brokerName={lead.corretorNome} branchName={lead.branchName} className="text-xs" />
          </p>
        </div>
        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </div>                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
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

