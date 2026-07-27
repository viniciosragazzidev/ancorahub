"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, UserPlus, ListChecks, ArrowRight, ChatCircleText } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reassignLeadAction, assumeLeadForInvestigationAction, assumeLeadForMessagingAction } from "@/features/leads/management-actions";

type Broker = { id: string; name: string };
type TaskItem = { completedAt: string | null | Date };

export function SupervisionPanel({
  leadId,
  currentStatus,
  currentOwner,
  currentOwnerId,
  assignedAt,
  stageEnteredAt,
  serviceStartedAt,
  brokers,
  slaFirstContactMinutes,
  tasks,
  isLost,
  currentUserId,
}: {
  leadId: string;
  currentStatus: string;
  currentOwner: string | null;
  currentOwnerId: string | null;
  assignedAt: Date | null;
  stageEnteredAt: Date;
  serviceStartedAt: Date | null;
  brokers: Broker[];
  slaFirstContactMinutes: number;
  tasks: TaskItem[];
  isLost: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"reassign" | "investigate">("reassign");
  const [brokerId, setBrokerId] = useState("");
  const [reason, setReason] = useState("");
  const [isAssuming, setIsAssuming] = useState(false);

  const [reassignState, reassign, reassignPending] = useActionState(reassignLeadAction, {});
  const [assumeState, assume, assumePending] = useActionState(assumeLeadForInvestigationAction, {});

  useEffect(() => {
    if (reassignState.success) {
      toast.success("Lead reatribuído e SLA reiniciado.");
      router.refresh();
    }
    if (reassignState.error) toast.error(reassignState.error);
  }, [reassignState, router]);

  useEffect(() => {
    if (assumeState.success) {
      toast.success("Lead assumido para investigação.");
      router.refresh();
    }
    if (assumeState.error) toast.error(assumeState.error);
  }, [assumeState, router]);

  // SLA calculations
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - stageEnteredAt.getTime()) / 60000));
  const remainingMinutes = Math.max(0, slaFirstContactMinutes - elapsedMinutes);
  const isSlaExpired = remainingMinutes <= 0 && !serviceStartedAt;

  // Task stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completedAt).length;

  const handleAssumeMessaging = async () => {
    try {
      setIsAssuming(true);
      const res = await assumeLeadForMessagingAction(leadId);
      if (res.success) {
        toast.success("Você assumiu este atendimento.");
        router.refresh();
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Ocorreu um erro ao assumir o atendimento.");
    } finally {
      setIsAssuming(false);
    }
  };

  const activeStatus = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(currentStatus);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/[0.01] shadow-sm">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <CardTitle className="text-base font-semibold">Painel de Supervisão e Gestão</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Métricas de SLA, desempenho e ferramentas de intervenção para este lead.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs">
            Modo Supervisor
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Row 1: Metrics Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card: SLA Status */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Status do SLA</span>
            </div>
            <div>
              {serviceStartedAt ? (
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Atendimento Iniciado</p>
              ) : isSlaExpired ? (
                <p className="text-sm font-semibold text-destructive">SLA Estourado</p>
              ) : (
                <p className="text-sm font-semibold text-warning">Aguardando Contato</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {serviceStartedAt
                  ? `Iniciado após ${Math.round((serviceStartedAt.getTime() - stageEnteredAt.getTime()) / 60000)}min`
                  : isSlaExpired
                  ? `Excedido há ${Math.abs(remainingMinutes)}min`
                  : `Expira em ${remainingMinutes}min`}
              </p>
            </div>
          </div>

          {/* Card: Assigned Broker */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserPlus className="size-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Responsável</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground truncate">{currentOwner || "Não distribuído"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {assignedAt ? `Designado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(assignedAt))}` : "Aguardando fila de distribuição"}
              </p>
            </div>
          </div>

          {/* Card: Tasks Progress */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="size-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Tarefas no Lead</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {completedTasks} de {totalTasks} concluídas
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Takeover banner if active under someone else */}
        {activeStatus && currentOwnerId !== currentUserId && (
          <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Intervir no Atendimento</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este lead está sendo atendido por <strong>{currentOwner}</strong>. Se necessário, assuma o controle da conversa.
              </p>
            </div>
            <Button
              className="shrink-0 justify-center h-9 text-xs"
              onClick={handleAssumeMessaging}
              disabled={isAssuming}
              variant="outline"
            >
              <ChatCircleText className="size-4 mr-1.5" />
              {isAssuming ? "Assumindo..." : "Assumir conversa"}
            </Button>
          </div>
        )}

        {/* Row 3: Management Form Actions */}
        <div className="border-t border-border/40 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Ações Administrativas</span>
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5" role="group">
              <Button className="h-7 text-xs px-3" onClick={() => setMode("reassign")} size="sm" type="button" variant={mode === "reassign" ? "secondary" : "ghost"}>Reatribuir</Button>
              <Button className="h-7 text-xs px-3" onClick={() => setMode("investigate")} size="sm" type="button" variant={mode === "investigate" ? "secondary" : "ghost"}>Investigar</Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/[0.15] p-4">
            {mode === "reassign" ? (
              <form action={reassign} className="space-y-4">
                <input name="leadId" type="hidden" value={leadId} />
                <div className="space-y-2">
                  <Label htmlFor="lead-reassign-broker-panel" className="text-xs">Selecionar novo corretor</Label>
                  <Select name="brokerId" onValueChange={(value) => setBrokerId(value ?? "")} value={brokerId}>
                    <SelectTrigger id="lead-reassign-broker-panel" className="h-9 text-xs"><SelectValue placeholder="Escolha um corretor na filial" /></SelectTrigger>
                    <SelectContent>
                      {brokers.length === 0 ? (
                        <SelectItem value="_none" disabled className="text-xs">Nenhum corretor na filial</SelectItem>
                      ) : (
                        brokers.map((broker) => <SelectItem key={broker.id} value={broker.id} className="text-xs">{broker.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full justify-between h-9 text-xs" disabled={!brokerId || brokerId === "_none" || reassignPending} type="submit">
                  {reassignPending ? "Reatribuindo..." : "Confirmar reatribuição"}<ArrowRight className="size-4" />
                </Button>
              </form>
            ) : (
              <form action={assume} className="space-y-4">
                <input name="leadId" type="hidden" value={leadId} />
                <div className="space-y-2">
                  <Label htmlFor="lead-investigation-reason-panel" className="text-xs">Motivo da investigação</Label>
                  <Input id="lead-investigation-reason-panel" name="reason" onChange={(event) => setReason(event.target.value)} placeholder="Ex.: divergência na distribuição de fila" value={reason} className="h-9 text-xs" />
                </div>
                <Button className="w-full justify-between h-9 text-xs" disabled={reason.trim().length < 3 || assumePending || isLost} type="submit" variant="secondary">
                  {assumePending ? "Registrando..." : "Assumir para investigação"}<ArrowRight className="size-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
