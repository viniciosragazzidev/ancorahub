import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { ChecklistClient } from "./checklist-client";
import { CheckCircle } from "@/components/huge-icons";

export const dynamic = "force-dynamic";

const finalStages = ["negotiation", "documentation_pending", "under_analysis"] as const;

export default async function ChecklistPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Leads in final stages (pre-conversion)
  const scope = context.role === "broker"
    ? eq(schema.leads.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : undefined;

  const preConversionLeads = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      email: schema.leads.email,
      status: schema.leads.status,
      planId: schema.leads.planId,
      corretorId: schema.leads.corretorId,
      corretorNome: schema.user.name,
      branchName: schema.branches.name,
      stageEnteredAt: schema.leads.stageEnteredAt,
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.status, finalStages),
        ...(scope ? [scope] : []),
      ),
    )
    .orderBy(desc(schema.leads.stageEnteredAt))
    .limit(50);

  // Converted leads in the last 30 days (post-sale)
  const thirtyDaysAgo = sql`now() - interval '30 days'`;
  const convertedLeads = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      corretorNome: schema.user.name,
      branchName: schema.branches.name,
      stageEnteredAt: schema.leads.stageEnteredAt,
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.status, "converted"),
        ...(scope ? [scope] : []),
        sql`${schema.leads.stageEnteredAt} >= ${thirtyDaysAgo}`,
      ),
    )
    .orderBy(desc(schema.leads.stageEnteredAt))
    .limit(50);

  const allLeadIds = [...preConversionLeads, ...convertedLeads].map((l) => l.id);

  if (!allLeadIds.length) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação" title="Checklist de fechamento" />
        <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
          <section className="flex flex-col items-center gap-4 py-20 text-center">
            <CheckCircle className="size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Nada pendente</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Nenhum lead em etapa de fechamento ou convertido nos últimos 30 dias no seu escopo.
            </p>
          </section>
        </main>
      </>
    );
  }

  // ─── Fetch validation data ───

  // Documents per lead
  const docRows = allLeadIds.length
    ? await db
        .select({
          leadId: schema.leadDocuments.leadId,
          status: schema.leadDocuments.status,
        })
        .from(schema.leadDocuments)
        .where(
          and(
            eq(schema.leadDocuments.tenantId, context.tenantId),
            inArray(schema.leadDocuments.leadId, allLeadIds),
          ),
        )
    : [];
  const docsByLead = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
  for (const doc of docRows) {
    const entry = docsByLead.get(doc.leadId) ?? { total: 0, approved: 0, pending: 0, rejected: 0 };
    entry.total++;
    if (doc.status === "approved") entry.approved++;
    else if (doc.status === "pending") entry.pending++;
    else if (doc.status === "rejected") entry.rejected++;
    docsByLead.set(doc.leadId, entry);
  }

  // Sales / commission per lead
  const saleRows = allLeadIds.length
    ? await db
        .select({
          leadId: schema.sales.leadId,
          id: schema.sales.id,
          commissionRuleId: schema.sales.commissionRuleId,
        })
        .from(schema.sales)
        .where(
          and(
            eq(schema.sales.tenantId, context.tenantId),
            inArray(schema.sales.leadId, allLeadIds),
          ),
        )
    : [];
  const salesByLead = new Map<string, { hasSale: boolean; hasCommission: boolean }>();
  for (const s of saleRows) {
    salesByLead.set(s.leadId, { hasSale: true, hasCommission: !!s.commissionRuleId });
  }

  // ─── Build enriched data ───
  const preChecklist = preConversionLeads.map((lead) => {
    const docs = docsByLead.get(lead.id);
    const sale = salesByLead.get(lead.id);

    const hasPlan = !!lead.planId;
    const hasEmail = !!lead.email;
    const docsApproved = (docs?.approved ?? 0) > 0;
    const docsPending = (docs?.pending ?? 0) > 0;
    const hasCommission = sale?.hasCommission ?? false;

    const items = [
      { label: "Plano selecionado", ok: hasPlan, hint: hasPlan ? (lead.planId ?? "") : "Selecione um plano" },
      { label: "E-mail do cliente", ok: hasEmail, hint: hasEmail ? (lead.email ?? "") : "Informe o e-mail" },
      { label: "Documentos aprovados", ok: docsApproved, hint: docsApproved ? `${docs!.approved} aprovado(s)` : `${docs?.pending ?? 0} pendente(s)` },
      { label: "Comissão configurada", ok: hasCommission, hint: hasCommission ? "Sim" : "Configure a comissão" },
    ];

    const checked = items.filter((i) => i.ok).length;
    const total = items.length;
    const ready = checked === total;

    return {
      id: lead.id,
      nome: lead.nome,
      status: lead.status,
      corretorNome: lead.corretorNome,
      branchName: lead.branchName,
      stageEnteredAt: lead.stageEnteredAt.toISOString(),
      type: "pre" as const,
      items,
      checked,
      total,
      ready,
      docsPending,
    };
  });

  const postChecklist = convertedLeads.map((lead) => {
    const docs = docsByLead.get(lead.id);
    const sale = salesByLead.get(lead.id);

    const docsApproved = (docs?.approved ?? 0) > 0;
    const hasSale = sale?.hasSale ?? false;
    const hasCommission = sale?.hasCommission ?? false;

    const hintDocsApproved = docsApproved ? `${(docs?.approved ?? 0)} aprovado(s)` : `${(docs?.pending ?? 0)} pendente(s)`;
    const items = [
      { label: "Cliente cadastrado", ok: true, hint: "Convertido" },
      { label: "Venda registrada", ok: hasSale, hint: hasSale ? "Sim" : "Registre a venda" },
      { label: "Documentos aprovados", ok: docsApproved, hint: hintDocsApproved },
      { label: "Comissão configurada", ok: hasCommission, hint: hasCommission ? "Sim" : "Verifique a comissão" },
    ];

    const checked = items.filter((i) => i.ok).length;
    const total = items.length;
    const ready = checked === total;

    return {
      id: lead.id,
      nome: lead.nome,
      status: lead.status,
      corretorNome: lead.corretorNome,
      branchName: lead.branchName,
      stageEnteredAt: lead.stageEnteredAt.toISOString(),
      type: "post" as const,
      items,
      checked,
      total,
      ready,
      docsPending: (docs?.pending ?? 0) > 0,
    };
  });

  return (
    <>
      <DashboardHeader breadcrumb="Operação" title="Checklist de fechamento" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">VALIDAÇÃO</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Checklist de fechamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Valide cliente, plano, documentos, cotação, responsável e comissão antes e depois da conversão.
            </p>
          </div>
        </section>

        <ChecklistClient preItems={preChecklist} postItems={postChecklist} />
      </main>
    </>
  );
}
