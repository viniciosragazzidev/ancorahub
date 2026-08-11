import { NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { generateReport } from "@/features/reports/report-export-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const context = await getRequiredTenantContext();
    const { reportId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const report = await generateReport(context, reportId, {
      start: searchParams.get("start"), end: searchParams.get("end"), format: searchParams.get("format"),
    });
    const body = typeof report.body === "string" ? report.body : new Uint8Array(report.body).buffer;
    return new NextResponse(body, { headers: { "Content-Type": report.contentType, "Content-Disposition": `attachment; filename="${report.filename}"`, "X-Report-Rows": String(report.rows), "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar o relatório.";
    const status = message === "Sem permissão para gerar este relatório." ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
