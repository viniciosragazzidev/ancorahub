import { NextResponse } from "next/server";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
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
  // The existing desktop chat rail supports brokers, supervisors and enabled Manager Lite users.
  const audience = context.role === "broker" ? "broker" : await getLiteAudience(context);
  if (audience !== "broker" && audience !== "supervisor" && audience !== "manager") return NextResponse.json({ rail: null });
  const rail = await getChatRailData();
  return NextResponse.json({ rail }, { headers: { "Cache-Control": "no-store" } });
}
