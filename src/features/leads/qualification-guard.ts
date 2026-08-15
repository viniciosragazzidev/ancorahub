import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";

export const QUALIFIED_STAGES = [
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
  "converted",
] as const;

export const UNQUALIFIED_STATUSES = ["pending", "qualifying"] as const;

/**
 * Enforces lead qualification integrity rules across all leads in a tenant:
 * 1. If AI Qualification is ENABLED:
 *    - Leads in qualified stages MUST be qualified. Any unqualified lead ("pending"/"qualifying"/null)
 *      found in a qualified stage is automatically returned to the qualification queue (status: "new", qualificationStatus: "pending").
 * 2. If AI Qualification is DISABLED:
 *    - Leads in qualified stages receive the tag/status "ia_disabled" ("IA Desativada") if not already qualified.
 */
export async function enforceLeadQualificationRules(
  tenantId: string,
  actorUserId?: string
): Promise<{
  returnedToQueueCount: number;
  taggedIaDisabledCount: number;
}> {
  const db = getDatabase();
  const settings = await getQualificationTenantSettings(tenantId);
  const isAiEnabled = settings?.enabled ?? false;

  let returnedToQueueCount = 0;
  let taggedIaDisabledCount = 0;

  // Resolve an effective userId for system interaction logs if actorUserId is not provided
  let effectiveUserId = actorUserId;
  if (!effectiveUserId) {
    const [foundUser] = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(eq(schema.tenantMemberships.tenantId, tenantId))
      .limit(1);
    effectiveUserId = foundUser?.userId ?? (await db.select({ id: schema.user.id }).from(schema.user).limit(1))[0]?.id;
  }

  if (isAiEnabled) {
    // 1. AI is ENABLED: Find any lead in qualified stages that has not completed qualification
    const unqualifiedInActiveStages = await db
      .select({ id: schema.leads.id, status: schema.leads.status, nome: schema.leads.nome, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          isNull(schema.leads.deletedAt),
          inArray(schema.leads.status, [...QUALIFIED_STAGES]),
          or(
            inArray(schema.leads.qualificationStatus, [...UNQUALIFIED_STATUSES]),
            isNull(schema.leads.qualificationStatus)
          )
        )
      );

    if (unqualifiedInActiveStages.length > 0) {
      const now = new Date();
      for (const lead of unqualifiedInActiveStages) {
        await db
          .update(schema.leads)
          .set({
            status: "new",
            qualificationStatus: "pending",
            qualificationState: "PENDING",
            updatedAt: now,
          })
          .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, tenantId)));

        await db.insert(schema.leadInteractions).values({
          id: randomUUID(),
          leadId: lead.id,
          userId: lead.corretorId || effectiveUserId!,
          tipo: "system_alert",
          conteudo: "Lead retornado para a fila de qualificação pois a qualificação por IA está ativa e a etapa exige qualificação prévia.",
          createdAt: now,
        });
      }
      returnedToQueueCount = unqualifiedInActiveStages.length;
    }
  } else {
    // 2. AI is DISABLED: Tag leads in qualified stages with "ia_disabled" if currently pending/qualifying/null
    const untaggedInActiveStages = await db
      .select({ id: schema.leads.id, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          isNull(schema.leads.deletedAt),
          inArray(schema.leads.status, [...QUALIFIED_STAGES]),
          or(
            inArray(schema.leads.qualificationStatus, [...UNQUALIFIED_STATUSES]),
            isNull(schema.leads.qualificationStatus)
          )
        )
      );

    if (untaggedInActiveStages.length > 0) {
      const now = new Date();
      for (const lead of untaggedInActiveStages) {
        await db
          .update(schema.leads)
          .set({
            qualificationStatus: "ia_disabled",
            updatedAt: now,
          })
          .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, tenantId)));

        await db.insert(schema.leadInteractions).values({
          id: randomUUID(),
          leadId: lead.id,
          userId: lead.corretorId || effectiveUserId!,
          tipo: "system_alert",
          conteudo: "Etapa atualizada com a marcação 'IA Desativada' para diferenciar da qualificação automatizada.",
          createdAt: now,
        });
      }
      taggedIaDisabledCount = untaggedInActiveStages.length;
    }
  }

  return { returnedToQueueCount, taggedIaDisabledCount };
}

/**
 * Validates a lead status change request against qualification rules.
 * Throws an Error if transition violates qualification policies.
 * Returns the recommended qualificationStatus to set (e.g. "ia_disabled" if AI is OFF).
 */
export async function validateLeadStatusChangeQualification(input: {
  tenantId: string;
  leadId: string;
  newStatus: string;
  currentQualificationStatus: string | null;
}): Promise<{ allow: boolean; newQualificationStatus?: string }> {
  const targetIsQualifiedStage = (QUALIFIED_STAGES as readonly string[]).includes(input.newStatus);
  if (!targetIsQualifiedStage) {
    return { allow: true };
  }

  const settings = await getQualificationTenantSettings(input.tenantId);
  const isAiEnabled = settings?.enabled ?? false;

  const isAlreadyQualified =
    input.currentQualificationStatus &&
    !UNQUALIFIED_STATUSES.includes(input.currentQualificationStatus as any);

  if (isAiEnabled) {
    if (!isAlreadyQualified) {
      throw new Error(
        "A IA de Qualificação está ATIVADA. O lead obrigatoriamente precisa passar pela qualificação e ser aprovado antes de avançar para a área de qualificados."
      );
    }
    return { allow: true };
  } else {
    // AI is disabled -> Allow moving to qualified stages, but tag as "ia_disabled" if not already qualified
    if (!isAlreadyQualified) {
      return { allow: true, newQualificationStatus: "ia_disabled" };
    }
    return { allow: true };
  }
}
