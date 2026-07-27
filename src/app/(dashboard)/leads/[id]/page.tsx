import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
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
import { getDatabase, schema } from "@/shared/db";
import { StartServiceButton } from "./start-service-button";
import { SupervisionPanel } from "./supervision-panel";
import { CotarButton } from "./cotar-button";

import { getRequirementsForLead, getLeadDocuments, getLeadDocumentChecklist } from "@/features/documents/actions";
import { LeadDocumentsSection } from "@/features/documents/components/lead-documents-section";
import { LeadActionHub } from "@/features/leads/components/lead-action-hub";

import { BeneficiariesSection } from "./beneficiaries-section";
import { getLeadBeneficiaries } from "@/features/post-sale/queries";
import { maskPhone, maskName } from "@/features/quotes/utils";
import { Phone, Clock, Share, Buildings, UserPlus, LockKey } from "@/components/huge-icons";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";

function getCurrentTimestamp() {
  return Date.now();
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {


  const { id } = await params;
  const context = await getRequiredTenantContext();
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
      tipo: schema.leads.tipo,
      status: schema.leads.status,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
      planId: schema.leads.planId,
      motivoPerda: schema.leads.motivoPerda,
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
      scopeFilter,
    ))
    .limit(1);

  if (!lead) notFound();
  const slaMinutes = Number((await getDatabase().select({ minutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1))[0]?.minutes ?? 15);
  const elapsedMinutes = Math.max(0, Math.round((getCurrentTimestamp() - lead.stageEnteredAt.getTime()) / 60000));
  const remainingMinutes = Math.max(0, slaMinutes - elapsedMinutes);
  const slaUrgent = remainingMinutes <= Math.max(5, Math.round(slaMinutes * 0.25));

  const [interactions, tasks, requirements, leadDocs, checklist, beneficiaries, carriers] = await Promise.all([
    getLeadTimeline(id),
    getDatabase().select({ id: schema.leadTasks.id, title: schema.leadTasks.title, description: schema.leadTasks.description, priority: schema.leadTasks.priority, dueAt: schema.leadTasks.dueAt, completedAt: schema.leadTasks.completedAt, createdAt: schema.leadTasks.createdAt, assignedTo: schema.leadTasks.assignedTo, assigneeName: schema.user.name })
      .from(schema.leadTasks).leftJoin(schema.user, eq(schema.leadTasks.assignedTo, schema.user.id)).where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, id)))
      .orderBy(schema.leadTasks.completedAt, schema.leadTasks.dueAt, schema.leadTasks.createdAt),
    getRequirementsForLead(id),
    getLeadDocuments(id),
    getLeadDocumentChecklist(id),
    getLeadBeneficiaries(id),
    getDatabase().select({ id: schema.carriers.id, name: schema.carriers.name })
      .from(schema.carriers)
      .where(and(eq(schema.carriers.tenantId, context.tenantId), eq(schema.carriers.status, "active")))
      .orderBy(schema.carriers.name),
  ]);

  if (!interactions) notFound();


  const brokers = (context.role === "manager" || context.role === "director") && lead.branchId
    ? await getDatabase().select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.branchId, lead.branchId!), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true)))
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
      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 bg-background p-4 lg:p-6">

        {/* Profile Cover & Header Card */}
        <div className="rounded-xl border border-border/80 bg-card px-4 py-4 shadow-none sm:px-5">
          {/* Subtle brand color cover warning */}
          <div className="hidden" />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            {/* Avatar overlapping cover */}
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
                  <span className="inline-flex min-w-0 items-center gap-1.5"><Share className="size-3.5 shrink-0" />{canSeePersonalData && lead.email ? <a className="max-w-[220px] truncate text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : canSeePersonalData ? "Não informado" : maskedEmail}</span>
                  <span className="hidden text-border sm:inline">•</span>
                  <span className="inline-flex items-center gap-1.5"><Buildings className="size-3.5 shrink-0" />{lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook")}</span>
                  <span className="hidden text-border sm:inline">•</span>
                  <span className="inline-flex items-center gap-1.5"><UserPlus className="size-3.5 shrink-0" />{lead.corretorNome ?? "Aguardando distribuição"}</span>
                </div>
              </div>

              {/* Quick Header Actions */}
              <div id="lead-actions" className="flex flex-wrap items-center gap-2 sm:justify-end">
                {context.role === "broker" && context.userId === lead.corretorId && lead.status === "distributed" && (
                  <StartServiceButton leadId={lead.id} />
                )}
                {lead.status !== "distributed" && (
                  <CotarButton />
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
        </div>

        {/* Main operational area */}
        <div className="min-w-0 space-y-5">
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



          <Tabs defaultValue={defaultLeadTab} orientation="horizontal" className="min-h-0 min-w-0 gap-4 overflow-hidden md:grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-5">
            <TabsList aria-label="Etapas do atendimento" className="h-auto w-full max-w-full min-w-0 flex-row items-stretch gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-border/70 bg-muted/20 p-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:h-fit md:flex-col md:overflow-visible md:[scrollbar-width:auto]" variant="line">
              <TabsTrigger value="service" className="min-w-[132px] flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1"><span className="flex flex-col items-start gap-0.5"><span>Atendimento</span><span className="text-[11px] font-normal text-muted-foreground">Contato inicial</span></span></TabsTrigger>
              <TabsTrigger value="documents" disabled={stageRank < 5} className="min-w-[132px] flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1">{stageRank < 5 ? <LockKey className="size-3.5 text-muted-foreground" /> : null}<span className="flex flex-col items-start gap-0.5"><span>Documentos {leadDocs.length > 0 ? `(${leadDocs.length})` : ""}</span><span className="text-[11px] font-normal text-muted-foreground">Análise cadastral</span></span></TabsTrigger>
              <TabsTrigger value="history" className="min-w-[132px] flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1"><span className="flex flex-col items-start gap-0.5"><span>Histórico</span><span className="text-[11px] font-normal text-muted-foreground">Linha do tempo</span></span></TabsTrigger>
              <TabsTrigger value="tasks" className="min-w-[132px] flex-none justify-start px-3 py-2 text-left md:w-full md:min-w-0 md:flex-1"><span className="flex flex-col items-start gap-0.5"><span>Tarefas ({tasks.filter(t => !t.completedAt).length})</span><span className="text-[11px] font-normal text-muted-foreground">Próximas ações</span></span></TabsTrigger>
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
                  showFeedback={context.role === "broker" && context.userId === lead.corretorId && lead.status !== "lost" && lead.status !== "converted"}
                />
              )}
              <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Esta é a etapa atual. As próximas etapas são liberadas conforme o status do lead avança.
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <PersonRecordDetails kind="lead" createdAt={lead.createdAt} consentimentoLgpd={lead.consentimentoLgpd} dependents={beneficiaries} documentCount={leadDocs.length} />
                <BeneficiariesSection leadId={lead.id} contactName={lead.nome} initialBeneficiaries={beneficiaries} />
              </div>
              <LeadChat phone={canSeePersonalData ? lead.telefone : null} />
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card className="border-border bg-card shadow-sm" id="documentos">
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
              <Card className="border-border bg-card shadow-sm">
                <CardContent className="pt-6">
                  <LeadTimeline leadId={lead.id} interactions={interactions} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4" id="tarefas">
              <Card className="border-border bg-card shadow-sm">
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

          {false && <aside className="space-y-4 xl:sticky xl:top-24">
            <Card className="border-border/80 bg-card shadow-none">
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
          </aside>}
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

