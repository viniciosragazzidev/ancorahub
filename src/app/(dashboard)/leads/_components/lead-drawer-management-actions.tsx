"use client";

import { useActionState, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { ArrowRight, Buildings, ChatCircleText, RotateCcw, Sparkle, UserSwitch } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/foundations/confirm-dialog";
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { getLeadDutyReassignmentOptions, reassignLeadAction, assumeLeadForInvestigationAction, assumeLeadForMessagingAction, removeLeadAssignmentAction } from "@/features/leads/management-actions";
import { routeLeadToBranchAction } from "@/features/lead-distribution/actions";
import { manuallyChangeQualificationStageAction } from "@/features/leads/qualification-tab-actions";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";
import { ManualQualificationDialog } from "./manual-qualification-dialog";

type Broker = { id: string; name: string; branchId: string | null; branchName?: string | null };
type DutyRosterState = {
  leadId: string;
  queueId: string;
  status: "ready" | "error";
  hasActiveDuty: boolean;
  brokers: Broker[];
  error?: string;
};
type Branch = { id: string; name: string };
type ManagementMode = "reassign" | "investigate";
type ManagementCommit = {
  entity?: {
    leadId: string;
    branchId?: string | null;
    corretorId?: string | null;
    status?: string;
    distributionStatus?: string;
  };
};

export function LeadDrawerManagementActions({
  leadId,
  leadName,
  brokers,
  branches,
  leadQueueId,
  contextRole,
  currentStatus,
  currentDistributionStatus,
  qualificationStatus,
  qualificationState,
  currentOwner,
  onSuccess,
  onReassignOptimistic,
  onReassignRollback,
  manualAssignmentChoiceEnabled = true,
}: {
  leadId: string;
  leadName?: string;
  brokers: Broker[];
  branches?: Branch[];
  leadQueueId?: string | null;
  contextRole?: string;
  currentStatus: string;
  currentDistributionStatus?: string;
  qualificationStatus?: string | null;
  qualificationState?: string | null;
  currentOwner: string | null;
  manualAssignmentChoiceEnabled?: boolean;
  onSuccess?: (result: ManagementCommit) => void;
  onReassignOptimistic?: (brokerId: string) => void;
  onReassignRollback?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ManagementMode>("reassign");
  const [brokerSelection, setBrokerSelection] = useState({ leadId, brokerId: "" });
  const brokerId = brokerSelection.leadId === leadId ? brokerSelection.brokerId : "";
  const setBrokerId = useCallback((nextBrokerId: string) => {
    setBrokerSelection({ leadId, brokerId: nextBrokerId });
  }, [leadId]);
  const [reason, setReason] = useState("");
  const [isAssuming, setIsAssuming] = useState(false);
  const [assignBranchId, setAssignBranchId] = useState("");
  const [dutyRosterState, setDutyRosterState] = useState<DutyRosterState | null>(null);

  const [openQualifyDialog, setOpenQualifyDialog] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [removeAssignmentDialogOpen, setRemoveAssignmentDialogOpen] = useState(false);
  const [manualAssignmentDialogOpen, setManualAssignmentDialogOpen] = useState(false);

  const isQualifiedOrDistributed =
    currentStatus === "distributed" ||
    ["in_contact", "quote_sent", "negotiation", "converted", "lost"].includes(currentStatus) ||
    qualificationState === "QUALIFIED" ||
    qualificationState === "COMPLETED" ||
    (Boolean(qualificationStatus) && ["qualified", "hot", "warm", "cold", "disqualified", "not_qualified"].includes(qualificationStatus!));

  async function handleRevertToQualifying() {
    setIsReverting(true);
    const res = await manuallyChangeQualificationStageAction({
      leadId,
      targetStage: "qualificacoes",
    });
    setIsReverting(false);
    if (res.success) {
      toast.success("Lead movido de volta para a fila de qualificação!");
      router.refresh();
      onSuccess?.({});
    } else {
      toast.error(res.error ?? "Erro ao mover lead para qualificação.");
    }
  }

  const [reassignState, reassign, reassignPending] = useActionState(reassignLeadAction, {});
  const [assumeState, assume, assumePending] = useActionState(assumeLeadForInvestigationAction, {});
  const [routeState, routeAction, routePending] = useActionState(
    routeLeadToBranchAction,
    {},
  );
  const [removeAssignmentState, removeAssignment, removeAssignmentPending] = useActionState(removeLeadAssignmentAction, {});

  useEffect(() => {
    let cancelled = false;
    if (!leadQueueId) return () => { cancelled = true; };
    void getLeadDutyReassignmentOptions(leadId).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setDutyRosterState({ leadId, queueId: leadQueueId, status: "error", hasActiveDuty: false, brokers: [], error: result.error });
        return;
      }
      setDutyRosterState({ leadId, queueId: leadQueueId, status: "ready", hasActiveDuty: result.hasActiveDuty, brokers: result.brokers });
    }).catch(() => {
      if (!cancelled) setDutyRosterState({ leadId, queueId: leadQueueId, status: "error", hasActiveDuty: false, brokers: [], error: "Não foi possível confirmar a escala ativa desta fila." });
    });

    return () => { cancelled = true; };
  }, [leadId, leadQueueId]);

  const handleReassignSuccess = useCallback((result: typeof reassignState) => {
    toast.success(result.message ?? "Lead atribuído e aviso enviado ao corretor.");
    setBrokerId("");
    onSuccess?.(result);
  }, [onSuccess, setBrokerId]);
  const handleReassignError = useCallback((result: typeof reassignState) => {
    onReassignRollback?.();
    if (result.error) toast.error(result.error);
  }, [onReassignRollback]);
  useActionDialogLifecycle({
    state: reassignState,
    pending: reassignPending,
    onSuccess: handleReassignSuccess,
    onError: handleReassignError,
  });

  const handleAssumeSuccess = useCallback((result: typeof assumeState) => {
    toast.success("Lead assumido para investigação.");
    setReason("");
    onSuccess?.(result);
  }, [onSuccess]);
  const handleAssumeError = useCallback((result: typeof assumeState) => {
    if (result.error) toast.error(result.error);
  }, []);
  useActionDialogLifecycle({
    state: assumeState,
    pending: assumePending,
    onSuccess: handleAssumeSuccess,
    onError: handleAssumeError,
  });

  const handleRouteSuccess = useCallback((result: typeof routeState) => {
    toast.success(result.message ?? "Lead enviado para a unidade.");
    onSuccess?.(result);
  }, [onSuccess]);
  const handleRouteError = useCallback((result: typeof routeState) => {
    if (result.error) toast.error(result.error);
  }, []);
  useActionDialogLifecycle({
    state: routeState,
    pending: routePending,
    onSuccess: handleRouteSuccess,
    onError: handleRouteError,
  });
  const handleRemoveAssignmentSuccess = useCallback((result: typeof removeAssignmentState) => {
    setRemoveAssignmentDialogOpen(false);
    toast.success("Atribuição removida. O lead aguardará uma nova ação manual.");
    onSuccess?.(result);
  }, [onSuccess]);
  const handleRemoveAssignmentError = useCallback((result: typeof removeAssignmentState) => {
    if (result.error) toast.error(result.error);
    // The rejection usually means the lead's real state has already moved on
    // (e.g. someone else already removed it) — refresh so the drawer stops
    // showing the stale owner/status that made the action look available.
    router.refresh();
  }, [router]);
  useActionDialogLifecycle({
    state: removeAssignmentState,
    pending: removeAssignmentPending,
    onSuccess: handleRemoveAssignmentSuccess,
    onError: handleRemoveAssignmentError,
  });

  const activeStatus = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(currentStatus);
  const isDirectorOrManager = contextRole === "director" || contextRole === "manager";
  const currentDutyState = dutyRosterState?.leadId === leadId && dutyRosterState.queueId === leadQueueId ? dutyRosterState : null;
  const dutyRosterLoading = Boolean(leadQueueId) && !currentDutyState;
  const activeQueueDuty = currentDutyState?.status === "ready" && currentDutyState.hasActiveDuty;
  const dutyRosterError = currentDutyState?.status === "error" ? currentDutyState.error : null;
  const assignmentBrokers = activeQueueDuty ? currentDutyState?.brokers ?? [] : brokers;
  const canReassignUnit = !activeStatus && !activeQueueDuty && !dutyRosterLoading && !dutyRosterError && branches && branches.length > 0 && isDirectorOrManager;
  const canRemoveAssignment = isDirectorOrManager && Boolean(currentOwner) && currentDistributionStatus === "assigned" &&
    currentStatus !== "lost" && currentStatus !== "converted";

  function confirmRemoveAssignment() {
    const data = new FormData();
    data.set("leadId", leadId);
    removeAssignment(data);
  }

  const handleAssumeMessaging = async () => {
    try {
      setIsAssuming(true);
      const res = await assumeLeadForMessagingAction(leadId);
      if (res.success) {
        toast.success("Você assumiu este atendimento.");
        onSuccess?.(res);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch {
      toast.error("Ocorreu um erro ao assumir o atendimento.");
    } finally {
      setIsAssuming(false);
    }
  };

  const selectedModeDescription = mode === "reassign"
    ? "Transfira a responsabilidade para outro corretor elegível. O SLA de primeiro contato será reiniciado."
    : "Assuma este caso para apurar uma exceção. Registre o motivo para manter a operação auditável.";

  const shouldAskAssignmentMode = manualAssignmentChoiceEnabled && !currentOwner;
  function handleReassignSubmit(event: FormEvent<HTMLFormElement>) {
    if (shouldAskAssignmentMode) {
      event.preventDefault();
      setManualAssignmentDialogOpen(true);
      return;
    }
    const canResolveOptimistically = !activeQueueDuty || brokers.some((broker) => broker.id === brokerId);
    if (canResolveOptimistically) onReassignOptimistic?.(brokerId);
  }

  function submitManualAssignment(assignmentMode: "direct" | "offer") {
    const data = new FormData();
    data.set("leadId", leadId);
    data.set("brokerId", brokerId);
    data.set("assignmentMode", assignmentMode);
    const canResolveOptimistically = !activeQueueDuty || assignmentBrokers.some((broker) => broker.id === brokerId);
    if (canResolveOptimistically) onReassignOptimistic?.(brokerId);
    setManualAssignmentDialogOpen(false);
    reassign(data);
  }

  return (
    <div className="space-y-4 pt-2">
      {canRemoveAssignment ? (
        <div className="rounded-lg border border-warning/25 bg-warning/[0.04] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <UserSwitch className="size-4 text-warning" />
            <p className="text-xs font-semibold text-foreground">Atribuição atual</p>
          </div>
          <p className="text-xs leading-normal text-muted-foreground">
            Retira o responsável atual sem apagar a etapa nem os horários do atendimento. O lead aguardará uma nova ação manual.
          </p>
          <Button
            className="w-full justify-center gap-2 text-xs"
            disabled={removeAssignmentPending}
            onClick={() => setRemoveAssignmentDialogOpen(true)}
            type="button"
            variant="outline"
          >
            Remover atribuição
          </Button>
          <ConfirmDialog
            open={removeAssignmentDialogOpen}
            onOpenChange={setRemoveAssignmentDialogOpen}
            title="Remover atribuição deste lead?"
            description={`O lead deixará a carteira de ${currentOwner}. A etapa e o histórico serão preservados, e ele aguardará uma nova ação manual sem voltar à distribuição automática.`}
            confirmLabel="Remover atribuição"
            destructive
            loading={removeAssignmentPending}
            onConfirm={confirmRemoveAssignment}
          />
        </div>
      ) : null}

      {/* Atribuir unidade */}
      {canReassignUnit && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Buildings className="size-4 text-primary" />
            <p className="text-xs font-semibold text-foreground">Reatribuir unidade</p>
          </div>
          <p className="text-xs text-muted-foreground leading-normal">
            Selecione uma filial para enviar este lead à fila de distribuição. Só é permitido antes do início do atendimento.
          </p>
          <form action={routeAction} className="flex items-center gap-2">
            <input name="leadId" type="hidden" value={leadId} />
            <Select name="branchId" onValueChange={(value) => setAssignBranchId(value ?? "")} value={assignBranchId}>
              <SelectTrigger className="h-9 flex-1 text-xs" aria-label="Selecionar unidade">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id} className="text-xs">{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!assignBranchId || routePending}
              type="submit"
              variant="default"
              className="h-9 gap-1 text-xs shrink-0"
            >
              {routePending ? "Enviando..." : "Enviar"}
              <ArrowRight className="size-3.5" />
            </Button>
          </form>
        </div>
      )}

      {/* Seção de assumir atendimento se já estiver ativo */}
      {activeStatus && (
        <div className="rounded-lg border border-primary/25 bg-primary/[0.02] p-3 space-y-2">
          <p className="text-xs text-muted-foreground leading-normal">
            Atendimento ativo com <strong className="text-foreground">{currentOwner || "outro corretor"}</strong>. Como gestor/diretor, você pode assumir a conversa para si.
          </p>
          <Button
            className="w-full justify-center text-xs h-9"
            onClick={handleAssumeMessaging}
            disabled={isAssuming}
            variant="outline"
          >
            <ChatCircleText className="size-4 mr-1.5" />
            {isAssuming ? "Assumindo..." : "Assumir atendimento (Conversa)"}
          </Button>
        </div>
      )}

      {/* Seção de Controle de Estágio e Qualificação */}
      {!isQualifiedOrDistributed && (
        <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Estágio & Qualificação do Lead</p>
          <p className="text-xs text-muted-foreground">
            Altere manualmente a etapa deste lead entre a fila de qualificação IA e o status de lead qualificado.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={isReverting}
              onClick={handleRevertToQualifying}
            >
              <RotateCcw className="size-3.5 text-amber-500" />
              {isReverting ? "Movendo..." : "Mover p/ Qualificação"}
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 text-xs gap-1 font-medium"
              onClick={() => setOpenQualifyDialog(true)}
            >
              <Sparkle className="size-3.5" />
              Qualificar Lead
            </Button>
          </div>
        </div>
      )}

      <ManualQualificationDialog
        open={openQualifyDialog}
        onOpenChange={setOpenQualifyDialog}
        leadId={leadId}
        leadName={leadName || "Lead"}
        brokers={brokers}
      />

      {/* Seletor de modo */}
      <div className="inline-flex w-full rounded-lg border border-border/80 bg-muted/50 p-1" role="group" aria-label="Tipo de intervenção">
        <Button className="h-8 flex-1 text-xs" onClick={() => setMode("reassign")} size="sm" type="button" variant={mode === "reassign" ? "secondary" : "ghost"}>Reatribuir</Button>
        <Button className="h-8 flex-1 text-xs" onClick={() => setMode("investigate")} size="sm" type="button" variant={mode === "investigate" ? "secondary" : "ghost"}>Investigar</Button>
      </div>

      <p className="text-xs leading-normal text-muted-foreground">{selectedModeDescription}</p>

      {mode === "reassign" && dutyRosterLoading ? (
        <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground" role="status">
          Verificando o plantão vinculado à fila do lead…
        </p>
      ) : mode === "reassign" && dutyRosterError ? (
        <p className="rounded-md border border-destructive/25 bg-destructive/[0.04] p-3 text-xs text-destructive" role="alert">
          {dutyRosterError} Atualize o drawer para tentar novamente.
        </p>
      ) : mode === "reassign" ? (
        <form action={reassign} className="space-y-3" onSubmit={handleReassignSubmit}>
          <input name="leadId" type="hidden" value={leadId} />
          <input name="brokerId" type="hidden" value={brokerId} />
          <div className="space-y-1.5">
            <Label htmlFor="lead-reassign-broker-drawer" className="text-xs">
              {activeQueueDuty ? "Corretores escalados no plantão ativo" : "Novo responsável"}
            </Label>
            {activeQueueDuty && assignmentBrokers.length === 0 ? (
              <p className="rounded-md border border-warning/25 bg-warning/[0.04] p-3 text-xs text-muted-foreground" role="status">
                Não há corretores ativos escalados neste plantão agora.
              </p>
            ) : (
            <Select name="brokerId" onValueChange={(value) => setBrokerId(value ?? "")} value={brokerId}>
              <SelectTrigger id="lead-reassign-broker-drawer" className="h-9 text-xs">
                <SelectValue placeholder={activeQueueDuty ? "Selecione um corretor escalado" : "Selecione um corretor"} />
              </SelectTrigger>
              <SelectContent>
                {assignmentBrokers.length === 0 ? (
                  <SelectItem value="_none" disabled>Nenhum corretor disponível nesta filial</SelectItem>
                ) : (
                  assignmentBrokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.id} className="text-xs">
                      {broker.name}{activeQueueDuty && broker.branchName ? ` · ${broker.branchName}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            )}
          </div>
          <Button className="w-full justify-between h-9 text-xs" disabled={!brokerId || brokerId === "_none" || (activeQueueDuty && assignmentBrokers.length === 0) || reassignPending} type="submit" variant="outline">
            {reassignPending ? "Reatribuindo..." : "Confirmar reatribuição"}<ArrowRight className="size-4" />
          </Button>
        </form>
      ) : (
        <form action={assume} className="space-y-3">
          <input name="leadId" type="hidden" value={leadId} />
          <div className="space-y-1.5">
            <Label htmlFor="lead-investigation-reason-drawer" className="text-xs">Motivo da investigação</Label>
            <Input id="lead-investigation-reason-drawer" name="reason" onChange={(event) => setReason(event.target.value)} placeholder="Ex.: divergência na distribuição" value={reason} className="h-9 text-xs" />
          </div>
          <Button className="w-full justify-between h-9 text-xs" disabled={reason.trim().length < 3 || assumePending || currentStatus === "lost"} type="submit" variant="secondary">
            {assumePending ? "Registrando..." : "Assumir investigação"}<ArrowRight className="size-4" />
          </Button>
        </form>
      )}

      <Dialog open={manualAssignmentDialogOpen} onOpenChange={setManualAssignmentDialogOpen}>
        <DialogPopup key={manualAssignmentDialogOpen ? "manual-assignment-open" : "manual-assignment-closed"} className="sm:max-w-md">
          <DialogTitle>Como deseja atribuir este lead?</DialogTitle>
          <DialogDescription>
            Escolha se {brokerId ? assignmentBrokers.find((broker) => broker.id === brokerId)?.name ?? "o corretor selecionado" : "o corretor selecionado"} deve receber uma oferta para aceitar ou se a atribuição deve ser imediata.
          </DialogDescription>
          <div className="grid gap-2 pt-2">
            <Button type="button" disabled={reassignPending || !brokerId || brokerId === "_none"} onClick={() => submitManualAssignment("offer")}>
              {reassignPending ? "Enviando oferta…" : "Sim, enviar oferta para aceite"}
            </Button>
            <Button type="button" variant="outline" disabled={reassignPending || !brokerId || brokerId === "_none"} onClick={() => submitManualAssignment("direct")}>
              Atribuir direto, sem mensagem de aceite
            </Button>
            <DialogClose render={<Button type="button" variant="ghost" disabled={reassignPending}>Cancelar</Button>} />
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
