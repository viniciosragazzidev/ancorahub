import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { AuthorizationError, AuthenticationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AppShell } from "@/components/app-shell";
import { getDatabase, schema } from "@/shared/db";
import { TenantOnboardingDialogLoader } from "@/features/onboarding/components/tenant-onboarding-dialog-loader";
import { DirectorWizardLoader } from "@/features/onboarding/components/director-wizard-loader";
import { RealtimeSyncProvider } from "@/components/providers/realtime-sync-provider";
import { NotificationCountProvider } from "@/components/providers/notification-count-provider";
import { FeedbackToastHandler } from "@/features/leads/components/feedback-toast-handler";
import { PasskeyToastHandler } from "@/components/passkey-toast-handler";
import { RouteOnboardingLoader } from "@/features/onboarding/components/route-onboarding-loader";
import { CommandPalette } from "@/components/command-palette";
import { SystemFeedbackDrawer } from "@/components/system-feedback-drawer";
import { AgentDrawerProvider } from "@/components/agent-drawer/agent-drawer-provider";
import { AgentDrawer } from "@/components/agent-drawer/agent-drawer";
import { getRealtimeSyncTopic } from "@/features/notifications/realtime-sync";

import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getSystemSetting } from "@/features/system-settings/queries";
import { hasPermission } from "@/shared/auth/permissions";

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
  const headersPromise = headers();
  const wahaConnectionsEnabledPromise =
    context.role === "broker"
      ? getSystemSetting("feature_waha_connections_enabled")
      : Promise.resolve("true");
  const tenantPromise = getDatabase()
    .select({
      name: schema.tenants.name,
      brandColor: schema.tenants.brandColor,
      logoUrl: schema.tenants.logoUrl,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, context.tenantId))
    .limit(1);

  const [experienceMode, headersList, tenantRows, wahaConnectionsEnabled] = await Promise.all([
    experienceModePromise,
    headersPromise,
    tenantPromise,
    wahaConnectionsEnabledPromise,
  ]);
  const isLightBroker = context.role === "broker" && experienceMode === "LIGHT";
  const showLightConversations =
    !isLightBroker ||
    wahaConnectionsEnabled !== "false";

  const pathname = headersList.get("x-pathname") || "";

  if (isLightBroker) {
    const allowedLightPrefixes = ["/dashboard", "/minha-fila", "/leads", "/clientes", "/conversas", "/l/", "/settings", "/notificacoes", "/primeiro-acesso"];
    const isAllowed = allowedLightPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix));
    if (!isAllowed && pathname !== "") {
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

  const [tenant] = tenantRows;
  const syncTopic = getRealtimeSyncTopic({ tenantId: context.tenantId, userId: context.userId });

  return (
    <AgentDrawerProvider>
      <AppShell
        isLightBroker={isLightBroker}
        showLightConversations={showLightConversations}
        branding={{
          tenantName: tenant?.name ?? null,
          brandColor: tenant?.brandColor ?? null,
          logoUrl: tenant?.logoUrl ?? null,
        }}
      >
        <TenantOnboardingDialogLoader />
        <DirectorWizardLoader />
        <RouteOnboardingLoader />
        <RealtimeSyncProvider
          tenantId={context.tenantId}
          userId={context.userId}
          role={context.role}
          syncTopic={syncTopic}
        >
          <NotificationCountProvider userId={context.userId}>
            <FeedbackToastHandler userId={context.userId} />
            <PasskeyToastHandler userId={context.userId} />
            <CommandPalette />
            <SystemFeedbackDrawer />
            <AgentDrawer />
            {children}
          </NotificationCountProvider>
        </RealtimeSyncProvider>
      </AppShell>
    </AgentDrawerProvider>
  );
}
