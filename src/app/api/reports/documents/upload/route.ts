import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { uploadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const context = await getRequiredTenantContext();
  if (!hasCapability(context.role, "exportar_relatorios", context.jobTitle)) return NextResponse.json({ error: "Sem permissão para documentos internos." }, { status: 403 });
  if (!(await isR2StorageEnabled())) return NextResponse.json({ error: "Armazenamento privado indisponível." }, { status: 503 });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  if (!(file instanceof File) || file.type !== "application/pdf" || file.size < 1 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Envie um PDF de até 15 MB." }, { status: 400 });
  if (title.length < 2 || title.length > 140) return NextResponse.json({ error: "Informe um título entre 2 e 140 caracteres." }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `internal-reports/${context.tenantId}/${id}-${safeName}`;
  await uploadR2Object(storageKey, buffer, "application/pdf");
  await getDatabase().transaction(async (tx) => {
    await tx.insert(schema.internalReportDocuments).values({ id, tenantId: context.tenantId, title, filename: file.name, storageKey, mimeType: "application/pdf", sizeBytes: file.size, checksumSha256: createHash("sha256").update(buffer).digest("hex"), uploadedBy: context.userId });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "internal_report_document", entidadeId: id, acao: "report_document.uploaded" });
  });
  return NextResponse.json({ id, title, filename: file.name });
}
