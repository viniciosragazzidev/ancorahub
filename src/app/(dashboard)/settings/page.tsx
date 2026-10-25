import { AccessibilityPreferences } from "@/features/assist/components/accessibility-preferences";
import { and, count, eq, inArray } from "drizzle-orm";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { ManagerLiteSettingsFooter, ManagerLiteSettingsHeader, ManagerLiteUnitSection } from "@/features/manager-workspace/manager-lite-settings-parts";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";

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
import { AiStageModeCard } from "@/features/conversation-intelligence/components/ai-stage-mode-card";
import { getAiStageMode } from "@/features/conversation-intelligence/stage-mode";
import { getIntegrationsData } from "./integrations-actions";
import { ExtensionTab } from "./extension/extension-tab";
import { getBrokerAvailabilityProfile } from "@/features/broker-availability/service";
import { BrokerAvailabilitySettings } from "@/features/broker-availability/components/broker-availability-settings";
import { LightAvailabilitySection } from "@/features/broker-availability/components/light-availability-section";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightSettings } from "./_components/light-settings";
import { LightWhatsappSection } from "./_components/light-whatsapp-section";

import { RelatedActions } from "@/components/related-actions";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { SupervisorLiteSettings } from "@/features/supervisor-workspace/supervisor-lite-settings";
import { RankingPreferences } from "@/features/journey/ranking-preferences";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import type { LightSettingsSection } from "./_components/light-settings";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import litePage from "@/components/lite/page/lite-page.module.css";
import compat from "@/components/lite/page/lite-compat.module.css";
import { LiteRelatedLinks } from "@/components/lite/page/related-links";
import { SettingsLite, type SettingsLiteSection } from "./_components/lite/settings-lite";
import { AccountLite } from "./_components/lite/account-lite";
import { EmpresaLite } from "./_components/lite/empresa-lite";
import { UnitLite, WhatsappLite } from "./_components/lite/unit-lite";
import { FeedbackLite, StageModeLite } from "./_components/lite/atendimento-lite";
import { IntegrationsLite } from "./_components/lite/integrations-lite";
import { SecurityLite } from "./_components/lite/security-lite";
import { ExtensionLite } from "./_components/lite/extension-lite";

