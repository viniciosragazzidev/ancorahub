"use server";

import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { canAccessNegotiations, getNegotiationTimeline } from "./queries";
import { canOpenNegotiations } from "./negotiation-scope";
import { hasEffectiveRouteAccess } from "@/features/custom-roles/service";

const leadIdSchema = z.string().uuid();

export async function getNegotiationTimelineAction(leadId: string) {
  const parsed = leadIdSchema.safeParse(leadId);
  if (!parsed.success) return { success: false as const, error: "Lead inválido.", events: [] };
  try {
    const context = await getRequiredTenantContext();
    const enabled = await getFeatureFlag(FEATURE_FLAGS.NEGOTIATIONS_AREA).catch(() => "false");
    const routeAccess = await hasEffectiveRouteAccess({
      tenantId: context.tenantId,
      role: context.role,
      jobTitle: context.jobTitle,
      customRoleId: context.customRoleId ?? null,
      routeKey: "negociacoes",
      fallbackPermission: "ver_dashboard_equipe",
    });
    if (!canOpenNegotiations(context.role, enabled === "true", routeAccess && hasPermission(context.role, "ver_dashboard_equipe")) || !canAccessNegotiations(context)) {
      return { success: false as const, error: "A área de negociações não está disponível para este papel.", events: [] };
    }
    const events = await getNegotiationTimeline(context, parsed.data);
    return { success: true as const, events };
  } catch {
    return { success: false as const, error: "Não foi possível abrir este atendimento no seu escopo.", events: [] };
  }
}
