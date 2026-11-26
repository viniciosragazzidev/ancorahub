import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";

import { aiConfigTablesReady } from "./config-tables";
import { changedConfigFields, configSnapshotOf, parseConfigSnapshot } from "./config-versions-core";
import { resolveInstructionsForSave, stripPlaybooksFromInstructions } from "./playbooks-format";

export const pauseModeValues = ["finish_active", "handoff_active", "pause_immediately"] as const;
export type PauseMode = (typeof pauseModeValues)[number];

export const updateTenantSettingsSchema = z.object({
  enabled: z.boolean(),
  pauseMode: z.enum(pauseModeValues).optional().default("handoff_active"),
  assistantName: z.string().trim().max(100).optional().default("Assistente Âncora Corretora"),
  initialMessage: z.string().trim().max(5000).optional().default("Olá! Sou o assistente virtual da Âncora Corretora. Vou fazer algumas perguntas rápidas para preparar seu atendimento."),
  handoffMessage: z.string().trim().max(5000).optional().default("Vou encaminhar você para um corretor da equipe agora."),
  outOfHoursMessage: z.string().trim().max(5000).optional().default("Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento."),
  absenceMessage: z.string().trim().max(5000).optional().default("No momento não há um corretor disponível. Deixaremos seu atendimento na fila."),
  tone: z.string().trim().optional().default("friendly"),
  useEmojis: z.boolean().optional().default(false),
  timeoutMinutes: z.coerce.number().int().min(1).max(1440).optional().default(30),
  businessContext: z.string().trim().max(100000).optional().default(""),
  customInstructions: z.string().trim().max(100000).optional().default(""),
  /** Minutos de cooldown antes de repetir o mesmo template de quick reply (default: 10) */
  quickReplyCooldownMinutes: z.coerce.number().int().optional().default(10),
  /** Janela de tempo (minutos) para contar respostas de "aguardando" (default: 30) */
  quickReplyWaitWindowMinutes: z.coerce.number().int().optional().default(30),
  /** Máximo de respostas de "aguardando" antes de suprimir (default: 2) */
  quickReplyWaitLimitCount: z.coerce.number().int().optional().default(2),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

type RawSettings = typeof schema.aiQualificationConfigs.$inferSelect;

/** O campo "Diretrizes" nunca mostra nem manda para o prompt o bloco antigo de playbooks. */
function withCleanInstructions<T extends RawSettings | null | undefined>(row: T): T {
  if (!row) return row;
  return { ...row, customInstructions: stripPlaybooksFromInstructions(row.customInstructions) };
}

export async function getQualificationTenantSettings(tenantId: string) {
  return withCleanInstructions(await getRawQualificationTenantSettings(tenantId));
}

async function getRawQualificationTenantSettings(tenantId: string) {
  const db = getDatabase();
  const [existing] = await db
    .select()
    .from(schema.aiQualificationConfigs)
    .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
    .orderBy(desc(schema.aiQualificationConfigs.updatedAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const [created] = await db
    .insert(schema.aiQualificationConfigs)
    .values({
      id: randomUUID(),
      tenantId,
      enabled: false,
      pauseMode: "handoff_active",
      assistantName: "Assistente Âncora Corretora",
      initialMessage:
        "Olá! Sou o assistente virtual da Âncora Corretora. Vou fazer algumas perguntas rápidas para preparar seu atendimento.",
      finalMessage: "Obrigado! Um corretor continuará seu atendimento em seguida.",
      handoffMessage: "Vou encaminhar você para um corretor da equipe agora.",
      outOfHoursMessage:
        "Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento.",
      absenceMessage:
        "No momento não há um corretor disponível. Deixaremos seu atendimento na fila.",
      language: "pt-BR",
      tone: "friendly",
      useEmojis: false,
      formOfAddress: "voce",
      maxConversationMinutes: 30,
      maxQuestions: 6,
      objectives: ["understand_need", "route_to_broker"],
      timeoutMinutes: 30,
      maxRetries: 2,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  return (
    created ??
    (
      await db
        .select()
        .from(schema.aiQualificationConfigs)
        .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
        .orderBy(desc(schema.aiQualificationConfigs.updatedAt))
        .limit(1)
    )[0] ??
    null
  );
}

export async function updateQualificationTenantSettings(
  tenantId: string,
  actorUserId: string,
  input: UpdateTenantSettingsInput,
  options: { restoredFromVersion?: number | null } = {},
) {
  const data = updateTenantSettingsSchema.parse(input);
  const db = getDatabase();
  const current = await getRawQualificationTenantSettings(tenantId);
  const now = new Date();
  const ready = await aiConfigTablesReady();
  const [playbooksRow] = ready.playbooks
    ? await db.select({ tenantId: schema.aiQualificationPlaybooks.tenantId }).from(schema.aiQualificationPlaybooks)
      .where(eq(schema.aiQualificationPlaybooks.tenantId, tenantId)).limit(1)
    : [];
  // Playbooks fora do texto livre (0241): o campo sai limpo; sem a tabela, o bloco antigo é preservado no fim.
  const instructions = resolveInstructionsForSave({
    incoming: data.customInstructions,
    stored: current?.customInstructions,
    playbooksTableReady: ready.playbooks,
    tableHasPlaybooks: Boolean(playbooksRow),
  });
  if (instructions.migratePlaybooks) {
    await db.insert(schema.aiQualificationPlaybooks)
      .values({ tenantId, playbooks: instructions.migratePlaybooks, updatedBy: actorUserId, updatedAt: now })
      .onConflictDoNothing();
  }
  const nextVersion = (current?.version ?? 0) + 1;

  await db
    .update(schema.aiQualificationConfigs)
    .set({
      enabled: data.enabled,
      pauseMode: data.pauseMode,
      assistantName: data.assistantName,
      initialMessage: data.initialMessage,
      handoffMessage: data.handoffMessage,
      outOfHoursMessage: data.outOfHoursMessage,
      absenceMessage: data.absenceMessage,
      tone: data.tone,
      useEmojis: data.useEmojis,
      timeoutMinutes: data.timeoutMinutes,
      businessContext: data.businessContext ?? "",
      customInstructions: instructions.customInstructions,
      quickReplyCooldownMinutes: data.quickReplyCooldownMinutes,
      quickReplyWaitWindowMinutes: data.quickReplyWaitWindowMinutes,
      quickReplyWaitLimitCount: data.quickReplyWaitLimitCount,
      version: nextVersion,
      updatedBy: actorUserId,
      updatedAt: now,
    })
    .where(eq(schema.aiQualificationConfigs.tenantId, tenantId));

  if (ready.versions) {
    const recording = recordConfigVersion({
      tenantId,
      actorUserId,
      previous: current ? withCleanInstructions(current) : null,
      next: { ...data, customInstructions: stripPlaybooksFromInstructions(instructions.customInstructions) },
      version: nextVersion,
      restoredFromVersion: options.restoredFromVersion ?? null,
      now,
    });
    // Restaurar só confirma com a versão gravada; o salvar comum nunca cai por causa do histórico.
    if (options.restoredFromVersion) await recording;
    else await recording.catch((error) => console.warn("[ai-qualification] config_version_not_recorded", error instanceof Error ? error.message.slice(0, 160) : error));
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_config",
    entidadeId: tenantId,
    acao: options.restoredFromVersion
      ? `qualification_settings.restored:${options.restoredFromVersion}->${nextVersion}`
      : data.enabled ? "qualification_settings.enabled" : "qualification_settings.disabled",
  });

  return getQualificationTenantSettings(tenantId);
}

/**
 * Grava a versão do salvar (0241). Na primeira vez do tenant, guarda antes a versão de partida (o que estava valendo),
 * para que dê para voltar a ela.
 */
async function recordConfigVersion(input: {
  tenantId: string;
  actorUserId: string;
  previous: RawSettings | null;
  next: Record<string, unknown>;
  version: number;
  restoredFromVersion: number | null;
  now: Date;
}) {
  const db = getDatabase();
  const table = schema.aiQualificationConfigVersions;
  const [last] = await db.select({ version: table.version, snapshot: table.snapshot }).from(table)
    .where(eq(table.tenantId, input.tenantId)).orderBy(desc(table.version)).limit(1);
  let previousSnapshot = last ? parseConfigSnapshot(last.snapshot) : null;
  if (!last && input.previous) {
    previousSnapshot = configSnapshotOf(input.previous as unknown as Record<string, unknown>);
    const baseVersion = Math.max(1, Math.min(input.previous.version, input.version - 1));
    await db.insert(table).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      version: baseVersion,
      snapshot: previousSnapshot,
      changedFields: [],
      createdBy: input.previous.updatedBy ?? null,
      createdAt: input.previous.updatedAt ?? input.previous.createdAt ?? input.now,
    }).onConflictDoNothing();
  }
  const snapshot = configSnapshotOf(input.next);
  const version = last && last.version >= input.version ? last.version + 1 : input.version;
  await db.insert(table).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    version,
    snapshot,
    changedFields: changedConfigFields(previousSnapshot, snapshot),
    restoredFromVersion: input.restoredFromVersion,
    createdBy: input.actorUserId,
    createdAt: input.now,
  });
}

export async function setQualificationEnabled(tenantId: string, actorUserId: string, enabled: boolean) {
  const db = getDatabase();
  const current = await getQualificationTenantSettings(tenantId);
  const now = new Date();

  if (current) {
    await db
      .update(schema.aiQualificationConfigs)
      .set({
        enabled,
        updatedBy: actorUserId,
        updatedAt: now,
      })
      .where(eq(schema.aiQualificationConfigs.tenantId, tenantId));
  } else {
    await db.insert(schema.aiQualificationConfigs).values({
      id: randomUUID(),
      tenantId,
      enabled,
      pauseMode: "handoff_active",
      assistantName: "Assistente Âncora Corretora",
      initialMessage: "Olá! Sou o assistente virtual da Âncora Corretora.",
      finalMessage: "Obrigado! Um corretor continuará seu atendimento em seguida.",
      handoffMessage: "Vou encaminhar você para um corretor da equipe agora.",
      outOfHoursMessage: "Recebemos sua mensagem. Responderemos no próximo horário.",
      absenceMessage: "No momento não há um corretor disponível.",
      language: "pt-BR",
      tone: "friendly",
      useEmojis: false,
      formOfAddress: "voce",
      maxConversationMinutes: 30,
      maxQuestions: 6,
      objectives: ["understand_need", "route_to_broker"],
      timeoutMinutes: 30,
      maxRetries: 2,
      createdAt: now,
      updatedAt: now,
      updatedBy: actorUserId,
    });
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_config",
    entidadeId: tenantId,
    acao: enabled ? "qualification_settings.enabled" : "qualification_settings.disabled",
  });

  return getQualificationTenantSettings(tenantId);
}

export async function isQualificationEnabledForTenant(tenantId: string): Promise<boolean> {
  const [globalEngineFlag, settings] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.AI_ENABLED),
    getQualificationTenantSettings(tenantId),
  ]);

  if (globalEngineFlag === "false") return false;
  return Boolean(settings?.enabled);
}
