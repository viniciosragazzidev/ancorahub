import { Suspense } from "react";
import Link from "next/link";
import { getSystemSettings } from "@/features/system-settings/queries";
import { getNotificationCapabilityStates } from "@/features/notifications/queries";
import {
  updateCentralAtencaoSettingsAction,
  updateGlobalSearchSettingsAction,
  updateBrokerWorkspaceSettingsAction,
  updateBrokerAvailabilityOnboardingSettingsAction,
  updateWorkflowAutomationSettingsAction,
  updateCleanUiOperationalSettingsAction,
  updateInterfaceMotionSettingsAction,
  updateR2StorageSettingsAction,
  updateMetaCloudWhatsAppSettingsAction,
  updateMetaLeadAdsSettingsAction,
  updateMetaLeadAdsPlatformIdentityAction,
  updateSystemReportSettingsAction,
  updateNotificationCapabilityAction,
  updateRealtimeSyncSettingsAction,
  updateAiSettingsAction,
  updateAiWhatsAppQualificationSettingsAction,
  updateQuickReplySettingsAction,
  updateAiMemoryResetSettingsAction,
  updateAgentTrainingCenterSettingsAction,
  updateExtensionGlobalSettingsAction,
  updateLeadDistributionJobsSettingsAction,
  runLeadDistributionJobsAction,
  updateLeadEffectOutboxSettingsAction,
  runLeadEffectOutboxAction,
  updateWahaCadenceSettingsAction,
  updateWahaConnectionSettingsAction,
  updateLeadManagementActionsSettingsAction,
  updateCustomRolesGlobalSettingsAction,
  updatePerformanceRankingSettingsAction,
  updateTeamMemberProfileSettingsAction,
  updateUserProfileSettingsAction,
} from "@/app/(platform-admin)/super-admin/actions";
import { CLEAN_UI_FEATURE } from "@/features/clean-ui/feature";
import { META_LEAD_ADS_PLATFORM_SETTINGS } from "@/features/communication-channels/meta-lead-ads-platform";
import {
  SYSTEM_REPORT_DESTINATION_KEY,
  SYSTEM_REPORT_ENABLED_KEY,
} from "@/features/system-report/message";
import { setRouteOnboardingGlobalAction } from "@/features/onboarding/actions/route-onboarding-actions";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { SuperAdminSettingsTabs } from "./super-admin-settings-tabs";

export const dynamic = "force-dynamic";

