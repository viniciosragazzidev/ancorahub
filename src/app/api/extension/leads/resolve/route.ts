import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { resolveLeadForExtension } from "@/features/browser-extension/lead-context";
import { resolveLeadSchema } from "@/features/browser-extension/schemas";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { extensionLeadPayloadSchema } from "@/features/browser-extension/payload";
import { extensionErrorResponse } from "@/features/browser-extension/http";
export async function POST(request: Request) {
  try {
    const { session, context } = await requireExtensionAccess(request, "VIEW_LEAD");
    const input = resolveLeadSchema.parse(await request.json());
    const result = await resolveLeadForExtension(context, input.phone);
    if (result.status !== "FOUND") {
      await recordExtensionAudit("extension.lead.resolve", session, { metadata: { found: false } });
      return NextResponse.json({ status: "NOT_FOUND" }, { headers: { "Cache-Control": "no-store" } });
    }
    const lead = extensionLeadPayloadSchema.parse(result.lead);
    lead.allowedActions = lead.allowedActions.filter((permission) => session.permissions.includes(permission));
    await recordExtensionAudit("extension.lead.resolve", session, { leadId: lead.id, metadata: { found: true } });
    return NextResponse.json({ status: "FOUND", lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
