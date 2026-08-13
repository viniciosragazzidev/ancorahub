import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPrivateCarrierAction, createPrivatePlanAction, createPrivatePriceTableAction } from "@/features/global-catalog/actions";
import { CatalogActionForm } from "@/features/global-catalog/components/catalog-action-form";
import { CatalogStatusBadge } from "@/features/global-catalog/components/catalog-status-badge";
import { getTenantPrivateCatalogData } from "@/features/global-catalog/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function TenantPrivateCatalogPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const { enabled, carriers, plans } = await getTenantPrivateCatalogData(context);

  return (
    <>
      <DashboardHeader breadcrumb="Administração / Catálogo" title="Catálogo interno" />
      <main className="flex min-h-full flex-col gap-6 p-4 lg:p-6">
        {!enabled ? (
          <Card className="border-warning/30 bg-warning/5 shadow-none">
            <CardContent className="p-4 text-sm">
              O Super-admin desativou temporariamente o catálogo interno. Seus dados históricos continuam preservados.
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader>
              <CardTitle>Nova operadora interna</CardTitle>
              <CardDescription>Use para um acordo que não deve aparecer para outras corretoras.</CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogActionForm action={createPrivateCarrierAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end" submitLabel="Criar operadora">
                <label className="grid gap-1.5 text-sm">
                  <span>Nome</span>
                  <Input name="name" required />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span>ANS</span>
                  <Input name="ansCode" />
                </label>
              </CatalogActionForm>
            </CardContent>
          </Card>

          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader>
              <CardTitle>Novo plano interno</CardTitle>
              <CardDescription>O plano fica disponível somente na operação desta corretora.</CardDescription>
            </CardHeader>
            <CardContent>
              <CatalogActionForm action={createPrivatePlanAction} className="grid gap-3 sm:grid-cols-2" submitLabel="Criar plano">
                <label className="grid gap-1.5 text-sm">
                  <span>Operadora</span>
                  <AppSelect
                    name="carrierId"
                    required
                    placeholder="Selecione uma operadora..."
                    options={carriers.map((carrier) => ({ value: carrier.id, label: carrier.name }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span>Nome</span>
                  <Input name="name" required />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span>Tipo</span>
                  <AppSelect
                    name="type"
                    defaultValue="individual"
                    options={[
                      { value: "individual", label: "Individual" },
                      { value: "familiar", label: "Familiar" },
                      { value: "empresarial", label: "Empresarial" },
                      { value: "pme", label: "PME" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span>Abrangência</span>
                  <Input name="coverage" />
                </label>
                <label className="col-span-full grid gap-1.5 text-sm">
                  <span>Descrição <span className="text-muted-foreground">(opcional)</span></span>
                  <Input name="description" placeholder="Breve descrição do plano, coberturas e diferenciais..." />
                </label>
              </CatalogActionForm>
            </CardContent>
          </Card>
        </section>

        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader>
            <CardTitle>Publicar tabela interna</CardTitle>
            <CardDescription>A tabela publicada é uma versão comercial. Uma alteração futura deve gerar uma nova versão, sem substituir esta.</CardDescription>
          </CardHeader>
          <CardContent>
            <CatalogActionForm action={createPrivatePriceTableAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end" submitLabel="Publicar tabela">
              <label className="grid gap-1.5 text-sm">
                <span>Plano</span>
                <AppSelect
                  name="planId"
                  required
                  placeholder="Selecione um plano..."
                  options={plans.map((plan) => ({ value: plan.id, label: `${plan.carrierName} — ${plan.name}` }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span>Tabela</span>
                <Input name="name" required />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span>Faixa</span>
                <Input defaultValue="0-18" name="ageBand" required />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span>Valor mensal</span>
                <Input min="0.01" name="monthlyPrice" required step="0.01" type="number" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span>Vigência inicial</span>
                <Input name="effectiveFrom" required type="date" />
              </label>
            </CatalogActionForm>
          </CardContent>
        </Card>

        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader>
            <CardTitle>Itens privados cadastrados</CardTitle>
            <CardDescription>Somente registros deste tenant. As alterações geram auditoria e não afetam o catálogo oficial.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Operadora</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="pr-5">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="pl-5 font-medium">{plan.carrierName}</TableCell>
                    <TableCell>{plan.name}</TableCell>
                    <TableCell className="capitalize">{plan.type}</TableCell>
                    <TableCell className="pr-5"><CatalogStatusBadge status={plan.active} /></TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell className="p-6 text-center text-sm text-muted-foreground" colSpan={4}>Ainda não há planos internos.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">{carriers.length} operadora(s) e {plans.length} plano(s) interno(s) <Badge className="ml-2" variant="outline">Isolado por corretora</Badge></p>
      </main>
    </>
  );
}
