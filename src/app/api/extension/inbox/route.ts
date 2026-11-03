import { NextResponse } from "next/server";
import { AuthorizationError } from "@/shared/auth/errors";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { readExtensionInbox, parseExtensionInboxCursor } from "@/features/browser-extension/inbox";
import { extensionErrorResponse } from "@/features/browser-extension/http";

export async function GET(request: Request) {
  try {
    const { session, context } = await requireExtensionAccess(request, "VIEW_LEAD");
    if (context.role !== "broker") throw new AuthorizationError("Somente o corretor pode consultar a caixa de entrada.");
    const cursor = parseExtensionInboxCursor(new URL(request.url).searchParams.get("cursor"));
    const result = await readExtensionInbox(context, cursor);
    await recordExtensionAudit("extension.inbox.polled", session, {
      metadata: { count: result.status === 304 ? 0 : result.body.items.length, notModified: result.status === 304 },
    });
    if (result.status === 304) return new NextResponse(null, { status: 304, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(result.body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
