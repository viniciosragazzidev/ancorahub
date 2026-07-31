import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { runMetaTenantSync } from "@/features/meta-ads/meta-sync-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDatabase();
  const activeConnections = await db
    .select({ tenantId: schema.metaConnections.tenantId })
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.status, "connected"));

  const results: Array<{ tenantId: string; success: boolean; itemsSynced: number; error?: string }> = [];

  for (const conn of activeConnections) {
    const res = await runMetaTenantSync(conn.tenantId, "full");
    results.push({ tenantId: conn.tenantId, ...res });
  }

  return NextResponse.json({
    tenantsProcessed: results.length,
    results,
  });
}
