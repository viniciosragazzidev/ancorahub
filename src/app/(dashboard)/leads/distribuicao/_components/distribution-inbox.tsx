"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { Archive, Download } from "lucide-react";
import {
  ArrowRight,
  CheckCircle,
  Loader2Icon,
  MagicWand,
  Megaphone,
  Target,
  UserList,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppSelect } from "@/components/ui/select";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";
import {
  assignLeadBatchToBrokerAction,
  assignLeadToBrokerAction,
  archiveUnassignedLeadsAction,
  distributeLeadBatchAction,
  distributeLeadAutomaticallyAction,
  routeLeadToBranchAction,
  type DistributionActionState,
} from "@/features/lead-distribution/actions";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils/core/cn";

type Lead = {
  id: string;
  name: string;
  phone: string;
  branchId: string | null;
  distributionStatus: string;
  status?: string | null;
  qualificationStatus?: string | null;
  createdAt: string;
  sourceCampaign?: string | null;
  sourceAd?: string | null;
  metaCampaignId?: string | null;
  metaAdId?: string | null;
};
type Branch = { id: string; name: string };
type Broker = {
  id: string;
  name: string;
  branchId: string | null;
  activeLeads: number;
  availabilityStatus: "available" | "paused" | "offline";
};

const PAGE_SIZE = 10;
const MAX_BATCH = 10;
type ArchiveScope = "all" | "period" | "status";
type ArchiveStatus = "all" | "operational" | "lost" | "disqualified";

/** Toast imediato baseado no estado da action, disparado em effect (nunca no render). */
function useActionFeedback(state: DistributionActionState, label: string) {
  // Keyed por mutationId: duas mutações consecutivas com o mesmo resultado
  // (ex.: dois erros iguais ou dois sucessos) devem disparar toast em ambas.
  const handledMutationRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.mutationId) return;
    if (handledMutationRef.current === state.mutationId) return;
    handledMutationRef.current = state.mutationId;
    if (state.error) {
      toast.error(state.error, { description: `Falha ao ${label}.` });
    } else if (state.message) {
      if (state.success) {
        toast.success(state.message, {
          description: state.processed ? `${state.processed} lead(s) processado(s).` : undefined,
        });
      } else {
        toast.warning(state.message);
      }
    }
  }, [label, state]);
}

