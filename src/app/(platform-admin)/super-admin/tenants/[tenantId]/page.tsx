import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  createTenantAccessAction,
  resetTenantOperationalDataAction,
  setTenantStatusAction,
  updateCleanUiOperationalLegacyTenantAction,
  updateMetaLeadAdsPilotAction,
  updateTenantCustomRolesPilotAction,
} from "../../actions";
import { CreateTenantAccessForm } from "./_components/create-tenant-access-form";
import { ResetTenantDataCard } from "./_components/reset-tenant-data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformTenant, getTenantBranches, getTenantMembers } from "@/features/platform-admin/service";
import { ArrowRight } from "@/components/huge-icons";
import { getSystemSettings } from "@/features/system-settings/queries";
import { CLEAN_UI_FEATURE, getCleanUiOperationalLegacyTenantIds } from "@/features/clean-ui/feature";
import { getMetaLeadAdsPilotTenantIds } from "@/features/communication-channels/meta-lead-ads-platform";
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";

const roleLabel = { director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor" } as const;

type MissingRelationError = { code?: string; cause?: { code?: string } };

function isMissingCustomRolesSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as MissingRelationError;
  return databaseError.code === "42P01" || databaseError.cause?.code === "42P01";
}

async function getCustomRolesPilotState(tenantId: string) {
  try {
    const [setting] = await getDatabase()
      .select({ enabled: schema.tenantCustomRoleSettings.enabled })
      .from(schema.tenantCustomRoleSettings)
      .where(eq(schema.tenantCustomRoleSettings.tenantId, tenantId))
      .limit(1);

    return { available: true, enabled: setting?.enabled === true };
  } catch (error) {
    if (isMissingCustomRolesSchema(error)) return { available: false, enabled: false };
    throw error;
  }
}

function operationalState(globalEnabled: boolean, tenantEnabled: boolean) {
  if (globalEnabled && tenantEnabled) return { label: "Disponível", variant: "success" as const };
  if (tenantEnabled) return { label: "Aguardando liberação global", variant: "warning" as const };
  return { label: "Não liberado", variant: "outline" as const };
}