export default async function SettingsPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "supervisor" && (await getLiteAudience(context)) === "supervisor") {
    const [user] = await getDatabase().select({ name: schema.user.name, image: schema.user.image }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1);
    const [branch] = context.branchId ? await getDatabase().select({ name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.id, context.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1) : [];
    const [team] = await getDatabase().select({ name: schema.supervisorTeams.name, imageUrl: schema.supervisorTeams.imageUrl }).from(schema.supervisorTeams).where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), eq(schema.supervisorTeams.supervisorId, context.userId))).limit(1).catch(() => []);
    return <SupervisorLiteSettings user={{ name: user?.name ?? "Supervisor", image: user?.image ?? null }} branchName={branch?.name ?? null} team={team ?? null} />;
  }
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
  const aiStageMode = context.role === "director" ? await getAiStageMode(context.tenantId) : null;
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
      {aiStageMode ? <AiStageModeCard initialMode={aiStageMode} /> : null}
    </div>
  ) : undefined;

  const whatsapp = <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>WhatsApp pessoal de atendimento</CardTitle><CardDescription>Conecte somente o número usado por você. A conexão é isolada por usuário e não altera a identidade da corretora.</CardDescription></CardHeader><CardContent><Button render={<a href="/integrations/whatsapp" />}><WhatsappLogo /> Configurar meu WhatsApp</Button></CardContent></Card>;
  const account = <MinhaContaTab name={user[0]?.name ?? "Usuário"} email={user[0]?.email ?? ""} role={context.role} />;
  const company = <EmpresaTab canEdit tenant={{ name: tenant[0]?.name ?? "", legalName: tenant[0]?.legalName ?? null, cnpj: tenant[0]?.cnpj ?? null, logoUrl: tenant[0]?.logoUrl ?? null, brandColor: tenant[0]?.brandColor ?? null }} />;
  const extension = <ExtensionTab />;

  // Manager Lite: personal settings plus their own unit, read only (rules and queues stay with the director).
  if (context.role === "manager" && (await getLiteAudience(context)) === "manager") {
    const unitScope = await getManagerUnitScope(context);
    const [[whatsappConnection], [profile], unitCounts] = await Promise.all([
      db.select({ status: schema.whatsappConnections.status }).from(schema.whatsappConnections)
        .where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1),
      db.select({ image: schema.user.image }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
      unitScope
        ? db.select({ role: schema.tenantMemberships.role, value: count() }).from(schema.tenantMemberships)
          .where(and(eq(schema.tenantMemberships.tenantId, unitScope.tenantId), eq(schema.tenantMemberships.branchId, unitScope.branchId), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.role, ["broker", "supervisor"])))
          .groupBy(schema.tenantMemberships.role)
        : Promise.resolve([]),
    ]);
    const branch = unitScope ? membership[0] : undefined;
    const countOf = (role: "broker" | "supervisor") => Number(unitCounts.find((row) => row.role === role)?.value ?? 0);
    return (
      <>
        <LightSettings
          intro="Sua conta, sua unidade e a segurança do acesso."
          header={<ManagerLiteSettingsHeader user={{ name: user[0]?.name ?? "Gestor", image: profile?.image ?? null }} branchName={branch?.name ?? null} />}
          sections={[
            { id: "conta", title: "Minha conta", description: "Seus dados de acesso e perfil", node: account },
            {
              id: "unidade",
              title: "Minha unidade",
              description: branch ? branch.name : "Você ainda não está em uma unidade",
              node: <ManagerLiteUnitSection unit={branch ? { name: branch.name, active: branch.status === "active", acceptingLeads: branch.acceptingLeads, autoDistribute: branch.autoDistribute, brokers: countOf("broker"), supervisors: countOf("supervisor") } : null} />,
            },
            { id: "whatsapp", title: "WhatsApp pessoal", description: "O número que você usa no atendimento", node: <LightWhatsappSection connected={whatsappConnection?.status === "ready"} status={whatsappConnection?.status ?? "disconnected"} /> },
            { id: "notificacoes", title: "Notificações", description: "Avisos no celular e no navegador", node: <div className="rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)"><PushNotificationManager variant="compact" /></div> },
            { id: "seguranca", title: "Segurança", description: "Autenticação em duas etapas e chaves de acesso", node: <SecurityTab enabled={user[0]?.twoFactorEnabled ?? false} email={user[0]?.email ?? "sua conta"} /> },
            { id: "extensao", title: "Extensão para o WhatsApp Web", description: "Atendimento contextual no navegador", node: extension },
            { id: "acessibilidade", title: "Acessibilidade", description: "Texto maior, menos animação e alto contraste", node: <AccessibilityPreferences /> },
          ]}
          footer={<ManagerLiteSettingsFooter />}
        />
      </>
    );
  }

  // Broker app (Light): sections as cards; managers and directors keep the desktop tabs below.
  if (context.role === "broker" && (await getExperienceMode(context)) === "LIGHT") {
    // Personal WhatsApp: the broker own connection, same query the Insights screen uses.
    const [whatsappConnection] = await db
      .select({ status: schema.whatsappConnections.status })
      .from(schema.whatsappConnections)
      .where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId)))
      .limit(1);
    const journeyEnabled = await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") === "true";
    const rankingMember = journeyEnabled ? await db.select({ optedOut: schema.tenantMemberships.rankingOptOut }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId), eq(schema.tenantMemberships.status, "active"))).limit(1).catch(() => []) : [];
    const rankingSections: LightSettingsSection[] = journeyEnabled ? [{ id: "placar", title: "Placar", description: "Sua presença no placar da unidade", node: <RankingPreferences initialOptOut={rankingMember[0]?.optedOut ?? false} schemaReady={Boolean(rankingMember[0])} /> }] : [];
    return (
      <LightSettings
        sections={[
          ...rankingSections,
          { id: "conta", title: "Minha conta", description: "Seus dados de acesso e perfil", node: account },
          {
            id: "disponibilidade",
            title: "Disponibilidade",
            description: "Pausa manual e horários para receber leads",
            node: brokerAvailability ? <LightAvailabilitySection windows={brokerAvailability.windows} schemaReady={brokerAvailability.availabilitySchemaReady} /> : <></>,
          },
          { id: "whatsapp", title: "WhatsApp pessoal", description: "O número que você usa no atendimento", node: <LightWhatsappSection connected={whatsappConnection?.status === "ready"} status={whatsappConnection?.status ?? "disconnected"} /> },
          { id: "seguranca", title: "Segurança", description: "Autenticação em duas etapas e chaves de acesso", node: <SecurityTab enabled={user[0]?.twoFactorEnabled ?? false} email={user[0]?.email ?? "sua conta"} /> },
          { id: "extensao", title: "Extensão para o WhatsApp Web", description: "Atendimento contextual no navegador", node: extension },
          { id: "acessibilidade", title: "Acessibilidade", description: "Texto maior, menos animação e alto contraste", node: <AccessibilityPreferences /> },
        ]}
      />
    );
  }

  // Chave do visual Lite: as mesmas seções (mesmos tabIds, dados e regras de edição de cada papel) no padrão Lite.
  if (await isDirectorLitePageOnServer(context, "/settings")) {
    const branch = membership[0] ? { id: membership[0].id, name: membership[0].name, status: membership[0].status, acceptingLeads: membership[0].acceptingLeads, autoDistribute: membership[0].autoDistribute, createdAt: membership[0].createdAt } : null;
    const nodes: Partial<Record<TabId, SettingsLiteSection>> = {
      conta: { id: "conta", title: "Minha conta", description: "Seus dados de acesso e perfil", node: <AccountLite name={user[0]?.name ?? "Usuário"} email={user[0]?.email ?? ""} role={context.role} /> },
      empresa: context.role === "director" ? { id: "empresa", title: "Empresa", description: "Dados da corretora e identidade visual", node: <EmpresaLite canEdit tenant={{ name: tenant[0]?.name ?? "", legalName: tenant[0]?.legalName ?? null, cnpj: tenant[0]?.cnpj ?? null, logoUrl: tenant[0]?.logoUrl ?? null, brandColor: tenant[0]?.brandColor ?? null }} /> } : undefined,
      unidade: { id: "unidade", title: "Unidade", description: branch ? branch.name : "Unidades e distribuição", node: <UnitLite branch={branch} /> },
      disponibilidade: brokerAvailability ? { id: "disponibilidade", title: "Disponibilidade", description: "Pausa manual e horários para receber leads", node: <div className={compat.compat}><BrokerAvailabilitySettings windows={brokerAvailability.windows} schemaReady={brokerAvailability.availabilitySchemaReady} /></div> } : undefined,
      atendimento: canEditFeedback ? {
        id: "atendimento",
        title: "Atendimento",
        description: "Lembretes de feedback, distribuição e etapa pela IA",
        node: (
          <>
            <FeedbackLite
              feedbackReminderInterval={tenantData?.feedbackReminderIntervalMinutes ?? "30"}
              feedbackReminderMaxAttempts={tenantData?.feedbackReminderMaxAttempts ?? 5}
              feedbackPushEnabled={tenantData?.feedbackPushEnabled ?? true}
              feedbackToastEnabled={tenantData?.feedbackToastEnabled ?? true}
              feedbackRequiredEnabled={tenantData?.feedbackRequiredEnabled ?? true}
              maxActiveLeadsLimit={tenantData?.maxActiveLeadsLimit ?? 10}
              canEdit={context.role === "director"}
            />
            {aiStageMode ? <StageModeLite initialMode={aiStageMode} /> : null}
          </>
        ),
      } : undefined,
      whatsapp: { id: "whatsapp", title: "WhatsApp", description: "O número que você usa no atendimento", node: <WhatsappLite /> },
      integracoes: integrations ? { id: "integracoes", title: "Integrações", description: "Fontes de captura, webhooks e pixels", node: <IntegrationsLite branches={integrations.branches} integrations={integrations.integrations} /> } : undefined,
      seguranca: { id: "seguranca", title: "Segurança", description: "Autenticação em duas etapas e chaves de acesso", node: <SecurityLite enabled={user[0]?.twoFactorEnabled ?? false} email={user[0]?.email ?? "sua conta"} /> },
      extensao: { id: "extensao", title: "Extensão", description: "Atendimento contextual no WhatsApp Web", node: <ExtensionLite /> },
    };
    const sections = tabIds.map((id) => nodes[id]).filter((section): section is SettingsLiteSection => Boolean(section));
    return (
      <>
        <DashboardHeader breadcrumb="Administração" title="Configurações" />
        <main className={litePage.stack}>
          <SettingsLite sections={sections} />
          {context.role !== "broker" ? (
            <LiteRelatedLinks
              title="Configurações relacionadas"
              description="Atalhos para parâmetros avançados e módulos."
              links={[
                { label: "Qualificação e robô IA", href: "/qualificacao", description: "Prompt, diagnóstico do WhatsApp e MCP" },
                { label: "Equipe e corretores", href: "/equipe", description: "Convites de usuários e permissões" },
                { label: "Regras de distribuição", href: "/leads?tab=distribuicao", description: "Roleta de atendimento e prioridades" },
                { label: "Guia e manual do sistema", href: "/guia", description: "Tours e definições de domínio" },
              ]}
            />
          ) : null}
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Parâmetros do Sistema" />
      <div className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
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
