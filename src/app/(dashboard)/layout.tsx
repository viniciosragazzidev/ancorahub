import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { AuthorizationError, AuthenticationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AppShell } from "@/components/app-shell";
import { ContextualIllustrationsProvider } from "@/components/illustrations/contextual-illustration";
import { isLightRouteAllowed } from "@/components/light/light-routes";
import { getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getDatabase, schema } from "@/shared/db";
import { TenantOnboardingDialogLoader } from "@/features/onboarding/components/tenant-onboarding-dialog-loader";
import { DirectorWizardLoader } from "@/features/onboarding/components/director-wizard-loader";
import { RealtimeSyncProvider } from "@/components/providers/realtime-sync-provider";
import { NotificationCountProvider } from "@/components/providers/notification-count-provider";
import { FeedbackToastHandler } from "@/features/leads/components/feedback-toast-handler";
import { PasskeyToastHandler } from "@/components/passkey-toast-handler";
import { RouteOnboardingLoader } from "@/features/onboarding/components/route-onboarding-loader";
import { BrokerAvailabilityOnboardingLoader } from "@/features/broker-availability/components/broker-availability-onboarding-loader";
import { CommandPalette } from "@/components/command-palette";
import { SystemFeedbackDrawer } from "@/components/system-feedback-drawer";
import { AgentDrawerProvider } from "@/components/agent-drawer/agent-drawer-provider";
import { AgentDrawer } from "@/components/agent-drawer/agent-drawer";
import { getRealtimeSyncTopic, isRealtimeSyncEnabled } from "@/features/notifications/realtime-sync";