export default async function SuperAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId: rawTenantId } = await params;
  const tenantId = z.string().uuid().safeParse(rawTenantId);
  if (!tenantId.success) notFound();

  const [tenant, members, branches, settings, metaLeadAdsPilotTenantIds, cleanUiLegacyTenantIds, customRolesPilot] = await Promise.all([
    getPlatformTenant(tenantId.data),
    getTenantMembers(tenantId.data),
    getTenantBranches(tenantId.data),
    getSystemSettings([
      "feature_meta_lead_ads_enabled",
      CLEAN_UI_FEATURE,
      "feature_custom_roles_enabled",
    ]),
    getMetaLeadAdsPilotTenantIds(),
    getCleanUiOperationalLegacyTenantIds(),
    getCustomRolesPilotState(tenantId.data),
  ]);

  if (!tenant) notFound();

  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const metaLeadAdsGlobalEnabled = settingMap.get("feature_meta_lead_ads_enabled") === "true";
  const cleanUiGlobalEnabled = settingMap.get(CLEAN_UI_FEATURE) !== "false";
  const customRolesGlobalEnabled = settingMap.get("feature_custom_roles_enabled") === "true";
  const metaLeadAdsPilotEnabled = metaLeadAdsPilotTenantIds.includes(tenant.id);
  const usingLegacyLayout = cleanUiLegacyTenantIds.includes(tenant.id);
  const metaLeadAdsState = operationalState(metaLeadAdsGlobalEnabled, metaLeadAdsPilotEnabled);
  const customRolesState = operationalState(customRolesGlobalEnabled, customRolesPilot.enabled);
  const metaLeadAdsAction = updateMetaLeadAdsPilotAction.bind(null, tenant.id);
  const cleanUiAction = updateCleanUiOperationalLegacyTenantAction.bind(null, tenant.id);
  const customRolesAction = updateTenantCustomRolesPilotAction.bind(null, tenant.id);

  return (
    <>
      <PlatformAdminHeader breadcrumb="Super administração / Empresas" title={tenant.name} />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Link className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" href="/super-admin/tenants">
          <ArrowRight className="size-3.5 rotate-180" /> Voltar para Empresas
        </Link>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
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
                <p className="text-xs text-muted-foreground">Situação</p>
                <Badge className="mt-1" variant={tenant.status === "active" ? "success" : "outline"}>
                  {tenant.status === "active" ? "Ativa" : "Inativa"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Licença da empresa</CardTitle>
              <CardDescription>Interromper o acesso não apaga dados, integrações ou histórico.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={setTenantStatusAction} className="flex flex-wrap items-center justify-between gap-3">
                <input name="tenantId" type="hidden" value={tenant.id} />
                <input name="status" type="hidden" value={tenant.status === "active" ? "inactive" : "active"} />
                <span className="text-sm text-muted-foreground">{tenant.status === "active" ? "A empresa pode acessar o CRM." : "O acesso da empresa está suspenso."}</span>
                <Button type="submit" variant={tenant.status === "active" ? "outline" : "default"}>
                  {tenant.status === "active" ? "Suspender acesso" : "Reativar acesso"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="tenant-controls-title" className="space-y-4">
          <div>
            <h2 id="tenant-controls-title" className="text-lg font-semibold tracking-tight">Pilotos e permissões</h2>
            <p className="mt-1 text-sm text-muted-foreground">Estas liberações valem somente para {tenant.name}. Regras globais continuam em Configurações da plataforma.</p>
          </div>

          <Card>
            <CardContent className="divide-y divide-border p-0">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">Facebook Lead Ads</h3>
                    <Badge variant={metaLeadAdsState.variant}>{metaLeadAdsState.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Libera o Diretor para descobrir e conectar Páginas autorizadas em Integrações Meta.</p>
                  {!metaLeadAdsGlobalEnabled && <p className="mt-2 text-xs text-warning">O piloto pode ser preparado agora, mas só funciona quando o Lead Ads global estiver ativo.</p>}
                </div>
                <form action={metaLeadAdsAction}>
                  <input name="enabled" type="hidden" value={metaLeadAdsPilotEnabled ? "false" : "true"} />
                  <Button type="submit" variant={metaLeadAdsPilotEnabled ? "outline" : "default"}>
                    {metaLeadAdsPilotEnabled ? "Remover do piloto" : "Liberar Lead Ads"}
                  </Button>
                </form>
              </div>

              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">Nova interface operacional</h3>
                    <Badge variant={usingLegacyLayout ? "warning" : "success"}>{usingLegacyLayout ? "Layout anterior" : "Layout novo"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Define se esta empresa usa a experiência nova ou retorna temporariamente ao layout anterior.</p>
                  {!cleanUiGlobalEnabled && <p className="mt-2 text-xs text-warning">A interface nova está desligada globalmente; esta preferência será aplicada quando ela for reativada.</p>}
                </div>
                <form action={cleanUiAction}>
                  <input name="enabled" type="hidden" value={usingLegacyLayout ? "false" : "true"} />
                  <Button type="submit" variant={usingLegacyLayout ? "default" : "outline"}>
                    {usingLegacyLayout ? "Usar interface nova" : "Usar layout anterior"}
                  </Button>
                </form>
              </div>

              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">Cargos personalizados</h3>
                    <Badge variant={customRolesState.variant}>{customRolesPilot.available ? customRolesState.label : "Indisponível"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Permite ao Diretor configurar cargos delegáveis sem alterar os papéis protegidos do sistema.</p>
                  {!customRolesGlobalEnabled && customRolesPilot.available && <p className="mt-2 text-xs text-warning">O piloto pode ser preparado agora, mas depende da liberação global de cargos personalizados.</p>}
                  {!customRolesPilot.available && <p className="mt-2 text-xs text-warning">A estrutura de cargos ainda não está disponível neste ambiente.</p>}
                </div>
                {customRolesPilot.available && (
                  <form action={customRolesAction}>
                    <input name="enabled" type="hidden" value={customRolesPilot.enabled ? "false" : "true"} />
                    <Button type="submit" variant={customRolesPilot.enabled ? "outline" : "default"}>
                      {customRolesPilot.enabled ? "Remover do piloto" : "Liberar piloto"}
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardHeader>
              <CardTitle>Membros com acesso</CardTitle>
              <CardDescription>Logins vinculados a esta corretora e seus papéis atuais.</CardDescription>
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
                      <TableCell className="pl-5 text-xs font-semibold">{member.name}</TableCell>
                      <TableCell className="text-xs">{member.email}</TableCell>
                      <TableCell className="text-xs">{roleLabel[member.role]}</TableCell>
                      <TableCell className="text-xs">{member.branchName ?? "—"}</TableCell>
                      <TableCell className="pr-5"><Badge variant={member.status === "active" ? "success" : "outline"} className="text-[10px]">{member.status === "active" ? "Ativo" : "Inativo"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Nenhum membro cadastrado para esta empresa.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Filiais</CardTitle>
                <CardDescription>{branches.length > 0 ? branches.map((branch) => branch.name).join(", ") : "Nenhuma filial cadastrada."}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Adicionar acesso</CardTitle>
                <CardDescription>Cria um login inicial vinculado a esta empresa.</CardDescription>
              </CardHeader>
              <CardContent>
                <CreateTenantAccessForm action={createTenantAccessAction} branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))} tenantId={tenant.id} />
              </CardContent>
            </Card>

            <ResetTenantDataCard action={resetTenantOperationalDataAction} tenantId={tenant.id} tenantName={tenant.name} />
          </div>
        </section>
      </main>
    </>
  );
}
