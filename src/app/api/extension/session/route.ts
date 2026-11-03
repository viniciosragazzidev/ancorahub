import { NextResponse } from "next/server";
import { renewExtensionSession } from "@/features/browser-extension/auth";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
export async function GET(request: Request) {
  try {
    const { session } = await requireExtensionAccess(request, "VIEW_LEAD");
    return NextResponse.json({ userId: session.userId, tenantId: session.tenantId, deviceId: session.deviceId,
      sessionId: session.id, expiresAt: session.expiresAt.toISOString(), permissions: session.permissions },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
/** Explicit renewal rotates the bearer token; GET remains compatible with the current extension. */
export async function POST(request: Request) {
  try {
    const { session } = await requireExtensionAccess(request, "VIEW_LEAD");
    return NextResponse.json(await renewExtensionSession(session), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
