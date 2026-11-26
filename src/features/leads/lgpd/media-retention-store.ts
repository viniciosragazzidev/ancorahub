import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { getSystemSetting, getSystemSettings } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { JOB_LEASE_PREFIX } from "@/shared/db/job-lease";
import { deleteR2Object } from "@/shared/storage/r2-storage";

import {
  MEDIA_RETENTION_KEY_PREFIX,
  mediaRetentionCutoff,
  mediaRetentionDays,
  mediaRetentionKey,
  parseMediaRetentionPolicy,
  removedMediaBody,
  selectExpiredMedia,
  type MediaRetentionCandidate,
  type MediaRetentionOption,
  type MediaRetentionPolicy,
} from "./media-retention";

/** A política da empresa; sem leitura, vale "Sempre" (nunca apaga por falha de banco). */
export async function getMediaRetentionPolicy(tenantId: string): Promise<MediaRetentionPolicy> {
  try {
    return parseMediaRetentionPolicy(await getSystemSetting(mediaRetentionKey(tenantId)));
  } catch {
    return parseMediaRetentionPolicy(null);
  }
}

const m = schema.whatsappMessages;
const l = schema.leads;

/**
 * O mesmo filtro da regra pura, no SQL: mensagem com arquivo guardado, de lead (não de cliente) perdido ou
 * arquivado, nunca convertido, sem cliente, sem venda, cujo arquivo não é também um documento da ficha, e com a
 * data de referência (mensagem, perda ou arquivamento, a mais recente) antes do corte.
 */
function expiredMediaWhere(tenantId: string, cutoff: Date) {
  return and(
    eq(m.tenantId, tenantId),
    isNotNull(m.mediaStorageKey),
    isNull(m.clientId),
    ne(l.status, "converted"),
    or(eq(l.status, "lost"), isNotNull(l.archivedAt)),
    sql`not exists (select 1 from ${schema.clients} c where c.lead_id = ${l.id})`,
    sql`not exists (select 1 from ${schema.sales} s where s.lead_id = ${l.id})`,
    sql`not exists (select 1 from ${schema.leadDocuments} d where d.storage_key = ${m.mediaStorageKey})`,
    sql`greatest(${m.sentAt}, case when ${l.status} = 'lost' then ${l.stageEnteredAt} end, ${l.archivedAt}) < ${cutoff.toISOString()}::timestamptz`,
  );
}

/** "Próxima limpeza remove cerca de N arquivos": a conta com o prazo escolhido, antes de salvar. */
export async function countExpiredMedia(tenantId: string, option: MediaRetentionOption, now = new Date()): Promise<number> {
  const cutoff = mediaRetentionCutoff(option, now);
  if (!cutoff) return 0;
  const [row] = await getDatabase()
    .select({ value: sql<number>`count(*)::int` })
    .from(m)
    .innerJoin(l, and(eq(l.id, m.leadId), eq(l.tenantId, m.tenantId)))
    .where(expiredMediaWhere(tenantId, cutoff));
  return Number(row?.value ?? 0);
}

type ExpiredRow = MediaRetentionCandidate & { body: string };

async function listExpiredMedia(tenantId: string, option: MediaRetentionOption, now: Date, limit: number): Promise<ExpiredRow[]> {
  const cutoff = mediaRetentionCutoff(option, now);
  if (!cutoff) return [];
  const rows = await getDatabase()
    .select({
      messageId: m.id,
      storageKey: m.mediaStorageKey,
      sentAt: m.sentAt,
      clientId: m.clientId,
      body: m.body,
      status: l.status,
      archivedAt: l.archivedAt,
      stageEnteredAt: l.stageEnteredAt,
      hasClient: sql<boolean>`exists (select 1 from ${schema.clients} c where c.lead_id = ${l.id})`,
      hasSale: sql<boolean>`exists (select 1 from ${schema.sales} s where s.lead_id = ${l.id})`,
    })
    .from(m)
    .innerJoin(l, and(eq(l.id, m.leadId), eq(l.tenantId, m.tenantId)))
    .where(expiredMediaWhere(tenantId, cutoff))
    .limit(limit);
  // A regra pura confere cada linha de novo: o SQL só adianta o filtro.
  return selectExpiredMedia(rows.map((row) => ({
    messageId: row.messageId,
    storageKey: row.storageKey,
    sentAt: new Date(row.sentAt),
    clientId: row.clientId,
    body: row.body,
    lead: {
      status: row.status,
      archivedAt: row.archivedAt ? new Date(row.archivedAt) : null,
      stageEnteredAt: row.stageEnteredAt ? new Date(row.stageEnteredAt) : null,
      hasClient: Boolean(row.hasClient),
      hasSale: Boolean(row.hasSale),
    },
  })), option, now);
}

const SLOT_KEY = `${JOB_LEASE_PREFIX}media-retention-next`;
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CATCH_UP_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 100;
const DELETE_CONCURRENCY = 8;

