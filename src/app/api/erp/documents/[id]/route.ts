import { NextResponse } from "next/server";
import { downloadErpEvidence } from "@/features/erp/documents";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const file = await downloadErpEvidence(id);
    return new NextResponse(file.blob, { headers: { ...safeFileHeaders({ mimeType: file.contentType, filename: file.fileName }), "Content-Disposition": `attachment; filename="evidencia-${id}.${file.contentType === "application/pdf" ? "pdf" : file.contentType === "image/png" ? "png" : "jpg"}"` } });
  } catch { return NextResponse.json({ error: "Evidência indisponível ou sem acesso." }, { status: 404 }); }
}
