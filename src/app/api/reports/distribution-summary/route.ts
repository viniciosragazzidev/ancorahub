import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasCapability } from "@/shared/auth/permissions";
import { fetchBrokerDailySummary } from "@/features/lead-distribution/broker-summary-service";
import { encodeBrokerSummaryPdf } from "@/features/lead-distribution/broker-summary-pdf";

export const dynamic = "force-dynamic";
const querySchema = z.object({ start: z.coerce.date(), end: z.coerce.date(), branchId: z.string().optional() });

export async function GET(request: Request) {
  try {
    const context = await getRequiredTenantContext();
    if ((context.role !== "director" && context.role !== "manager") || !hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle)) {
      return NextResponse.json({ error: "Sem permissão para exportar este resumo." }, { status: 403 });
    }
    const parsed = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (parsed.end < parsed.start || (parsed.end.getTime() - parsed.start.getTime()) / 86_400_000 > 366) throw new Error("Escolha um período de até 366 dias.");
    const branchId = context.role === "manager" ? context.branchId : parsed.branchId;
    if (context.role === "manager" && parsed.branchId && parsed.branchId !== context.branchId) return NextResponse.json({ error: "Unidade fora do seu escopo." }, { status: 403 });
    const data = await fetchBrokerDailySummary(context.tenantId, { startDate: parsed.start, endDate: parsed.end, branchId });
    const branchLabel = branchId ? ((await getDatabase().select({ name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.id, branchId)).limit(1))[0]?.name ?? "Unidade selecionada") : "Todas as unidades";
    const body = await encodeBrokerSummaryPdf({ data, startDate: parsed.start, endDate: parsed.end, branchLabel });
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: "distribution-summary", acao: `report.generated:distribution-summary:${data.items.length}:pdf` });
    return new NextResponse(body.buffer as ArrayBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="resumo-distribuicao-${parsed.start.toISOString().slice(0, 10)}-a-${parsed.end.toISOString().slice(0, 10)}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o PDF." }, { status: 400 });
  }
}
