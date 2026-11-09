import { notFound, redirect } from "next/navigation";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getPostSaleWorkspaceAction, previewPostSaleAudienceAction } from "@/features/post-sale-audit/actions";
import { POST_SALE_CAMPAIGN_MAX_LEADS, postSaleAudienceSchema, type PostSaleAudience } from "@/features/post-sale-audit/rules";
import { BrokerProfileViewerProvider } from "@/components/broker-profile-link";
import { PostSaleWorkspace } from "./post-sale-workspace";
import { parsePostSaleTab } from "./post-sale-tabs";

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
  return (
    <BrokerProfileViewerProvider viewerRole={context.role}>
      <PostSaleWorkspace initialTab={parsePostSaleTab(params.aba, rawLeadIds !== undefined)} initialData={initial.data} initialAudience={initialAudience} initialPreview={initialPreview} initialFeedback={initialFeedback} />
    </BrokerProfileViewerProvider>
  );
}
