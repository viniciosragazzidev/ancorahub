import { normalize } from "node:path";

import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { downloadDocumentObject } from "@/shared/storage/document-storage";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    const key = request.nextUrl.searchParams.get("key") ?? "";
    const safeKey = normalize(key).replaceAll("\\", "/");
    if (!safeKey || safeKey.includes("..") || !safeKey.startsWith(`${context.tenantId}/`)) {
      return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
    }

    const fileUrl = `/api/documents/download?key=${encodeURIComponent(key)}`;
    const [document] = await getDatabase()
      .select({ filename: schema.leadDocuments.filename, fileUrl: schema.leadDocuments.fileUrl, mimeType: schema.leadDocuments.mimeType, storageKey: schema.leadDocuments.storageKey })
      .from(schema.leadDocuments)
      .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
      .where(and(
        eq(schema.leadDocuments.tenantId, context.tenantId),
        eq(schema.leadDocuments.fileUrl, fileUrl),
        isNull(schema.leadDocuments.deletedAt),
        context.role === "broker" ? eq(schema.leads.corretorId, context.userId) : context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
      ))
      .limit(1);
    if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

    const storageKey = document.storageKey === safeKey ? document.storageKey : safeKey;
    const file = await downloadDocumentObject(storageKey);
    return new NextResponse(file, {
      headers: {
        "Content-Disposition": `inline; filename="${document.filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "Content-Type": document.mimeType ?? "application/octet-stream",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 404 });
  }
}
