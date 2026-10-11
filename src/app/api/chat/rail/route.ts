import { NextResponse } from "next/server";

import { isSupervisorLiteAvailable } from "@/features/broker-workspace/lite-audience";
import { getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/**
 * The conversation list for the rail of the Lite on computers. A GET (not a
 * server action, which is a POST): "Ver como" refuses every POST, and a read
 * must keep working while a super admin views the app as someone.
 */
export async function GET() {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ rail: null }, { status: 401 });
  // Broker or supervisor with the supervisor Lite (the rail lists the team threads).
  if (context.role !== "broker" && !(await isSupervisorLiteAvailable(context))) return NextResponse.json({ rail: null });
  const rail = await getChatRailData();
  return NextResponse.json({ rail }, { headers: { "Cache-Control": "no-store" } });
}
