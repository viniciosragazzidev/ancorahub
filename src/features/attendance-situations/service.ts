import "server-only";

import { eq } from "drizzle-orm";

import { loadQuickReplyTemplates } from "@/features/ai-agent/quick-reply";
import { getTenantPlaybooks } from "@/features/ai-qualification/playbooks-storage";
import type { SituationalPlaybookItem } from "@/shared/domain-root/situational-playbooks-root";
import { getDatabase, schema } from "@/shared/db";
import { BUILTIN_SITUATIONS, type SituationAction, type SituationKind, type TenantSituation } from "./catalog";

/** The tenant's rows (taught phrases, switches, own situations). Empty on any read failure: the engine keeps its defaults. */
export async function loadTenantSituations(tenantId: string): Promise<TenantSituation[]> {
  try {
    const rows = await getDatabase().select({
      key: schema.attendanceSituations.situationKey,
      kind: schema.attendanceSituations.kind,
      title: schema.attendanceSituations.title,
      examplePhrases: schema.attendanceSituations.examplePhrases,
      response: schema.attendanceSituations.response,
      action: schema.attendanceSituations.action,
      enabled: schema.attendanceSituations.enabled,
    }).from(schema.attendanceSituations).where(eq(schema.attendanceSituations.tenantId, tenantId));
    return rows.map((row) => ({ ...row, examplePhrases: Array.isArray(row.examplePhrases) ? row.examplePhrases.map(String) : [] }));
  } catch (error) {
    console.warn("[situations] load_failed_using_defaults", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return [];
  }
}

export type SituationRow = {
  id: string;
  key: string;
  kind: SituationKind;
  title: string;
  /** What the engine recognizes by itself (builtin) or the guidance trigger (guided). */
  recognizedBy: string[];
  /** Phrases the tenant taught (builtin) or its own phrases (custom). */
  phrases: string[];
  response: string;
  action: SituationAction | "guide";
  enabled: boolean;
  critical: boolean;
  guided?: SituationalPlaybookItem;
};

/** Every situation for Atendimento → Situações, in the order the engine checks them. */
export async function getSituationsOverview(tenantId: string): Promise<SituationRow[]> {
  const [situations, templates, playbooks] = await Promise.all([
    loadTenantSituations(tenantId),
    loadQuickReplyTemplates(tenantId).catch(() => ({} as Awaited<ReturnType<typeof loadQuickReplyTemplates>>)),
    getTenantPlaybooks(tenantId).catch(() => [] as SituationalPlaybookItem[]),
  ]);
  const rowOf = (key: string) => situations.find((item) => item.kind === "builtin" && item.key === key);
  const builtins: SituationRow[] = BUILTIN_SITUATIONS.map((builtin) => {
    const row = rowOf(builtin.key);
    return {
      id: `builtin:${builtin.key}`, key: builtin.key, kind: "builtin", title: builtin.label,
      recognizedBy: builtin.examples, phrases: row?.examplePhrases ?? [],
      response: templates[builtin.key]?.body ?? "", action: builtin.action,
      enabled: builtin.critical ? true : row?.enabled ?? true, critical: Boolean(builtin.critical),
    };
  });
  const customs: SituationRow[] = situations.filter((item) => item.kind === "custom").map((item) => ({
    id: item.key, key: item.key, kind: "custom", title: item.title ?? "Situação", recognizedBy: [],
    phrases: item.examplePhrases, response: item.response ?? "", action: item.action ?? "continue",
    enabled: item.enabled, critical: false,
  }));
  const guided: SituationRow[] = playbooks.map((playbook) => ({
    id: `guided:${playbook.id}`, key: playbook.key, kind: "guided", title: playbook.title,
    recognizedBy: [playbook.triggerCondition], phrases: playbook.exampleCustomerInput ? [playbook.exampleCustomerInput] : [],
    response: playbook.recommendedResponse, action: "guide", enabled: playbook.enabled, critical: false, guided: playbook,
  }));
  return [...builtins, ...customs, ...guided];
}
