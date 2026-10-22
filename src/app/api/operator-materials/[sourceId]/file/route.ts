import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { operatorFileStorageKey } from "@/features/operator-catalog/ingest";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The original operator file (director and manager), checked against the tenant. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const { sourceId } = await params;
  const [source] = await getDatabase()
    .select({ fileName: schema.knowledgeSources.fileName, fileType: schema.knowledgeSources.fileType, fileUrl: schema.knowledgeSources.fileUrl })
    .from(schema.knowledgeSources)
    .where(and(eq(schema.knowledgeSources.id, sourceId), eq(schema.knowledgeSources.tenantId, context.tenantId), eq(schema.knowledgeSources.category, OPERATOR_MATERIAL_CATEGORY)))
    .limit(1);
  const key = source ? operatorFileStorageKey(source.fileUrl) : null;
  if (!source || !key) return NextResponse.json({ error: "O arquivo original não foi guardado; só o texto lido está no catálogo." }, { status: 404 });
  try {
    const file = await downloadR2Object(key);
    return new NextResponse(file, {
      headers: {
        "Content-Disposition": `inline; filename="${source.fileName.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "Content-Type": source.fileType || "application/octet-stream",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir o arquivo." }, { status: 404 });
  }
}
