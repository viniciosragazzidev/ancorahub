import { notFound, redirect } from "next/navigation";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getPostSaleWorkspaceAction, previewPostSaleAudienceAction } from "@/features/post-sale-audit/actions";
import { POST_SALE_CAMPAIGN_MAX_LEADS, postSaleAudienceSchema, type PostSaleAudience } from "@/features/post-sale-audit/rules";
import { BrokerProfileViewerProvider } from "@/components/broker-profile-link";
import { UnitManagerLinks } from "@/features/dashboard/components/allowed-link";
import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { PostSaleWorkspace } from "./post-sale-workspace";
import { isLegacyResponsesTab, parsePostSaleTab } from "./post-sale-tabs";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";

type PostSaleSearchParams = Promise<{ period?: string; leadIds?: string | string[]; aba?: string | string[] }>;

function reportPeriod(value: string | undefined) {
  return value === "7" || value === "90" ? Number(value) : 30;
}

export default async function PostSalePage({ searchParams }: { searchParams: PostSaleSearchParams }) {
  const params = await searchParams;
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  if (context.role === "manager" && !context.branchId) redirect("/access-denied");
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") notFound();
  const canAccess = await hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_leads",
  });
  if (!canAccess) redirect("/access-denied");
  const initial = await getPostSaleWorkspaceAction(reportPeriod(params.period));
  if (!initial.ok) redirect("/access-denied");
  const rawLeadIds = Array.isArray(params.leadIds) ? params.leadIds.join(",") : params.leadIds;
  let initialAudience: PostSaleAudience | undefined;
  let initialPreview: Awaited<ReturnType<typeof previewPostSaleAudienceAction>> | undefined;
  let initialFeedback: string | undefined;
  if (rawLeadIds !== undefined) {
    const leadIds = [...new Set(rawLeadIds.split(",").map((id) => id.trim()).filter(Boolean))];
    if (leadIds.length > POST_SALE_CAMPAIGN_MAX_LEADS) {
      initialFeedback = `Selecione até ${POST_SALE_CAMPAIGN_MAX_LEADS} leads por campanha.`;
    } else {
      const parsed = postSaleAudienceSchema.safeParse({ kind: "leadIds", leadIds });
      if (!parsed.success) initialFeedback = "A seleção de leads não é válida. Selecione novamente na lista.";
      else {
        initialAudience = parsed.data;
        initialPreview = await previewPostSaleAudienceAction(initialAudience);
      }
    }
  }
  const sent = initial.data.surveys.filter((row) => row.sentAt).length;
  const answered = initial.data.surveys.filter((row) => row.lastReplyAt).length;
  const summary = `${sent.toLocaleString("pt-BR")} ${sent === 1 ? "pesquisa enviada" : "pesquisas enviadas"} e ${answered.toLocaleString("pt-BR")} ${answered === 1 ? "respondida" : "respondidas"} nos últimos ${initial.data.periodDays} dias`;
  return (
    <BrokerProfileViewerProvider viewerRole={context.role}>
      {/* Gestor de unidade (20/11): "Abrir conversa" leva às conversas de qualificação, que são do diretor, e sai. */}
      <UnitManagerLinks active={isOutsideManagerScope(context.role, context.jobTitle)}>
        <DashboardHeader breadcrumb="Equipe" title="Pós-venda" summary={summary} />
        <main className={litePage.stack}>
          <PostSaleWorkspace initialTab={parsePostSaleTab(params.aba, rawLeadIds !== undefined)} initialRespondedOnly={isLegacyResponsesTab(params.aba)} initialData={initial.data} initialAudience={initialAudience} initialPreview={initialPreview} initialFeedback={initialFeedback} />
        </main>
      </UnitManagerLinks>
    </BrokerProfileViewerProvider>
  );
}