/** Botão de ação com estado de processamento sem duplicar o conteúdo visível. */
function ActionButton({
  pending,
  success,
  variant = "outline",
  size = "sm",
  className,
  children,
}: {
  pending: boolean;
  success?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "xs" | "sm" | "default";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      disabled={pending}
      size={size}
      type="submit"
      variant={variant}
      className={cn(
        "gap-1.5 transition-[color,background-color,border-color,transform] duration-150",
        "active:scale-[0.96]",
        pending && "pointer-events-none",
        success && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2Icon
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          <span>Processando…</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Wrapper de formulário de ação com feedback visual completo */
function ActionForm({
  action,
  children,
  fields,
  label,
  onCampaignConflict,
  onCommitted,
}: {
  action: (
    previous: DistributionActionState,
    formData: FormData,
  ) => Promise<DistributionActionState>;
  children: React.ReactNode;
  fields: Record<string, string>;
  label: string;
  onCampaignConflict?: (
    conflict: NonNullable<DistributionActionState["campaignConflict"]>,
    fields: Record<string, string>,
  ) => void;
  onCommitted?: (state: DistributionActionState) => void;
}) {
  const router = useRouter();
  const formKey = useId();
  const [state, formAction, pending] = useActionState(action, {});
  const [formVersion, setFormVersion] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Feedback imediato via toast
  useActionFeedback(state, label);

  // Detect campaign conflict and notify parent (uma vez por mudança de estado)
  const prevConflictRef = useRef(state.campaignConflict);
  useEffect(() => {
    if (state.campaignConflict === prevConflictRef.current) return;
    prevConflictRef.current = state.campaignConflict;
    if (state.campaignConflict && onCampaignConflict) {
      onCampaignConflict(state.campaignConflict, fields);
    }
  }, [fields, onCampaignConflict, state.campaignConflict]);

  // Reset only after the action settles.  The visible queue is patched first;
  // refresh is merely reconciliation and can never keep the button pending.
  const handledMutationRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.mutationId || handledMutationRef.current === state.mutationId) return;
    handledMutationRef.current = state.mutationId;
    setFormVersion((value) => value + 1);
    if (state.success) {
      setShowSuccess(true);
      const timeout = window.setTimeout(() => setShowSuccess(false), 1800);
      onCommitted?.(state);
      startTransition(() => router.refresh());
      return () => window.clearTimeout(timeout);
    }
  }, [onCommitted, router, state]);

  return (
    <form
      key={`${formKey}-${formVersion}`}
      action={formAction}
      className="flex flex-wrap items-center gap-2"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <ActionButton pending={pending} success={showSuccess}>
        {showSuccess ? <CheckCircle className="size-4" /> : children}
      </ActionButton>
    </form>
  );
}

export function DistributionInbox({
  role,
  totalUnassigned,
  leads,
  branches,
  brokers,
  initialStatusFilter = "all",
}: {
  role: string;
  totalUnassigned: number;
  leads: Lead[];
  branches: Branch[];
  brokers: Broker[];
  initialStatusFilter?: "all" | "unassigned" | "queued" | "returned_to_queue" | "manual_hold";
}) {
  const router = useRouter();
  const [inboxLeads, setInboxLeads] = useState(leads);
  const [selected, setSelected] = useState<string[]>([]);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const managerBranchId = role === "manager" ? (branches[0]?.id ?? "") : "";
  const [brokerByLead, setBrokerByLead] = useState<Record<string, string>>({});
  const [batchBrokerId, setBatchBrokerId] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [page, setPage] = useState(1);
  const [campaignConflictDialog, setCampaignConflictDialog] = useState<
    DistributionActionState["campaignConflict"] | null
  >(null);
  const [pendingOverrideFields, setPendingOverrideFields] = useState<Record<string, string> | null>(
    null,
  );
  const submittedBatchLeadIdsRef = useRef<string[]>([]);
  const archiveCandidateIdsRef = useRef<string[]>([]);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>("all");
  const [archivePeriodDays, setArchivePeriodDays] = useState("30");
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus>("all");

  useEffect(() => setInboxLeads(leads), [leads]);

  const selectable = useMemo(
    () =>
      inboxLeads.filter(
        (lead) =>
          (lead.distributionStatus === "unassigned" ||
            lead.distributionStatus === "queued" ||
            lead.distributionStatus === "returned_to_queue" ||
            lead.distributionStatus === "manual_hold") &&
          lead.status !== "lost" &&
          lead.qualificationStatus !== "disqualified",
      ),
    [inboxLeads],
  );
  const archivePreview = useMemo(() => {
    if (archiveScope === "all") return inboxLeads;
    if (archiveScope === "period") {
      const cutoff = Date.now() - Number(archivePeriodDays || 30) * 24 * 60 * 60 * 1000;
      return inboxLeads.filter((lead) => new Date(lead.createdAt).getTime() >= cutoff);
    }
    return inboxLeads.filter((lead) => {
      if (archiveStatus === "lost") return lead.status === "lost";
      if (archiveStatus === "disqualified") return lead.qualificationStatus === "disqualified";
      if (archiveStatus === "operational") {
        return lead.status !== "lost" && lead.qualificationStatus !== "disqualified";
      }
      return true;
    });
  }, [archivePeriodDays, archiveScope, archiveStatus, inboxLeads]);
  const filtered = useMemo(
    () =>
      selectable.filter((lead) => {
        const matchesUnit = unitFilter === "all" || lead.branchId === unitFilter;
        const matchesStatus = statusFilter === "all" || lead.distributionStatus === statusFilter;
        return matchesUnit && matchesStatus;
      }),
    [selectable, statusFilter, unitFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unitBrokers = brokers.filter(
    (broker) => broker.branchId === branchId && broker.availabilityStatus === "available",
  );

  function toggle(id: string) {
    if (selected.includes(id)) {
      setSelected(selected.filter((item) => item !== id));
      return;
    }
    if (selected.length >= MAX_BATCH) {
      toast.error(`Máximo de ${MAX_BATCH} leads por envio.`, {
        description: "Remova leads selecionados para adicionar outros.",
      });
      return;
    }
    setSelected([...selected, id]);
  }

  function toggleVisible() {
    const visibleIds = visible.map((lead) => lead.id);
    if (visibleIds.every((id) => selected.includes(id))) {
      setSelected(selected.filter((id) => !visibleIds.includes(id)));
      return;
    }
    const missing = visibleIds.filter((id) => !selected.includes(id));
    if (selected.length + missing.length > MAX_BATCH) {
      toast.error(`Máximo de ${MAX_BATCH} leads por envio.`, {
        description: "Selecione menos leads para continuar.",
      });
      return;
    }
    setSelected([...selected, ...missing]);
  }

  function changeUnitFilter(value: string) {
    setUnitFilter(value);
    setPage(1);
    setSelected([]);
    setBatchBrokerId("");
    if (value !== "all") setBranchId(value);
  }

  function changeStatusFilter(value: string) {
    setStatusFilter(value as "all" | "unassigned" | "queued" | "returned_to_queue" | "manual_hold");
    setPage(1);
    setSelected([]);
  }

  function changeBatchUnit(value: string) {
    setBranchId(value);
    setBatchBrokerId("");
  }

  const stateAction = useActionState(distributeLeadBatchAction, {});
  const [batchState, batchAction, batchPending] = stateAction;
  const [assignState, assignAction, assignPending] = useActionState(
    assignLeadBatchToBrokerAction,
    {},
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveUnassignedLeadsAction,
    {},
  );

  // Toasts para ações em lote
  useActionFeedback(batchState, "enviar leads em lote");
  useActionFeedback(assignState, "atribuir leads em lote");
  useActionFeedback(archiveState, "arquivar leads sem distribuição");

  const [batchSuccess, setBatchSuccess] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Acende o indicador de sucesso ao concluir a ação em lote; um effect próprio
  // apaga após 1,8s (com cleanup para não vazar timer).
  useActionDialogLifecycle({
    state: batchState,
    pending: batchPending,
    onSuccess: () => setBatchSuccess(true),
    onError: () => undefined,
  });
  useActionDialogLifecycle({
    state: assignState,
    pending: assignPending,
    onSuccess: () => setAssignSuccess(true),
    onError: () => undefined,
  });
  useEffect(() => {
    if (!batchSuccess) return;
    const timer = window.setTimeout(() => setBatchSuccess(false), 1800);
    return () => window.clearTimeout(timer);
  }, [batchSuccess]);
  useEffect(() => {
    if (!assignSuccess) return;
    const timer = window.setTimeout(() => setAssignSuccess(false), 1800);
    return () => window.clearTimeout(timer);
  }, [assignSuccess]);

  function clearBatchUi() {
    setSelected([]);
    setBrokerByLead({});
    setBatchBrokerId("");
  }

  function applySingleCommit(state: DistributionActionState) {
    const entity = state.entity;
    if (!entity) return;
    setInboxLeads((current) =>
      current.flatMap((lead) => {
        if (lead.id !== entity.leadId) return [lead];
        if (entity.corretorId) return [];
        return [
          {
            ...lead,
            branchId: entity.branchId ?? lead.branchId,
            distributionStatus: entity.distributionStatus,
          },
        ];
      }),
    );
  }

  function submitBatch() {
    submittedBatchLeadIdsRef.current = [...selected];
    clearBatchUi();
  }

  useEffect(() => {
    if (!batchState.mutationId) return;
    const submitted = batchState.processedLeadIds ?? submittedBatchLeadIdsRef.current;
    if (!submitted.length) return;
    setInboxLeads((current) =>
      current.map((lead) =>
        submitted.includes(lead.id) ? { ...lead, branchId, distributionStatus: "queued" } : lead,
      ),
    );
    startTransition(() => router.refresh());
  }, [batchState.mutationId, batchState.processedLeadIds, branchId, router]);
  useEffect(() => {
    if (!assignState.mutationId) return;
    const submitted = assignState.processedLeadIds ?? submittedBatchLeadIdsRef.current;
    if (!submitted.length) return;
    setInboxLeads((current) => current.filter((lead) => !submitted.includes(lead.id)));
    startTransition(() => router.refresh());
  }, [assignState.mutationId, assignState.processedLeadIds, router]);

  const handledArchiveMutationRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!archiveState.mutationId || handledArchiveMutationRef.current === archiveState.mutationId) return;
    handledArchiveMutationRef.current = archiveState.mutationId;
    if (!archiveState.success) return;
    const archivedIds = archiveState.processedLeadIds ?? archiveCandidateIdsRef.current;
    setInboxLeads((current) => current.filter((lead) => !archivedIds.includes(lead.id)));
    setSelected([]);
    setArchiveDialogOpen(false);
    startTransition(() => router.refresh());
  }, [archiveState.mutationId, archiveState.processedLeadIds, archiveState.success, router]);

  return (
    <>
      <Card variant="overview" data-onboarding="manager-team-performance">
        <CardHeader className="border-b border-border px-5 pb-4 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserList className="size-4 text-primary" /> Inbox operacional de distribuição
              </CardTitle>
              <CardDescription className="mt-1">
                Aqui ficam apenas os leads que ainda podem ser enviados para uma unidade, fila ou corretor.
              </CardDescription>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              {role === "director" ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    render={<a href="/api/reports/distribution-unassigned" download />}
                    className="gap-1.5"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Baixar lista PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                    disabled={!totalUnassigned || archivePending}
                    onClick={() => {
                      archiveCandidateIdsRef.current = inboxLeads.map((lead) => lead.id);
                      setArchiveDialogOpen(true);
                    }}
                  >
                    <Archive className="size-3.5" aria-hidden="true" />
                    Arquivar todos sem corretor
                  </Button>
                </div>
              ) : null}
              {selected.length ? (
                <div className="flex flex-col items-end gap-2">
                <form
                  action={batchAction}
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={submitBatch}
                >
                  <input name="leadIds" type="hidden" value={selected.join(",")} />
                  {role === "director" ? (
                    <AppSelect
                      aria-label="Unidade de destino"
                      name="branchId"
                      value={branchId}
                      onValueChange={changeBatchUnit}
                      size="sm"
                      className="w-40"
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    />
                  ) : (
                    <input name="branchId" type="hidden" value={managerBranchId} />
                  )}
                  <ActionButton pending={batchPending} success={batchSuccess} variant="default">
                    <ArrowRight /> Enviar ({selected.length}/{MAX_BATCH})
                  </ActionButton>
                </form>
                <form
                  action={assignAction}
                  className="flex flex-wrap items-center justify-end gap-2"
                  onSubmit={submitBatch}
                >
                  <input name="leadIds" type="hidden" value={selected.join(",")} />
                  <input
                    name="branchId"
                    type="hidden"
                    value={role === "director" ? branchId : managerBranchId}
                  />
                  <AppSelect
                    aria-label="Corretor em massa"
                    size="sm"
                    value={batchBrokerId}
                    onValueChange={setBatchBrokerId}
                    placeholder="Corretor..."
                    options={[
                      { value: "", label: "Corretor..." },
                      ...unitBrokers.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <ActionButton
                    pending={assignPending}
                    success={assignSuccess}
                    variant="outline"
                    className={cn(!batchBrokerId && "opacity-50")}
                  >
                    <UserList /> Atribuir ({selected.length})
                  </ActionButton>
                </form>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <AppSelect
                aria-label="Filtrar por unidade"
                className="w-full sm:w-52"
                value={unitFilter}
                onValueChange={changeUnitFilter}
                options={[
                  { value: "all", label: "Todas as unidades" },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
              <AppSelect
                aria-label="Filtrar por status"
                className="w-full sm:w-52"
                value={statusFilter}
                onValueChange={changeStatusFilter}
                options={[
                  { value: "all", label: "Todos os status" },
                  { value: "unassigned", label: "Aguardando unidade" },
                  { value: "queued", label: "Aguardando corretor" },
                  { value: "returned_to_queue", label: "Devolvido à fila" },
                  { value: "manual_hold", label: "Aguardando ação manual" },
                ]}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Até {PAGE_SIZE} por página · máx. {MAX_BATCH} por envio
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectable.length ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle aria-hidden="true" className="size-5" />
              </span>
              <p className="text-sm font-medium">Inbox em dia</p>
              <p className="text-xs text-muted-foreground">
                Não há leads aguardando unidade ou corretor neste escopo.
              </p>
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
              <span className="grid size-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
                <UserList aria-hidden="true" className="size-5" />
              </span>
              <p className="text-sm font-medium">Nenhum lead com os filtros atuais</p>
              <p className="text-xs text-muted-foreground">
                Ajuste a unidade ou o status para ver os leads da fila.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                  <strong className="font-semibold text-foreground">{filtered.length}</strong> lead
                  {filtered.length === 1 ? "" : "s"} na fila
                </span>
                <span>{totalPages > 1 ? `Página ${currentPage} de ${totalPages}` : null}</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 pl-5">
                        <Checkbox
                          aria-label="Selecionar todos da página"
                          checked={
                            visible.length > 0 &&
                            visible.every((lead) => selected.includes(lead.id))
                          }
                          onCheckedChange={toggleVisible}
                        />
                      </TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Destino atual</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-5 text-right">Próxima ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((lead) => {
                      const leadBrokers = brokers.filter(
                        (broker) =>
                          broker.branchId === lead.branchId &&
                          broker.availabilityStatus === "available",
                      );
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="pl-5">
                            <Checkbox
                              aria-label={`Selecionar ${lead.name}`}
                              checked={selected.includes(lead.id)}
                              onCheckedChange={() => toggle(lead.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">{lead.phone}</p>
                            {(lead.sourceCampaign || lead.metaCampaignId) && (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-primary/10 text-primary border-primary/20 max-w-[220px] truncate"
                                >
                                  <Target aria-hidden="true" className="size-3 shrink-0" />
                                  {lead.sourceCampaign || lead.metaCampaignId}
                                </Badge>
                                {(lead.sourceAd || lead.metaAdId) && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] max-w-[180px] truncate"
                                  >
                                    <Megaphone aria-hidden="true" className="size-3 shrink-0" />
                                    {lead.sourceAd || lead.metaAdId}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {branches.find((branch) => branch.id === lead.branchId)?.name ??
                                "Inbox geral"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                lead.distributionStatus === "queued" ||
                                lead.distributionStatus === "returned_to_queue"
                                  ? "warning"
                                  : lead.distributionStatus === "manual_hold" ? "secondary" : "outline"
                              }
                            >
                              {lead.distributionStatus === "queued"
                                ? "Aguardando corretor"
                                : lead.distributionStatus === "returned_to_queue"
                                  ? "Devolvido à fila"
                                  : lead.distributionStatus === "manual_hold"
                                    ? "Aguardando ação manual"
                                    : "Aguardando unidade"}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-5" data-onboarding="manager-redistribute-lead">
                            <div className="flex min-w-[18rem] flex-wrap items-center justify-end gap-2">
                              {lead.branchId ? (
                                <>
                                  <AppSelect
                                    aria-label={`Corretor para ${lead.name}`}
                                    size="sm"
                                    className="w-44"
                                    value={brokerByLead[lead.id] ?? ""}
                                    onValueChange={(val) =>
                                      setBrokerByLead((current) => ({ ...current, [lead.id]: val }))
                                    }
                                    placeholder="Corretor..."
                                    options={[
                                      { value: "", label: "Corretor" },
                                      ...leadBrokers.map((b) => ({ value: b.id, label: b.name })),
                                    ]}
                                  />
                                  {brokerByLead[lead.id] ? (
                                    <ActionForm
                                      action={assignLeadToBrokerAction}
                                      fields={{ leadId: lead.id, brokerId: brokerByLead[lead.id] }}
                                      label={`atribuir lead ${lead.name}`}
                                      onCommitted={applySingleCommit}
                                    >
                                      <UserList /> Atribuir
                                    </ActionForm>
                                  ) : null}
                                  {lead.distributionStatus !== "manual_hold" ? (
                                    <ActionForm
                                      action={distributeLeadAutomaticallyAction}
                                      fields={{ leadId: lead.id }}
                                      label={`distribuir lead ${lead.name}`}
                                      onCommitted={applySingleCommit}
                                    >
                                      <MagicWand /> Auto
                                    </ActionForm>
                                  ) : null}
                                </>
                              ) : role === "director" ? (
                                <>
                                  <AppSelect
                                    aria-label={`Unidade para ${lead.name}`}
                                    size="sm"
                                    className="w-36"
                                    value={branchId}
                                    onValueChange={setBranchId}
                                    placeholder="Unidade..."
                                    options={branches.map((branch) => ({
                                      value: branch.id,
                                      label: branch.name,
                                    }))}
                                  />
                                  <ActionForm
                                    action={routeLeadToBranchAction}
                                    fields={{ leadId: lead.id, branchId }}
                                    label={`enviar lead ${lead.name} para a unidade`}
                                    onCampaignConflict={(conflict, f) => {
                                      setCampaignConflictDialog(conflict);
                                      setPendingOverrideFields(f);
                                    }}
                                    onCommitted={applySingleCommit}
                                  >
                                    <ArrowRight /> Enviar para unidade
                                  </ActionForm>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} lead{filtered.length === 1 ? "" : "s"} · {PAGE_SIZE} por
                    página
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label="Página anterior"
                      disabled={currentPage === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      <ArrowRight className="rotate-180" /> Anterior
                    </Button>
                    <Button
                      aria-label="Próxima página"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Próxima <ArrowRight />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {inboxLeads.length ? (
        <Card variant="overview" className="mt-4">
          <CardHeader className="border-b border-border px-5 pb-4 pt-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="size-4 text-amber-600 dark:text-amber-400" />
              Todos os leads sem corretor
              <Badge variant="secondary">{totalUnassigned}</Badge>
            </CardTitle>
            <CardDescription>
              Esta é a lista completa do escopo sem corretor. Leads que ainda podem ser distribuídos ficam no Inbox acima;
              os demais também podem ser arquivados e exportados.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
              <div className="max-h-[560px] overflow-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Lead</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="pr-5 text-right">Entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboxLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="pl-5">
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {branches.find((branch) => branch.id === lead.branchId)?.name ?? "Inbox geral"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {lead.qualificationStatus === "disqualified"
                            ? "Desqualificado"
                            : lead.status === "lost"
                              ? "Perdido"
                              : "Fora da fila operacional"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-5 text-right text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(lead.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalUnassigned > inboxLeads.length ? (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                Mostrando {inboxLeads.length} dos {totalUnassigned} leads sem corretor. O arquivamento e o PDF consideram todos.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Campaign Conflict Dialog */}
      <CampaignConflictDialog
        conflict={campaignConflictDialog}
        fields={pendingOverrideFields}
        onClose={() => {
          setCampaignConflictDialog(null);
          setPendingOverrideFields(null);
        }}
      />

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Escolha quais leads arquivar</DialogTitle>
              <DialogDescription>
                O arquivamento remove os leads escolhidos da distribuição sem apagar os dados. A seleção é recalculada no servidor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <p className="text-xs font-medium text-foreground">Escopo do arquivamento</p>
              <AppSelect
                value={archiveScope}
                onValueChange={(value) => setArchiveScope(value as ArchiveScope)}
                options={[
                  { value: "all", label: `Todos os sem corretor (${totalUnassigned})` },
                  { value: "period", label: "Por período de entrada" },
                  { value: "status", label: "Por situação do lead" },
                ]}
              />
              {archiveScope === "period" ? (
                <div className="grid gap-1.5">
                  <p className="text-xs font-medium text-foreground">Leads recebidos nos últimos</p>
                  <AppSelect
                    value={archivePeriodDays}
                    onValueChange={setArchivePeriodDays}
                    options={[
                      { value: "7", label: "7 dias" },
                      { value: "30", label: "30 dias" },
                      { value: "90", label: "90 dias" },
                      { value: "365", label: "12 meses" },
                    ]}
                  />
                </div>
              ) : null}
              {archiveScope === "status" ? (
                <div className="grid gap-1.5">
                  <p className="text-xs font-medium text-foreground">Situação</p>
                  <AppSelect
                    value={archiveStatus}
                    onValueChange={(value) => setArchiveStatus(value as ArchiveStatus)}
                    options={[
                      { value: "all", label: "Todos os status" },
                      { value: "operational", label: "Operacionais" },
                      { value: "lost", label: "Perdidos" },
                      { value: "disqualified", label: "Desqualificados" },
                    ]}
                  />
                </div>
              ) : null}
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {archiveScope === "all"
                  ? `${totalUnassigned} lead${totalUnassigned === 1 ? "" : "s"} sem corretor serão arquivados.`
                  : `${archivePreview.length} lead${archivePreview.length === 1 ? "" : "s"} corresponde${archivePreview.length === 1 ? "" : "m"} ao filtro carregado. O servidor fará a conferência final.`}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArchiveDialogOpen(false)}>
                Cancelar
              </Button>
              <form
                action={archiveAction}
                onSubmit={() => {
                  archiveCandidateIdsRef.current = archivePreview.map((lead) => lead.id);
                }}
              >
                <input type="hidden" name="archiveScope" value={archiveScope} />
                <input type="hidden" name="archivePeriodDays" value={archivePeriodDays} />
                <input type="hidden" name="archiveStatus" value={archiveStatus} />
                <Button type="submit" disabled={archivePending || !archivePreview.length} className="gap-1.5">
                  {archivePending ? <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> : <Archive className="size-4" />}
                  {archivePending ? "Arquivando…" : "Confirmar seleção"}
                </Button>
              </form>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}

function CampaignConflictDialog({
  conflict,
  fields,
  onClose,
}: {
  conflict: DistributionActionState["campaignConflict"] | null;
  fields: Record<string, string> | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [overriding, setOverriding] = useState(false);

  async function handleOverride() {
    if (!fields) return;
    setOverriding(true);
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.set(k, v);
    formData.set("overrideCampaign", "true");
    const result = await routeLeadToBranchAction({}, formData);
    setOverriding(false);
    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(result.message ?? "Lead enviado com sucesso.", {
        description: "A regra da campanha foi ignorada (override manual).",
      });
      router.refresh();
    }
    onClose();
  }

  return (
    <Dialog
      open={!!conflict}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md p-0">
        <DialogPanel>
          <DialogHeader className="p-5 sm:p-6 border-b border-border/70">
            <DialogTitle>Conflito de campanha</DialogTitle>
            <DialogDescription>
              Este lead pertence à campanha "{conflict?.campaignId}" que está vinculada a outra fila
              {conflict?.queueName ? ` ("${conflict.queueName}")` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Você pode alterar a regra da campanha para incluir esta unidade, ou forçar o envio
              ignorando a regra existente.
            </p>
          </div>
          <DialogFooter className="p-4 sm:p-5 border-t border-border/70 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={overriding}
              className="active:scale-[0.97] transition-transform"
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => void handleOverride()}
              disabled={overriding}
              className={cn(
                "gap-1.5 active:scale-[0.97] transition-all duration-150",
                overriding && "pointer-events-none",
              )}
            >
              {overriding ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
                  Enviando...
                </>
              ) : (
                "Forçar envio (override)"
              )}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
