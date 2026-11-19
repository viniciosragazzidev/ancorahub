import "server-only";

import { randomUUID } from "node:crypto";

import { and, count, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import type { SasaReply } from "./command-core";
import { retentionCutoff, spDayStart, type SasaUsage } from "./limits";

/**
 * Gravação dos pedidos à Sasá em `sasa_commands` (migration 0233). Tudo aqui é tolerante à tabela
 * ausente: sem a migration, a Sasá continua respondendo, só sem histórico, teto e idempotência.
 */
function tableMissing(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${(error as { cause?: { message?: string } }).cause?.message ?? ""}` : String(error);
  return /sasa_commands/.test(text) && /does not exist|não existe/.test(text);
}

function warn(error: unknown) {
  if (!tableMissing(error)) console.error("[sasa] store failed", error);
}

/** Pedidos concluídos e áudio usados hoje (dia de São Paulo). */
export async function sasaUsageToday(tenantId: string, userId: string, now = new Date()): Promise<SasaUsage> {
  try {
    const [row] = await getDatabase()
      .select({ commands: count(), audio: sql<string | null>`coalesce(sum(${schema.sasaCommands.audioSeconds}), 0)` })
      .from(schema.sasaCommands)
      .where(and(
        eq(schema.sasaCommands.tenantId, tenantId),
        eq(schema.sasaCommands.userId, userId),
        gte(schema.sasaCommands.createdAt, spDayStart(now)),
        ne(schema.sasaCommands.status, "limited"),
      ));
    return { commands: Number(row?.commands ?? 0), audioSeconds: Number(row?.audio ?? 0) };
  } catch (error) {
    warn(error);
    return { commands: 0, audioSeconds: 0 };
  }
}

export type StoredCommand = { status: string; origin: string; transcript: string | null; audioSeconds: number | null; reply: SasaReply | null };

export async function findSasaCommand(tenantId: string, userId: string, clientCommandId: string): Promise<StoredCommand | null> {
  try {
    const [row] = await getDatabase()
      .select({ status: schema.sasaCommands.status, origin: schema.sasaCommands.origin, transcript: schema.sasaCommands.transcript, audioSeconds: schema.sasaCommands.audioSeconds, reply: schema.sasaCommands.reply })
      .from(schema.sasaCommands)
      .where(and(eq(schema.sasaCommands.tenantId, tenantId), eq(schema.sasaCommands.userId, userId), eq(schema.sasaCommands.clientCommandId, clientCommandId)))
      .limit(1);
    if (!row) return null;
    return { status: row.status, origin: row.origin, transcript: row.transcript, audioSeconds: row.audioSeconds === null ? null : Number(row.audioSeconds), reply: (row.reply as SasaReply | null) ?? null };
  } catch (error) {
    warn(error);
    return null;
  }
}

/** A rota de voz grava a transcrição; o pedido que chega depois com o mesmo id completa a linha. */
export async function recordSasaTranscription(input: { tenantId: string; userId: string; clientCommandId: string; transcript: string; audioSeconds: number }) {
  try {
    await getDatabase().insert(schema.sasaCommands).values({
      id: randomUUID(), tenantId: input.tenantId, userId: input.userId, clientCommandId: input.clientCommandId,
      origin: "voice", transcript: input.transcript, audioSeconds: String(input.audioSeconds), status: "transcribed",
    }).onConflictDoNothing();
  } catch (error) {
    warn(error);
  }
}

export async function saveSasaCommand(input: {
  tenantId: string; userId: string; clientCommandId: string; origin: "text" | "voice"; text: string;
  status: "answered" | "done" | "failed" | "not_command" | "limited"; tool?: string | null; via?: string | null; pickedLeadId?: string | null; reply?: SasaReply | null;
}) {
  const values = {
    tool: input.tool ?? null, via: input.via ?? null, status: input.status, pickedLeadId: input.pickedLeadId ?? null,
    reply: (input.reply ?? null) as Record<string, unknown> | null, updatedAt: new Date(),
  };
  try {
    await getDatabase().insert(schema.sasaCommands).values({
      id: randomUUID(), tenantId: input.tenantId, userId: input.userId, clientCommandId: input.clientCommandId,
      origin: input.origin, transcript: input.text, ...values,
    }).onConflictDoUpdate({ target: [schema.sasaCommands.userId, schema.sasaCommands.clientCommandId], set: values });
  } catch (error) {
    warn(error);
  }
}

/** Pergunta respondida lendo o ecossistema: guarda quais áreas foram lidas (auditoria). */
export async function markSasaAnswered(tenantId: string, userId: string, clientCommandId: string, areas: string[], via: string) {
  try {
    await getDatabase().update(schema.sasaCommands)
      .set({ status: "answered", tool: `ask:${areas.join(",")}`.slice(0, 120), via, updatedAt: new Date() })
      .where(and(eq(schema.sasaCommands.tenantId, tenantId), eq(schema.sasaCommands.userId, userId), eq(schema.sasaCommands.clientCommandId, clientCommandId)));
  } catch (error) {
    warn(error);
  }
}

/** D5: apaga o texto dito e a resposta dos pedidos com mais de 90 dias (a linha fica como trilha). */
export async function purgeOldSasaCommands(now = new Date(), batch = 5_000) {
  const db = getDatabase();
  const old = db.select({ id: schema.sasaCommands.id }).from(schema.sasaCommands)
    .where(and(isNull(schema.sasaCommands.purgedAt), lt(schema.sasaCommands.createdAt, retentionCutoff(now))))
    .limit(batch);
  const purged = await db.update(schema.sasaCommands)
    .set({ transcript: null, reply: null, purgedAt: now, updatedAt: now })
    .where(sql`${schema.sasaCommands.id} IN (${old})`)
    .returning({ id: schema.sasaCommands.id });
  return { purged: purged.length };
}
