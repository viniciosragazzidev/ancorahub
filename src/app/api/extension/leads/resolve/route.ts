import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { resolveLeadForExtension } from "@/features/browser-extension/lead-context";
import { resolveLeadSchema } from "@/features/browser-extension/schemas";
import { getDatabase, schema } from "@/shared/db";
import { and, eq } from "drizzle-orm";
import { AuthenticationError } from "@/shared/auth/errors";
import { getSystemSetting } from "@/features/system-settings/queries";

export async function POST(request: Request) {
  try {
    const session = await authenticateExtensionRequest(request);
    if ((await getSystemSetting("feature_browser_extension_enabled")) === "false") return NextResponse.json({ status: "FORBIDDEN" });
    const input = resolveLeadSchema.parse(await request.json());
    const [membership] = await getDatabase().select({ role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.userId, session.userId), eq(schema.tenantMemberships.tenantId, session.tenantId), eq(schema.tenantMemberships.status, "active"))).limit(1);
    if (!membership) return NextResponse.json({ status: "FORBIDDEN" });
    const [tenantSettings] = await getDatabase().select({ enabled: schema.extensionSettings.enabled }).from(schema.extensionSettings).where(eq(schema.extensionSettings.tenantId, session.tenantId)).limit(1);
    if (tenantSettings && !tenantSettings.enabled) return NextResponse.json({ status: "FORBIDDEN" });
    const result = await resolveLeadForExtension({ userId: session.userId, tenantId: session.tenantId, role: membership.role, jobTitle: membership.jobTitle, branchId: membership.branchId }, input.phone);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_REQUEST" }, { status: error instanceof AuthenticationError ? 401 : 400 });
  }
}
