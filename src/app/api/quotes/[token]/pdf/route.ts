import { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { getQuoteByToken } from "@/features/quotes/queries";
import { formatCurrency } from "@/features/quotes/utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuoteByToken(token);

  if (!quote) {
    return new Response("Proposta não encontrada", { status: 404 });
  }

  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  let y = height - 60;

  // Title
  page.drawText("Proposta de Seguro de Saúde", {
    x: 50,
    y,
    size: 22,
    font: helveticaBold,
    color: rgb(0.15, 0.25, 0.55),
  });

  y -= 35;
  page.drawText(`Preparada para: ${quote.leadName ?? "Não informado"}`, {
    x: 50,
    y,
    size: 12,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 20;
  page.drawText(`Data: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(quote.createdAt)}`, {
    x: 50,
    y,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Divider
  y -= 25;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  y -= 25;

  // Summary
  if (quote.beneficiaryCount) {
    page.drawText(`Beneficiários: ${quote.beneficiaryCount}`, {
      x: 50,
      y,
      size: 11,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 20;
  }

  if (quote.totalMonthly) {
    page.drawText(`Valor Mensal Total: ${formatCurrency(Number(quote.totalMonthly))}`, {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.15, 0.4, 0.65),
    });
    y -= 30;
  }

  // Plans
  if (quote.items.length > 0) {
    page.drawText("Planos Incluídos", {
      x: 50,
      y,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 20;

    for (const item of quote.items) {
      const planName = (item.snapshot as Record<string, string>)?.planName ?? item.planId;
      const price = formatCurrency(Number(item.monthlyPrice));

      page.drawText(planName, {
        x: 60,
        y,
        size: 10,
        font: helveticaFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText(`${price}/mês`, {
        x: width - 150,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.15, 0.4, 0.65),
      });

      y -= 18;

      if (item.recommended) {
        page.drawText("(Recomendado)", {
          x: 75,
          y,
          size: 8,
          font: helveticaFont,
          color: rgb(0.2, 0.6, 0.3),
        });
        y -= 15;
      }
    }

    y -= 10;
  }

  // Line Items (per beneficiary)
  if (quote.lineItems.length > 0) {
    page.drawText("Detalhamento por Beneficiário", {
      x: 50,
      y,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 20;

    for (const item of quote.lineItems) {
      const name = (item.snapshot as Record<string, string>)?.beneficiaryName ?? item.beneficiaryId;
      const planName = (item.snapshot as Record<string, string>)?.planName ?? item.planId;
      const price = formatCurrency(Number(item.calculatedValue));

      page.drawText(`${name} (${item.ageAtQuote} anos) — ${planName}`, {
        x: 60,
        y,
        size: 10,
        font: helveticaFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText(price, {
        x: width - 150,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.15, 0.4, 0.65),
      });

      y -= 18;
    }

    y -= 10;
  }

  // Notes
  if (quote.notes) {
    page.drawText("Observações", {
      x: 50,
      y,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 18;

    const lines = quote.notes.split("\n");
    for (const line of lines) {
      if (y < 80) break;
      page.drawText(line.slice(0, 80), {
        x: 60,
        y,
        size: 9,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      y -= 14;
    }
  }

  // Footer
  page.drawText("Proposta gerada pela plataforma CorreTop", {
    x: 50,
    y: 40,
    size: 8,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6),
  });

  page.drawText("Este documento não substitui a análise formal da operadora.", {
    x: 50,
    y: 28,
    size: 8,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proposta-${(quote.leadName ?? "corretop").replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
