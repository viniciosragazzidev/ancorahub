import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { WelcomeScreen } from "@/features/onboarding/components/welcome-screen";
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

  const role = context.role as "director" | "manager" | "broker";

  // If onboarding is already dismissed/completed and user is going back to /welcome,
  // redirect to the appropriate dashboard
  if (onboarding?.dismissed || onboarding?.fullyCompleted) {
    const redirectMap = {
      director: "/dashboard",
      manager: "/dashboard",
      broker: "/minha-fila",
    } as const;
    redirect(redirectMap[role]);
  }

  return (
    <WelcomeScreen
      userName={user?.name ?? "Usuário"}
      role={role}
      tenantName={tenant?.name ?? "CorreTop"}
      onboarding={onboarding}
    />
  );
}
