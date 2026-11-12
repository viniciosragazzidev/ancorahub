import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";
import { downloadR2Object } from "@/shared/storage/r2-storage";

/**
 * PDF de uma oferta da Venda Automatizada (DEC-182): só o diretor ou o gestor que escolheu a negociação,
 * sempre da própria empresa (tenant da sessão). O arquivo sai do R2 privado e cada leitura é auditada.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const { offerId } = await params;
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(offerId)) return NextResponse.json({ error: "Oferta inválida." }, { status: 400 });
    const db = getDatabase();
    const [row] = await db.select({ pdfKey: schema.autoSaleOffers.pdfKey, version: schema.autoSaleOffers.version, chosenBy: schema.autoSaleDeals.chosenBy, dealId: schema.autoSaleDeals.id })
      .from(schema.autoSaleOffers).innerJoin(schema.autoSaleDeals, eq(schema.autoSaleDeals.id, schema.autoSaleOffers.dealId))
      .where(and(eq(schema.autoSaleOffers.id, offerId), eq(schema.autoSaleOffers.tenantId, context.tenantId))).limit(1);
    if (!row?.pdfKey || (context.role === "manager" && row.chosenBy !== context.userId)) return NextResponse.json({ error: "PDF não encontrado." }, { status: 404 });
    const file = await downloadR2Object(row.pdfKey);
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "auto_sale_offer", entidadeId: offerId, acao: "auto_sale.pdf_viewed", metadata: { dealId: row.dealId } }).catch(() => undefined);
    return new NextResponse(file, { headers: safeFileHeaders({ mimeType: "application/pdf", filename: `cotacao-${row.version}.pdf` }) });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir o PDF agora." }, { status: 404 });
  }
}
