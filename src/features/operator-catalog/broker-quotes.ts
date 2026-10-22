import "server-only";

import { and, asc, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

import { ingestOperatorFile } from "./ingest";

/**
 * Import of the PDFs brokers sent to leads on WhatsApp (Vinicios, 22/10): their quotes
 * become prices observed in the catalog. Runs in batches inside the catalog job, so a
 * long backlog never holds a request; the director starts and pauses it on the screen.
 */
const SETTING_PREFIX = "broker_quotes_import_";
const BATCH_SIZE = 10;

export type BrokerQuotesImportState = {
  status: "running" | "paused" | "done";
  cursorSentAt: string | null;
  cursorId: string | null;
  read: number;
  captured: number;
  duplicated: number;
  unreadable: number;
  startedAt: string;
  updatedAt: string;
};

const settingKey = (tenantId: string) => `${SETTING_PREFIX}${tenantId}`;

export async function readBrokerQuotesImport(tenantId: string): Promise<BrokerQuotesImportState | null> {
  const value = await getSystemSetting(settingKey(tenantId));
  if (!value) return null;
  try {
    return JSON.parse(value) as BrokerQuotesImportState;
  } catch {
    return null;
  }
}

async function writeState(tenantId: string, state: BrokerQuotesImportState) {
  await setSystemSetting(settingKey(tenantId), JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

/** PDFs a person of the team sent to a lead (not the AI), with the file kept. */
function sentPdfConditions(tenantId: string) {
  return and(
    eq(schema.whatsappMessages.tenantId, tenantId),
    inArray(schema.whatsappMessages.direction, ["outgoing", "outbound"]),
    or(sql`${schema.whatsappMessages.mediaMimeType} ilike '%pdf%'`, sql`${schema.whatsappMessages.mediaFilename} ilike '%.pdf'`),
    sql`coalesce(${schema.whatsappMessages.senderRole}, '') <> 'assistant'`,
    isNotNull(schema.whatsappMessages.mediaStorageKey),
  );
}

function afterCursor(state: BrokerQuotesImportState | null) {
  if (!state?.cursorSentAt) return undefined;
  const at = new Date(state.cursorSentAt);
  return or(
    sql`${schema.whatsappMessages.sentAt} > ${at.toISOString()}::timestamptz`,
    and(sql`${schema.whatsappMessages.sentAt} = ${at.toISOString()}::timestamptz`, sql`${schema.whatsappMessages.id} > ${state.cursorId ?? ""}`),
  );
}

/** How many PDFs exist and how many are still to read, for the screen. */
export async function brokerQuotesImportStatus(tenantId: string) {
  const state = await readBrokerQuotesImport(tenantId);
  const db = getDatabase();
  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    remaining: state?.cursorSentAt ? sql<number>`count(*) filter (where ${afterCursor(state)})::int` : sql<number>`count(*)::int`,
  }).from(schema.whatsappMessages).where(sentPdfConditions(tenantId));
  return { state, total: Number(totals?.total ?? 0), remaining: Number(totals?.remaining ?? 0) };
}

export async function startBrokerQuotesImport(tenantId: string) {
  const current = await readBrokerQuotesImport(tenantId);
  const now = new Date().toISOString();
  await writeState(tenantId, current
    ? { ...current, status: "running" }
    : { status: "running", cursorSentAt: null, cursorId: null, read: 0, captured: 0, duplicated: 0, unreadable: 0, startedAt: now, updatedAt: now });
}

export async function pauseBrokerQuotesImport(tenantId: string) {
  const current = await readBrokerQuotesImport(tenantId);
  if (current && current.status === "running") await writeState(tenantId, { ...current, status: "paused" });
}

/**
 * One batch per company with an import running: downloads each PDF from storage and
 * ingests it as a private quote (never searchable; the catalog keeps only a quote's
 * prices and drops anything else). The cursor moves past every file, read or not.
 */
export async function importBrokerQuotesBatch() {
  const db = getDatabase();
  const rows = await db.select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(like(schema.systemSettings.key, `${SETTING_PREFIX}%`));
  const results: Array<{ tenantId: string; read: number; done: boolean }> = [];
  for (const row of rows) {
    let state: BrokerQuotesImportState;
    try {
      state = JSON.parse(row.value) as BrokerQuotesImportState;
    } catch {
      continue;
    }
    if (state.status !== "running") continue;
    const tenantId = row.key.slice(SETTING_PREFIX.length);
    const messages = await db.select({
      id: schema.whatsappMessages.id,
      leadId: schema.whatsappMessages.leadId,
      sentAt: schema.whatsappMessages.sentAt,
      fileName: schema.whatsappMessages.mediaFilename,
      storageKey: schema.whatsappMessages.mediaStorageKey,
    })
      .from(schema.whatsappMessages)
      .where(and(sentPdfConditions(tenantId), afterCursor(state)))
      .orderBy(asc(schema.whatsappMessages.sentAt), asc(schema.whatsappMessages.id))
      .limit(BATCH_SIZE);

    for (const message of messages) {
      try {
        const blob = await downloadR2Object(message.storageKey!);
        const result = await ingestOperatorFile({
          tenantId,
          body: Buffer.from(await blob.arrayBuffer()),
          fileName: (message.fileName || `cotacao-${message.id.slice(-8)}.pdf`).slice(0, 200),
          mimeType: "application/pdf",
          originLabel: `whatsapp-message:${message.id}`,
          brokerQuote: { messageId: message.id, leadId: message.leadId, sentAt: message.sentAt.toISOString() },
        });
        if (result.status === "captured") state.captured += 1;
        else if (result.status === "duplicate_material") state.duplicated += 1;
        else state.unreadable += 1;
      } catch (error) {
        state.unreadable += 1;
        console.warn("[broker-quotes] file_failed", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
      }
      state.read += 1;
      state.cursorSentAt = message.sentAt.toISOString();
      state.cursorId = message.id;
    }
    if (messages.length < BATCH_SIZE) state.status = "done";
    await writeState(tenantId, state);
    results.push({ tenantId, read: messages.length, done: state.status === "done" });
  }
  return results;
}
