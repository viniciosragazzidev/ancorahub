import "server-only";

import { getSystemSettings } from "@/features/system-settings/queries";

import { proposalDefaultsKeys, resolveProposalDefaults, type ProposalDefaults } from "./proposal-rules";

/** Validade e condições padrão da corretora (system_settings por empresa), com o padrão do sistema quando vazias. */
export async function getProposalDefaults(tenantId: string): Promise<ProposalDefaults> {
  const keys = proposalDefaultsKeys(tenantId);
  try {
    const rows = await getSystemSettings([keys.validDays, keys.conditions]);
    const value = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
    return resolveProposalDefaults({ validDays: value(keys.validDays), conditions: value(keys.conditions) });
  } catch {
    return resolveProposalDefaults({});
  }
}
