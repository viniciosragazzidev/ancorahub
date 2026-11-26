"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { dpoKey, isEmptyDpoInput, parseDpo, serializeDpo, validateDpoInput, type DataProtectionOfficer } from "./dpo";
import { mediaRetentionDays, mediaRetentionKey, parseMediaRetentionOption, serializeMediaRetentionPolicy, type MediaRetentionOption, type MediaRetentionPolicy } from "./media-retention";
import { countExpiredMedia, getMediaRetentionPolicy } from "./media-retention-store";

type Failure = { ok: false; error: string };

/** Encarregado de dados: só o diretor, só na própria empresa (a chave leva o tenant do contexto). Vazio apaga. */
export async function saveDpoAction(input: { name: string; email: string; phone: string }): Promise<{ ok: true; dpo: DataProtectionOfficer | null } | Failure> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor cadastra o encarregado de dados." };
    const previous = parseDpo(await getSystemSetting(dpoKey(context.tenantId)).catch(() => null));
    const now = new Date();
    let dpo: DataProtectionOfficer | null = null;
    if (isEmptyDpoInput(input)) {
      await setSystemSetting(dpoKey(context.tenantId), "", now);
    } else {
      const check = validateDpoInput(input);
      if (!check.ok) return { ok: false, error: check.error };
      dpo = { ...check.dpo, updatedAt: now.toISOString() };
      await setSystemSetting(dpoKey(context.tenantId), serializeDpo(dpo), now);
    }
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "tenant",
      entidadeId: context.tenantId,
      acao: "lgpd.encarregado_atualizado",
      metadata: { tenantId: context.tenantId, antes: previous ? { name: previous.name, email: previous.email } : null, depois: dpo ? { name: dpo.name, email: dpo.email } : null },
    });
    revalidatePath("/settings");
    return { ok: true, dpo };
  } catch {
    return { ok: false, error: "Não deu para salvar o encarregado agora." };
  }
}

/** Conta quantos arquivos a próxima limpeza apagaria com o prazo escolhido, antes de salvar. */
export async function previewMediaRetentionAction(option: string): Promise<{ ok: true; count: number } | Failure> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor define a retenção de mídia." };
    const parsed = parseMediaRetentionOption(option);
    if (!parsed) return { ok: false, error: "Escolha um prazo." };
    return { ok: true, count: await countExpiredMedia(context.tenantId, parsed) };
  } catch {
    return { ok: false, error: "Não deu para contar os arquivos agora." };
  }
}

export async function saveMediaRetentionAction(option: string): Promise<{ ok: true; policy: MediaRetentionPolicy; count: number } | Failure> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor define a retenção de mídia." };
    const parsed: MediaRetentionOption | null = parseMediaRetentionOption(option);
    if (!parsed) return { ok: false, error: "Escolha um prazo." };
    const previous = await getMediaRetentionPolicy(context.tenantId);
    const now = new Date();
    const count = await countExpiredMedia(context.tenantId, parsed, now).catch(() => null);
    const policy: MediaRetentionPolicy = { option: parsed, updatedBy: context.userId, updatedAt: now.toISOString() };
    await setSystemSetting(mediaRetentionKey(context.tenantId), serializeMediaRetentionPolicy(policy), now);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "tenant",
      entidadeId: context.tenantId,
      acao: "lgpd.retencao_midia_atualizada",
      metadata: { tenantId: context.tenantId, antesDias: mediaRetentionDays(previous.option), depoisDias: mediaRetentionDays(parsed), arquivosPrevistos: count },
    });
    revalidatePath("/settings");
    return { ok: true, policy, count: count ?? 0 };
  } catch {
    return { ok: false, error: "Não deu para salvar a retenção agora." };
  }
}
