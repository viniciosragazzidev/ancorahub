import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { downloadR2Object } from "@/shared/storage/r2-storage";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { PILOT_SETTING, canUsePilot, pilotConfigSchema, type CatalogIndex, type PilotConfig, type PlanDetail, type NetworkData } from "./contracts";

const indexCache = new TtlCache<CatalogIndex>(300_000, 2);
const shardCache = new TtlCache<Record<string, PlanDetail | NetworkData>>(120_000, 4);
export async function readPilotConfig(): Promise<PilotConfig | null> {
  const [row] = await getDatabase().select({ value: schema.systemSettings.value }).from(schema.systemSettings).where(eq(schema.systemSettings.key, PILOT_SETTING)).limit(1);
  if (!row) return null;
  try { const parsed = pilotConfigSchema.safeParse(JSON.parse(row.value)); return parsed.success ? parsed.data : null; } catch { return null; }
}
export async function requirePilot() {
  const context = await getRequiredTenantContext(); const config = await readPilotConfig();
  if (!config || !canUsePilot(context, config)) throw new Error("Cotador não liberado para este acesso.");
  return { context, config };
}
async function readObject(key: string, hash: string) {
  const blob = await downloadR2Object(key); const compressed = Buffer.from(await blob.arrayBuffer());
  if (createHash("sha256").update(compressed).digest("hex") !== hash) throw new Error("Falha de integridade no catálogo. Tente novamente ou contate a administração.");
  return gunzipSync(compressed, { maxOutputLength: 96 * 1024 * 1024 }).toString("utf8");
}
export function loadPilotIndex(config: PilotConfig) {
  return indexCache.getOrLoad(`${config.release}/${config.indexHash}`, async () => {
    const value: CatalogIndex = JSON.parse(await readObject(`quote-catalog/${config.release}/index.json.gz`, config.indexHash));
    if (value.schemaVersion !== 1 || value.release !== config.release || !Array.isArray(value.plans) || value.plans.length !== value.counts.plans) throw new Error("Versão de catálogo inválida.");
    return value;
  });
}
export async function loadPlanShard(config: PilotConfig, kind: "details" | "network", id: string) {
  const index = await loadPilotIndex(config); const prefix = id.slice(0, 2); const key = `${kind}/${prefix}.json.gz`;
  if (!index.plans.some(p => p.id === id) || config.hiddenPlanIds.includes(id)) throw new Error("Plano indisponível para este acesso.");
  const digest = index.shardHashes[key]; if (!digest) throw new Error("Detalhe não disponível neste lote.");
  const shard = await shardCache.getOrLoad(`${config.release}/${digest}/${key}`, async () => JSON.parse(await readObject(`quote-catalog/${config.release}/${key}`, digest)) as Record<string, PlanDetail | NetworkData>);
  const value = shard[id]; if (!value) throw new Error("Detalhe não encontrado."); return value;
}
export async function auditPilot(userId: string, tenantId: string, action: string, metadata: Record<string, unknown>) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "quote_catalog", entidadeId: tenantId, acao: action, metadata: { tenantId, ...metadata } });
}
