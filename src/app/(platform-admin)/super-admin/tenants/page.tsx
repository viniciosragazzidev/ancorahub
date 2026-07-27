import Link from "next/link";
import { getPlatformTenants } from "@/features/platform-admin/service";
import { createTenantAction, setTenantStatusAction } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { CreateTenantForm } from "@/features/platform-admin/components/create-tenant-form";

const statusLabel = {
  active: "Ativo",
  inactive: "Inativo",
  delinquent: "Inadimplente",
} as const;

export default async function SuperAdminTenantsPage() {
  const tenants = await getPlatformTenants();

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Empresas Parceiras" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Gestão de Empresas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre novas corretoras e altere o status de ativação da licença de uso.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Corretoras cadastradas</CardTitle>
              <CardDescription>{tenants.length} empresa(s) registradas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="pl-5">
                        <Link className="font-semibold hover:text-primary transition-colors text-xs" href={`/super-admin/tenants/${tenant.id}`}>
                          {tenant.name}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR").format(tenant.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">{tenant.cnpj ?? "—"}</TableCell>
                      <TableCell className="text-xs">{tenant.subscriptionPlan}</TableCell>
                      <TableCell>
                        {tenant.status === "active" ? (
                          <Badge variant="success" className="text-[10px]">{statusLabel[tenant.status]}</Badge>
                        ) : tenant.status === "delinquent" ? (
                          <Badge variant="warning" className="text-[10px]">{statusLabel[tenant.status]}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{statusLabel[tenant.status]}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <form action={setTenantStatusAction}>
                          <input name="tenantId" type="hidden" value={tenant.id} />
                          <input
                            name="status"
                            type="hidden"
                            value={tenant.status === "active" ? "inactive" : "active"}
                          />
                          <Button size="xs" variant="ghost">
                            {tenant.status === "active" ? "Desativar" : "Ativar"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none h-fit">
            <CardHeader>
              <CardTitle>Nova empresa</CardTitle>
              <CardDescription>Registre uma nova corretora.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateTenantForm action={createTenantAction}>
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs">Razão social / Nome fantasia</Label>
                  <Input name="name" id="name" required className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="legalName" className="text-xs">Razão social</Label>
                  <Input name="legalName" id="legalName" required className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cnpj" className="text-xs">CNPJ</Label>
                  <Input name="cnpj" id="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="slug" className="text-xs">Subdomínio / Slug único</Label>
                  <Input name="slug" id="slug" required className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="plan" className="text-xs">Plano de Licença</Label>
                  <select
                    name="subscriptionPlan"
                    id="plan"
                    className="h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  >
                    <option value="starter">Iniciante (Starter)</option>
                    <option value="growth">Crescimento (Growth)</option>
                    <option value="enterprise">Corporativo (Enterprise)</option>
                  </select>
                </div>
                <Button size="sm" type="submit" className="w-full text-xs font-semibold h-8 mt-2">
                  Criar Empresa
                </Button>
              </CreateTenantForm>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
