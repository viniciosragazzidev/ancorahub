import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPrivateCarrierAction, createPrivatePlanAction, createPrivatePriceTableAction } from "@/features/global-catalog/actions";
import { CatalogActionForm } from "@/features/global-catalog/components/catalog-action-form";
import { CatalogStatusBadge } from "@/features/global-catalog/components/catalog-status-badge";
import { getTenantPrivateCatalogData } from "@/features/global-catalog/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

const selectClassName = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function TenantPrivateCatalogPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");
  const { enabled, carriers, plans } = await getTenantPrivateCatalogData(context);

  return (
    <>
      <DashboardHeader breadcrumb="Administração / Catálogo" title="Catálogo interno" />
      <main className="flex min-h-full flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-primary">ACORDOS EXCLUSIVOS</p>
          <h1 className="text-2xl font-semibold tracking-tight">Operadoras e planos da sua corretora</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">Cadastre apenas condições comerciais exclusivas. Elas ficam isoladas da plataforma e do catálogo oficial, mas usam o mesmo padrão de vigência e auditoria.</p>
        </section>

        {!enabled ? <Card className="border-warning/30 bg-warning/5 shadow-none"><CardContent className="p-4 text-sm">O Super-admin desativou temporariamente o catálogo interno. Seus dados históricos continuam preservados.</CardContent></Card> : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Nova operadora interna</CardTitle><CardDescription>Use para um acordo que não deve aparecer para outras corretoras.</CardDescription></CardHeader><CardContent><CatalogActionForm action={createPrivateCarrierAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end" submitLabel="Criar operadora"><label className="grid gap-1.5 text-sm"><span>Nome</span><Input name="name" required /></label><label className="grid gap-1.5 text-sm"><span>ANS</span><Input name="ansCode" /></label></CatalogActionForm></CardContent></Card>
          <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Novo plano interno</CardTitle><CardDescription>O plano fica disponível somente na operação desta corretora.</CardDescription></CardHeader><CardContent><CatalogActionForm action={createPrivatePlanAction} className="grid gap-3 sm:grid-cols-2" submitLabel="Criar plano"><label className="grid gap-1.5 text-sm"><span>Operadora</span><select className={selectClassName} defaultValue="" name="carrierId" required><option disabled value="">Selecione</option>{carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}</select></label><label className="grid gap-1.5 text-sm"><span>Nome</span><Input name="name" required /></label><label className="grid gap-1.5 text-sm"><span>Tipo</span><select className={selectClassName} defaultValue="individual" name="type"><option value="individual">Individual</option><option value="familiar">Familiar</option><option value="empresarial">Empresarial</option><option value="pme">PME</option></select></label><label className="grid gap-1.5 text-sm"><span>Abrangência</span><Input name="coverage" /></label><label className="col-span-full grid gap-1.5 text-sm"><span>Descrição <span className="text-muted-foreground">(opcional)</span></span><Input name="description" placeholder="Breve descrição do plano, coberturas e diferenciais..." /></label></CatalogActionForm></CardContent></Card>
        </section>

        <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Publicar tabela interna</CardTitle><CardDescription>A tabela publicada é uma versão comercial. Uma alteração futura deve gerar uma nova versão, sem substituir esta.</CardDescription></CardHeader><CardContent><CatalogActionForm action={createPrivatePriceTableAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end" submitLabel="Publicar tabela"><label className="grid gap-1.5 text-sm"><span>Plano</span><select className={selectClassName} defaultValue="" name="planId" required><option disabled value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.carrierName} — {plan.name}</option>)}</select></label><label className="grid gap-1.5 text-sm"><span>Tabela</span><Input name="name" required /></label><label className="grid gap-1.5 text-sm"><span>Faixa</span><Input defaultValue="0-18" name="ageBand" required /></label><label className="grid gap-1.5 text-sm"><span>Valor mensal</span><Input min="0.01" name="monthlyPrice" required step="0.01" type="number" /></label><label className="grid gap-1.5 text-sm"><span>Vigência inicial</span><Input name="effectiveFrom" required type="date" /></label></CatalogActionForm></CardContent></Card>

        <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Itens privados cadastrados</CardTitle><CardDescription>Somente registros deste tenant. As alterações geram auditoria e não afetam o catálogo oficial.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="pl-5">Operadora</TableHead><TableHead>Plano</TableHead><TableHead>Tipo</TableHead><TableHead className="pr-5">Estado</TableHead></TableRow></TableHeader><TableBody>{plans.map((plan) => <TableRow key={plan.id}><TableCell className="pl-5 font-medium">{plan.carrierName}</TableCell><TableCell>{plan.name}</TableCell><TableCell className="capitalize">{plan.type}</TableCell><TableCell className="pr-5"><CatalogStatusBadge status={plan.active} /></TableCell></TableRow>)}{plans.length === 0 ? <TableRow><TableCell className="p-6 text-center text-sm text-muted-foreground" colSpan={4}>Ainda não há planos internos.</TableCell></TableRow> : null}</TableBody></Table></CardContent></Card>
        <p className="text-xs text-muted-foreground">{carriers.length} operadora(s) e {plans.length} plano(s) interno(s) <Badge className="ml-2" variant="outline">Isolado por corretora</Badge></p>
      </main>
    </>
  );
}
