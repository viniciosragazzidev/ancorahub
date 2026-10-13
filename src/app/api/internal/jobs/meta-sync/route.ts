import { after, NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { runMetaTenantSync } from "@/features/meta-ads/meta-sync-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A sync still "in progress" after this long was cut off (the process stopped mid-way). */
const STALE_SYNC_MS = 15 * 60_000;

/**
 * Starts the full Meta sync of every connected tenant and answers right away.
 * A full sync takes minutes, longer than the proxy in front of the app keeps a
 * request open (Cloudflare cuts at 100 s, error 524): run inside the request,
 * it was cut and left a log "in_progress" forever. It now runs after the
 * response, on the server.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDatabase();
  const staleBefore = new Date(Date.now() - STALE_SYNC_MS);
  const closed = await db.update(schema.metaSyncLogs)
    .set({ status: "error", errorDetails: "Sincronização interrompida antes de terminar (o processo parou no meio).", completedAt: new Date() })
    .where(and(eq(schema.metaSyncLogs.status, "in_progress"), lt(schema.metaSyncLogs.startedAt, staleBefore)))
    .returning({ id: schema.metaSyncLogs.id });

  const activeConnections = await db
    .select({ tenantId: schema.metaConnections.tenantId })
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.status, "connected"));

  after(async () => {
    for (const conn of activeConnections) {
      const res = await runMetaTenantSync(conn.tenantId, "full", { scheduled: true }).catch((error: unknown) => ({
        success: false,
        itemsSynced: 0,
        error: error instanceof Error ? error.message : "unknown",
      }));
      console.info("[meta-sync] tenant_done", { tenantId: conn.tenantId, success: res.success, itemsSynced: res.itemsSynced, error: res.error });
    }
  });

  return NextResponse.json({ started: true, tenants: activeConnections.length, staleClosed: closed.length }, { status: 202 });
}
