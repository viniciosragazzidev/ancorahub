import { and, eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsappLogo } from "@/components/huge-icons";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getDatabase, schema } from "@/shared/db";
import { MinhaContaTab } from "./_components/minha-conta-tab";
import { EmpresaTab } from "./_components/empresa-tab";
import { IntegrationsTab } from "./_components/integrations-tab";
import { SecurityTab } from "./_components/security-tab";
import { SettingsTabs, type TabId } from "./_components/settings-tabs";
import { UnitTab } from "./_components/unit-tab";
import { FeedbackTab } from "./_components/feedback-tab";
import { getIntegrationsData } from "./integrations-actions";
import { ExtensionTab } from "./extension/extension-tab";
import { getBrokerAvailabilityProfile } from "@/features/broker-availability/service";
import { BrokerAvailabilitySettings } from "@/features/broker-availability/components/broker-availability-settings";

import { RelatedActions } from "@/components/related-actions";

export default async function SettingsPage() {
  const context = await getRequiredTenantContext();
  const canViewIntegrations = context.role === "director" || await hasEffectiveCapability({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null, permission: "ver_importacoes_meta" });
  const db = getDatabase();
  const [tenant, user] = await Promise.all([
    db.select({ name: schema.tenants.name, legalName: schema.tenants.legalName, cnpj: schema.tenants.cnpj, logoUrl: schema.tenants.logoUrl, brandColor: schema.tenants.brandColor }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    db.select({ name: schema.user.name, email: schema.user.email, twoFactorEnabled: schema.user.twoFactorEnabled }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
  ]);
  const membership = context.branchId
    ? await db.select({ id: schema.branches.id, name: schema.branches.name, status: schema.branches.status, acceptingLeads: schema.branches.acceptingLeads, autoDistribute: schema.branches.autoDistribute, createdAt: schema.branches.createdAt }).from(schema.branches).where(and(eq(schema.branches.id, context.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1)
    : [];
  const [tenantData] = await db.select({
    feedbackReminderIntervalMinutes: schema.tenants.feedbackReminderIntervalMinutes,
    feedbackReminderMaxAttempts: schema.tenants.feedbackReminderMaxAttempts,
    feedbackPushEnabled: schema.tenants.feedbackPushEnabled,
    feedbackToastEnabled: schema.tenants.feedbackToastEnabled,
    feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled,
    maxActiveLeadsLimit: schema.tenants.maxActiveLeadsLimit,
  }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);

  const integrations = canViewIntegrations ? await getIntegrationsData() : null;
  const brokerAvailability = context.role === "broker" ? await getBrokerAvailabilityProfile(context) : null;
  const tabIds: TabId[] = context.role === "director" ? ["conta", "empresa", "unidade", "atendimento", "whatsapp", "integracoes", "seguranca", "extensao"] : canViewIntegrations ? ["conta", "integracoes", "whatsapp", "seguranca", "extensao"] : context.role === "manager" ? ["conta", "unidade", "atendimento", "whatsapp", "seguranca", "extensao"] : ["conta", "disponibilidade", "whatsapp", "seguranca", "extensao"];

  const canEditFeedback = context.role === "director" || context.role === "manager";
  const atendimento = canEditFeedback ? (
    <div className="space-y-6">
      <FeedbackTab
        feedbackReminderInterval={tenantData?.feedbackReminderIntervalMinutes ?? "30"}
        feedbackReminderMaxAttempts={tenantData?.feedbackReminderMaxAttempts ?? 5}
        feedbackPushEnabled={tenantData?.feedbackPushEnabled ?? true}
        feedbackToastEnabled={tenantData?.feedbackToastEnabled ?? true}
        feedbackRequiredEnabled={tenantData?.feedbackRequiredEnabled ?? true}
        maxActiveLeadsLimit={tenantData?.maxActiveLeadsLimit ?? 10}
        canEdit={context.role === "director"}
      />
    </div>
  ) : undefined;

  const whatsapp = <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>WhatsApp pessoal de atendimento</CardTitle><CardDescription>Conecte somente o número usado por você. A conexão é isolada por usuário e não altera a identidade da corretora.</CardDescription></CardHeader><CardContent><Button render={<a href="/integrations/whatsapp" />}><WhatsappLogo /> Configurar meu WhatsApp</Button></CardContent></Card>;
  const account = <MinhaContaTab name={user[0]?.name ?? "Usuário"} email={user[0]?.email ?? ""} role={context.role} />;
  const company = <EmpresaTab canEdit tenant={{ name: tenant[0]?.name ?? "", legalName: tenant[0]?.legalName ?? null, cnpj: tenant[0]?.cnpj ?? null, logoUrl: tenant[0]?.logoUrl ?? null, brandColor: tenant[0]?.brandColor ?? null }} />;
  const extension = <ExtensionTab />;

  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Parâmetros do Sistema" />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <SettingsTabs
          account={account}
          company={context.role === "director" ? company : undefined}
          unit={<UnitTab branch={membership[0] ? { id: membership[0].id, name: membership[0].name, status: membership[0].status, acceptingLeads: membership[0].acceptingLeads, autoDistribute: membership[0].autoDistribute, createdAt: membership[0].createdAt } : null} currentRole={context.role} />}
          availability={brokerAvailability ? <BrokerAvailabilitySettings windows={brokerAvailability.windows} schemaReady={brokerAvailability.availabilitySchemaReady} /> : undefined}
          atendimento={atendimento}
          whatsapp={whatsapp}
          integrations={integrations ? <IntegrationsTab branches={integrations.branches} integrations={integrations.integrations} /> : undefined}
          security={<SecurityTab enabled={user[0]?.twoFactorEnabled ?? false} email={user[0]?.email ?? "sua conta"} />}
          extension={extension}
          tabIds={tabIds}
        />

        {context.role !== "broker" && (
          <RelatedActions
            title="Configurações Relacionadas"
            description="Navegação rápida para parâmetros avançados e módulos."
            links={[
              { label: "Qualificação & Robô IA", href: "/qualificacao", description: "Prompt, WhatsApp Diagnóstico e MCP" },
              { label: "Equipe & Corretores", href: "/equipe", description: "Convites de usuários e permissões" },
              { label: "Regras de Distribuição", href: "/leads?tab=distribuicao", description: "Roleta de atendimento e prioridades" },
              { label: "Guia & Manual do Sistema", href: "/guia", description: "Tours e definições de domínio" },
            ]}
          />
        )}
      </div>
    </>
  );
}
