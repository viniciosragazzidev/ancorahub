"use server";

import { randomUUID } from "node:crypto";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { getTwoFactorPolicy } from "./two-factor-policy-server";
import {
  MAX_TWO_FACTOR_GRACE_DAYS,
  MIN_TWO_FACTOR_GRACE_DAYS,
  nextTwoFactorPolicy,
  parseTwoFactorGraceDays,
  parseTwoFactorPolicyScope,
  serializeTwoFactorPolicy,
  twoFactorPolicyKey,
  type TwoFactorPolicy,
} from "./two-factor-policy";

export type TwoFactorPolicyActionState = { success: boolean; error?: string; policy?: TwoFactorPolicy };

/** Só o diretor exige 2FA da equipe, e só na própria empresa (a chave leva o tenant do contexto). */
export async function updateTwoFactorPolicyAction(_prev: TwoFactorPolicyActionState, formData: FormData): Promise<TwoFactorPolicyActionState> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Só o diretor exige a verificação em duas etapas da equipe." };

    const scope = parseTwoFactorPolicyScope(formData.get("scope"));
    if (!scope) return { success: false, error: "Escolha de quem exigir." };
    const graceDays = parseTwoFactorGraceDays(formData.get("graceDays"));
    if (graceDays === null) return { success: false, error: `Informe uma carência entre ${MIN_TWO_FACTOR_GRACE_DAYS} e ${MAX_TWO_FACTOR_GRACE_DAYS} dias.` };

    const now = new Date();
    const previous = await getTwoFactorPolicy(context.tenantId);
    const policy = nextTwoFactorPolicy(previous, { scope, graceDays }, now);
    await setSystemSetting(twoFactorPolicyKey(context.tenantId), serializeTwoFactorPolicy(policy), now);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "tenant",
      entidadeId: context.tenantId,
      acao: "atualizou_exigencia_2fa",
      metadata: { scope: policy.scope, graceDays: policy.graceDays, since: policy.since },
    });
    return { success: true, policy };
  } catch {
    return { success: false, error: "Não deu para salvar a exigência agora." };
  }
}
