import { NextResponse } from "next/server";
import { revokeExtensionSession } from "@/features/browser-extension/auth";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
export async function POST(request: Request) {
  try {
    const { session } = await requireExtensionAccess(request, "VIEW_LEAD");
    await revokeExtensionSession(session);
    return NextResponse.json({ success: true });
  } catch (error) { return extensionErrorResponse(error); }
}
