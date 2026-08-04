import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const tenant = await getRequiredTenantContext();
  if (!hasCapability(tenant.role, "exportar_relatorios", tenant.jobTitle)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await context.params;
  const [document] = await getDatabase().select().from(schema.internalReportDocuments).where(and(eq(schema.internalReportDocuments.id, id), eq(schema.internalReportDocuments.tenantId, tenant.tenantId))).limit(1);
  if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  const file = await downloadR2Object(document.storageKey);
  return new NextResponse(file, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": document.mimeType,
      "content-disposition": `attachment; filename="${document.filename.replace(/[\r\n"]/g, "_")}"`,
    },
  });
}
