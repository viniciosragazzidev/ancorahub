import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";
import { AuthenticationError } from "@/shared/auth/errors";
import { getSystemSetting } from "@/features/system-settings/queries";

export async function GET(request: Request) {
  try {
    const session = await authenticateExtensionRequest(request);
    if ((await getSystemSetting("feature_browser_extension_enabled")) === "false") return NextResponse.json({ enabled: false, reason: "DISABLED_GLOBALLY" });
    const [settings] = await getDatabase().select({ enabled: schema.extensionSettings.enabled, minimumVersion: schema.extensionSettings.minimumVersion, allowInsert: schema.extensionSettings.allowInsert, maxSuggestions: schema.extensionSettings.maxSuggestions }).from(schema.extensionSettings).where(eq(schema.extensionSettings.tenantId, session.tenantId)).limit(1);
    return NextResponse.json({ enabled: settings?.enabled ?? false, minimumVersion: settings?.minimumVersion ?? "0.1.0", allowInsert: settings?.allowInsert ?? false, maxSuggestions: settings?.maxSuggestions ?? 3 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_REQUEST" }, { status: error instanceof AuthenticationError ? 401 : 400 });
  }
}
