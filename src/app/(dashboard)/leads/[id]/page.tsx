import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadStatusSelector } from "@/features/leads/components/lead-status-selector";
import { LeadTimeline } from "@/features/leads/components/lead-timeline";
import { LeadTasks } from "@/features/leads/components/lead-tasks";
import { LeadChat } from "@/features/leads/components/lead-chat";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "@/features/leads/lead-status-constants";
import { getLeadTimeline } from "@/features/leads/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { StartServiceButton } from "./start-service-button";
import { SupervisionPanel } from "./supervision-panel";
import { DeleteLeadControl } from "./delete-lead-control";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightLeadDetail, type LightLeadDetailData } from "@/features/broker-workspace/components/light-lead-detail";
import { StartQualificationButton } from "@/app/(dashboard)/leads/_components/qualifying-lead-actions";

import { getRequirementsForLead, getLeadDocuments, getLeadDocumentChecklist } from "@/features/documents/actions";
import { LeadDocumentsSection } from "@/features/documents/components/lead-documents-section";
import { LeadActionHub } from "@/features/leads/components/lead-action-hub";
import { getSystemSetting } from "@/features/system-settings/queries";

import { BeneficiariesSection } from "./beneficiaries-section";
import { getLeadBeneficiaries } from "@/features/post-sale/queries";
import { maskPhone, maskName } from "@/features/quotes/utils";
import Link from "next/link";
import { Phone, Clock, Share, Buildings, UserPlus, LockKey, ChatCircleText } from "@/components/huge-icons";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";
import {
  resolveLeadNextBestAction,
  NextBestActionCard,
  type LeadActionContext,
} from "@/features/next-best-action";

