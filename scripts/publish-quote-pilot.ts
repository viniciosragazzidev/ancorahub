/** Private R2 publication. Run with node --conditions=react-server --import tsx.
 * No new dependencies. Staging never changes access; activation is explicit.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import postgres from "postgres";
import { uploadR2Object, downloadR2Object, R2StorageRequestError } from "../src/shared/storage/r2-storage";
import { pilotConfigSchema, PILOT_SETTING } from "../src/features/global-catalog/pilot/contracts";

async function main() {
process.loadEnvFile(".env.local");
const args = process.argv.slice(2);
const folder = args[0];
const userId = args[args.indexOf("--user") + 1];
const tenantId = args[args.indexOf("--tenant") + 1];
if (!folder || !args.includes("--user") || !args.includes("--tenant")) throw new Error("Usage: <release folder> --user UUID --tenant UUID [--activate]");
const manifest = JSON.parse(await readFile(resolve(folder, "manifest.json"), "utf8")) as { release: string; indexHash: string; hashes: Record<string, string>; counts: Record<string, number> };
const config = pilotConfigSchema.parse({ enabled: args.includes("--activate"), userId, tenantId, release: manifest.release, indexHash: manifest.indexHash });
const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 15 });
try {
  const identities = await sql`select u.id from "user" u join tenant_memberships m on m.user_id=u.id where u.id=${userId} and u.active=true and u.is_platform_admin=true and m.tenant_id=${tenantId} and m.role='broker' and m.status='active'`;
  if (identities.length !== 1) throw new Error("Target must be an active platform admin with an active broker membership in the selected tenant.");
  const receiptPath = resolve(folder, "uploaded.json");
  let receipt: Record<string, string> = {};
  try { receipt = JSON.parse(await readFile(receiptPath, "utf8")); } catch { /* First staged publication. */ }
  const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
  let complete = 0;
  let receiptWrite = Promise.resolve();
  async function publish(name: string, digest: string) {
    const data = await readFile(resolve(folder, name));
    if (hash(data) !== digest) throw new Error(`Local integrity failure: ${name}`);
    if (receipt[name] === digest) { complete++; return; }
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        let existing: Buffer | null = null;
        try { existing = Buffer.from(await (await downloadR2Object(`quote-catalog/${config.release}/${name}`)).arrayBuffer()); }
        catch (error) { if (!(error instanceof R2StorageRequestError) || (error.cause as { status?: number })?.status !== 404) throw error; }
        if (existing && hash(existing) !== digest) throw new Error(`Immutable release already contains different bytes: ${name}`);
        if (!existing) await uploadR2Object(`quote-catalog/${config.release}/${name}`, data, "application/gzip");
        const readBack = Buffer.from(await (await downloadR2Object(`quote-catalog/${config.release}/${name}`)).arrayBuffer());
        if (hash(readBack) !== digest) throw new Error(`Remote integrity failure: ${name}`);
        receipt[name] = digest; complete++;
        // Workers mutate in the same JS turn; each snapshot includes all receipts.
        receiptWrite = receiptWrite.then(() => writeFile(receiptPath, JSON.stringify(receipt, null, 2)));
        await receiptWrite;
        if (complete % 20 === 0) console.log(`Verified private objects: ${complete}/${Object.keys(manifest.hashes).length}`);
        return;
      } catch (error) { if (attempt === 4) throw error; await new Promise(r => setTimeout(r, attempt * 1000)); }
    }
  }
  const queue = Object.entries(manifest.hashes).filter(([name]) => name !== "index.json.gz");
  await Promise.all(Array.from({ length: 4 }, async () => { let item; while ((item = queue.shift())) await publish(...item); }));
  await publish("index.json.gz", manifest.indexHash);
  const raw = Buffer.from(await (await downloadR2Object(`quote-catalog/${config.release}/index.json.gz`)).arrayBuffer());
  const index = JSON.parse(gunzipSync(raw).toString("utf8"));
  if (hash(raw) !== config.indexHash || index.release !== config.release || index.plans.length !== manifest.counts.plans) throw new Error("Release validation failed.");
  await sql.begin(async tx => {
    const currentIdentities = await tx`select u.id from "user" u join tenant_memberships m on m.user_id=u.id where u.id=${userId} and u.active=true and u.is_platform_admin=true and m.tenant_id=${tenantId} and m.role='broker' and m.status='active'`;
    if (currentIdentities.length !== 1) throw new Error("Target identity or broker membership was revoked.");
    const [previous] = await tx`select value from system_settings where key=${PILOT_SETTING} for update`;
    if (previous) {
      const old = pilotConfigSchema.parse(JSON.parse(previous.value));
      if (old.userId !== userId || old.tenantId !== tenantId) throw new Error("Refusing to replace another user's pilot.");
      if (old.release === config.release) { config.reviewedPlanIds = old.reviewedPlanIds; config.hiddenPlanIds = old.hiddenPlanIds; }
    }
    if (!previous || args.includes("--activate")) await tx`insert into system_settings(key,value) values(${PILOT_SETTING},${JSON.stringify(config)}) on conflict(key) do update set value=excluded.value,updated_at=now()`;
    await tx`insert into platform_audit_logs(id,actor_user_id,action,target_type,target_id,metadata) values(${randomUUID()},${userId},${config.enabled ? "quote_catalog.pilot_activated" : "quote_catalog.release_staged"},'quote_catalog_pilot',${config.release},${tx.json({ userId, tenantId, indexHash: config.indexHash, counts: manifest.counts, verifiedObjects: complete, origin: "explicit_user_release_request" })})`;
  });
  console.log(JSON.stringify({ release: config.release, enabled: config.enabled, verifiedObjects: complete, counts: manifest.counts }));
} finally { await sql.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Publication failed."); process.exitCode = 1; });