/** Uma rodada a cada 6 h (a rota de expurgo roda todo minuto). A linha diz "próxima rodada em <hora>". */
async function claimRunSlot(now: Date): Promise<boolean> {
  const next = new Date(now.getTime() + RUN_INTERVAL_MS).toISOString();
  const rows = await getDatabase().execute(sql`
    insert into system_settings (key, value, updated_at)
    values (${SLOT_KEY}, ${next}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
    where system_settings.value < ${now.toISOString()}
    returning key
  `);
  const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
  return list.length > 0;
}

async function scheduleCatchUp(now: Date) {
  const next = new Date(now.getTime() + CATCH_UP_INTERVAL_MS).toISOString();
  await getDatabase().execute(sql`update system_settings set value = ${next}, updated_at = now() where key = ${SLOT_KEY}`).catch(() => undefined);
}

async function deleteFiles(keys: string[]) {
  const deleted = new Set<string>();
  for (let index = 0; index < keys.length; index += DELETE_CONCURRENCY) {
    const slice = keys.slice(index, index + DELETE_CONCURRENCY);
    const results = await Promise.allSettled(slice.map(async (key) => { await deleteR2Object(key); return key; }));
    for (const result of results) if (result.status === "fulfilled") deleted.add(result.value);
  }
  return deleted;
}

export type MediaRetentionRunResult =
  | { ran: false; reason: "not_due" | "storage_off" }
  | { ran: true; tenants: number; removed: number; failed: number; more: boolean };

/**
 * A limpeza, dentro da rota de expurgo (/api/internal/jobs/purge, sem tarefa nova no Coolify). Só arquivos: a
 * mensagem fica, o texto ganha o aviso e as colunas da mídia saem. Arquivo que falhou continua para a próxima
 * rodada; o que já saiu não entra de novo (idempotente). Cada empresa com arquivo removido ganha uma linha em
 * audit_logs no nome de quem escolheu o prazo.
 */
export async function runMediaRetention(options: { now?: Date; budgetMs?: number } = {}): Promise<MediaRetentionRunResult> {
  const now = options.now ?? new Date();
  const deadline = Date.now() + (options.budgetMs ?? 20_000);
  if (!(await claimRunSlot(now))) return { ran: false, reason: "not_due" };
  // Sem o armazenamento ligado, nada sai do registro: a mídia ficaria marcada como removida sem ter sido.
  if (!(await isR2StorageEnabled().catch(() => false))) return { ran: false, reason: "storage_off" };

  const settings = await getSystemSettings();
  const policies = settings
    .filter((setting) => setting.key.startsWith(MEDIA_RETENTION_KEY_PREFIX))
    .map((setting) => ({ tenantId: setting.key.slice(MEDIA_RETENTION_KEY_PREFIX.length), policy: parseMediaRetentionPolicy(setting.value) }))
    .filter((item) => item.tenantId && item.policy.option !== "always");

  const db = getDatabase();
  let removed = 0;
  let failed = 0;
  let more = false;
  let tenants = 0;
  for (const { tenantId, policy } of policies) {
    if (Date.now() > deadline) { more = true; break; }
    let tenantRemoved = 0;
    let tenantFailed = 0;
    for (;;) {
      if (Date.now() > deadline) { more = true; break; }
      const batch = await listExpiredMedia(tenantId, policy.option, now, BATCH_SIZE);
      const work = batch.filter((row) => row.storageKey);
      if (!work.length) break;
      const deleted = await deleteFiles([...new Set(work.map((row) => row.storageKey!))]);
      for (const row of work) {
        if (!deleted.has(row.storageKey!)) { tenantFailed += 1; continue; }
        await db.update(m).set({
          body: removedMediaBody(row.body),
          mediaKind: null,
          mediaMimeType: null,
          mediaFilename: null,
          mediaSizeBytes: null,
          mediaStorageKey: null,
          mediaProviderId: null,
          mediaSha256: null,
        }).where(and(eq(m.tenantId, tenantId), eq(m.id, row.messageId), eq(m.mediaStorageKey, row.storageKey!)));
        tenantRemoved += 1;
      }
      // Lote todo falhou: para esta empresa, tenta de novo na próxima rodada em vez de girar no mesmo lote.
      if (!deleted.size) break;
      if (batch.length < BATCH_SIZE) break;
    }
    if (tenantRemoved || tenantFailed) tenants += 1;
    removed += tenantRemoved;
    failed += tenantFailed;
    if (tenantRemoved && policy.updatedBy) {
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: policy.updatedBy,
        entidade: "tenant",
        entidadeId: tenantId,
        acao: "lgpd.midia_removida_retencao",
        metadata: { tenantId, arquivos: tenantRemoved, falhas: tenantFailed, prazoDias: mediaRetentionDays(policy.option), rodada: now.toISOString() },
      }).catch(() => undefined);
    }
  }
  if (more) await scheduleCatchUp(now);
  return { ran: true, tenants, removed, failed, more };
}
