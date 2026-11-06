import { notFound, redirect } from "next/navigation";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getPostSaleWorkspaceAction } from "@/features/post-sale-audit/actions";
import { PostSaleWorkspace } from "./post-sale-workspace";

export default async function PostSalePage() {
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
  const initial = await getPostSaleWorkspaceAction();
  if (!initial.ok) redirect("/access-denied");
  return <PostSaleWorkspace initialData={initial.data} />;
}
