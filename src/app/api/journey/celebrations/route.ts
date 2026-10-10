import { NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getPendingJourneyCelebrations } from "@/features/engagement/journey-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return NextResponse.json({ items: [] }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    const items = await getPendingJourneyCelebrations(context.tenantId, context.userId).catch(() => []);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ items: [] }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
}
