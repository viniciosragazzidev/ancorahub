import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
export async function GET(request: Request) {
  try {
    const { settings } = await requireExtensionAccess(request, "VIEW_LEAD");
    return NextResponse.json({ enabled: settings.enabled, minimumVersion: settings.minimumVersion,
      allowInsert: settings.allowInsert, maxSuggestions: settings.maxSuggestions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
