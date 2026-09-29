import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import {
  getDefaultPlaybooks,
  SituationalPlaybookItemSchema,
} from "./situations-catalog";
import type { SituationalPlaybookItem } from "@/shared/domain-root/situational-playbooks-root";

const PLAYBOOK_METADATA_HEADER = "---SITUATIONAL_PLAYBOOKS_JSON---";

/**
 * Carrega os playbooks salvos do tenant (ou retorna os defaults se não houver customização).
 */
export async function getTenantPlaybooks(tenantId: string): Promise<SituationalPlaybookItem[]> {
  try {
    const db = getDatabase();
    const [config] = await db
      .select({
        customInstructions: schema.aiQualificationConfigs.customInstructions,
      })
      .from(schema.aiQualificationConfigs)
      .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
      .limit(1);

    if (!config?.customInstructions) {
      return getDefaultPlaybooks();
    }

    const text = config.customInstructions;
    const headerIdx = text.indexOf(PLAYBOOK_METADATA_HEADER);
    if (headerIdx === -1) {
      return getDefaultPlaybooks();
    }

    const jsonStr = text.substring(headerIdx + PLAYBOOK_METADATA_HEADER.length).trim();
    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const validated = parsed
        .map((p) => {
          const res = SituationalPlaybookItemSchema.safeParse(p);
          return res.success ? res.data : null;
        })
        .filter((p): p is SituationalPlaybookItem => p !== null);

      if (validated.length > 0) {
        return validated;
      }
    }

    return getDefaultPlaybooks();
  } catch (err) {
    console.error("[playbooks-storage] getTenantPlaybooks error, using defaults:", err);
    return getDefaultPlaybooks();
  }
}

/**
 * Salva os playbooks customizados para o tenant.
 */
export async function saveTenantPlaybooks(
  tenantId: string,
  playbooks: SituationalPlaybookItem[],
): Promise<void> {
  const db = getDatabase();
  const [config] = await db
    .select({
      id: schema.aiQualificationConfigs.id,
      customInstructions: schema.aiQualificationConfigs.customInstructions,
    })
    .from(schema.aiQualificationConfigs)
    .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
    .limit(1);

  let cleanInstructions = "";
  if (config?.customInstructions) {
    const headerIdx = config.customInstructions.indexOf(PLAYBOOK_METADATA_HEADER);
    cleanInstructions = headerIdx !== -1
      ? config.customInstructions.substring(0, headerIdx).trim()
      : config.customInstructions.trim();
  }

  const jsonPayload = JSON.stringify(playbooks, null, 2);
  const updatedInstructions = cleanInstructions
    ? `${cleanInstructions}\n\n${PLAYBOOK_METADATA_HEADER}\n${jsonPayload}`
    : `${PLAYBOOK_METADATA_HEADER}\n${jsonPayload}`;

  if (config) {
    await db
      .update(schema.aiQualificationConfigs)
      .set({
        customInstructions: updatedInstructions,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiQualificationConfigs.id, config.id));
  }
}