import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { isManagerLiteAvailable, isSupervisorLiteAvailable } from "@/features/broker-workspace/lite-audience";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { WhatsAppPlantaoNotice } from "@/components/whatsapp/whatsapp-plantao-notice";
import { WhatsAppLinkHandler } from "@/components/whatsapp/whatsapp-link-handler";
import { hasPermission } from "@/shared/auth/permissions";
import { isCleanUiOperationalEnabled } from "@/features/clean-ui/feature";
import { getRouteDefinition } from "@/features/custom-roles/routes";
import { hasEffectiveRouteAccess } from "@/features/custom-roles/service";
import { shouldUseDirectorLiteStyle } from "@/features/director-lite/style-flag";
import { resolveNegotiationsRouteAccess } from "@/features/negotiations/route-access";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let context;
  try {
    context = await getRequiredTenantContext();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/access-denied");
    throw error;
  }

  // These request-scoped reads are independent after the authenticated context
  // is resolved. Starting them together keeps client-side route transitions from
  // serializing the shell, preference, branding and pathname lookups.
  const experienceModePromise = getExperienceMode(context);
  const illustrationsPromise = context.role === "director" || context.role === "broker"
    ? getFeatureFlag(FEATURE_FLAGS.UI_CONTEXTUAL_ILLUSTRATIONS).catch(() => "false")
    : Promise.resolve("false");
  const brokerDutyCalendarFlagPromise = context.role === "broker"
    ? getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR)
    : Promise.resolve("false");
  const brokerJourneyFlagPromise = context.role === "broker"
    ? getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false")
    : Promise.resolve("false");
  const relationshipFlagPromise = context.role === "broker" || context.role === "supervisor"
    ? getFeatureFlag(FEATURE_FLAGS.RELATIONSHIP_CENTER).catch(() => "false")
    : Promise.resolve("false");
  const welcomeVideoFlagPromise = context.role === "broker"
    ? getFeatureFlag(FEATURE_FLAGS.WELCOME_VIDEO).catch(() => "false")
    : Promise.resolve("false");
  const whatsappPlantaoNoticeFlagPromise = context.role === "broker"
    ? getFeatureFlag(FEATURE_FLAGS.WHATSAPP_PLANTAO_NOTICE).catch(() => "false")
    : Promise.resolve("false");
  const whatsappConnectionPromise = context.role === "broker"
    ? getWhatsAppConnection().catch(() => null)
    : Promise.resolve(null);
  const teamRankingFlagPromise = context.role === "supervisor"
    ? getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false")
    : Promise.resolve("false");
  const supervisorLitePromise = isSupervisorLiteAvailable(context);
  const managerLitePromise = isManagerLiteAvailable(context);
  const cleanUiPromise = isCleanUiOperationalEnabled(context.tenantId);
  // Visual Lite das telas internas: chave da empresa + modo normal (fora de um Lite próprio). Ver style-flag.ts.
  const directorLiteStylePromise = shouldUseDirectorLiteStyle(context).catch(() => false);
  // getFeatureFlag reads the shared getSystemSettings bulk cache used by the other layout flags.
  const negotiationsAreaPromise = context.role === "director" || context.role === "manager" || context.role === "supervisor"
    ? getFeatureFlag(FEATURE_FLAGS.NEGOTIATIONS_AREA).catch(() => "false")
    : Promise.resolve("false");
  const headersPromise = headers();
  // Tenant branding, the signed-in user and their membership in one round trip:
  // the layout renders on every navigation and every realtime refresh, and the
  // production pool has only a handful of sockets for the whole team.
  const shellPromise = getDatabase()
    .select({
      tenantName: schema.tenants.name,
      brandColor: schema.tenants.brandColor,
      logoUrl: schema.tenants.logoUrl,
      userName: schema.user.name,
      userEmail: schema.user.email,
      isPlatformAdmin: schema.user.isPlatformAdmin,
      availabilityStatus: schema.tenantMemberships.availabilityStatus,
      leadToastEnabled: schema.tenantMemberships.leadToastEnabled,
    })
    .from(schema.tenants)
    .leftJoin(schema.user, eq(schema.user.id, context.userId))
    .leftJoin(
      schema.tenantMemberships,
      and(
        eq(schema.tenantMemberships.tenantId, schema.tenants.id),
        eq(schema.tenantMemberships.userId, context.userId),
      ),
    )
    .where(eq(schema.tenants.id, context.tenantId))
    .limit(1);
  // Started now, not after the redirects below: each one is independent of the others.
  const pathnamePromise = headersPromise.then((list) => list.get("x-pathname") || "");
  const routeAccessPromise = pathnamePromise.then((pathname) => {
    const definition = getRouteDefinition(pathname.split("?")[0]);
    if (!definition || pathname === "") return true;
    return hasEffectiveRouteAccess({
      tenantId: context.tenantId,
      role: context.role,
      jobTitle: context.jobTitle,
      customRoleId: context.customRoleId ?? null,
      routeKey: definition.key,
      fallbackPermission: definition.fallbackPermission,
    });
  });
  const negotiationsRouteAccessPromise = resolveNegotiationsRouteAccess({
    featureSetting: negotiationsAreaPromise,
    role: context.role,
    getPathname: () => pathnamePromise,
    getCurrentRouteAccess: () => routeAccessPromise,
    checkRouteAccess: () => hasEffectiveRouteAccess({
      tenantId: context.tenantId,
      role: context.role,
      jobTitle: context.jobTitle,
      customRoleId: context.customRoleId ?? null,
      routeKey: "negociacoes",
      fallbackPermission: "ver_dashboard_equipe",
    }).catch(() => false),
  });
  // Leads waiting for this broker to accept: badge on the Fila tab of the app shell.
  const queueBadgeCountPromise = context.role === "broker"
    ? experienceModePromise.then(async (mode) => mode !== "LIGHT" ? 0 : Number((await getDatabase()
      .select({ total: count() })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.corretorId, context.userId),
        inArray(schema.leads.status, ["distributed", "new"]),
        isNull(schema.leads.archivedAt),
        isNull(schema.leads.deletedAt),
      )))[0]?.total ?? 0))
    : Promise.resolve(0);
  const realtimeSyncPromise = isRealtimeSyncEnabled();
  const teamManagementPromise = context.role === "manager" ? isTeamManagementEnabled() : Promise.resolve(false);
  // Keep a rejected early start from surfacing as unhandled when a redirect ends the render first.
  routeAccessPromise.catch(() => undefined);
  negotiationsRouteAccessPromise.catch(() => undefined);
  queueBadgeCountPromise.catch(() => undefined);
  realtimeSyncPromise.catch(() => undefined);
  teamManagementPromise.catch(() => undefined);

  const [
    experienceMode,
    headersList,
    shellRows,
    cleanUiEnabled,
    brokerDutyCalendarFlag,
    brokerJourneyFlag,
    relationshipFlag,
    teamRankingFlag,
    supervisorLiteAvailable,
    managerLiteAvailable,
    welcomeVideoFlag,
    whatsappPlantaoNoticeFlag,
    whatsappConnection,
    directorLiteStyleEnabled,
    negotiationsAreaSetting,
    negotiationsRouteAccess,
    illustrationsSetting,
  ] = await Promise.all([
    experienceModePromise,
    headersPromise,
    shellPromise,
    cleanUiPromise,
    brokerDutyCalendarFlagPromise,
    brokerJourneyFlagPromise,
    relationshipFlagPromise,
    teamRankingFlagPromise,
    supervisorLitePromise,
    managerLitePromise,
    welcomeVideoFlagPromise,
    whatsappPlantaoNoticeFlagPromise,
    whatsappConnectionPromise,
    directorLiteStylePromise,
    negotiationsAreaPromise,
    negotiationsRouteAccessPromise,
    illustrationsPromise,
  ]);

  // Flag criada no G0 (feature_team_management_enabled): só libera o item Gestão do gestor Lite.
  const teamManagementFlag = await teamManagementPromise;
  const isLightBroker = context.role === "broker" && experienceMode === "LIGHT";
  // Supervisor Lite (S2): same chrome, team screens only.
  const isLightSupervisor = supervisorLiteAvailable && experienceMode === "LIGHT";
  const isLightManager = managerLiteAvailable && experienceMode === "LIGHT";
  const liteAudience = isLightManager ? "manager" as const : isLightSupervisor ? "supervisor" as const : "broker" as const;
  const initialChatRail = isLightManager ? await getChatRailData() : null;

  const pathname = headersList.get("x-pathname") || "";

  if (isLightBroker && brokerJourneyFlag !== "true" && (pathname === "/jornada" || pathname === "/dashboard/c/jornada")) redirect("/dashboard");
  if (isLightBroker || isLightSupervisor || isLightManager) {
    if (!isLightRouteAllowed(pathname, liteAudience) && pathname !== "") {
      redirect("/dashboard");
    }
  }

  if (!hasPermission(context.role, "acessar_conversas")) {
    if (pathname === "/conversas" || pathname.startsWith("/conversas/")) {
      redirect("/minha-fila");
    }
  }

  if (context.jobTitle === "marketing") {
    const restrictedPrefixes = ["/conversas", "/tarefas", "/documentos", "/clientes", "/vendas", "/checklist", "/minha-fila", "/corretor", "/metas", "/relatorios", "/noc", "/filiais", "/unidades", "/gestor", "/diretor"];
    const isRestricted = restrictedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
    if (isRestricted) {
      redirect("/access-denied");
    }
  }

  if (!(await routeAccessPromise)) redirect("/access-denied");

  const [queueBadgeCount, realtimeSyncEnabled] = await Promise.all([queueBadgeCountPromise, realtimeSyncPromise]);

  const [shell] = shellRows;
  const tenant = shell ? { name: shell.tenantName, brandColor: shell.brandColor, logoUrl: shell.logoUrl } : undefined;
  const currentUser = shell && shell.userName !== null ? { name: shell.userName, email: shell.userEmail, isPlatformAdmin: shell.isPlatformAdmin } : undefined;
  // "Ver como": the real signed-in user is a platform admin (while viewing, context.viewAs says so).
  const viewAsState = {
    canViewAs: Boolean(context.viewAs) || Boolean(currentUser?.isPlatformAdmin),
    viewingAs: context.viewAs ? { name: currentUser?.name ?? "usuário", role: context.role } : null,
  };
  const membership = shell && shell.availabilityStatus !== null ? { availabilityStatus: shell.availabilityStatus, leadToastEnabled: shell.leadToastEnabled } : undefined;
  // With realtime switched off the server sends no signals; a null topic makes
  // the client fall back to periodic reconciliation instead of trusting a silent channel.
  const syncTopic = realtimeSyncEnabled
    ? getRealtimeSyncTopic({ tenantId: context.tenantId, userId: context.userId })
    : null;

  return (
    <AgentDrawerProvider>
      <ContextualIllustrationsProvider enabled={illustrationsSetting === "true" && (isLightBroker || (context.role === "director" && directorLiteStyleEnabled))}>
      <AppShell
        viewAs={viewAsState}
        cleanUiEnabled={cleanUiEnabled}
        directorLiteEnabled={directorLiteStyleEnabled}
        negotiationsEnabled={negotiationsAreaSetting === "true" && negotiationsRouteAccess}
        isLightBroker={isLightBroker || isLightSupervisor || isLightManager}
        liteAudience={liteAudience}
        initialChatRail={initialChatRail}
        queueBadgeCount={queueBadgeCount}
        showQuoteSimulator={isLightBroker}
        journeyEnabled={isLightBroker && brokerJourneyFlag === "true"}
        welcomeVideoEnabled={isLightBroker && welcomeVideoFlag === "true" && (process.env.WELCOME_VIDEO_TENANT_ID ?? "").split(",").map((id) => id.trim()).filter(Boolean).includes(context.tenantId)}
        teamRankingEnabled={isLightSupervisor && teamRankingFlag === "true"}
        teamManagementEnabled={isLightManager && teamManagementFlag}
        showDutyCalendar={isLightBroker && brokerDutyCalendarFlag === "true"}
        showRelationship={(isLightBroker || isLightSupervisor) && relationshipFlag === "true"}
        branding={{
          tenantName: tenant?.name ?? null,
          brandColor: tenant?.brandColor ?? null,
          logoUrl: tenant?.logoUrl ?? null,
        }}
        user={{
          name: currentUser?.name ?? null,
          email: currentUser?.email ?? null,
          role: context.role,
          jobTitle: context.jobTitle,
          isPlatformAdmin: currentUser?.isPlatformAdmin ?? false,
        }}
        initialAvailability={(membership?.availabilityStatus as "available" | "paused" | "offline") ?? "available"}
      >
        <TenantOnboardingDialogLoader />
        <DirectorWizardLoader />
        {/* Lite audiences skip route and availability onboarding dialogs. */}
        {isLightBroker || isLightSupervisor || isLightManager ? null : <RouteOnboardingLoader />}
        {isLightBroker || isLightSupervisor || isLightManager ? null : <BrokerAvailabilityOnboardingLoader />}
        <RealtimeSyncProvider
          tenantId={context.tenantId}
          userId={context.userId}
          role={context.role}
          syncTopic={syncTopic}
          leadToastEnabled={membership?.leadToastEnabled ?? true}
          leadNoticeStyle={isLightBroker ? "dynamic" : "toast"}
        >
          <NotificationCountProvider userId={context.userId}>
            <FeedbackToastHandler userId={context.userId} />
            <PasskeyToastHandler userId={context.userId} />
            <WhatsAppLinkHandler />
            {context.role === "broker" && whatsappPlantaoNoticeFlag === "true" && whatsappConnection && whatsappConnection.status !== "ready" ? (
              <WhatsAppPlantaoNotice userId={context.userId} mode="daily" />
            ) : null}
            {!isLightManager && <CommandPalette />}
            {!isLightBroker && !isLightManager && <SystemFeedbackDrawer />}
            {!isLightBroker && !isLightManager && <AgentDrawer />}
            {children}
          </NotificationCountProvider>
        </RealtimeSyncProvider>
      </AppShell>
      </ContextualIllustrationsProvider>
    </AgentDrawerProvider>
  );
}
