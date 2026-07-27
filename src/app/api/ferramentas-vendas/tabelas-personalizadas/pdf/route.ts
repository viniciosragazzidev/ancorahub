import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, eq, inArray } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const planIdsParam = searchParams.get("planIds");
  if (!planIdsParam) return new Response("planIds é obrigatório", { status: 400 });

  const planIds = planIdsParam.split(",").filter(Boolean);
  if (planIds.length === 0) return new Response("Selecione ao menos um plano.", { status: 400 });

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    // Fetch plan info
    const [globalPlanInfo, legacyPlanInfo, globalPrices, legacyPrices] = await Promise.all([
      db
        .select({
          id: schema.globalPlans.id,
          carrierName: schema.globalCarriers.name,
          planName: schema.globalPlans.name,
          coverage: schema.globalPlans.coverage,
          type: schema.globalPlans.type,
        })
        .from(schema.globalPlans)
        .innerJoin(schema.globalCarriers, eq(schema.globalPlans.carrierId, schema.globalCarriers.id))
        .where(inArray(schema.globalPlans.id, planIds)),
      db
        .select({
          id: schema.carrierPlans.id,
          carrierName: schema.carriers.name,
          planName: schema.carrierPlans.name,
          coverage: schema.carrierPlans.coverage,
          type: schema.carrierPlans.type,
        })
        .from(schema.carrierPlans)
        .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
        .where(and(eq(schema.carrierPlans.tenantId, context.tenantId), inArray(schema.carrierPlans.id, planIds))),
      db
        .select({
          planId: schema.globalPlans.id,
          ageBand: schema.catalogPriceRows.ageBand,
          monthlyPrice: schema.catalogPriceRows.monthlyPrice,
        })
        .from(schema.catalogPriceRows)
        .innerJoin(schema.catalogTableVersions, eq(schema.catalogPriceRows.tableVersionId, schema.catalogTableVersions.id))
        .innerJoin(schema.catalogPriceTables, eq(schema.catalogTableVersions.priceTableId, schema.catalogPriceTables.id))
        .innerJoin(schema.globalPlans, eq(schema.catalogPriceTables.planId, schema.globalPlans.id))
        .where(and(eq(schema.catalogTableVersions.status, "published"), eq(schema.catalogPriceTables.status, "published"), inArray(schema.globalPlans.id, planIds))),
      db
        .select({
          planId: schema.carrierPlanPrices.planId,
          ageBand: schema.carrierPlanPrices.ageBand,
          monthlyPrice: schema.carrierPlanPrices.monthlyPrice,
        })
        .from(schema.carrierPlanPrices)
        .where(and(eq(schema.carrierPlanPrices.tenantId, context.tenantId), inArray(schema.carrierPlanPrices.planId, planIds))),
    ]);

    // Merge plan info
    const planInfoMap = new Map<string, { carrierName: string; planName: string; coverage: string | null; type: string }>();
    for (const p of globalPlanInfo) planInfoMap.set(p.id, p);
    for (const p of legacyPlanInfo) planInfoMap.set(p.id, p);

    // Merge prices
    const allPrices = [...globalPrices, ...legacyPrices];
    const pricesByPlan = new Map<string, { ageBand: string; monthlyPrice: number }[]>();
    for (const price of allPrices) {
      const existing = pricesByPlan.get(price.planId) ?? [];
      existing.push({ ageBand: price.ageBand, monthlyPrice: Number(price.monthlyPrice) });
      pricesByPlan.set(price.planId, existing);
    }

    const allAgeBands = Array.from(new Set(allPrices.map((p) => p.ageBand))).sort();

    // Build PDF
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const brand = rgb(0.15, 0.39, 0.93); // #2563eb

    // Brand header bar
    page.drawRectangle({ x: 0, y: 760, width: 595.28, height: 81.89, color: brand });
    page.drawText("CorreTop", { x: 42, y: 799, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Tabela Personalizada de Preços", { x: 42, y: 778, size: 11, font: regular, color: rgb(1, 1, 1) });

    // Info section
    page.drawText("Planos e Preços", { x: 42, y: 718, size: 18, font: bold, color: rgb(0.1, 0.12, 0.16) });
    let y = 695;

    // Calculate table layout
    const colCount = allAgeBands.length + 2; // carrier+plan + coverage + age bands
    const colWidth = Math.min(80, (511 - 144 - 80) / allAgeBands.length);
    const startX = 42;

    // Draw column headers
    const headers = ["Operadora", "Plano", ...allAgeBands];
    let xOffset = startX;

    page.drawText("Operadora", { x: xOffset, y, size: 8, font: bold, color: rgb(0.35, 0.39, 0.45) });
    xOffset += 72;
    page.drawText("Plano", { x: xOffset, y, size: 8, font: bold, color: rgb(0.35, 0.39, 0.45) });
    xOffset += 72;

    for (const band of allAgeBands) {
      page.drawText(band, { x: xOffset, y, size: 7, font: bold, color: rgb(0.35, 0.39, 0.45) });
      xOffset += colWidth;
    }

    y -= 20;
    page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: rgb(0.88, 0.9, 0.94), thickness: 1 });
    y -= 8;

    // Draw rows
    for (const planId of planIds) {
      const info = planInfoMap.get(planId);
      if (!info) continue;

      const prices = pricesByPlan.get(planId) ?? [];

      // Check if we need a new page
      if (y < 100) {
        y = 760;
        page.drawRectangle({ x: 0, y, width: 595.28, height: 1, color: rgb(0.88, 0.9, 0.94) });
        y -= 16;
      }

      // Row background
      page.drawRectangle({ x: 42, y: y - 6, width: 511, height: 14, color: rgb(0.97, 0.98, 1) });

      xOffset = startX;
      page.drawText(info.carrierName, { x: xOffset, y: y - 2, size: 7.5, font: regular, color: rgb(0.1, 0.12, 0.16) });
      xOffset += 72;

      page.drawText(info.planName, { x: xOffset, y: y - 2, size: 7.5, font: bold, color: rgb(0.1, 0.12, 0.16) });
      xOffset += 72;

      for (const band of allAgeBands) {
        const price = prices.find((p) => p.ageBand === band);
        const value = price ? formatCurrency(price.monthlyPrice) : "—";
        page.drawText(value, { x: xOffset, y: y - 2, size: 7.5, font: regular, color: rgb(0.1, 0.12, 0.16) });
        xOffset += colWidth;
      }

      y -= 20;
    }

    // Footer
    page.drawText("Valores de referência sujeitos à análise de crédito e às condições vigentes das operadoras.", {
      x: 42, y: 66, size: 8, font: regular, color: rgb(0.4, 0.43, 0.48),
    });
    page.drawText("CorreTop · Tabela gerada digitalmente", {
      x: 42, y: 48, size: 8, font: regular, color: rgb(0.4, 0.43, 0.48),
    });

    const bytes = await pdf.save();

    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tabela-personalizada-corretop.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response("Erro ao gerar PDF.", { status: 500 });
  }
}