function getCurrentTimestamp() {
  return Date.now();
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {


  const { id } = await params;
  const context = await getRequiredTenantContext();
  const brokerInternalChatEnabled =
    context.role !== "broker" ||
    (await getSystemSetting("feature_waha_connections_enabled")) !== "false";
  const db = getDatabase();

  let isMatrix = false;
  if (context.branchId) {
    const [userBranch] = await db
      .select({ name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, context.branchId), eq(schema.branches.tenantId, context.tenantId)))
      .limit(1);
    isMatrix = userBranch?.name?.toLowerCase() === "matriz";
  } else {
    isMatrix = true;
  }

  const isMarketing = context.jobTitle === "marketing";

  const scopeFilter = isMarketing
    ? (isMatrix ? undefined : eq(schema.leads.branchId, context.branchId!))
    : (context.role === "broker"
      ? eq(schema.leads.corretorId, context.userId)
      : context.role === "manager" && context.branchId
        ? eq(schema.leads.branchId, context.branchId)
        : undefined);

  const [lead] = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      email: schema.leads.email,
      origem: schema.leads.origem,
      sourceCampaign: schema.leads.sourceCampaign,
      sourceAd: schema.leads.sourceAd,
      sourceForm: schema.leads.sourceForm,
      capturedAt: schema.leads.capturedAt,
      metaCampaignId: schema.leads.metaCampaignId,
      tipo: schema.leads.tipo,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationState: schema.leads.qualificationState,
      formData: schema.leads.formData,
      qualificationDetails: schema.leads.qualificationDetails,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
      planId: schema.leads.planId,
      motivoPerda: schema.leads.motivoPerda,
      lossCategory: schema.leads.lossCategory,
      slaBreachedAt: schema.leads.slaBreachedAt,
      firstContactLatencySeconds: schema.leads.firstContactLatencySeconds,
      consentimentoLgpd: schema.leads.consentimentoLgpd,
      createdAt: schema.leads.createdAt,
      assignedAt: schema.leads.assignedAt,
      serviceStartedAt: schema.leads.serviceStartedAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
      corretorNome: schema.user.name,
      branchNome: schema.branches.name,
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .where(and(
      eq(schema.leads.id, id),
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
      scopeFilter,
    ))
    .limit(1);

  if (!lead) notFound();
  const qualificationDetails = readQualificationDetails(lead.qualificationDetails);

  if (context.role === "broker" && (await getExperienceMode(context)) === "LIGHT") {
    const [brokerUser] = await db
      .select({ name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, context.userId))
      .limit(1);

    const [userWahaConn, lightBeneficiaries, lightRequirements, lightLeadDocs, lightCarriers] = await Promise.all([
      db.select({
        status: schema.whatsappConnections.status,
        chatInternoAtivo: schema.whatsappConnections.chatInternoAtivo,
      })
      .from(schema.whatsappConnections)
      .where(and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.userId, context.userId),
      ))
      .limit(1)
      .then((rows) => rows[0] ?? null),
      getLeadBeneficiaries(id),
      getRequirementsForLead(id),
      getLeadDocuments(id),
      db.select({ id: schema.carriers.id, name: schema.carriers.name })
        .from(schema.carriers)
        .where(and(eq(schema.carriers.tenantId, context.tenantId), eq(schema.carriers.status, "active")))
        .orderBy(schema.carriers.name),
    ]);

    const hasWahaConnected = userWahaConn?.status === "ready" && userWahaConn?.chatInternoAtivo === true;

    const lightFormData = readFormData(lead.formData);

    const lightLead: LightLeadDetailData = {
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email,
      status: lead.status,
      qualificationStatus: lead.qualificationStatus,
      qualificationState: lead.qualificationState,
      corretorId: lead.corretorId,
      corretorNome: lead.corretorNome,
      branchName: lead.branchNome,
      summary: qualificationDetails?.resumoAtendimento || qualificationDetails?.resumoNecessidade || null,
      livesCount: qualificationDetails?.qtdVidas ? Number(qualificationDetails.qtdVidas) : null,
      urgency: qualificationDetails?.urgenciaContratacao || null,
      city: qualificationDetails?.cidade || null,
      createdAt: lead.createdAt,
      isCurrentBroker: lead.corretorId === context.userId,
      tipo: lead.tipo,
      origem: lead.origem,
      sourceCampaign: lead.sourceCampaign,
      beneficiaries: lightBeneficiaries.map((b) => ({
        id: b.id,
        name: b.name,
        birthDate: b.birthDate,
        relationship: b.relationship,
        isHolder: b.isHolder,
      })),
      formData: lightFormData,
      consentimentoLgpd: lead.consentimentoLgpd,
    };

    return (
      <LightLeadDetail
        lead={lightLead}
        brokerName={brokerUser?.name || "Corretor"}
        hasWahaConnected={Boolean(hasWahaConnected)}
        requirements={lightRequirements.map((req) => ({
          id: req.id,
          name: req.name,
          description: req.description,
          required: Boolean(req.required),
          appliesPerBeneficiary: Boolean(req.appliesPerBeneficiary),
        }))}
        documents={lightLeadDocs.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          status: doc.status,
        }))}
        carriers={lightCarriers}
      />
    );
  }
  const formData = readFormData(lead.formData);
  const slaMinutes = Number((await getDatabase().select({ minutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1))[0]?.minutes ?? 15);
  const elapsedMinutes = Math.max(0, Math.round((getCurrentTimestamp() - lead.stageEnteredAt.getTime()) / 60000));
  const remainingMinutes = Math.max(0, slaMinutes - elapsedMinutes);
  const slaUrgent = remainingMinutes <= Math.max(5, Math.round(slaMinutes * 0.25));

  // CRITICAL: data needed for the page to render
  const [interactions, tasks, leadDocs] = await Promise.all([
    getLeadTimeline(id),
    getDatabase().select({ id: schema.leadTasks.id, title: schema.leadTasks.title, description: schema.leadTasks.description, priority: schema.leadTasks.priority, dueAt: schema.leadTasks.dueAt, completedAt: schema.leadTasks.completedAt, createdAt: schema.leadTasks.createdAt, assignedTo: schema.leadTasks.assignedTo, assigneeName: schema.user.name })
      .from(schema.leadTasks).leftJoin(schema.user, eq(schema.leadTasks.assignedTo, schema.user.id)).where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, id)))
      .orderBy(schema.leadTasks.completedAt, schema.leadTasks.dueAt, schema.leadTasks.createdAt),
    getLeadDocuments(id),
  ]);

  // OPTIONAL: secondary data that can degrade independently
  const [requirementsResult, checklistResult, beneficiariesResult, carriersResult] = await Promise.allSettled([
    getRequirementsForLead(id),
    getLeadDocumentChecklist(id),
    getLeadBeneficiaries(id),
    getDatabase().select({ id: schema.carriers.id, name: schema.carriers.name })
      .from(schema.carriers)
      .where(and(eq(schema.carriers.tenantId, context.tenantId), eq(schema.carriers.status, "active")))
      .orderBy(schema.carriers.name),
  ]);
  const requirements = requirementsResult.status === "fulfilled" ? requirementsResult.value : [];
  const checklist = checklistResult.status === "fulfilled" ? checklistResult.value : [];
  const beneficiaries = beneficiariesResult.status === "fulfilled" ? beneficiariesResult.value : [];
  const carriers = carriersResult.status === "fulfilled" ? carriersResult.value : [];

  if (!interactions) notFound();


  const brokers = (context.role === "manager" || context.role === "director") && lead.branchId
    ? await getDatabase().select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.branchId, lead.branchId!), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.jobTitle, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true)))
    : [];

  const isManagement = context.role === "manager" || context.role === "director";
  const shouldMask = isMarketing && lead.branchId !== context.branchId;

  const canSeePersonalData = (context.role !== "broker" || lead.corretorId !== context.userId || lead.status !== "distributed") && !shouldMask;
  const maskedPhone = maskPhone(lead.telefone);
  const maskedEmail = lead.email ? maskEmail(lead.email) : "Não informado";
  const stageRank = LEAD_STATUS_ORDER[lead.status] ?? 0;
  const defaultLeadTab = lead.status === "converted" || lead.status === "lost"
    ? "history"
    : stageRank >= 6
      ? "documents"
      : "service";

  if (shouldMask) {
    lead.nome = maskName(lead.nome);
  }

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Perfil do Lead" />
      <main className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-5 bg-background p-4 lg:p-6">

        {/* Profile Cover & Header Card */}
        <Card variant="overview" className="border-border/60 bg-card/80 p-4 shadow-none dark:border-border/80 dark:bg-card sm:p-5" data-onboarding="lead-profile">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <UserAvatar seed={lead.email || lead.nome} name={lead.nome} className="size-11 rounded-xl shrink-0" />

            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className={`truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl ${shouldMask ? "blur-[3px] select-none" : ""}`}>{lead.nome}</h1>
                  <Badge variant={lead.status === "lost" ? "destructive" : "outline"} className="capitalize">
                    {lead.status === "in_contact" ? "Em atendimento" : (LEAD_STATUS_LABELS as Record<string, string>)[lead.status] ?? lead.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Criado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(lead.createdAt)}</span>
                  <span>•</span>
                  <span>Unidade: <strong className="font-semibold text-foreground">{lead.branchNome ?? "Geral/Sem filial"}</strong></span>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5"><Phone className="size-3.5 shrink-0" />{canSeePersonalData ? <a className="truncate text-primary hover:underline" href={`tel:${lead.telefone.replace(/\D/g, "")}`}>{lead.telefone}</a> : maskedPhone}</span>
                  <span className="hidden text-border sm:inline">•</span>
                  <span className="inline-flex min-w-0 items-center gap-1.5"><Share className="size-[10px] shrink-0" />{canSeePersonalData && lead.email ? <a className="max-w-[220px] truncate text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : canSeePersonalData ? "Não informado" : maskedEmail}</span>
                  <span className="hidden text-border sm:inline">•</span>
                  <span className="inline-flex items-center gap-1.5"><Buildings className="size-3.5 shrink-0" />{lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook")}</span>
                  <span className="hidden text-border sm:inline">•</span>
                  <span className="inline-flex items-center gap-1.5"><UserPlus className="size-3.5 shrink-0" />{lead.corretorNome ?? "Aguardando distribuição"}</span>
                </div>
              </div>

              {/* Quick Header Actions */}
              <div id="lead-actions" className="flex flex-wrap items-center gap-2 sm:justify-end">
                {hasPermission(context.role, "acessar_conversas") ? (
                  <Button className="h-7 text-xs gap-1" render={<Link href={`/conversas?leadId=${lead.id}&draft=broker_intro`} />} variant="outline">
                    <ChatCircleText className="size-3.5 text-primary" />
                    Conversas
                  </Button>
                ) : null}
                {lead.status !== "distributed" && lead.qualificationState !== "QUALIFIED" && (!lead.qualificationStatus || ["pending", "qualifying"].includes(lead.qualificationStatus)) ? (
                  <StartQualificationButton leadId={lead.id} leadName={lead.nome} variant="outline" size="xs" />
                ) : null}
                {context.role === "director" ? <DeleteLeadControl leadId={lead.id} leadName={lead.nome} /> : null}
                {context.role === "broker" && context.userId === lead.corretorId && lead.status === "distributed" && (
                  <StartServiceButton leadId={lead.id} />
                )}
                <Badge className={slaUrgent ? "border-warning/30 bg-warning/[0.08] text-warning" : "border-border/80"} variant="outline">
                  {lead.status === "distributed" ? `SLA: ${remainingMinutes > 0 ? `expira em ${remainingMinutes}min` : "expirado"}` : "SLA em acompanhamento"}
                </Badge>
                {/* Render status selector if allowed */}
                {(lead.corretorId
                  ? (context.userId === lead.corretorId && lead.status !== "distributed")
                  : (context.role !== "broker")) ? (
                  <LeadStatusSelector leadId={lead.id} currentStatus={lead.status} role={context.role} isOwner={context.userId === lead.corretorId} isSameBranch={context.branchId === lead.branchId} documents={leadDocs.map((document) => ({ id: document.id, filename: document.filename, status: document.status }))} carriers={carriers} />
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {/* SLA Diagnostic & Loss Audit Card */}
        {lead.status === "lost" || lead.lossCategory ? (
          <Card className="border-destructive/30 bg-destructive/5 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">
                  {lead.lossCategory === "unattended_sla"
                    ? "Estouro de SLA"
                    : lead.lossCategory === "response_delay"
                      ? "Atraso no Atendimento"
                      : "Lead Perdido"}
                </Badge>
                <CardTitle className="text-sm font-semibold text-foreground">
                  {lead.lossCategory === "unattended_sla"
                    ? "Perda por Falta de Atendimento (SLA Expirado)"
                    : lead.lossCategory === "response_delay"
                      ? "Perda por Demora de Resposta"
                      : "Lead Encerrado sem Venda"}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                {lead.motivoPerda ? `Motivo: ${lead.motivoPerda}` : "Atendimento não iniciado a tempo ou sem resposta oportuna ao cliente."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {/* Main operational area */}
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <section className="min-w-0 space-y-5">
            {/* Dense operational content is organized in the tabs below. */}

            {/* Legacy quote block retained below in the Cotações tab. */}
            {/*
          {false && shouldShowQuotes && (
            <Card className="border-border bg-card shadow-sm" id="cotacao">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cotações</CardTitle>
                    <CardDescription className="text-xs font-normal">
                      {isManagement ? "Propostas montadas para o cliente (somente leitura)." : "Monte propostas e compartilhe com o cliente."}
                    </CardDescription>
                  </div>
                  {!isManagement && (
                    <QuoteBuilder
                      leadId={lead.id}
                      leadName={lead.nome}
                      leadPhone={canSeePersonalData ? lead.telefone : null}
                      beneficiaries={beneficiaries.map((b) => ({ id: b.id, name: b.name }))}
                      plans={plans.map((p) => ({ id: p.id, name: p.name }))}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {quotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhuma cotação criada ainda.
                  </p>
                ) : (
                  quotes.map((quote) => (
                    <QuoteCard
                      key={quote.id}
                      quote={quote}
                      leadName={lead.nome}
                      leadPhone={canSeePersonalData ? lead.telefone : null}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )}
          */}



            {(() => {
              const qualDetails = lead.qualificationDetails as { status?: string; score?: number } | null;
              const leadActionCtx: LeadActionContext = {
                id: lead.id,
                name: lead.nome,
                status: lead.status,
                qualificationStatus: qualDetails?.status ?? null,
                score: qualDetails?.score ?? null,
                phone: lead.telefone,
                hasSlaBreach: Boolean(lead.slaBreachedAt),
                documentsPendingCount: leadDocs.filter((d) => d.status === "pending" || d.status === "rejected").length,
                documentsApprovedCount: leadDocs.filter((d) => d.status === "approved").length,
                totalDocumentsRequired: leadDocs.length,
                hasCompletedSale: lead.status === "converted",
                firstContactCompleted: lead.status !== "new" && lead.status !== "distributed",
              };
              const leadNextBestAction = resolveLeadNextBestAction(leadActionCtx, context.role, context.jobTitle);
              return <NextBestActionCard action={leadNextBestAction} className="mb-4" />;
            })()}

            <Tabs defaultValue={defaultLeadTab} variant="segment" className="min-h-0 min-w-0 gap-5 overflow-hidden">
              <TabsList aria-label="Etapas do atendimento" id="tabs-lead-page" className="h-30 w-full py-8 max-w-full min-w-0 flex-row items-stretch gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-border/50 bg-muted/15 p-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-border/70 dark:bg-muted/20">
                <TabsTrigger value="service" className="min-w-[132px] flex-none justify-start px-3 py-2 text-left"><span className="flex flex-col items-start gap-0.5"><span>Atendimento</span><span className="text-[11px] font-normal text-muted-foreground">Contato inicial</span></span></TabsTrigger>
                <TabsTrigger value="documents" disabled={stageRank < 5} className="min-w-[132px] flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1">{stageRank < 5 ? <LockKey className="size-3.5 text-muted-foreground" /> : null}<span className="flex flex-col items-start gap-0.5"><span>Documentos {leadDocs.length > 0 ? `(${leadDocs.length})` : ""}</span><span className="text-[11px] font-normal text-muted-foreground">Análise cadastral</span></span></TabsTrigger>
                <TabsTrigger value="history" className="min-w-[132px] flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1"><span className="flex flex-col items-start gap-0.5"><span>Histórico</span><span className="text-[11px] font-normal text-muted-foreground">Linha do tempo</span></span></TabsTrigger>
                <TabsTrigger value="tasks" className="min-w-[132px] py-6 flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1"><span className="flex flex-col items-start gap-0.5"><span>Tarefas ({tasks.filter(t => !t.completedAt).length})</span><span className="text-[11px] font-normal text-muted-foreground">Próximas ações</span></span></TabsTrigger>
              </TabsList>

              <TabsContent value="service" className="mt-0 space-y-5">
                {isManagement && (
                  <SupervisionPanel
                    leadId={lead.id}
                    currentStatus={lead.status}
                    currentOwner={lead.corretorNome}
                    currentOwnerId={lead.corretorId}
                    assignedAt={lead.assignedAt}
                    stageEnteredAt={lead.stageEnteredAt}
                    serviceStartedAt={lead.serviceStartedAt}
                    brokers={brokers}
                    slaFirstContactMinutes={slaMinutes}
                    tasks={tasks}
                    isLost={lead.status === "lost"}
                    currentUserId={context.userId}
                  />
                )}
                {!isManagement && (
                  <LeadActionHub
                    hasPendingDocuments={leadDocs.some((document) => document.status === "pending" || document.status === "rejected")}
                    leadId={lead.id}
                    currentOwner={lead.corretorNome}
                    nextTask={(() => { const task = tasks.find((item) => !item.completedAt); return task ? { title: task.title, dueAt: task.dueAt?.toISOString() ?? null, priority: task.priority, assigneeName: task.assigneeName } : null; })()}
                    status={lead.status}
                    isOwner={context.userId === lead.corretorId}
                    phone={canSeePersonalData ? lead.telefone : null}
                    canSeePersonalData={canSeePersonalData}
                    canAccessConversas={
                      hasPermission(context.role, "acessar_conversas") && brokerInternalChatEnabled
                    }
                    showFeedback={context.role === "broker" && context.userId === lead.corretorId && lead.status !== "lost" && lead.status !== "converted"}
                  />
                )}
                <div className="rounded-lg border border-border/50 bg-muted/15 px-4 py-3 text-sm text-muted-foreground dark:border-border/70 dark:bg-muted/20">
                  Esta é a etapa atual. As próximas etapas são liberadas conforme o status do lead avança.
                </div>

                <Card className="border-amber-500/20 bg-amber-500/5 shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                          Qualificação por Agente de IA
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Ideal para leads antigos ou importados. Clique para disparar o template oficial de qualificação no WhatsApp.
                        </CardDescription>
                      </div>
                      <StartQualificationButton leadId={lead.id} leadName={lead.nome} variant="default" size="sm" />
                    </div>
                  </CardHeader>
                </Card>
                {(qualificationDetails.numberOfLives || qualificationDetails.averageAge || qualificationDetails.individualAges) && (
                  <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Dados da qualificação</CardTitle>
                      <CardDescription>Dados coletados pelo agente, separados entre atendimento individual e empresarial.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                      <div><p className="text-xs text-muted-foreground">Vidas</p><p className="mt-1 font-medium">{qualificationDetails.numberOfLives ?? "Não informado"}</p></div>
                      {lead.tipo === "PME" ? (
                        <div><p className="text-xs text-muted-foreground">Média de idade do grupo</p><p className="mt-1 font-medium">{qualificationDetails.averageAge ? `${qualificationDetails.averageAge} anos` : "Não informada"}</p></div>
                      ) : (
                        <div><p className="text-xs text-muted-foreground">Idades informadas</p><p className="mt-1 font-medium">{qualificationDetails.individualAges ?? "Não informadas"}</p></div>
                      )}
                      <div><p className="text-xs text-muted-foreground">Tipo de atendimento</p><p className="mt-1 font-medium">{lead.tipo === "PME" ? "Empresa / PME" : "Pessoa física"}</p></div>
                    </CardContent>
                  </Card>
                )}
                {/* ── Dados adicionais do formulário (PF / PME) ──────────────── */}
                {(lead.tipo === "PF" && (formData.dependentes || formData.mediaIdades)) && (
                  <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Dados informados no cadastro</CardTitle>
                      <CardDescription>Informações adicionais coletadas durante a criação do lead.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                      {formData.dependentes && (
                        <div><p className="text-xs text-muted-foreground">Dependentes</p><p className="mt-1 font-medium">{formData.dependentes}</p></div>
                      )}
                      {formData.mediaIdades && (
                        <div><p className="text-xs text-muted-foreground">Média de idades</p><p className="mt-1 font-medium">{formData.mediaIdades} anos</p></div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {(lead.tipo === "PME" && (formData.razaoSocial || formData.cnpj || formData.funcionarios)) && (
                  <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Dados da empresa (PME)</CardTitle>
                      <CardDescription>Informações da pessoa jurídica contratante.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                      {formData.razaoSocial && (
                        <div><p className="text-xs text-muted-foreground">Razão social</p><p className="mt-1 font-medium">{formData.razaoSocial}</p></div>
                      )}
                      {formData.cnpj && (
                        <div><p className="text-xs text-muted-foreground">CNPJ</p><p className="mt-1 font-medium">{formData.cnpj}</p></div>
                      )}
                      {formData.funcionarios && (
                        <div><p className="text-xs text-muted-foreground">Funcionários</p><p className="mt-1 font-medium">{formData.funcionarios}</p></div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {/* ── Origem Meta Ads ──────────────── */}
                {(lead.origem === "webhook" || lead.sourceCampaign || lead.metaCampaignId) && (
                  <Card className="border-primary/20 bg-primary/5 shadow-none">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">f</span>
                        <CardTitle className="text-sm font-bold">Origem Meta Ads</CardTitle>
                      </div>
                      <CardDescription className="text-xs">Rastreabilidade completa do anúncio até este lead.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-xs sm:grid-cols-3 pt-2">
                      <div><p className="text-muted-foreground">Origem</p><p className="font-semibold text-foreground mt-0.5">Meta Ads (Lead Ads / Click to WhatsApp)</p></div>
                      <div><p className="text-muted-foreground">Campanha</p><p className="font-semibold text-foreground mt-0.5">{lead.sourceCampaign || "Campanha Meta"}</p></div>
                      <div><p className="text-muted-foreground">Anúncio</p><p className="font-semibold text-foreground mt-0.5">{lead.sourceAd || "Anúncio Padrão"}</p></div>
                      <div><p className="text-muted-foreground">Formulário</p><p className="font-semibold text-foreground mt-0.5">{lead.sourceForm || "Formulário Direct"}</p></div>
                      <div><p className="text-muted-foreground font-medium">Data de Captura</p><p className="font-mono text-foreground mt-0.5">{lead.capturedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(lead.capturedAt) : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(lead.createdAt)}</p></div>
                    </CardContent>
                  </Card>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                  <PersonRecordDetails kind="lead" createdAt={lead.createdAt} consentimentoLgpd={lead.consentimentoLgpd} dependents={beneficiaries} documentCount={leadDocs.length} formData={formData} />
                  <BeneficiariesSection leadId={lead.id} contactName={lead.nome} initialBeneficiaries={beneficiaries} />
                </div>
                {hasPermission(context.role, "acessar_conversas") ? (
                  <LeadChat leadId={lead.id} phone={canSeePersonalData ? lead.telefone : null} />
                ) : null}
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card" id="documentos">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documentação do atendimento</CardTitle>
                    <CardDescription className="text-xs">Anexe documentos opcionais por titular ou beneficiário. A aprovação é acompanhada pela fila central de Documentos.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <LeadDocumentsSection leadId={lead.id} requirements={requirements} documents={leadDocs} checklist={checklist} beneficiaries={beneficiaries.map((beneficiary) => ({ id: beneficiary.id, name: beneficiary.name, isHolder: beneficiary.isHolder }))} />
                  </CardContent>
                </Card>


              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card" data-onboarding="lead-timeline">
                  <CardContent className="pt-6">
                    <LeadTimeline leadId={lead.id} interactions={interactions} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4" id="tarefas">
                <Card className="border-border/60 bg-card/80 shadow-none dark:border-border dark:bg-card" data-onboarding="create-follow-up">
                  <CardContent className="pt-6">
                    <LeadTasks assignees={context.role === "broker" ? [{ id: context.userId, name: lead.corretorNome ?? "Eu" }] : brokers} leadId={lead.id} tasks={tasks.map((task) => ({ ...task, dueAt: task.dueAt?.toISOString() ?? null, completedAt: task.completedAt?.toISOString() ?? null }))} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Info & Actions Grid — contact, management, beneficiaries */}
            <div className="hidden">
              {/* About Contact Info Card */}
              <Card className="border-border/80 bg-card shadow-none">
                <CardHeader className="border-b border-border/60 pb-3">
                  <CardTitle className="text-sm font-semibold">Contato e contexto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Phone className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Telefone</p>
                      <p className={`mt-0.5 text-sm font-medium text-foreground ${shouldMask ? "blur-[3px] select-none" : ""}`}>
                        {canSeePersonalData ? (
                          <a className="text-primary hover:underline font-semibold" href={`tel:${lead.telefone.replace(/\D/g, "")}`}>{lead.telefone}</a>
                        ) : maskedPhone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail</p>
                      <p className={`mt-0.5 text-sm font-medium text-foreground ${shouldMask ? "blur-[3px] select-none" : ""}`}>
                        {canSeePersonalData && lead.email ? (
                          <a className="text-primary hover:underline font-semibold" href={`mailto:${lead.email}`}>{lead.email}</a>
                        ) : canSeePersonalData ? "Não informado" : maskedEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Share className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origem do Lead</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <UserPlus className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Lead</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{lead.tipo === "PME" ? "PME (Pessoa Jurídica)" : "PF (Pessoa Física)"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Buildings className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unidade / Filial</p>
                      <p className="mt-0.5 text-sm font-semibold text-primary">{lead.branchNome ?? "Geral/Sem filial"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <UserPlus className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsável</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{lead.corretorNome ?? "Aguardando distribuição"}</p>
                    </div>
                  </div>

                  {lead.motivoPerda && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                      <p className="font-semibold uppercase tracking-wider text-[10px]">Motivo da Perda</p>
                      <p className="mt-1 font-medium">{lead.motivoPerda}</p>
                    </div>
                  )}

                  {!canSeePersonalData && (
                    <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-muted-foreground leading-relaxed">
                      O telefone e o e-mail serão liberados somente quando você iniciar o atendimento. Essa ação registra sua responsabilidade pelo lead.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Person Details (management actions now in SupervisionPanel above) */}
              <div className="space-y-4">
                <PersonRecordDetails kind="lead" createdAt={lead.createdAt} consentimentoLgpd={lead.consentimentoLgpd} dependents={beneficiaries} documentCount={leadDocs.length} />
              </div>

              {/* Beneficiaries */}
              <div className="space-y-4">
                <BeneficiariesSection leadId={lead.id} contactName={lead.nome} initialBeneficiaries={beneficiaries} />
              </div>
            </div>

            {/* Hidden legacy composition kept out of the operational surface. */}
            {false && <LeadChat phone={canSeePersonalData ? lead.telefone : null} />}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <Card className="border-border/60 bg-card/80 shadow-none dark:border-border/80 dark:bg-card">
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="text-sm font-semibold">Dados do lead</CardTitle>
                <CardDescription className="text-xs">Informações sempre visíveis durante o atendimento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Phone className="size-4" /></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Telefone</p><p className={`mt-0.5 truncate text-sm font-medium ${shouldMask ? "blur-[3px] select-none" : ""}`}>{canSeePersonalData ? <a className="font-semibold text-primary hover:underline" href={`tel:${lead.telefone.replace(/\D/g, "")}`}>{lead.telefone}</a> : maskedPhone}</p></div></div>
                <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Clock className="size-4" /></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail</p><p className={`mt-0.5 truncate text-sm font-medium ${shouldMask ? "blur-[3px] select-none" : ""}`}>{canSeePersonalData && lead.email ? <a className="font-semibold text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : canSeePersonalData ? "Não informado" : maskedEmail}</p></div></div>
                <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Share className="size-4" /></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origem</p><p className="mt-0.5 text-sm font-medium">{lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook")}</p></div></div>
                <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Buildings className="size-4" /></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unidade</p><p className="mt-0.5 text-sm font-semibold text-primary">{lead.branchNome ?? "Geral/Sem filial"}</p></div></div>
                <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UserPlus className="size-4" /></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsável</p><p className="mt-0.5 text-sm font-medium">{lead.corretorNome ?? "Aguardando distribuição"}</p></div></div>
                {lead.motivoPerda && <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"><p className="font-semibold uppercase tracking-wider text-[10px]">Motivo da perda</p><p className="mt-1 font-medium">{lead.motivoPerda}</p></div>}
                {!canSeePersonalData && <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-muted-foreground">O telefone e o e-mail serão liberados quando você iniciar o atendimento.</div>}
              </CardContent>
            </Card>
          </aside>
        </div>

      </main>
    </>
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "••••";
  return `${local.slice(0, 1)}${"•".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

function readQualificationDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, string | null>;
  const details = value as Record<string, unknown>;
  const read = (key: string) => typeof details[key] === "string" ? details[key] : null;
  return {
    numberOfLives: read("numberOfLives"),
    averageAge: read("averageAge"),
    individualAges: read("individualAges"),
  };
}

function readFormData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, string | null>;
  const data = value as Record<string, unknown>;
  return {
    dependentes: typeof data.dependentes === "string" ? data.dependentes : null,
    mediaIdades: typeof data.mediaIdades === "string" ? data.mediaIdades : null,
    razaoSocial: typeof data.razaoSocial === "string" ? data.razaoSocial : null,
    cnpj: typeof data.cnpj === "string" ? data.cnpj : null,
    funcionarios: typeof data.funcionarios === "string" ? data.funcionarios : null,
  };
}
