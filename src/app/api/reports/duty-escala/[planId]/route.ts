import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasCapability } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { encodeDutyEscalaPdf } from "@/features/lead-distribution/duty-escala-pdf";
import { buildDutyEscalaPdfInput, getDutyEscalaReportData, resolveDutyEscalaScope } from "@/features/lead-distribution/duty-escala-report";

export const dynamic = "force-dynamic";

function fileSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "geral";
}

export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const context = await getRequiredTenantContext();
    if ((context.role !== "director" && context.role !== "manager") || !hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle)) {
      return NextResponse.json({ error: "Sem permissão para exportar a escala." }, { status: 403 });
    }
    const { planId } = await params;
    const search = new URL(request.url).searchParams;
    const db = getDatabase();
    let selection: { kind: "geral" } | { kind: "unidade"; branchId: string } | { kind: "tipo"; typeId: string | null };
    if (context.role === "manager") {
      if (!context.branchId) return NextResponse.json({ error: "A unidade do Gestor não está definida." }, { status: 403 });
      selection = { kind: "unidade", branchId: context.branchId };
    } else {
      const requestedScope = search.get("scope") ?? "geral";
      if (requestedScope === "geral") selection = { kind: "geral" };
      else if (requestedScope === "unidade") {
        const branchId = search.get("branchId");
        if (!branchId) return NextResponse.json({ error: "Informe a unidade do relatório." }, { status: 400 });
        selection = { kind: "unidade", branchId };
      } else if (requestedScope === "tipo") {
        const typeId = search.get("typeId");
        if (!typeId) return NextResponse.json({ error: "Informe o tipo do relatório." }, { status: 400 });
        selection = { kind: "tipo", typeId: typeId === "__none" ? null : typeId };
      } else return NextResponse.json({ error: "Escopo de relatório inválido." }, { status: 400 });
    }
    const scope = await resolveDutyEscalaScope(db, context.tenantId, selection);
    if (!scope) return NextResponse.json({ error: "Unidade ou tipo não encontrado." }, { status: 404 });
    const data = await getDutyEscalaReportData(db, context.tenantId, planId, scope);
    // A Gestor only sees escalas the Diretor already published.
    if (!data || (context.role === "manager" && data.plan.status === "draft")) return NextResponse.json({ error: "Escala não encontrada." }, { status: 404 });
    const report = buildDutyEscalaPdfInput(data);
    const body = await encodeDutyEscalaPdf(report);
    await db.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: planId,
      acao: `report.generated:duty-escala:${report.occurrences.length}:pdf`,
    });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="escala-${fileSlug(report.scopeLabel)}-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o relatório." }, { status: 400 });
  }
}
