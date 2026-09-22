import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { encodeUnassignedLeadsPdf, type UnassignedLeadPdfRow } from "@/features/lead-distribution/unassigned-leads-pdf";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function firstValue(records: JsonRecord[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
    }
  }
  return "Não informado";
}

export async function GET() {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" || !hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle)) {
      return NextResponse.json({ error: "Somente o Diretor pode exportar esta lista." }, { status: 403 });
    }

    const db = getDatabase();
    const rows = await db
      .select({
        name: schema.leads.nome,
        phone: schema.leads.telefone,
        email: schema.leads.email,
        createdAt: schema.leads.createdAt,
        qualificationDetails: schema.leads.qualificationDetails,
        formData: schema.leads.formData,
      })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.corretorId),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
        inArray(schema.leads.distributionStatus, ["unassigned", "queued", "returned_to_queue"]),
        ne(schema.leads.status, "lost"),
        or(isNull(schema.leads.qualificationStatus), ne(schema.leads.qualificationStatus, "disqualified")),
      ))
      .orderBy(asc(schema.leads.createdAt));

    const pdfRows: UnassignedLeadPdfRow[] = rows.map((row) => {
      const qualificationDetails = asRecord(row.qualificationDetails);
      const aiContext = asRecord(qualificationDetails.aiQualificationContext);
      const sources = [qualificationDetails, asRecord(aiContext.memory), asRecord(row.formData)];
      return {
        name: row.name,
        contact: [row.phone, row.email].filter((value): value is string => Boolean(value?.trim())).join(" · "),
        lives: firstValue(sources, ["vidas", "n_vidas", "dependentes", "lives", "numberOfLives", "quantidadeVidas"]),
        city: firstValue(sources, ["cidade", "city", "localidade", "cidade_cliente"]),
        enteredAt: row.createdAt,
      };
    });

    const body = await encodeUnassignedLeadsPdf({ rows: pdfRows });
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "report",
      entidadeId: "distribution-unassigned",
      acao: `report.generated:distribution-unassigned:${pdfRows.length}:pdf`,
    });

    return new NextResponse(body.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="leads-sem-distribuicao-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o PDF." }, { status: 400 });
  }
}
