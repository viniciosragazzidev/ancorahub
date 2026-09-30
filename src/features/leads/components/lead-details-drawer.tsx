"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChatCircleText, FileText, ListChecks, Phone, WhatsappLogo } from "@/components/huge-icons";
import { DetailDrawer } from "@/components/foundations/detail-drawer";
import { OwnershipContext } from "@/components/ownership-context";
import { Button } from "@/components/ui/button";
import { SheetSection, SheetSectionHeader } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadDrawerManagementActions } from "@/app/(dashboard)/leads/_components/lead-drawer-management-actions";
import { LeadDistributionRemovedTag } from "@/app/(dashboard)/leads/_components/lead-distribution-removal";
import { LeadAssignmentHistory } from "@/app/(dashboard)/leads/_components/lead-assignment-history";
import { StartQualificationButton } from "@/app/(dashboard)/leads/_components/qualifying-lead-actions";
import { LeadQualificationBadge, LeadStatusBadge } from "@/components/status-badges";
import { LeadHealthBadge, computeLeadHealth } from "@/features/leads/components/lead-health-badge";
import { MarkLeadInServiceButton } from "@/features/leads/components/mark-lead-in-service-button";
import { LeadQuickNote } from "@/features/leads/components/lead-quick-note";
import { LeadReminder } from "@/features/leads/components/lead-reminder";
import { getLeadProductLabel, readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";
import { canDirectorMarkLeadInService } from "@/features/leads/director-service-start";
import { formatDate, maskName, maskPhone } from "@/features/quotes/utils";
import type { LeadWorkspaceItem } from "./lead-workspace-types";
import { QueueColorTag } from "@/features/lead-distribution/queue-color-tag";
import { getLeadInvestigationObservationAction } from "@/features/leads/investigation-observation-action";

type BrokerOption = { id: string; name: string; branchId: string | null };
type BranchOption = { id: string; name: string };

export type LeadDrawerCommitResult = {
  entity?: {
    leadId: string;
    branchId?: string | null;
    corretorId?: string | null;
    status?: string;
    distributionStatus?: string;
    distributionRemovalReason?: string | null;
    distributionRemovalNote?: string | null;
  };
};

type LeadDetailsDrawerProps = {
  lead: LeadWorkspaceItem;
  contextRole: string;
  contextJobTitle?: string | null;
  contextBranchId?: string | null;
  brokers: BrokerOption[];
  branches: BranchOption[];
  manualAssignmentChoiceEnabled: boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
  onOpenChange: (open: boolean) => void;
  onManagementCommitted: (result: LeadDrawerCommitResult) => void;
  onReassignOptimistic: (brokerId: string) => void;
  onReassignRollback: () => void;
  onLeadPatch: (patch: Partial<LeadWorkspaceItem>) => void;
};

function DetailRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return <div className="flex min-w-0 items-center justify-between gap-4"><span className="shrink-0 text-muted-foreground">{label}</span><div className="min-w-0 break-words text-right font-medium">{value}</div></div>;
}

