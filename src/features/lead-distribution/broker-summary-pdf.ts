import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import type { BrokerDailySummaryAggregate } from "./broker-summary-service";

const navy = rgb(0.06, 0.09, 0.16);
const muted = rgb(0.35, 0.4, 0.48);
const blue = rgb(0.08, 0.45, 0.85);
const green = rgb(0.05, 0.6, 0.4);
const orange = rgb(0.95, 0.55, 0.1);

function text(page: PDFPage, value: unknown, x: number, y: number, size: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, color = navy) {
  page.drawText(String(value ?? "").replace(/[\r\n]+/g, " ").slice(0, 80), { x, y, size, font, color });
}

export async function encodeBrokerSummaryPdf(input: { data: BrokerDailySummaryAggregate; startDate: Date; endDate: Date; branchLabel: string }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([841.89, 595.28]);
  const { height } = page.getSize();
  text(page, "Resumo de distribuição", 32, height - 38, 20, bold);
  text(page, `${input.branchLabel} · ${input.startDate.toLocaleDateString("pt-BR")} a ${input.endDate.toLocaleDateString("pt-BR")}`, 32, height - 57, 9, regular, muted);

  const cards = [
    ["Corretores ativos", input.data.totalBrokers, blue],
    ["Leads recebidos", input.data.totalReceived, blue],
    ["Em atendimento", input.data.totalActive, green],
    ["Leads perdidos", input.data.totalLost, orange],
    ["Vendas concluídas", input.data.totalConverted, green],
    ["Conversão da equipe", `${input.data.teamConversionRate}%`, navy],
  ] as const;
  cards.forEach(([label, value, color], index) => {
    const x = 32 + index * 130;
    page.drawRectangle({ x, y: height - 120, width: 118, height: 45, color: rgb(0.96, 0.97, 0.98), borderColor: rgb(0.86, 0.88, 0.91), borderWidth: 0.7 });
    text(page, label, x + 8, height - 91, 7, regular, muted);
    text(page, value, x + 8, height - 109, 15, bold, color);
  });

  text(page, "Desempenho por corretor", 32, height - 151, 12, bold);
  const rows = input.data.items.slice(0, 9);
  const maxReceived = Math.max(1, ...rows.map((row) => row.leadsReceived));
  rows.forEach((row, index) => {
    const y = height - 177 - index * 34;
    text(page, row.brokerName, 32, y + 9, 8, bold);
    text(page, row.branchName ?? "Matriz", 32, y - 2, 7, regular, muted);
    page.drawRectangle({ x: 185, y, width: 270, height: 12, color: rgb(0.91, 0.93, 0.96) });
    page.drawRectangle({ x: 185, y, width: Math.max(2, 270 * row.leadsReceived / maxReceived), height: 12, color: blue });
    text(page, `${row.leadsReceived} recebidos`, 465, y + 2, 8, regular);
    text(page, `${row.offersAccepted}/${row.offersReceived} aceitas`, 550, y + 2, 8, regular, green);
    text(page, `${row.redistributionRate}% redistrib.`, 645, y + 2, 8, regular, row.redistributionRate > 0 ? orange : muted);
    text(page, row.avgOfferResponseMinutes === null ? "Sem aceite" : `${row.avgOfferResponseMinutes} min para aceitar`, 735, y + 2, 7, regular, muted);
  });
  if (input.data.items.length > rows.length) text(page, `+ ${input.data.items.length - rows.length} corretores no período`, 32, 62, 8, regular, muted);
  text(page, `Não iniciados: ${input.data.totalUnstarted} · Tempo médio 1º contato: ${input.data.avgTeamResponseMinutes ?? "N/A"} min · Redistribuições exibidas por corretor`, 32, 34, 8, regular, muted);
  return new Uint8Array(await pdf.save());
}
