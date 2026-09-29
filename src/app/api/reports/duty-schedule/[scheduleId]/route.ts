import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasCapability } from "@/shared/auth/permissions";
import { DUTY_PROFILE_LEADS_LIMIT, getDutyScheduleProfile } from "@/features/lead-distribution/duty-schedule-profile-queries";
import { getReturnedUnacceptedLeadIds } from "@/features/lead-distribution/returned-unaccepted";
import { buildDutyScheduleReport } from "@/features/lead-distribution/duty-schedule-report";
import { encodeDutySchedulePdf } from "@/features/lead-distribution/duty-schedule-pdf";

export const dynamic = "force-dynamic";

function fileSlug(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "plantao";
}

export async function GET(_request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    const context = await getRequiredTenantContext();
    if ((context.role !== "director" && context.role !== "manager") || !hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle)) {
      return NextResponse.json({ error: "Sem permissão para exportar o relatório do plantão." }, { status: 403 });
    }
    const { scheduleId } = await params;

    let profile: Awaited<ReturnType<typeof getDutyScheduleProfile>>;
    try {
      // Same query and branch scoping as the plantão page itself.
      profile = await getDutyScheduleProfile(context, scheduleId);
    } catch {
      return NextResponse.json({ error: "Plantão não encontrado." }, { status: 404 });
    }

    const db = getDatabase();
    const [returnedUnaccepted, tenantRow] = await Promise.all([
      getReturnedUnacceptedLeadIds(context.tenantId, profile.leads.map((lead) => lead.id)),
      db.select({ name: schema.tenants.name, logoUrl: schema.tenants.logoUrl }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    ]);
    const tenant = tenantRow[0];
    const body = await encodeDutySchedulePdf({
      ...buildDutyScheduleReport(profile, returnedUnaccepted, DUTY_PROFILE_LEADS_LIMIT),
      tenantName: tenant?.name ?? "AncoraHub",
      tenantLogoUrl: tenant?.logoUrl,
    });
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: scheduleId, acao: `report.generated:duty-schedule:${profile.leads.length}:pdf` });

    return new NextResponse(body.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="plantao-${fileSlug(profile.schedule.name)}-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o PDF." }, { status: 400 });
  }
}
