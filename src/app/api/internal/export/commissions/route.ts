import { NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { getCommissionExportData, generateCsv } from "@/features/commissions/export-service";

export async function GET(request: Request) {
  try {
    const context = await getRequiredTenantContext();

    if (!hasCapability(context.role, "exportar_relatorios", context.jobTitle)) {
      return NextResponse.json({ error: "Sem permissão para exportar relatórios." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startMonth = searchParams.get("startMonth");
    const endMonth = searchParams.get("endMonth");
    const branchId = searchParams.get("branchId") || undefined;
    const brokerId = searchParams.get("brokerId") || undefined;
    const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

    if (!startMonth || !endMonth) {
      return NextResponse.json({ error: "Período obrigatório (startMonth, endMonth)." }, { status: 400 });
    }

    const rows = await getCommissionExportData({
      tenantId: context.tenantId,
      startMonth,
      endMonth,
      branchId: context.role === "manager" ? context.branchId ?? undefined : branchId,
      brokerId: context.role === "broker" ? context.userId : brokerId,
    });

    if (format === "csv") {
      const csv = generateCsv(rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="comissoes_${startMonth}_${endMonth}.csv"`,
        },
      });
    }

    // XLSX fallback — return JSON for client-side generation
    return NextResponse.json({ rows, filename: `comissoes_${startMonth}_${endMonth}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao exportar relatório." },
      { status: 500 },
    );
  }
}
