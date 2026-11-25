import { NextResponse } from "next/server";

import { getNavCounts } from "@/features/nav-counts/nav-counts";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contadores do menu lateral (leads sem primeiro contato, leads esperando corretor). */
export async function GET() {
  try {
    const context = await getRequiredTenantContext();
    return NextResponse.json({ counts: await getNavCounts(context) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // O menu nunca quebra por causa do contador: sem número, nada aparece.
    return NextResponse.json({ counts: {} }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
