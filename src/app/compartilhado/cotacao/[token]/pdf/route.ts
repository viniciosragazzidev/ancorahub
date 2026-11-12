import { NextRequest, NextResponse } from "next/server";

import { loadPublicQuotePdf } from "@/features/auto-sale/public-quote";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";
import { downloadR2Object } from "@/shared/storage/r2-storage";

export const dynamic = "force-dynamic";

/** PDF da cotação pelo link público (mesmas regras da página: token, validade, revogação, flag). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const pdf = await loadPublicQuotePdf(token);
    if (!pdf) return NextResponse.json({ error: "Cotação não encontrada ou vencida." }, { status: 404 });
    const file = await downloadR2Object(pdf.key);
    const headers = new Headers(safeFileHeaders({ mimeType: "application/pdf", filename: `cotacao-${pdf.version}.pdf` }));
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new NextResponse(file, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir o PDF agora." }, { status: 404 });
  }
}
