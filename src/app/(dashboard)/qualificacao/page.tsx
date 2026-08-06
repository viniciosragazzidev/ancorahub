import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { getTenantTestNumbers } from "@/features/ai-qualification/test-numbers-service";
import { QualificationHubClient } from "./_components/qualification-hub-client";

export const dynamic = "force-dynamic";

export default async function QualificacaoPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores têm permissão para acessar a qualificação por IA.");
  }

  const [settings, testNumbers] = await Promise.all([
    getQualificationTenantSettings(context.tenantId),
    getTenantTestNumbers(context.tenantId),
  ]);

  return <QualificationHubClient settings={settings} testNumbers={testNumbers} />;
}
