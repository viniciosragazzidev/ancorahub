"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowRight, ChatCircleText } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reassignLeadAction, assumeLeadForInvestigationAction, assumeLeadForMessagingAction } from "@/features/leads/management-actions";

type Broker = { id: string; name: string; branchId: string | null };
type ManagementMode = "reassign" | "investigate";

export function LeadDrawerManagementActions({
  leadId,
  brokers,
  currentStatus,
  currentOwner,
  onSuccess,
}: {
  leadId: string;
  brokers: Broker[];
  currentStatus: string;
  currentOwner: string | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ManagementMode>("reassign");
  const [brokerId, setBrokerId] = useState("");
  const [reason, setReason] = useState("");
  const [isAssuming, setIsAssuming] = useState(false);

  const [reassignState, reassign, reassignPending] = useActionState(reassignLeadAction, {});
  const [assumeState, assume, assumePending] = useActionState(assumeLeadForInvestigationAction, {});

  useEffect(() => {
    if (reassignState.success) {
      toast.success("Lead reatribuído e SLA reiniciado.");
      router.refresh();
      if (onSuccess) onSuccess();
    }
    if (reassignState.error) toast.error(reassignState.error);
  }, [reassignState, router, onSuccess]);

  useEffect(() => {
    if (assumeState.success) {
      toast.success("Lead assumido para investigação.");
      router.refresh();
      if (onSuccess) onSuccess();
    }
    if (assumeState.error) toast.error(assumeState.error);
  }, [assumeState, router, onSuccess]);

  const activeStatus = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(currentStatus);

  const handleAssumeMessaging = async () => {
    try {
      setIsAssuming(true);
      const res = await assumeLeadForMessagingAction(leadId);
      if (res.success) {
        toast.success("Você assumiu este atendimento.");
        router.refresh();
        if (onSuccess) onSuccess();
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Ocorreu um erro ao assumir o atendimento.");
    } finally {
      setIsAssuming(false);
    }
  };

  const selectedModeDescription = mode === "reassign"
    ? "Transfira a responsabilidade para outro corretor elegível. O SLA de primeiro contato será reiniciado."
    : "Assuma este caso para apurar uma exceção. Registre o motivo para manter a operação auditável.";

  return (
    <div className="space-y-4 pt-2">
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

      {/* Seletor de modo */}
      <div className="inline-flex w-full rounded-lg border border-border/80 bg-muted/50 p-1" role="group" aria-label="Tipo de intervenção">
        <Button className="h-8 flex-1 text-xs" onClick={() => setMode("reassign")} size="sm" type="button" variant={mode === "reassign" ? "secondary" : "ghost"}>Reatribuir</Button>
        <Button className="h-8 flex-1 text-xs" onClick={() => setMode("investigate")} size="sm" type="button" variant={mode === "investigate" ? "secondary" : "ghost"}>Investigar</Button>
      </div>

      <p className="text-xs leading-normal text-muted-foreground">{selectedModeDescription}</p>

      {mode === "reassign" ? (
        <form action={reassign} className="space-y-3">
          <input name="leadId" type="hidden" value={leadId} />
          <div className="space-y-1.5">
            <Label htmlFor="lead-reassign-broker-drawer" className="text-xs">Novo responsável</Label>
            <Select name="brokerId" onValueChange={(value) => setBrokerId(value ?? "")} value={brokerId}>
              <SelectTrigger id="lead-reassign-broker-drawer" className="h-9 text-xs"><SelectValue placeholder="Selecione um corretor" /></SelectTrigger>
              <SelectContent>
                {brokers.length === 0 ? (
                  <SelectItem value="_none" disabled>Nenhum corretor disponível nesta filial</SelectItem>
                ) : (
                  brokers.map((broker) => <SelectItem key={broker.id} value={broker.id} className="text-xs">{broker.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full justify-between h-9 text-xs" disabled={!brokerId || brokerId === "_none" || reassignPending} type="submit" variant="outline">
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
    </div>
  );
}