export default async function SuperAdminSettingsPage() {
  const settings = await getSystemSettings([
    "feature_central_atencao_enabled",
    "feature_central_atencao_stagnant_days",
    "feature_global_search_enabled",
    "feature_broker_workspace_enabled",
    "feature_broker_availability_onboarding_enabled",
    "feature_workflow_automation_enabled",
    CLEAN_UI_FEATURE,
    "feature_interface_motion_enabled",
    "feature_r2_storage_enabled",
    "feature_route_onboarding_enabled",
    "feature_whatsapp_meta_cloud_enabled",
    SYSTEM_REPORT_ENABLED_KEY,
    SYSTEM_REPORT_DESTINATION_KEY,
    "feature_meta_lead_ads_enabled",
    "feature_realtime_sync_enabled",
    META_LEAD_ADS_PLATFORM_SETTINGS.partnerName,
    META_LEAD_ADS_PLATFORM_SETTINGS.businessId,
    META_LEAD_ADS_PLATFORM_SETTINGS.supportWhatsApp,
    "feature_lead_distribution_jobs_enabled",
    "lead_distribution_jobs_batch_size",
    "lead_distribution_jobs_max_attempts",
    "lead_distribution_jobs_retry_base_seconds",
    "lead_distribution_jobs_lease_seconds",
    "lead_distribution_jobs_recovery_minutes",
    "feature_lead_intake_outbox_enabled",
    "feature_waha_cadence_enabled",
    "feature_waha_connections_enabled",
    "feature_waha_ai_enabled",
    "waha_cadence_max_attempts",
    "waha_cadence_retry_base_seconds",
    "waha_cadence_lease_seconds",
    "lead_intake_outbox_max_attempts",
    "lead_intake_outbox_retry_base_seconds",
    "lead_intake_outbox_lease_seconds",
    "feature_lead_management_actions_enabled",
    "ai_enabled",
    "feature_ai_whatsapp_qualification_enabled",
    "feature_ai_quick_reply_enabled",
    "ai_memory_reset_mode",
    "feature_browser_extension_enabled",
    "feature_agent_training_center_enabled",
    "feature_custom_roles_enabled",
    "feature_performance_ranking_enabled",
    "feature_team_member_profile_enabled",
    "feature_user_profile_enabled",
    "ai_primary_provider",
    "ai_primary_model",
    "ai_fallback_provider",
    "ai_fallback_model",
    "ai_temperature",
    "ai_max_tokens",
    "ai_system_prompt",
    "ai_groq_api_key",
    "ai_openai_api_key",
    "ai_google_api_key",
    "ai_openrouter_api_key",
  ]);
  const [notificationCapabilities] = await Promise.all([getNotificationCapabilityStates()]);
  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const centralEnabled = settingMap.get("feature_central_atencao_enabled") !== "false";
  const stagnantDays = settingMap.get("feature_central_atencao_stagnant_days") ?? "3";
  const globalSearchEnabled = settingMap.get("feature_global_search_enabled") !== "false";
  const brokerWorkspaceEnabled = settingMap.get("feature_broker_workspace_enabled") !== "false";
  const brokerAvailabilityOnboardingEnabled = settingMap.get("feature_broker_availability_onboarding_enabled") !== "false";
  const workflowAutomationEnabled =
    settingMap.get("feature_workflow_automation_enabled") === "true";
  const cleanUiOperationalEnabled = settingMap.get(CLEAN_UI_FEATURE) !== "false";
  const interfaceMotionEnabled = settingMap.get("feature_interface_motion_enabled") !== "false";
  const r2StorageEnabled = settingMap.get("feature_r2_storage_enabled") !== "false";
  const routeOnboardingEnabled = settingMap.get("feature_route_onboarding_enabled") !== "false";
  const metaCloudWhatsAppEnabled = settingMap.get("feature_whatsapp_meta_cloud_enabled") === "true";
  const systemReportEnabled = settingMap.get(SYSTEM_REPORT_ENABLED_KEY) !== "false";
  const systemReportDestination = settingMap.get(SYSTEM_REPORT_DESTINATION_KEY) ?? "";
  const metaLeadAdsEnabled = settingMap.get("feature_meta_lead_ads_enabled") === "true";
  const realtimeSyncEnabled = settingMap.get("feature_realtime_sync_enabled") !== "false";
  const metaLeadAdsPartnerName =
    settingMap.get(META_LEAD_ADS_PLATFORM_SETTINGS.partnerName) ?? "Ancora Hub";
  const metaLeadAdsBusinessId =
    settingMap.get(META_LEAD_ADS_PLATFORM_SETTINGS.businessId) ?? "37173915645589885";
  const metaLeadAdsSupportWhatsApp =
    settingMap.get(META_LEAD_ADS_PLATFORM_SETTINGS.supportWhatsApp) ?? "+55 21 95930-7782";
  const distributionJobsEnabled =
    settingMap.get("feature_lead_distribution_jobs_enabled") !== "false";
  const leadManagementActionsEnabled =
    settingMap.get("feature_lead_management_actions_enabled") !== "false";
  const distributionBatchSize = settingMap.get("lead_distribution_jobs_batch_size") ?? "25";
  const distributionMaxAttempts = settingMap.get("lead_distribution_jobs_max_attempts") ?? "8";
  const distributionRetryBaseSeconds =
    settingMap.get("lead_distribution_jobs_retry_base_seconds") ?? "60";
  const distributionLeaseSeconds = settingMap.get("lead_distribution_jobs_lease_seconds") ?? "120";
  const distributionRecoveryMinutes =
    settingMap.get("lead_distribution_jobs_recovery_minutes") ?? "5";
  const leadEffectOutboxEnabled = settingMap.get("feature_lead_intake_outbox_enabled") !== "false";
  const leadEffectOutboxMaxAttempts = settingMap.get("lead_intake_outbox_max_attempts") ?? "8";
  const leadEffectOutboxRetryBaseSeconds =
    settingMap.get("lead_intake_outbox_retry_base_seconds") ?? "60";
  const leadEffectOutboxLeaseSeconds = settingMap.get("lead_intake_outbox_lease_seconds") ?? "120";
  const wahaCadenceEnabled = settingMap.get("feature_waha_cadence_enabled") === "true";
  const wahaConnectionsEnabled = settingMap.get("feature_waha_connections_enabled") === "true";
  const wahaAiEnabled = settingMap.get("feature_waha_ai_enabled") === "true";
  const wahaMaxAttempts = settingMap.get("waha_cadence_max_attempts") ?? "5";
  const wahaRetryBaseSeconds = settingMap.get("waha_cadence_retry_base_seconds") ?? "60";
  const wahaLeaseSeconds = settingMap.get("waha_cadence_lease_seconds") ?? "120";

  const aiEnabled = settingMap.get("ai_enabled") === "true";
  const aiWhatsAppQualificationEnabled =
    settingMap.get("feature_ai_whatsapp_qualification_enabled") !== "false";
  const aiQuickReplyEnabled = settingMap.get("feature_ai_quick_reply_enabled") !== "false";
  const aiMemoryResetMode = settingMap.get("ai_memory_reset_mode") ?? "before_each_session";
  const browserExtensionEnabled = settingMap.get("feature_browser_extension_enabled") !== "false";
  const agentTrainingCenterEnabled =
    settingMap.get("feature_agent_training_center_enabled") === "true";
  const customRolesEnabled = settingMap.get("feature_custom_roles_enabled") === "true";
  const performanceRankingEnabled =
    settingMap.get("feature_performance_ranking_enabled") !== "false";
  const teamMemberProfileEnabled =
    settingMap.get("feature_team_member_profile_enabled") !== "false";
  const userProfileEnabled = settingMap.get("feature_user_profile_enabled") !== "false";
  const aiPrimaryProvider = settingMap.get("ai_primary_provider") ?? "groq";
  const aiPrimaryModel = settingMap.get("ai_primary_model") ?? "";
  const aiFallbackProvider = settingMap.get("ai_fallback_provider") ?? "none";
  const aiFallbackModel = settingMap.get("ai_fallback_model") ?? "";
  const aiTemperature = settingMap.get("ai_temperature") ?? "0.7";
  const aiMaxTokens = settingMap.get("ai_max_tokens") ?? "1024";
  const aiSystemPrompt =
    settingMap.get("ai_system_prompt") ?? "Você é um assistente virtual utilitário e direto.";
  const hasGroqKey = !!(process.env.GROQ_API_KEY || settingMap.get("ai_groq_api_key"));
  const hasOpenaiKey = !!(process.env.OPENAI_API_KEY || settingMap.get("ai_openai_api_key"));
  const hasGoogleKey = !!(process.env.GOOGLE_API_KEY || settingMap.get("ai_google_api_key"));
  const hasOpenrouterKey = !!(
    process.env.OPENROUTER_API_KEY || settingMap.get("ai_openrouter_api_key")
  );

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Configurações da Plataforma" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Parâmetros Globais</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste as configurações globais da plataforma CorreTop.
            </p>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              Carregando configurações...
            </div>
          }
        >
          <SuperAdminSettingsTabs>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Workspace do Corretor</CardTitle>
                <CardDescription>
                  Define a home operacional dos corretores. Desativar restaura o dashboard legado
                  sem remover dados, tarefas ou histórico.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateBrokerWorkspaceSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="brokerWorkspaceEnabled"
                      value="true"
                      defaultChecked={brokerWorkspaceEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Habilitar Workspace do Corretor</span>
                      <span className="block text-xs text-muted-foreground">
                        A alteração é auditada e reversível pela plataforma.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={brokerWorkspaceEnabled ? "outline" : "default"}>
                    {brokerWorkspaceEnabled ? "Salvar controle" : "Liberar Workspace"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Agenda obrigatória do corretor</CardTitle>
                <CardDescription>
                  Exige a configuração da disponibilidade semanal e usa a agenda para filtrar a distribuição automática. Atribuições manuais continuam possíveis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateBrokerAvailabilityOnboardingSettingsAction} className="flex flex-wrap items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="brokerAvailabilityOnboardingEnabled" value="true" defaultChecked={brokerAvailabilityOnboardingEnabled} className="size-4" />
                    <span><span className="font-medium">Exigir agenda para novos leads automáticos</span><span className="block text-xs text-muted-foreground">Desativar preserva as agendas salvas, mas deixa de usá-las para bloquear a distribuição.</span></span>
                  </label>
                  <Button type="submit" variant={brokerAvailabilityOnboardingEnabled ? "outline" : "default"}>{brokerAvailabilityOnboardingEnabled ? "Salvar controle" : "Ativar agenda obrigatória"}</Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Automation Builder</CardTitle>
                <CardDescription>
                  Libera a publicação de fluxos versionados. Desativar interrompe novas publicações
                  sem apagar rascunhos, versões ou auditoria; nenhum canal externo é ativado por
                  este controle.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateWorkflowAutomationSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="workflowAutomationEnabled"
                      value="true"
                      defaultChecked={workflowAutomationEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Permitir publicação de fluxos seguros</span>
                      <span className="block text-xs text-muted-foreground">
                        IA e WhatsApp permanecem bloqueados por capacidades próprias.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={workflowAutomationEnabled ? "outline" : "default"}>
                    {workflowAutomationEnabled ? "Salvar controle" : "Liberar piloto"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Clean UI operacional</CardTitle>
                <CardDescription>
                  A experiência simplificada é o padrão. Desative globalmente ou por empresa para
                  restaurar o layout anterior, sem alterar dados, permissões ou histórico.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  action={updateCleanUiOperationalSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="cleanUiOperationalEnabled"
                      value="true"
                      defaultChecked={cleanUiOperationalEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Nova interface disponível</span>
                      <span className="block text-xs text-muted-foreground">
                        Ativa para todas as empresas. Exceções são gerenciadas no detalhe da
                        empresa.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={cleanUiOperationalEnabled ? "outline" : "default"}>
                    {cleanUiOperationalEnabled ? "Salvar controle" : "Ativar para todas"}
                  </Button>
                </form>
                <Button render={<Link href="/super-admin/tenants" />} size="sm" variant="ghost">
                  Gerenciar exceções por empresa
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Cargos personalizados</CardTitle>
                <CardDescription>
                  Libera o piloto de cargos por empresa. O Diretor monta apenas cargos e permissões
                  delegáveis; Diretor, Gestor e Corretor de sistema permanecem protegidos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  action={updateCustomRolesGlobalSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      value="true"
                      defaultChecked={customRolesEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Habilitar globalmente</span>
                      <span className="block text-xs text-muted-foreground">
                        Desativar preserva cargos e retorna o tenant ao comportamento legado.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar controle
                  </Button>
                </form>
                <Button render={<Link href="/super-admin/tenants" />} size="sm" variant="ghost">
                  Gerenciar piloto por empresa
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Temporadas e ranking comercial</CardTitle>
                <CardDescription>
                  Kill switch global para a gestão de temporadas, metas e premiações. Desativar
                  bloqueia novos ajustes, mas preserva ciclos, resultados e auditoria.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updatePerformanceRankingSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="performanceRankingEnabled"
                      value="true"
                      defaultChecked={performanceRankingEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Ranking habilitado globalmente</span>
                      <span className="block text-xs text-muted-foreground">
                        A gestão continua restrita ao Diretor dentro da própria empresa.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={performanceRankingEnabled ? "outline" : "default"}>
                    {performanceRankingEnabled ? "Salvar controle" : "Liberar ranking"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Perfil administrativo da equipe</CardTitle>
                <CardDescription>
                  Libera a visão de desempenho individual para Diretores e Gestores. Gestores
                  permanecem limitados aos membros e leads da própria unidade; cada acesso fica
                  auditado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateTeamMemberProfileSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="teamMemberProfileEnabled"
                      value="true"
                      defaultChecked={teamMemberProfileEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Perfis administrativos habilitados</span>
                      <span className="block text-xs text-muted-foreground">
                        Desativar remove o atalho e bloqueia a rota sem apagar históricos ou
                        auditoria.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={teamMemberProfileEnabled ? "outline" : "default"}>
                    {teamMemberProfileEnabled ? "Salvar controle" : "Liberar perfis"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Perfil pessoal do usuário</CardTitle>
                <CardDescription>
                  Libera a área &quot;Meu perfil&quot; para todos os usuários editarem nome, foto,
                  senha, sessões e consultarem o histórico de atividades de sua conta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateUserProfileSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="userProfileEnabled"
                      value="true"
                      defaultChecked={userProfileEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Área de perfil habilitada</span>
                      <span className="block text-xs text-muted-foreground">
                        Desativar bloqueia a rota e remove o atalho, preservando auditoria e
                        histórico.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={userProfileEnabled ? "outline" : "default"}>
                    {userProfileEnabled ? "Salvar controle" : "Liberar perfil"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Configuração do Servidor</CardTitle>
                <CardDescription>Parâmetros operacionais do ambiente ativo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-muted-foreground">Nome do sistema:</span>
                  <span className="font-semibold">CorreTop CRM</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-muted-foreground">Banco de dados:</span>
                  <Badge
                    variant="outline"
                    className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
                  >
                    PostgreSQL (Supabase)
                  </Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-muted-foreground">Versão do sistema:</span>
                  <span className="font-semibold">v2.10.0-prod</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Onboarding por rota</CardTitle>
                <CardDescription>
                  Apresentações contextuais aparecem uma vez por usuário e rota. O estado é
                  persistido por corretora, pode ser reiniciado pela central administrativa e toda
                  alteração fica auditada.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={setRouteOnboardingGlobalAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      value="true"
                      defaultChecked={routeOnboardingEnabled}
                      className="size-4 warning-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">Onboarding de rotas habilitado</span>
                      <span className="block text-xs text-muted-foreground">
                        Desative temporariamente sem apagar progresso nem auditoria.
                      </span>
                    </span>
                  </label>
                  <Button type="submit">Salvar onboarding</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Motor de distribuição</CardTitle>
                <CardDescription>
                  Processa leads em fila, recupera execuções interrompidas e mantém exceções
                  auditáveis. Desativar interrompe novas tentativas sem apagar a fila.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  action={updateLeadDistributionJobsSettingsAction}
                  className="grid gap-4 lg:grid-cols-3"
                >
                  <label className="flex items-center gap-2 text-sm lg:col-span-3">
                    <input
                      type="checkbox"
                      name="enabled"
                      value="true"
                      defaultChecked={distributionJobsEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">
                        Distribuição automática resiliente habilitada
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        A fila segue preservada quando desativada; Diretor e Gestor ainda podem
                        atribuir manualmente.
                      </span>
                    </span>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Leads por ciclo
                    <Input
                      name="batchSize"
                      min={1}
                      max={100}
                      type="number"
                      defaultValue={distributionBatchSize}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Tentativas máximas
                    <Input
                      name="maxAttempts"
                      min={1}
                      max={20}
                      type="number"
                      defaultValue={distributionMaxAttempts}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Lease (segundos)
                    <Input
                      name="leaseSeconds"
                      min={30}
                      max={900}
                      type="number"
                      defaultValue={distributionLeaseSeconds}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Retry inicial (segundos)
                    <Input
                      name="retryBaseSeconds"
                      min={15}
                      max={3600}
                      type="number"
                      defaultValue={distributionRetryBaseSeconds}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Recuperação (minutos)
                    <Input
                      name="recoveryMinutes"
                      min={1}
                      max={60}
                      type="number"
                      defaultValue={distributionRecoveryMinutes}
                    />
                  </label>
                  <div className="flex items-end">
                    <Button type="submit">Salvar motor</Button>
                  </div>
                </form>
                <form
                  action={runLeadDistributionJobsAction}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <p className="text-xs text-muted-foreground">
                    Use apenas para intervenção operacional: executa um ciclo com os limites
                    configurados e registra a solicitação na auditoria.
                  </p>
                  <Button type="submit" variant="outline">
                    Processar fila agora
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Central de notificações</CardTitle>
                <CardDescription>
                  Ative ou desative globalmente cada evento. Quando desativado, o CorreTop não cria
                  o toast/in-app nem envia push para esse evento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {notificationCapabilities.map((capability) => (
                  <form
                    action={updateNotificationCapabilityAction}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={capability.id}
                  >
                    <input name="capabilityId" type="hidden" value={capability.id} />
                    <div className="min-w-0">
                      <p className="font-medium">{capability.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {capability.description} · {capability.channels}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={capability.enabled ? "success" : "outline"}>
                        {capability.enabled ? "Ativo" : "Desativado"}
                      </Badge>
                      <input
                        name="enabled"
                        type="hidden"
                        value={capability.enabled ? "false" : "true"}
                      />
                      <Button
                        size="sm"
                        type="submit"
                        variant={capability.enabled ? "outline" : "default"}
                      >
                        {capability.enabled ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </form>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Sincronização em tempo real</CardTitle>
                <CardDescription>
                  Envia ao navegador apenas um sinal técnico de atualização; os dados continuam
                  sendo lidos pelo CRM autenticado. Desativar preserva notificações e push, usando a
                  reconciliação periódica.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateRealtimeSyncSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="realtimeSyncEnabled"
                      value="true"
                      defaultChecked={realtimeSyncEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Sinais em tempo real habilitados</span>
                      <span className="block text-xs text-muted-foreground">
                        Controle global, reversível e auditado.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={realtimeSyncEnabled ? "outline" : "default"}>
                    {realtimeSyncEnabled ? "Salvar controle" : "Ativar sincronização"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>WhatsApp oficial da Meta</CardTitle>
                <CardDescription>
                  Ativa o Embedded Signup, o webhook oficial e o envio pela Cloud API. A capacidade
                  pode ser interrompida sem apagar canais ou histórico.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateMetaCloudWhatsAppSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="metaCloudWhatsAppEnabled"
                      value="true"
                      defaultChecked={metaCloudWhatsAppEnabled}
                      className="size-4 warning-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">Integração oficial habilitada</span>
                      <span className="block text-xs text-muted-foreground">
                        Exige as credenciais privadas da Meta configuradas no ambiente da Vercel.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar integração
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Report de problema no WhatsApp</CardTitle>
                <CardDescription>
                  Ativa a central de feedback do &quot;?&quot; no cabeçalho. O envio usa o número
                  oficial da Meta Cloud da própria corretora para um WhatsApp de destino global
                  definido pelo Super-admin. Toda alteração é auditada na plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateSystemReportSettingsAction}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <label className="flex items-center gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      name="enabled"
                      value="true"
                      defaultChecked={systemReportEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Central de report habilitada</span>
                      <span className="block text-xs text-muted-foreground">
                        Desativar oculta a ação e bloqueia o envio em todos os tenants, preservando
                        auditoria.
                      </span>
                    </span>
                  </label>
                  <label className="grid gap-1 text-xs font-medium md:col-span-2">
                    WhatsApp de destino (com código do país)
                    <Input
                      name="destination"
                      defaultValue={systemReportDestination}
                      inputMode="tel"
                      placeholder="5521999999999"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <Button type="submit" variant={systemReportEnabled ? "outline" : "default"}>
                      {systemReportEnabled ? "Salvar controle" : "Ativar central de report"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Captação manual de Lead Ads</CardTitle>
                <CardDescription>
                  Libera o webhook Page/leadgen com um token técnico exclusivo da plataforma. Cada
                  Página continua mapeada e auditada por empresa, sem guardar token do cliente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateMetaLeadAdsSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="metaLeadAdsEnabled"
                      value="true"
                      defaultChecked={metaLeadAdsEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Recebimento de Lead Ads habilitado</span>
                      <span className="block text-xs text-muted-foreground">
                        Desativar interrompe novas capturas e preserva páginas, leads e auditoria
                        existentes.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant={metaLeadAdsEnabled ? "outline" : "default"}>
                    {metaLeadAdsEnabled ? "Salvar controle" : "Liberar Lead Ads"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Capacidades operacionais</CardTitle>
                <CardDescription>
                  Controle reversível de recursos que impactam a operação dos tenants. Toda
                  alteração é registrada na auditoria da plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateCentralAtencaoSettingsAction}
                  className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="centralAtencaoEnabled"
                      value="true"
                      defaultChecked={centralEnabled}
                      className="size-4 warning-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">Central Atenção agora</span>
                      <span className="block text-xs text-muted-foreground">
                        Exibir pendências acionáveis no roadmap.
                      </span>
                    </span>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Dias para estagnação
                    <Input
                      name="stagnantDays"
                      type="number"
                      min={1}
                      max={30}
                      defaultValue={stagnantDays}
                    />
                  </label>
                  <Button type="submit">Salvar alterações</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Busca global</CardTitle>
                <CardDescription>
                  Pesquisa leads, clientes, cotações, tarefas e equipe respeitando o escopo de cada
                  usuário.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateGlobalSearchSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="globalSearchEnabled"
                      value="true"
                      defaultChecked={globalSearchEnabled}
                      className="size-4 warning-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">Busca global habilitada</span>
                      <span className="block text-xs text-muted-foreground">
                        Permitir pesquisas pelo cabeçalho do sistema.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar busca
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Movimento da interface</CardTitle>
                <CardDescription>
                  Controla transições curtas de rota, títulos e superfícies. Não altera a
                  preferência de acessibilidade de cada pessoa.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateInterfaceMotionSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="interfaceMotionEnabled"
                      value="true"
                      defaultChecked={interfaceMotionEnabled}
                      className="size-4 warning-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">Motion da interface habilitado</span>
                      <span className="block text-xs text-muted-foreground">
                        Desative para trocar rotas e estados instantaneamente em toda a plataforma.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar motion
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Painel e Ações Administrativas no Lead</CardTitle>
                <CardDescription>
                  Customiza a tela de detalhes e o drawer rápido de leads para Diretores e Gestores
                  com foco em supervisão, auditoria de propostas e reatribuição.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateLeadManagementActionsSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="leadManagementActionsEnabled"
                      value="true"
                      defaultChecked={leadManagementActionsEnabled}
                      className="size-4 warning-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">
                        Personalização para diretores e gestores habilitada
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Desative para retornar à mesma visualização padrão (Corretor) para todos os
                        cargos.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar personalização
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Motor de Inteligência Artificial</CardTitle>
                <CardDescription>
                  Gerencie o motor central de IA da plataforma CorreTop. Os recursos utilizam o
                  Vercel AI SDK para streaming rápido de respostas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateAiSettingsAction} className="space-y-6">
                  {/* Ativação Global */}
                  <div className="flex items-center justify-between border-b pb-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        name="aiEnabled"
                        value="true"
                        defaultChecked={aiEnabled}
                        className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span>
                        <span className="font-semibold block">
                          Habilitar Inteligência Artificial
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Ativa recursos inteligentes e rotas de chat em toda a plataforma.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Provedor Primário */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Provedor Primário</label>
                      <AppSelect
                        name="primaryProvider"
                        defaultValue={aiPrimaryProvider}
                        options={[
                          { value: "groq", label: "Groq (Llama 3.3 / Llama 3)" },
                          { value: "openai", label: "OpenAI (GPT-4o / GPT-4o-mini)" },
                          { value: "google", label: "Google Gemini (Gemini 2.5 Flash)" },
                          {
                            value: "openrouter",
                            label: "OpenRouter (Modelos Gratuitos & Diversos)",
                          },
                        ]}
                      />
                      <p className="text-xs text-muted-foreground">
                        Provedor principal utilizado para completar requisições.
                      </p>
                    </div>

                    {/* Modelo Primário Override */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Modelo Primário (Override)</label>
                      <Input
                        name="primaryModel"
                        placeholder="Ex: llama-3.3-70b-versatile"
                        defaultValue={aiPrimaryModel}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco para usar o modelo padrão do provedor.
                      </p>
                    </div>

                    {/* Provedor de Fallback */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Provedor de Fallback</label>
                      <AppSelect
                        name="fallbackProvider"
                        defaultValue={aiFallbackProvider}
                        options={[
                          { value: "none", label: "Nenhum (Disparar erro em caso de falha)" },
                          { value: "groq", label: "Groq" },
                          { value: "openai", label: "OpenAI" },
                          { value: "google", label: "Google Gemini" },
                          { value: "openrouter", label: "OpenRouter" },
                        ]}
                      />
                      <p className="text-xs text-muted-foreground">
                        Provedor utilizado caso o primário retorne erro ou atinja limite.
                      </p>
                    </div>

                    {/* Modelo de Fallback Override */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Modelo de Fallback (Override)</label>
                      <Input
                        name="fallbackModel"
                        placeholder="Ex: gpt-4o-mini"
                        defaultValue={aiFallbackModel}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco para usar o modelo padrão do fallback.
                      </p>
                    </div>

                    {/* Temperatura */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Temperatura</label>
                      <Input
                        name="temperature"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        defaultValue={aiTemperature}
                      />
                      <p className="text-xs text-muted-foreground">
                        Precisão e criatividade da IA (0.0 = preciso, 1.0 = criativo).
                      </p>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Limite de Tokens (Max Tokens)</label>
                      <Input
                        name="maxTokens"
                        type="number"
                        min="1"
                        max="8192"
                        defaultValue={aiMaxTokens}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tamanho máximo da resposta gerada.
                      </p>
                    </div>
                  </div>

                  {/* Chaves de API */}
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-bold tracking-tight">
                      Chaves de API (Configuração de Credenciais)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      As chaves informadas abaixo serão salvas no banco de dados. Caso já estejam
                      configuradas nas variáveis de ambiente (.env), não é necessário preencher.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2 text-xs font-semibold">
                          Groq API Key
                          <a
                            href="https://console.groq.com/docs/models"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
                          >
                            Ver modelos Groq
                            <span aria-hidden="true">↗</span>
                          </a>
                        </label>
                        <Input
                          name="groqApiKey"
                          type="password"
                          placeholder={
                            hasGroqKey ? "Configurado (Preencha para alterar)" : "Chave da API Groq"
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">OpenAI API Key</label>
                        <Input
                          name="openaiApiKey"
                          type="password"
                          placeholder={
                            hasOpenaiKey
                              ? "Configurado (Preencha para alterar)"
                              : "Chave da API OpenAI"
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">Google API Key</label>
                        <Input
                          name="googleApiKey"
                          type="password"
                          placeholder={
                            hasGoogleKey
                              ? "Configurado (Preencha para alterar)"
                              : "Chave da API Google"
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">OpenRouter API Key</label>
                        <Input
                          name="openrouterApiKey"
                          type="password"
                          placeholder={
                            hasOpenrouterKey
                              ? "Configurado (Preencha para alterar)"
                              : "Chave da API OpenRouter"
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prompt de Sistema Global */}
                  <div className="space-y-2 border-t pt-4">
                    <label className="text-sm font-semibold">
                      Instruções do Sistema (System Prompt Global)
                    </label>
                    <textarea
                      name="systemPrompt"
                      rows={4}
                      defaultValue={aiSystemPrompt}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                      placeholder="Você é um assistente virtual utilitário e direto..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Instruções comportamentais enviadas por padrão a todas as chamadas de IA.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button type="submit">Salvar Configurações de IA</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Outbox do recebimento de leads</CardTitle>
                <CardDescription>
                  Garante que distribuição e notificações sejam executadas após o commit do lead.
                  Desativar pausa novas tentativas sem apagar a fila ou os erros auditáveis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  action={updateLeadEffectOutboxSettingsAction}
                  className="grid gap-4 lg:grid-cols-3"
                >
                  <label className="flex items-center gap-2 text-sm lg:col-span-3">
                    <input
                      type="checkbox"
                      name="enabled"
                      value="true"
                      defaultChecked={leadEffectOutboxEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Outbox de efeitos habilitada</span>
                      <span className="block text-xs text-muted-foreground">
                        Kill switch global para notificações e distribuição disparadas pelo intake.
                      </span>
                    </span>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Tentativas máximas
                    <Input
                      name="maxAttempts"
                      min={1}
                      max={20}
                      type="number"
                      defaultValue={leadEffectOutboxMaxAttempts}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Retry inicial (segundos)
                    <Input
                      name="retryBaseSeconds"
                      min={15}
                      max={3600}
                      type="number"
                      defaultValue={leadEffectOutboxRetryBaseSeconds}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Lease (segundos)
                    <Input
                      name="leaseSeconds"
                      min={30}
                      max={900}
                      type="number"
                      defaultValue={leadEffectOutboxLeaseSeconds}
                    />
                  </label>
                  <div className="flex items-end">
                    <Button type="submit">Salvar outbox</Button>
                  </div>
                </form>
                <form
                  action={runLeadEffectOutboxAction}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <p className="text-xs text-muted-foreground">
                    Executa uma passagem segura pelos efeitos pendentes e registra a intervenção na
                    auditoria.
                  </p>
                  <Button type="submit" variant="outline">
                    Processar efeitos agora
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Cadência de WhatsApp</CardTitle>
                <CardDescription>
                  Controle global do relay na VPS e das respostas de IA. O canal oficial Meta não é
                  alterado.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <p className="text-xs text-muted-foreground">
                  Conexões:{" "}
                  <strong>{wahaConnectionsEnabled ? "habilitadas" : "desativadas"}</strong>. Salve a
                  configuração abaixo para alterar este controle.
                </p>
              </CardContent>
              <CardContent className="pt-3">
                <form
                  action={updateWahaConnectionSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="connectionsEnabled"
                      value="true"
                      defaultChecked={wahaConnectionsEnabled}
                      className="size-4"
                    />
                    <span>Permitir conexões de números WhatsApp</span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar conexões
                  </Button>
                </form>
              </CardContent>
              <CardContent>
                <form
                  action={updateWahaCadenceSettingsAction}
                  className="grid gap-3 md:grid-cols-3"
                >
                  <label className="flex items-center gap-2 text-sm md:col-span-3">
                    <input
                      type="checkbox"
                      name="enabled"
                      value="true"
                      defaultChecked={wahaCadenceEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Cadências habilitadas</span>
                      <span className="block text-xs text-muted-foreground">
                        Pausa a fila sem apagar histórico.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm md:col-span-3">
                    <input
                      type="checkbox"
                      name="aiEnabled"
                      value="true"
                      defaultChecked={wahaAiEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">IA após mensagem recebida</span>
                      <span className="block text-xs text-muted-foreground">
                        Mantém ações de baixo risco.
                      </span>
                    </span>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Tentativas
                    <Input
                      name="maxAttempts"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={wahaMaxAttempts}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Retry (segundos)
                    <Input
                      name="retryBaseSeconds"
                      type="number"
                      min={15}
                      max={3600}
                      defaultValue={wahaRetryBaseSeconds}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Lease (segundos)
                    <Input
                      name="leaseSeconds"
                      type="number"
                      min={30}
                      max={900}
                      defaultValue={wahaLeaseSeconds}
                    />
                  </label>
                  <div className="md:col-span-3">
                    <Button type="submit">Salvar cadência de WhatsApp</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>CorreTop Assistant</CardTitle>
                <CardDescription>
                  Kill switch global da extensão contextual. Desativar bloqueia novas consultas sem
                  revogar dados históricos ou sessões já registradas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateExtensionGlobalSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="extensionEnabled"
                      value="true"
                      defaultChecked={browserExtensionEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Extensão habilitada globalmente</span>
                      <span className="block text-xs text-muted-foreground">
                        O Diretor ainda controla a ativação por tenant.
                      </span>
                    </span>
                  </label>
                  <Button type="submit">Salvar extensão</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Armazenamento de arquivos</CardTitle>
                <CardDescription>
                  Controle global do bucket privado Cloudflare R2. Desativar interrompe uploads e
                  downloads sem apagar registros, objetos ou auditoria.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateR2StorageSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="r2StorageEnabled"
                      value="true"
                      defaultChecked={r2StorageEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Armazenamento R2 habilitado</span>
                      <span className="block text-xs text-muted-foreground">
                        Requer credenciais privadas configuradas no ambiente do servidor.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar armazenamento
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Qualificação automática no WhatsApp</CardTitle>
                <CardDescription>
                  Usa o mesmo motor de IA e o canal oficial da Meta para fazer perguntas iniciais.
                  Desativar interrompe novas sessões sem apagar histórico.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateAiWhatsAppQualificationSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="aiWhatsAppQualificationEnabled"
                      value="true"
                      defaultChecked={aiWhatsAppQualificationEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Iniciar qualificação para novos leads</span>
                      <span className="block text-xs text-muted-foreground">
                        Requer Motor de IA e canal Meta Cloud ativos. O atendimento humano pode
                        assumir a qualquer momento.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar qualificação
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Quick Reply determinístico</CardTitle>
                <CardDescription>
                  Resolve saudações, mídia, opt-out e solicitações humanas antes de chamar a IA. O
                  estado e o cooldown são persistidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateQuickReplySettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="quickReplyEnabled"
                      value="true"
                      defaultChecked={aiQuickReplyEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Quick Reply habilitado</span>
                      <span className="block text-xs text-muted-foreground">
                        Desative sem apagar eventos, métricas ou templates por tenant.
                      </span>
                    </span>
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar Quick Reply
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Reset de memória do agente de WhatsApp</CardTitle>
                <CardDescription>
                  Controla quando o agente esquece o contexto acumulado (memória estruturada +
                  histórico da conversa). A opção “A cada mensagem” faz o bot responder do zero a
                  cada interação recebida.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateAiMemoryResetSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Modo de reset de memória</span>
                    <span className="block text-xs text-muted-foreground">
                      A alteração é auditada e vale para todos os leads.
                    </span>
                    <AppSelect
                      name="aiMemoryResetMode"
                      defaultValue={aiMemoryResetMode}
                      options={[
                        {
                          value: "before_each_message",
                          label: "A cada mensagem (responder do zero)",
                        },
                        { value: "before_each_session", label: "A cada nova sessão (padrão)" },
                        { value: "never", label: "Nunca resetar (manter contexto)" },
                        { value: "manual", label: "Somente manual" },
                      ]}
                    />
                  </label>
                  <Button type="submit" variant="outline">
                    Salvar reset de memória
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Centro de Treinamento do Agente</CardTitle>
                <CardDescription>
                  Libera o piloto para Diretores criarem, validarem e publicarem versões de
                  comportamento. Desativar preserva histórico, rascunhos e auditoria; apenas
                  bloqueia novos acessos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateAgentTrainingCenterSettingsAction}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="agentTrainingCenterEnabled"
                      value="true"
                      defaultChecked={agentTrainingCenterEnabled}
                      className="size-4"
                    />
                    <span>
                      <span className="font-medium">Liberar Centro de Treinamento globalmente</span>
                      <span className="block text-xs text-muted-foreground">
                        Quando ativo, o Diretor ainda opera exclusivamente dentro do próprio tenant.
                      </span>
                    </span>
                  </label>
                  <Button
                    type="submit"
                    variant={agentTrainingCenterEnabled ? "outline" : "default"}
                  >
                    {agentTrainingCenterEnabled ? "Salvar controle" : "Liberar piloto"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Identidade pública do Lead Ads</CardTitle>
                <CardDescription>
                  Estes são os únicos dados técnicos exibidos ao Diretor/cliente durante a
                  autorização. Tokens, App Secret e webhooks ficam exclusivamente no ambiente da
                  plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={updateMetaLeadAdsPlatformIdentityAction}
                  className="grid gap-4 md:grid-cols-3"
                >
                  <label className="grid gap-1 text-sm font-medium">
                    Nome do parceiro
                    <Input name="partnerName" defaultValue={metaLeadAdsPartnerName} />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Business ID público
                    <Input
                      name="businessId"
                      defaultValue={metaLeadAdsBusinessId}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    WhatsApp de suporte
                    <Input name="supportWhatsApp" defaultValue={metaLeadAdsSupportWhatsApp} />
                  </label>
                  <div className="md:col-span-3">
                    <Button type="submit">Salvar dados públicos</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle>Liberação por empresa</CardTitle>
                <CardDescription>
                  O controle global acima protege toda a plataforma. Para liberar Lead Ads a uma
                  corretora, abra a empresa e use a área “Pilotos e permissões”.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button render={<Link href="/super-admin/tenants" />} variant="outline">
                  Abrir empresas
                </Button>
              </CardContent>
            </Card>
          </SuperAdminSettingsTabs>
        </Suspense>
      </main>
    </>
  );
}
