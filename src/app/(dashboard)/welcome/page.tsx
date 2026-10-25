import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { WelcomeScreen } from "@/features/onboarding/components/welcome-screen";
import { WelcomeScreenLite } from "@/features/onboarding/components/welcome-screen-lite";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { getCurrentTenantOnboarding } from "@/features/onboarding/queries/get-current-tenant-onboarding";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";

export default async function WelcomePage() {
  const context = await getRequiredTenantContext();
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

  if (isMobile) {
    redirect("/dashboard");
  }

  const [tenant] = await getDatabase()
    .select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, context.tenantId))
    .limit(1);

  const [user] = await getDatabase()
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, context.userId))
    .limit(1);

  // Load real onboarding data
  const onboarding = await getCurrentTenantOnboarding();

  const role = context.role;

  // If onboarding is already dismissed/completed and user is going back to /welcome,
  // redirect to the appropriate dashboard
  if (onboarding?.dismissed || onboarding?.fullyCompleted) {
    const redirectMap = {
      director: "/dashboard",
      manager: "/dashboard",
      supervisor: "/dashboard",
      broker: "/minha-fila",
    } as const;
    redirect(redirectMap[role]);
  }

  if (await isDirectorLitePageOnServer(context, "/welcome")) {
    // Saudação pela hora de São Paulo, no servidor: o cliente não lê o relógio no primeiro render.
    const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
    const greeting = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
    return (
      <>
        <DashboardHeader breadcrumb="Início" title="Boas-vindas" />
        <main className={litePage.stack}>
          <WelcomeScreenLite userName={user?.name ?? "Usuário"} role={role} tenantName={tenant?.name ?? "Âncora Corretora"} onboarding={onboarding} greeting={greeting} />
        </main>
      </>
    );
  }

  return (
    <WelcomeScreen
      userName={user?.name ?? "Usuário"}
      role={role}
      tenantName={tenant?.name ?? "Âncora Corretora"}
      onboarding={onboarding}
    />
  );
}
