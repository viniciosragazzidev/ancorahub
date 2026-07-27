import { notFound } from "next/navigation";
import Link from "next/link";
import { createTenantAccessAction } from "../../actions";
import { CreateTenantAccessForm } from "../../../super-admin/tenants/[tenantId]/_components/create-tenant-access-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformTenant, getTenantBranches, getTenantMembers } from "@/features/platform-admin/service";
import { ArrowRight } from "@/components/huge-icons";

const roleLabel = { director: "Diretor", manager: "Gestor", broker: "Corretor" } as const;

export default async function SuperDevTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [tenant, members, branches] = await Promise.all([
    getPlatformTenant(tenantId),
    getTenantMembers(tenantId),
    getTenantBranches(tenantId),
  ]);

  if (!tenant) notFound();

  return (
    <>
      <PlatformAdminHeader breadcrumb="Super administração / Empresas" title={tenant.name} />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Link className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" href="/super-dev/tenants">
          <ArrowRight className="size-3.5 rotate-180" /> Voltar para Empresas
        </Link>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>{tenant.name}</CardTitle>
                <CardDescription>{tenant.legalName ?? "Razão social não informada"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="mt-1 text-sm font-medium">{tenant.cnpj ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <p className="mt-1 text-sm font-medium">{tenant.subscriptionPlan}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className="mt-1" variant={tenant.status === "active" ? "success" : "outline"}>
                    {tenant.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Filiais cadastradas</CardTitle>
                <CardDescription>Estrutura territorial da corretora.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Nome</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="pl-5 font-medium text-xs">{branch.name}</TableCell>
                        <TableCell>
                          <Badge variant={branch.status === "active" ? "success" : "outline"} className="text-[10px]">
                            {branch.status === "active" ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Membros com acesso</CardTitle>
                <CardDescription>Visão geral dos colaboradores vinculados a esta corretora.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead className="pr-5">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="pl-5 font-semibold text-xs">{member.name}</TableCell>
                        <TableCell className="text-xs">{member.email}</TableCell>
                        <TableCell className="text-xs">{roleLabel[member.role]}</TableCell>
                        <TableCell className="text-xs">{member.branchName ?? "—"}</TableCell>
                        <TableCell className="pr-5">
                          <Badge variant={member.status === "active" ? "outline" : "secondary"} className="text-[10px]">
                            {member.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card shadow-none h-fit">
            <CardHeader>
              <CardTitle>Criar acesso inicial</CardTitle>
              <CardDescription>Crie o primeiro usuário/administrador da corretora.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateTenantAccessForm
                action={createTenantAccessAction}
                branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
                tenantId={tenant.id}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