function OperationalDetail({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return <div className="min-w-0 border-b border-border/70 px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(odd)]:border-border/70"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className={`${multiline ? "mt-1 whitespace-pre-wrap break-words text-sm font-normal text-foreground" : "mt-1 truncate text-sm font-medium text-foreground"}`} title={value}>{value}</dd></div>;
}

export function LeadDetailsDrawer({
  lead,
  contextRole,
  contextJobTitle,
  contextBranchId,
  brokers,
  branches,
  manualAssignmentChoiceEnabled,
  slaFirstContactMinutes,
  slaStagnantDays,
  onOpenChange,
  onManagementCommitted,
  onReassignOptimistic,
  onReassignRollback,
  onLeadPatch,
}: LeadDetailsDrawerProps) {
  const shouldMask = contextJobTitle === "marketing" && lead.branchId !== contextBranchId;
  const canCall = !(contextRole === "broker" && lead.status === "distributed");
  const selectedMetaDetails = readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata);
  const filteredBrokers = brokers.filter((broker) => broker.branchId === lead.branchId);
  const managementRole = contextRole === "manager" || contextRole === "director";
  const [investigationObservation, setInvestigationObservation] = useState<{
    leadId: string;
    status: "loading" | "loaded" | "error";
    reason: string | null;
  } | null>(null);

  useEffect(() => {
    if (!managementRole || !lead.isManagementInvestigation) {
      setInvestigationObservation(null);
      return;
    }

    let current = true;
    setInvestigationObservation({ leadId: lead.id, status: "loading", reason: null });
    void getLeadInvestigationObservationAction(lead.id)
      .then(({ reason }) => {
        if (current) setInvestigationObservation({ leadId: lead.id, status: "loaded", reason });
      })
      .catch(() => {
        if (current) setInvestigationObservation({ leadId: lead.id, status: "error", reason: null });
      });

    return () => { current = false; };
  }, [lead.id, lead.isManagementInvestigation, managementRole]);

  return (
    <DetailDrawer
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={<span className={shouldMask ? "blur-[3px] select-none" : ""}>{shouldMask ? maskName(lead.nome) : lead.nome}</span>}
      description={<div className="flex flex-col gap-0.5"><span className={`font-mono text-xs ${shouldMask ? "blur-[3px] select-none" : ""}`}>{shouldMask ? "••••-••••" : contextRole === "broker" && lead.status === "distributed" ? maskPhone(lead.telefone) : lead.telefone}</span><OwnershipContext brokerName={lead.corretorNome} branchName={lead.branchName} className="text-xs text-muted-foreground" /></div>}
      summary={<div className="flex flex-wrap items-center gap-1.5 pt-1"><LeadStatusBadge status={lead.status} /><LeadQualificationBadge status={lead.qualificationStatus} />{!lead.corretorId ? <LeadDistributionRemovedTag reason={lead.distributionRemovalReason} note={lead.distributionRemovalNote} /> : null}{canDirectorMarkLeadInService({ role: contextRole, corretorId: lead.corretorId, status: lead.status }) ? <MarkLeadInServiceButton leadId={lead.id} brokerName={lead.corretorNome} onDone={() => onLeadPatch({ status: "in_contact" })} /> : null}<LeadHealthBadge health={computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays)} />{lead.queueName ? <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-2 py-0.5"><QueueColorTag name={lead.queueName} hue={lead.queueColorHue} /></span> : null}</div>}
      footer={<Button className="w-full justify-center gap-2 font-medium" render={<Link href={`/leads/${lead.id}`} />}>Abrir atendimento completo<ArrowUpRight className="size-4" /></Button>}
    >
      <div className="space-y-5">
        {managementRole ? (
          <>
            {!lead.corretorId && lead.distributionStatus === "returned_to_queue" ? <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3"><p className="text-xs font-semibold text-warning">Lead aguardando reatribuição</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">O corretor responsável foi excluído. O lead voltou para a fila e precisa ser reatribuído manualmente.</p></div> : null}
            <SheetSection><SheetSectionHeader><div className="min-w-0"><p className="text-sm font-semibold">Resumo operacional</p><p className="mt-1 text-xs text-muted-foreground">O que aconteceu e o que precisa de decisão.</p></div></SheetSectionHeader><dl className="grid overflow-hidden rounded-b-xl sm:grid-cols-2"><OperationalDetail label="Responsável" value={lead.corretorNome ?? "Aguardando distribuição"} />{lead.isManagementInvestigation ? <OperationalDetail label="Motivo da investigação" multiline value={investigationObservation?.leadId === lead.id ? investigationObservation.status === "loading" ? "Carregando motivo registrado…" : investigationObservation.status === "error" ? "Não foi possível carregar o motivo agora." : investigationObservation.reason ?? "Motivo não localizado no histórico." : "Carregando motivo registrado…"} /> : null}<OperationalDetail label="Unidade" value={lead.branchName ?? "Sem unidade"} /><OperationalDetail label="Recebeu o lead" value={formatDate(lead.assignedAt, { dateStyle: "short", timeStyle: "short" })} /><OperationalDetail label="Primeiro contato" value={formatDate(lead.firstContactAt, { dateStyle: "short", timeStyle: "short" })} /><OperationalDetail label="Atendimento iniciado" value={formatDate(lead.serviceStartedAt, { dateStyle: "short", timeStyle: "short" })} /><OperationalDetail label="Etapa atual desde" value={formatDate(lead.stageEnteredAt, { dateStyle: "short", timeStyle: "short" })} /></dl></SheetSection>
            <SheetSection><SheetSectionHeader><div><p className="text-sm font-semibold">Ações rápidas</p><p className="mt-1 text-xs text-muted-foreground">Acesse o atendimento ou o cadastro completo.</p></div></SheetSectionHeader><div className="grid gap-2 p-4 sm:grid-cols-2"><Button className="w-full" render={<Link href={`/conversas?leadId=${lead.id}`} />}><ChatCircleText />Abrir conversa</Button><Button className="w-full" render={<Link href={`/leads/${lead.id}`} />} variant="outline">Ver cadastro<ArrowUpRight /></Button></div></SheetSection>
            <SheetSection><SheetSectionHeader><div><p className="text-sm font-semibold">Intervir na operação</p><p className="mt-1 text-xs text-muted-foreground">Reatribua, investigue ou encaminhe o lead sem perder o contexto.</p></div></SheetSectionHeader><div className="p-4"><LeadDrawerManagementActions leadId={lead.id} leadName={lead.nome} brokers={filteredBrokers} branches={branches} manualAssignmentChoiceEnabled={manualAssignmentChoiceEnabled} leadQueueId={lead.queueId} contextRole={contextRole} currentStatus={lead.status} currentDistributionStatus={lead.distributionStatus} qualificationStatus={lead.qualificationStatus} qualificationState={lead.qualificationState} currentOwner={lead.corretorNome} distributionRemovalReason={lead.distributionRemovalReason} distributionRemovalNote={lead.distributionRemovalNote} onSuccess={onManagementCommitted} onReassignOptimistic={onReassignOptimistic} onReassignRollback={onReassignRollback} /></div></SheetSection>
            <LeadAssignmentHistory leadId={lead.id} assignedAt={lead.assignedAt} corretorNome={lead.corretorNome} />
          </>
        ) : (
          <Tabs defaultValue="summary" variant="underline" className="min-h-0"><TabsList aria-label="Informações do lead no drawer" className="w-full justify-start"><TabsTrigger value="summary">Resumo</TabsTrigger>{!shouldMask ? <TabsTrigger value="actions">Ações</TabsTrigger> : null}</TabsList><TabsContent value="summary" className="mt-4 space-y-4"><SheetSection className="p-4"><div><p className="text-sm font-semibold">Dados do atendimento</p><p className="mt-1 text-xs text-muted-foreground">Contexto essencial para continuar o lead.</p></div><dl className="mt-4 space-y-3"><DetailRow label="Saúde" value={<LeadHealthBadge health={computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays)} />} /><DetailRow label="Responsável" value={[lead.corretorNome ?? "Aguardando distribuição", lead.branchName ?? "Sem unidade"].join(" · ")} /><DetailRow label="Plano / Produto" value={getLeadProductLabel({ tipo: lead.tipo, sourceChannel: lead.sourceChannel, sourceMetadata: lead.sourceMetadata })} />{!shouldMask ? <DetailRow label="E-mail" value={lead.email || "Não informado"} /> : null}{!shouldMask && selectedMetaDetails?.tipoCnpj ? <DetailRow label="Tipo de CNPJ" value={selectedMetaDetails.tipoCnpj} /> : null}{!shouldMask && selectedMetaDetails?.operadora ? <DetailRow label="Operadora" value={selectedMetaDetails.operadora} /> : null}<DetailRow label="Origem" value={lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook")} /><DetailRow label="Entrada" value={formatDate(lead.createdAt, { day: "2-digit", month: "short" })} /></dl></SheetSection><LeadAssignmentHistory leadId={lead.id} assignedAt={lead.assignedAt} corretorNome={lead.corretorNome} /></TabsContent><TabsContent value="actions" className="mt-4 space-y-3">{!(lead.status === "distributed" || ["in_contact", "quote_sent", "negotiation", "converted", "lost"].includes(lead.status) || lead.qualificationState === "QUALIFIED" || lead.qualificationState === "COMPLETED" || (Boolean(lead.qualificationStatus) && ["qualified", "hot", "warm", "cold", "disqualified", "not_qualified"].includes(lead.qualificationStatus))) ? <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"><p className="mb-1.5 text-xs font-semibold text-foreground">Qualificação Manual por IA</p><StartQualificationButton leadId={lead.id} leadName={lead.nome} variant="secondary" size="sm" className="w-full justify-center" /></div> : null}<div className="grid grid-cols-2 gap-2"><Button className="w-full" render={<Link href={`/leads/${lead.id}`} />}><ArrowUpRight />Abrir atendimento</Button><Button className="w-full" render={<Link href={`/conversas?leadId=${lead.id}`} />} variant="outline"><ChatCircleText />Conversas</Button></div>{canCall ? <div className="grid grid-cols-2 gap-2"><Button className="w-full" render={<a href={`tel:${lead.telefone}`} />} variant="outline"><Phone />Ligar</Button><Button className="w-full" render={<a href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank" />} variant="outline"><WhatsappLogo />WhatsApp</Button></div> : <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-muted-foreground">Os dados de contato serão liberados quando você iniciar este atendimento.</p>}<div className="grid grid-cols-2 gap-2"><Button className="w-full" render={<Link href={`/tarefas?leadId=${lead.id}`} />} variant="outline"><ListChecks />Tarefas</Button><Button className="w-full" render={<Link href="#documentos" />} variant="outline"><FileText />Documentos</Button></div><div className="flex flex-wrap gap-2 border-t border-border pt-3"><LeadQuickNote leadId={lead.id} /><LeadReminder leadId={lead.id} /></div></TabsContent></Tabs>
        )}
      </div>
    </DetailDrawer>
  );
}
