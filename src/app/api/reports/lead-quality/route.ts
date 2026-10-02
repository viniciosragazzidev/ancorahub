import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { canAccessLeadQualityCenter, parseLeadOrigin } from "@/features/reports/metrics/lead-quality-service";
import { getLeadQualityExport } from "@/features/reports/metrics/lead-quality-export";
import { parseLeadQualityPeriod } from "@/features/reports/metrics/lead-quality-period";
import { originLabel } from "@/features/reports/pdf/lead-quality-report-labels";
import { renderLeadQualityReportPdf } from "@/features/reports/pdf/lead-quality-report-pdf";
import { encodeLeadQualitySpreadsheet } from "@/features/reports/pdf/lead-quality-report-spreadsheet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/reports/lead-quality?period=today|7|14|30|90&queue=<id>&origin=form|whatsapp|other&format=pdf|xlsx
 * The lead quality center's numbers for the selection, split by origin and shift.
 */
export async function GET(request: Request) {
  try {
    const context = await getRequiredTenantContext();
    if (!(await canAccessLeadQualityCenter(context))) {
      return NextResponse.json({ error: "Sem permissão para exportar este relatório." }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const period = parseLeadQualityPeriod(params.get("period") ?? undefined);
    const rawQueue = params.get("queue");
    const queueId = rawQueue && UUID.test(rawQueue) ? rawQueue : null;
    const origin = parseLeadOrigin(params.get("origin"));
    const format = params.get("format") === "xlsx" ? "xlsx" : "pdf";

    const generatedAt = new Date();
    const data = await getLeadQualityExport(context, period, { queueId, origin }, generatedAt);
    if (!data.report.enabled) return NextResponse.json({ error: "A central de qualidade está desativada." }, { status: 404 });

    const db = getDatabase();
    const [tenant] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
    const input = { ...data, tenantName: tenant?.name ?? "AncoraHub", generatedAt, originLabelFilter: origin ? originLabel(origin) : "Todas as origens" };

    const body = format === "xlsx" ? encodeLeadQualitySpreadsheet(input) : await renderLeadQualityReportPdf(input);
    await db.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: "lead_quality_center",
      acao: `report.generated:lead-quality:${period}:${queueId ?? "all"}:${origin ?? "all"}:${format}`,
    });

    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(generatedAt);
    const fileName = `qualidade-leads-${period === "today" ? "hoje" : `${period}d`}-${day}.${format}`;
    return new NextResponse(body.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o relatório." }, { status: 400 });
  }
}
