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
import { encodeDutyScheduleSpreadsheet } from "@/features/lead-distribution/duty-schedule-spreadsheet";
import { buildDutyOccurrenceHistoryReport } from "@/features/lead-distribution/duty-schedule-report";
import { getDutyOccurrenceHistory } from "@/features/lead-distribution/duty-occurrence-history";
import { getDutyWindowOnDate } from "@/features/lead-distribution/duty-presence-domain";
import { and, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

function fileSlug(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "plantao";
}

export async function GET(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    const context = await getRequiredTenantContext();
    if ((context.role !== "director" && context.role !== "manager") || !hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle)) {
      return NextResponse.json({ error: "Sem permissão para exportar o relatório do plantão." }, { status: 403 });
    }
    const { scheduleId } = await params;
    let profile: Awaited<ReturnType<typeof getDutyScheduleProfile>>;
    try {
      profile = await getDutyScheduleProfile(context, scheduleId);
    } catch {
      return NextResponse.json({ error: "Plantão não encontrado." }, { status: 404 });
    }

    const db = getDatabase();
    // A finished occurrence (from the "Terminado" page): its own window and history.
    const dutyDate = new URL(request.url).searchParams.get("data");
    if (dutyDate) {
      const window = getDutyWindowOnDate(profile.schedule, dutyDate);
      if (!window) return NextResponse.json({ error: "Data inválida para este plantão." }, { status: 400 });
      if (window.endsAt > new Date()) return NextResponse.json({ error: "Este turno ainda não terminou." }, { status: 400 });
      const history = await getDutyOccurrenceHistory(context, profile.schedule.id, profile.linkedQueues.map((queue) => queue.id), window);
      const brokerIds = history.brokers.map((entry) => entry.brokerId);
      const [codeRows, tenantRows] = await Promise.all([
        brokerIds.length
          ? db.select({ userId: schema.brokerProfiles.userId, code: schema.brokerProfiles.internalCode }).from(schema.brokerProfiles)
            .where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), inArray(schema.brokerProfiles.userId, brokerIds)))
          : Promise.resolve([]),
        db.select({ name: schema.tenants.name, logoUrl: schema.tenants.logoUrl }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
      ]);
      const body = await encodeDutySchedulePdf({
        ...buildDutyOccurrenceHistoryReport(profile, window, history, new Map(codeRows.flatMap((row) => (row.userId ? [[row.userId, row.code] as const] : [])))),
        tenantName: tenantRows[0]?.name ?? "AncoraHub",
        tenantLogoUrl: tenantRows[0]?.logoUrl,
      });
      await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: scheduleId, acao: `report.generated:duty-occurrence:${history.distributions.length}:pdf` });
      return new NextResponse(body.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="plantao-${fileSlug(profile.schedule.name)}-${dutyDate}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (new URL(request.url).searchParams.get("format") === "xlsx") {
      const body = encodeDutyScheduleSpreadsheet({ scheduleName: profile.schedule.name, leads: profile.leads });
      const assignedLeadCount = profile.leads.filter((lead) => Boolean(lead.corretorId && lead.assignedAt)).length;
      await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: scheduleId, acao: `report.generated:duty-schedule:${assignedLeadCount}:xlsx` });
      return new NextResponse(body.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="plantao-${fileSlug(profile.schedule.name)}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o relatório." }, { status: 400 });
  }
}
