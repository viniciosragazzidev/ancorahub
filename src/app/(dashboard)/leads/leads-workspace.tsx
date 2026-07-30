"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowUpRight, ChatCircleText, FileText, ListChecks, Phone, SlidersHorizontal, SquaresFour, UserList, WhatsappLogo, X } from "@/components/huge-icons";
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
import { StatCard } from "@/components/dashboard/metric-card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const KANBAN_STORAGE_KEY = "ancorahub_kanban_config";

const kanbanStatuses = ["new", "in_contact", "quote_sent", "negotiation", "converted"];

function loadKanbanConfig(): { ordered: string[]; hidden: string[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KANBAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ordered?: string[]; hidden?: string[] };
    if (!Array.isArray(parsed.ordered) || !Array.isArray(parsed.hidden)) return null;
    // Validate that all items are valid statuses
    const valid = parsed.ordered.every((s: string) => kanbanStatuses.includes(s));
    const validHidden = parsed.hidden.every((s: string) => kanbanStatuses.includes(s));
    if (!valid || !validHidden) return null;
    return { ordered: parsed.ordered, hidden: parsed.hidden };
  } catch {
    return null;
  }
}

function saveKanbanConfig(ordered: string[], hidden: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      KANBAN_STORAGE_KEY,
      JSON.stringify({ ordered, hidden }),
    );
  } catch {
    // localStorage may be full or unavailable
  }
}

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
  const kanbanRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [orderedStatuses, setOrderedStatuses] = useState<string[]>(() => {
    const saved = loadKanbanConfig();
    return saved?.ordered ?? kanbanStatuses;
  });
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>(() => {
    const saved = loadKanbanConfig();
    return saved?.hidden ?? [];
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const visibleStatuses = useMemo(
    () => orderedStatuses.filter((s) => !hiddenStatuses.includes(s)),
    [orderedStatuses, hiddenStatuses],
  );

  useEffect(() => {
    saveKanbanConfig(orderedStatuses, hiddenStatuses);
  }, [orderedStatuses, hiddenStatuses]);

  function toggleStatusVisibility(status: string) {
    setHiddenStatuses((current) =>
      current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    );
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    const el = kanbanRef.current;
    if (!el) return;
    const viewport = el.parentElement;
    if (!viewport) return;

    const checkScroll = () => {
      setShowScrollButton(viewport.scrollLeft > 20);
    };

    checkScroll();
    viewport.addEventListener("scroll", checkScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", checkScroll);
  }, []);

  const scrollToStart = useCallback(() => {
    const el = kanbanRef.current;
    if (!el) return;
    const viewport = el.parentElement;
    if (!viewport) return;
    viewport.scrollTo({ left: 0, behavior: "smooth" });
  }, []);

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

  const unassignedCount = useMemo(() => leads.filter((l) => !l.corretorId).length, [leads]);
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


  const activeCount = useMemo(() => leads.filter((l) => l.status === "in_contact" || l.status === "negotiation").length, [leads]);
  const convertedCount = useMemo(() => leads.filter((l) => l.status === "converted").length, [leads]);
  const leadsTrend = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayLeads = leads.filter((lead) => {
        const createdAt = new Date(lead.createdAt).getTime();
        return createdAt >= dayStart && createdAt < dayEnd;
      });

      return {
        unassigned: dayLeads.filter((lead) => !lead.corretorId).length,
        active: dayLeads.filter((lead) => lead.status === "in_contact" || lead.status === "negotiation").length,
        converted: dayLeads.filter((lead) => lead.status === "converted").length,
      };
    });
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedStatuses((current) => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Sem responsável"
          value={unassignedCount}
          sublabel="Aguardando distribuição"
          sparklineData={leadsTrend.map((day) => day.unassigned)}
          sparklineColor="var(--chart-1)"
        />
        <StatCard
          label="Em atendimento"
          value={activeCount}
          sublabel="Contatos em negociação"
          sparklineData={leadsTrend.map((day) => day.active)}
          sparklineColor="var(--chart-3)"
        />
        <StatCard
          label="Finalizados"
          value={convertedCount}
          sublabel="Vendas convertidas"
          sparklineData={leadsTrend.map((day) => day.converted)}
          sparklineColor="var(--chart-5)"
        />
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
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="outline" className="gap-1.5 text-xs" />}>
              <SlidersHorizontal className="size-3.5" />
              Colunas
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Colunas do Kanban</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {kanbanStatuses.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  className="text-xs"
                  checked={!hiddenStatuses.includes(status)}
                  onCheckedChange={() => toggleStatusVisibility(status)}
                >
                  {statusLabel(status)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

        <TabsContent value="kanban" className="relative mt-4 min-h-0 min-w-0 flex-1 overflow-hidden max-h-[80vh]">
          <SelectionToolbar
            selectedCount={multiSelect.count}
            totalCount={leads.length}
            onClear={multiSelect.clear}
          >
            {selectionActions}
          </SelectionToolbar>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToHorizontalAxis]}
          >
            <ScrollArea className="h-full w-full" aria-label="Funil de leads em Kanban">
              <div ref={kanbanRef} className="flex min-w-max items-start gap-4 pr-4">
                <SortableContext items={visibleStatuses} strategy={horizontalListSortingStrategy}>
                  {visibleStatuses.map((status) => (
                    <SortableKanbanColumn
                      key={status}
                      status={status}
                      leads={groupedLeads[status] ?? []}
                      onOpen={setSelectedLead}
                      isSelected={multiSelect.isSelected}
                      onToggle={multiSelect.toggle}
                      slaFirstContactMinutes={slaFirstContactMinutes}
                      slaStagnantDays={slaStagnantDays}
                    />
                  ))}
                </SortableContext>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DndContext>
          <DragOverlay dropAnimation={null}>
            {activeDragId ? (
              <div className="w-72 sm:w-80 opacity-90">
                <KanbanColumn
                  status={activeDragId}
                  leads={groupedLeads[activeDragId] ?? []}
                  onOpen={() => {}}
                  isSelected={() => false}
                  onToggle={() => {}}
                  slaFirstContactMinutes={slaFirstContactMinutes}
                  slaStagnantDays={slaStagnantDays}
                />
              </div>
            ) : null}
          </DragOverlay>
          {showScrollButton && (
            <button
              onClick={scrollToStart}
              className="absolute bottom-12 left-3 z-10 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-background hover:text-foreground hover:shadow-md active:scale-95"
            >
              <ArrowLeft className="size-3.5" />
              Início
            </button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Arraste as colunas para reordenar. Use o botão "Colunas" para exibir/ocultar etapas.
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

function SortableKanbanColumn({
  status,
  leads,
  onOpen,
  isSelected,
  onToggle,
  slaFirstContactMinutes = 15,
  slaStagnantDays = 3,
}: {
  status: string;
  leads: LeadWorkspaceItem[];
  onOpen: (lead: LeadWorkspaceItem) => void;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  } as const;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanColumn
        leads={leads}
        onOpen={onOpen}
        status={status}
        isSelected={isSelected}
        onToggle={onToggle}
        slaFirstContactMinutes={slaFirstContactMinutes}
        slaStagnantDays={slaStagnantDays}
      />
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

      <div className="mt-3 space-y-3 overflow-y-auto" style={{ maxHeight: "calc(80vh - 7rem)" }}>
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
  const sla = useMemo(() => computeSlaInfo(lead, slaFirstContactMinutes, slaStagnantDays), [lead, slaFirstContactMinutes, slaStagnantDays]);

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

      {/* SLA bar */}
      {sla && <SlaBar sla={sla} />}

      {/* Card body */}
      <button
        className="w-full p-4 pt-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
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

function SlaBar({ sla }: { sla: NonNullable<SlaInfo> }) {
  const pct = Math.min(100, Math.max(0, sla.ratio * 100));
  const barColor =
    sla.ratio >= 1 ? "bg-red-500"
    : sla.ratio >= 0.7 ? "bg-amber-500"
    : sla.ratio >= 0.4 ? "bg-yellow-500"
    : "bg-emerald-500";
  const textColor = sla.ratio >= 1 ? "text-red-500" : sla.ratio >= 0.7 ? "text-amber-500" : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger render={
        <div className="flex items-center gap-2 px-3 py-1.5 cursor-default">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`shrink-0 text-[10px] font-medium tabular-nums ${textColor}`}>
            {sla.label}
          </span>
        </div>
      } />
      <TooltipContent side="top" className="max-w-56">
        <div className="space-y-1">
          <p className="font-semibold">{sla.title}</p>
          <p>{sla.deadline}</p>
          <p className={`text-[11px] ${textColor}`}>{sla.label}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

type SlaInfo = {
  ratio: number;
  label: string;
  title: string;
  deadline: string;
} | null;

function computeSlaInfo(
  lead: {
    status: string;
    createdAt: string;
    assignedAt?: string | null;
    stageEnteredAt?: string | null;
    serviceStartedAt?: string | null;
    firstContactAt?: string | null;
    corretorId?: string | null;
  },
  slaFirstContactMinutes: number,
  slaStagnantDays: number,
): SlaInfo {
  const now = Date.now();
  const fmtTime = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(ms));
  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));

  // New or distributed without first contact → first-contact SLA
  if ((lead.status === "new" || lead.status === "distributed") && !lead.firstContactAt) {
    const anchor = lead.assignedAt || lead.createdAt;
    if (!anchor) return null;
    const anchorMs = new Date(anchor).getTime();
    const elapsed = now - anchorMs;
    const total = slaFirstContactMinutes * 60_000;
    const ratio = Math.min(elapsed / total, 2);
    const remaining = Math.max(0, total - elapsed);
    const deadlineMs = anchorMs + total;

    let label: string;
    if (elapsed >= total) {
      const over = Math.round((elapsed - total) / 60000);
      label = over >= 60 ? `${Math.round(over / 60)}h atrasado` : `${over}min atrasado`;
    } else if (remaining >= 3600000) {
      label = `${Math.round(remaining / 3600000)}h restantes`;
    } else {
      label = `${Math.round(remaining / 60000)}min restantes`;
    }

    return {
      ratio,
      label,
      title: "Prazo de 1º contato",
      deadline: `Limite: ${fmtTime(deadlineMs)} (${slaFirstContactMinutes}min)`,
    };
  }

  // Active stages → stagnation SLA
  const activeStatuses: readonly string[] = ["in_contact", "quote_sent", "negotiation"];
  if (activeStatuses.includes(lead.status) && lead.stageEnteredAt) {
    const stageMs = new Date(lead.stageEnteredAt).getTime();
    const elapsed = now - stageMs;
    const total = slaStagnantDays * 24 * 60 * 60_000;
    const ratio = Math.min(elapsed / total, 2);
    const remaining = Math.max(0, total - elapsed);
    const deadlineMs = stageMs + total;

    let label: string;
    if (elapsed >= total) {
      const over = Math.round(elapsed / 86400000 - slaStagnantDays);
      label = `${over}d atrasado`;
    } else if (remaining >= 86400000) {
      label = `${Math.round(remaining / 86400000)}d restantes`;
    } else {
      label = `${Math.round(remaining / 3600000)}h restantes`;
    }

    return {
      ratio,
      label,
      title: `Tempo na etapa (${statusLabel(lead.status)})`,
      deadline: `Limite: ${fmtDate(deadlineMs)} (${slaStagnantDays}d)`,
    };
  }

  return null;
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

function statusLabel(status: string) {
  return (LEAD_STATUS_LABELS as Record<string, string>)[status] ?? status;
}
