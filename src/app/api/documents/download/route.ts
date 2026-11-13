import { normalize } from "node:path";

import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";
import { getDatabase, schema } from "@/shared/db";
import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { downloadR2Object } from "@/shared/storage/r2-storage";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { buildDocumentLeadScope } from "@/features/documents/document-scope";
import { getEffectiveAccess } from "@/features/custom-roles/service";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    if (!(await getEffectiveAccess({ ...context, customRoleId: context.customRoleId ?? null })).capabilities.has("acessar_documentos")) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    const scope = buildDocumentLeadScope(context, await resolveReportDataScope(context));
    if (!(await isR2StorageEnabled())) {
      return NextResponse.json(
        { error: "O armazenamento de arquivos está temporariamente desativado pela plataforma." },
        { status: 503 },
      );
    }
    const key = request.nextUrl.searchParams.get("key") ?? "";
    const safeKey = normalize(key).replaceAll("\\", "/");
    if (
      !safeKey ||
      safeKey.includes("..") ||
      !safeKey.startsWith(`documents/${context.tenantId}/`)
    ) {
      return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
    }

    const fileUrl = `/api/documents/download?key=${encodeURIComponent(key)}`;
    const [document] = await getDatabase()
      .select({
        id: schema.leadDocuments.id,
        filename: schema.leadDocuments.filename,
        fileUrl: schema.leadDocuments.fileUrl,
        mimeType: schema.leadDocuments.mimeType,
        storageKey: schema.leadDocuments.storageKey,
      })
      .from(schema.leadDocuments)
      .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.leadDocuments.tenantId, context.tenantId),
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leadDocuments.fileUrl, fileUrl),
          isNull(schema.leadDocuments.deletedAt),
          isNull(schema.leads.deletedAt), scope,
        ),
      )
      .limit(1);
    if (!document)
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

    const storageKey = document.storageKey === safeKey ? document.storageKey : safeKey;
    const file = await downloadR2Object(storageKey);
    await getDatabase().insert(schema.auditLogs).values({ id: crypto.randomUUID(), userId: context.viewAs?.adminUserId ?? context.userId, entidade: "lead_document", entidadeId: document.id, acao: "document.downloaded" });
    return new NextResponse(file, {
      headers: safeFileHeaders({ mimeType: document.mimeType, filename: document.filename }),
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 404 });
  }
}
