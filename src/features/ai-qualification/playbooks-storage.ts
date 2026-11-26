import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import {
  getDefaultPlaybooks,
  SituationalPlaybookItemSchema,
} from "./situations-catalog";
import type { SituationalPlaybookItem } from "@/shared/domain-root/situational-playbooks-root";

import { aiConfigTablesReady } from "./config-tables";
import { joinLegacyInstructions, splitLegacyInstructions, validPlaybookList } from "./playbooks-format";

function parseItem(item: unknown): SituationalPlaybookItem | null {
  const result = SituationalPlaybookItemSchema.safeParse(item);
  return result.success ? result.data : null;
}

/**
 * Carrega os playbooks do tenant: primeiro a tabela própria (migration 0241), depois o formato antigo dentro de
 * custom_instructions; sem nenhum dos dois, os padrões.
 */
export async function getTenantPlaybooks(tenantId: string): Promise<SituationalPlaybookItem[]> {
  try {
    const db = getDatabase();
    const ready = await aiConfigTablesReady();
    if (ready.playbooks) {
      const [row] = await db.select({ playbooks: schema.aiQualificationPlaybooks.playbooks })
        .from(schema.aiQualificationPlaybooks)
        .where(eq(schema.aiQualificationPlaybooks.tenantId, tenantId))
        .limit(1);
      if (row) return validPlaybookList(row.playbooks, parseItem) ?? getDefaultPlaybooks();
    }

    const [config] = await db
      .select({ customInstructions: schema.aiQualificationConfigs.customInstructions })
      .from(schema.aiQualificationConfigs)
      .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
      .limit(1);
    return validPlaybookList(splitLegacyInstructions(config?.customInstructions).playbooks, parseItem) ?? getDefaultPlaybooks();
  } catch (err) {
    console.error("[playbooks-storage] getTenantPlaybooks error, using defaults:", err);
    return getDefaultPlaybooks();
  }
}

/**
 * Salva os playbooks do tenant. Com a tabela própria, grava nela e limpa o bloco antigo de custom_instructions
 * (o texto do diretor fica intacto). Sem a tabela, mantém o formato antigo.
 */
export async function saveTenantPlaybooks(
  tenantId: string,
  playbooks: SituationalPlaybookItem[],
  actorUserId?: string | null,
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
  const parts = splitLegacyInstructions(config?.customInstructions);
  const ready = await aiConfigTablesReady();
  const now = new Date();

  if (ready.playbooks) {
    await db.insert(schema.aiQualificationPlaybooks)
      .values({ tenantId, playbooks, updatedBy: actorUserId ?? null, updatedAt: now })
      .onConflictDoUpdate({ target: schema.aiQualificationPlaybooks.tenantId, set: { playbooks, updatedBy: actorUserId ?? null, updatedAt: now } });
    if (config && parts.hadMarker) {
      await db.update(schema.aiQualificationConfigs)
        .set({ customInstructions: parts.instructions, updatedAt: now })
        .where(eq(schema.aiQualificationConfigs.id, config.id));
    }
    return;
  }

  if (config) {
    await db
      .update(schema.aiQualificationConfigs)
      .set({ customInstructions: joinLegacyInstructions(parts.instructions, playbooks), updatedAt: now })
      .where(eq(schema.aiQualificationConfigs.id, config.id));
  }
}
