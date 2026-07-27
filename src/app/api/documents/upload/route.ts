import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { DocumentStorageConfigurationError, uploadDocumentObject } from "@/shared/storage/document-storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const leadIdSchema = z.string().uuid();

export async function POST(req: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    if (!context) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const leadId = leadIdSchema.safeParse(formData.get("leadId"));
    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!leadId.success) {
      return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "O arquivo deve ter entre 1 byte e 10 MB." }, { status: 400 });
    }
    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: "Formato não permitido. Envie PDF, JPG ou PNG." }, { status: 400 });
    }

    const db = getDatabase();
    const [lead] = await db
      .select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId.data), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    }
    if (context.role === "broker" && lead.corretorId !== context.userId) {
      return NextResponse.json({ error: "Você não pode anexar documentos a este lead." }, { status: 403 });
    }
    if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
      return NextResponse.json({ error: "Este lead não pertence à sua filial." }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const uuid = randomUUID();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const uniqueFilename = `${uuid}-${safeFilename}`;

    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
    const storageKey = `${context.tenantId}/${uniqueFilename}`;
    await uploadDocumentObject(storageKey, buffer, file.type);
    const fileUrl = `/api/documents/download?key=${encodeURIComponent(storageKey)}`;

    return NextResponse.json({ fileUrl, storageKey, filename: file.name, mimeType: file.type, sizeBytes: file.size, checksumSha256 });
  } catch (error) {
    if (error instanceof DocumentStorageConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Document upload failed", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { error: "Não foi possível concluir o upload. Tente novamente." },
      { status: 502 }
    );
  }
}
