import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { AuthenticationError } from "@/shared/auth/errors";

export async function GET(request: Request) {
  try {
    const session = await authenticateExtensionRequest(request);
    return NextResponse.json({ userId: session.userId, tenantId: session.tenantId, deviceId: session.deviceId, sessionId: session.id, expiresAt: session.expiresAt.toISOString(), permissions: session.permissions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "SESSION_INVALID" }, { status: 401 });
  }
}
