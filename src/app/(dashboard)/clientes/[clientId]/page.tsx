import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadTimeline } from "@/features/leads/components/lead-timeline";
import { getLeadTimeline } from "@/features/leads/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { Phone, Clock, Buildings, CalendarCheck, ShieldCheck, FileText, CurrencyCircleDollar, ArrowRight } from "@/components/huge-icons";
import { LeadDocumentsSection } from "@/features/documents/components/lead-documents-section";
import { getRequirementsForLead, getLeadDocuments, getLeadDocumentChecklist } from "@/features/documents/actions";
import { getLeadBeneficiaries } from "@/features/post-sale/queries";
import { CustomerRenewalStatus } from "@/features/post-sale/components/customer-renewal-status";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";

import { buildClientScopeWhere } from "@/features/customers/customer-authorization";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Fetch client with related data
  const [client] = await db
    .select({
      id: schema.clients.id,
      leadId: schema.clients.leadId,
      name: schema.clients.nome,
      phone: schema.clients.telefone,
      email: schema.clients.email,
      convertedAt: schema.clients.convertedAt,
      createdAt: schema.clients.createdAt,
      branchId: schema.clients.branchId,
      corretorId: schema.clients.corretorId,
      brokerName: schema.user.name,
      branchName: schema.branches.name,
    })
    .from(schema.clients)
    .leftJoin(schema.user, eq(schema.clients.corretorId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.clients.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.clients.id, clientId),
        buildClientScopeWhere(context),
      ),
    )
    .limit(1);

  if (!client) notFound();

  // Fetch related data in parallel
  const [lead, sales, activeCustomer, interactions, requirements, leadDocs, checklist, beneficiaries] = await Promise.all([
    // Lead info
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        status: schema.leads.status,
        createdAt: schema.leads.createdAt,
        origem: schema.leads.origem,
        consentimentoLgpd: schema.leads.consentimentoLgpd,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, client.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // Sales for this client (by clientId or leadId)
    db
      .select({
        id: schema.sales.id,
        saleValue: schema.sales.saleValue,
        approvedValue: schema.sales.approvedValue,
        policyNumber: schema.sales.policyNumber,
        coverageStartDate: schema.sales.coverageStartDate,
        saleDate: schema.sales.saleDate,
        status: schema.sales.status,
        notes: schema.sales.notes,
        planName: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
        brokerName: schema.user.name,
        createdAt: schema.sales.createdAt,
      })
      .from(schema.sales)
      .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .leftJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
      .where(
        and(
          eq(schema.sales.tenantId, context.tenantId),
          eq(schema.sales.clientId, client.id),
        ),
      )
      .orderBy(desc(schema.sales.createdAt)),

    // Active customer / renewal info
    db
      .select({
        id: schema.activeCustomers.id,
        status: schema.activeCustomers.status,
        coverageStartDate: schema.activeCustomers.coverageStartDate,
        contractAnniversary: schema.activeCustomers.contractAnniversary,
        expirationDate: schema.activeCustomers.expirationDate,
        renewalStatus: schema.activeCustomers.renewalStatus,
        renewalNotes: schema.activeCustomers.renewalNotes,
        cancellationDate: schema.activeCustomers.cancellationDate,
        cancellationReason: schema.activeCustomers.cancellationReason,
        createdAt: schema.activeCustomers.createdAt,
      })
      .from(schema.activeCustomers)
      .where(
        and(
          eq(schema.activeCustomers.tenantId, context.tenantId),
          eq(schema.activeCustomers.clientId, client.id),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // Timeline
    getLeadTimeline(client.leadId),

    // Documents
    getRequirementsForLead(client.leadId),
    getLeadDocuments(client.leadId),
    getLeadDocumentChecklist(client.leadId),

    // Beneficiaries
    getLeadBeneficiaries(client.leadId),
  ]);

  const totalSalesValue = sales.reduce((sum, s) => sum + parseFloat(s.saleValue || "0"), 0);
  const renewalDate = activeCustomer?.expirationDate ?? activeCustomer?.contractAnniversary;
  const anniversarySoon = renewalDate
    ? (() => {
      const today = new Date();
      const anniversary = new Date(`${renewalDate}T00:00:00`);
      const diffDays = Math.ceil((anniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays;
    })()
    : null;

  const anniversaryIsUpcoming = anniversarySoon !== null && anniversarySoon >= 0 && anniversarySoon <= 45;

  return (
    <>
      <DashboardHeader
        breadcrumb="Pós-venda"
        title={client.name}
      />
      <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        {/* Profile Cover & Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-chart-2/10 via-chart-2/5 to-transparent border-b border-border/40" />
          <div className="relative px-6 pb-6 pt-4">
            <UserAvatar seed={client.email || client.name} name={client.name} size="lg" className="absolute -top-10 left-6 size-20 rounded-2xl border-4 border-card shadow-sm" />
            <div className="flex flex-col gap-4 pl-0 pt-10 sm:flex-row sm:items-end sm:justify-between sm:pl-24 sm:pt-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">{client.name}</h1>
                  <Badge variant={activeCustomer?.status === "cancelled" ? "destructive" : "success"} className="rounded-full">
                    {activeCustomer?.status === "cancelled" ? "Cliente cancelado" : "Cliente ativo"}
                  </Badge>
                  {anniversaryIsUpcoming && (
                    <Badge variant="warning" className="rounded-full">
                      Renovação em {anniversarySoon} dias
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Convertido em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(client.convertedAt)}</span>
                  {client.branchName && (
                    <>
                      <span>•</span>
                      <span>Unidade: <strong className="font-semibold text-foreground">{client.branchName}</strong></span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" render={<Link href={`/leads/${client.leadId}`} />}>
                  <ArrowRight className="size-3.5" />
                  Ver lead original
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CARD INFORMATIVO PÓS-VENDA ─── */}
        <Card className="border border-border/80 bg-card p-4 sm:p-5 shadow-2xs rounded-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  Próxima Ação Pós-Venda
                </span>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {anniversaryIsUpcoming
                  ? `Iniciar renovação de apólice (faltam ${anniversarySoon} dias)`
                  : "Cliente ativo com suporte pós-venda em dia"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {anniversaryIsUpcoming
                  ? "Envie uma proposta de renovação antecipada para garantir retenção de carteira."
                  : "Acompanhe as apólices, tarefas de relacionamento e histórico comercial deste cliente."}
              </p>
            </div>
            {hasPermission(context.role, "acessar_conversas") ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" className="h-9 px-4 text-xs font-semibold gap-1.5" render={<Link href={`/conversas?leadId=${client.leadId}`} />}>
                  Enviar Mensagem Pós-Venda <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </Card>

        {/* 2-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-[24rem_1fr] items-start">
          {/* Left Column: About, Sales Summary, Renewal */}
          <div className="space-y-6">
            {/* About Contact Info */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Sobre o cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Telefone</p>
                    <a className="mt-0.5 block text-sm font-medium text-primary hover:underline" href={`tel:${client.phone.replace(/\D/g, "")}`}>
                      {client.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail</p>
                    {client.email ? (
                      <a className="mt-0.5 block text-sm font-medium text-primary hover:underline" href={`mailto:${client.email}`}>
                        {client.email}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted-foreground">Não informado</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <Buildings className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unidade / Filial</p>
                    <p className="mt-0.5 text-sm font-semibold text-primary">{client.branchName ?? "Sem filial"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsável</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{client.brokerName ?? "Não informado"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <PersonRecordDetails kind="client" createdAt={client.createdAt} consentimentoLgpd={lead?.consentimentoLgpd ?? false} dependents={beneficiaries} documentCount={leadDocs.length} />

            {/* Sales Summary Card */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumo financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                  <span className="text-xs text-muted-foreground">Total em vendas</span>
                  <span className="text-lg font-semibold tabular-nums text-success">
                    {totalSalesValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Vendas registradas</span>
                  <span className="font-medium tabular-nums">{sales.length}</span>
                </div>
                {activeCustomer && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status do contrato</span>
                    <Badge variant={activeCustomer.status === "active" ? "success" : "destructive"} className="rounded-full text-[10px]">
                      {activeCustomer.status === "active" ? "Ativo" : "Cancelado"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Renewal / Coverage Card */}
            {activeCustomer && (
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="border-b border-border/40 pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <CalendarCheck className="mr-1.5 size-3.5 text-warning" />
                    Vigência e renovação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Início da vigência</span>
                    <span className="font-medium tabular-nums">
                      {new Intl.DateTimeFormat("pt-BR").format(new Date(`${activeCustomer.coverageStartDate}T00:00:00`))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Aniversário do contrato</span>
                    <span className="font-medium tabular-nums">
                      {new Intl.DateTimeFormat("pt-BR").format(new Date(`${activeCustomer.contractAnniversary}T00:00:00`))}
                    </span>
                  </div>
                  {anniversarySoon !== null && (
                    <div className={`rounded-lg px-3 py-2 text-xs ${anniversaryIsUpcoming ? "bg-accent/10 text-warning" : "bg-muted/30 text-muted-foreground"}`}>
                      {anniversaryIsUpcoming
                        ? `Renovação em ${anniversarySoon} dia${anniversarySoon !== 1 ? "s" : ""}`
                        : anniversarySoon < 0
                          ? `Vencido há ${Math.abs(anniversarySoon)} dias`
                          : `Próxima renovação em ${anniversarySoon} dias`}
                    </div>
                  )}
                  {activeCustomer.status === "cancelled" && activeCustomer.cancellationDate && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                      <p className="font-semibold uppercase tracking-wider text-[10px]">Cancelamento</p>
                      <p className="mt-1">
                        Cancelado em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${activeCustomer.cancellationDate}T00:00:00`))}
                      </p>
                      {activeCustomer.cancellationReason && (
                        <p className="mt-0.5 text-muted-foreground">Motivo: {activeCustomer.cancellationReason}</p>
                      )}
                    </div>
                  )}
                  <CustomerRenewalStatus
                    activeCustomerId={activeCustomer.id}
                    initialStatus={activeCustomer.renewalStatus}
                    initialNotes={activeCustomer.renewalNotes}
                    disabled={activeCustomer.status === "cancelled"}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Tabs with Sales, Documents, Timeline */}
          <div className="space-y-6">
            <Tabs defaultValue="sales" className="min-h-0">
              <TabsList
                aria-label="Seções do cliente"
                className="w-full snap-x snap-mandatory flex-nowrap justify-start overflow-x-auto border-b border-border/40 pb-px"
                variant="line"
              >
                <TabsTrigger className="min-h-(--mobile-touch-target) shrink-0 snap-start" value="sales">
                  <CurrencyCircleDollar className="size-3.5" />
                  Vendas ({sales.length})
                </TabsTrigger>
                <TabsTrigger className="min-h-(--mobile-touch-target) shrink-0 snap-start" value="documents">
                  <FileText className="size-3.5" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger className="min-h-(--mobile-touch-target) shrink-0 snap-start" value="timeline">
                  Linha do Tempo
                </TabsTrigger>
              </TabsList>

              {/* Sales Tab */}
              <TabsContent value="sales" className="mt-4 space-y-4">
                {sales.length > 0 ? (
                  sales.map((sale) => (
                    <Card key={sale.id} className="border-border/70 bg-card shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CurrencyCircleDollar className="size-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">Venda</CardTitle>
                          </div>
                          <Badge
                            variant={sale.status === "active" ? "success" : "destructive"}
                            className="rounded-full text-[10px]"
                          >
                            {sale.status === "active" ? "Ativa" : "Cancelada"}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Registrada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(sale.saleDate)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-muted-foreground">Valor</p>
                            <p className="font-semibold tabular-nums text-foreground">
                              {parseFloat(sale.saleValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                          {sale.policyNumber && (
                            <div>
                              <p className="text-muted-foreground">Apólice</p>
                              <p className="font-medium text-foreground">{sale.policyNumber}</p>
                            </div>
                          )}
                          {sale.carrierName && (
                            <div>
                              <p className="text-muted-foreground">Operadora</p>
                              <p className="font-medium text-foreground">{sale.carrierName}</p>
                            </div>
                          )}
                          {sale.planName && (
                            <div>
                              <p className="text-muted-foreground">Plano</p>
                              <p className="font-medium text-foreground">{sale.planName}</p>
                            </div>
                          )}
                        </div>
                        {sale.notes && (
                          <div className="mt-2 rounded-lg bg-muted/20 px-3 py-2 text-muted-foreground">
                            {sale.notes}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            render={<Link href={`/vendas/${sale.id}`} />}
                          >
                            Ver detalhes
                            <ArrowRight className="size-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center">
                    <CurrencyCircleDollar className="size-6 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">Nenhuma venda registrada</p>
                    <p className="text-xs text-muted-foreground">As vendas deste cliente aparecerão aqui.</p>
                  </div>
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="mt-4">
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Documentos
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Documentos vinculados ao lead original e aprovados na conversão.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <LeadDocumentsSection
                      leadId={client.leadId}
                      clientId={client.id}
                      requirements={requirements}
                      documents={leadDocs}
                      checklist={checklist}
                      beneficiaries={beneficiaries.map((b) => ({ id: b.id, name: b.name, isHolder: b.isHolder }))}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="mt-4">
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="pt-6">
                    {interactions && interactions.length > 0 ? (
                      <LeadTimeline leadId={client.leadId} interactions={interactions} />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                        <p className="text-sm font-medium text-foreground">Nenhuma interação registrada</p>
                        <p className="text-xs text-muted-foreground">O histórico de interações deste cliente aparecerá aqui.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </>
  );
}
