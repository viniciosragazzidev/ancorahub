import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { getExtensionTenantContext } from "@/features/browser-extension/context";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { statusPatchSchema } from "@/features/browser-extension/schemas";
import { changeLeadStatus } from "@/features/leads/change-lead-status";
import { AuthenticationError } from "@/shared/auth/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await authenticateExtensionRequest(request);
    const input = statusPatchSchema.parse(await request.json());
    const { leadId } = await params;
    const context = await getExtensionTenantContext(session.userId, session.tenantId);
    if (!context) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedVersion) return NextResponse.json({ error: "CONFLICT", message: "Este lead foi atualizado em outro local." }, { status: 409 });
    const result = await changeLeadStatus({ leadId, newStatus: input.statusId, expectedVersion: input.expectedVersion }, context);
    return NextResponse.json({ ...result, version: input.expectedVersion + 1 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_OPERATION" }, { status: error instanceof AuthenticationError ? 401 : 400 });
  }
}
