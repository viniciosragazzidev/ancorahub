import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { getContactAvatar } from "@/features/contact-avatars/service";
import { canTagLead } from "@/features/lead-tags/rules";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

/**
 * The WhatsApp profile picture of a lead (?lead=<id>) or, for a director or
 * manager, of a contact with no lead yet (?phone=<digits>). 404 when there is
 * none: the screen keeps its illustrated avatar.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    const leadId = request.nextUrl.searchParams.get("lead");
    const rawPhone = request.nextUrl.searchParams.get("phone");
    let phone: string | null = null;

    if (leadId) {
      if (leadId.length > 64) return new NextResponse(null, { status: 400 });
      const [lead] = await getDatabase().select({ telefone: schema.leads.telefone, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
        .from(schema.leads)
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
        .limit(1);
      if (!lead || !canTagLead(context, lead)) return new NextResponse(null, { status: 404 });
      phone = lead.telefone;
    } else if (rawPhone && /^\d{10,15}$/.test(rawPhone) && (context.role === "director" || context.role === "manager")) {
      phone = rawPhone;
    }
    if (!phone) return new NextResponse(null, { status: 404 });

    const avatar = await getContactAvatar(context.tenantId, phone);
    if (!avatar) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, max-age=3600" } });
    return new NextResponse(new Uint8Array(avatar.body), {
      headers: { "Content-Type": avatar.contentType, "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
