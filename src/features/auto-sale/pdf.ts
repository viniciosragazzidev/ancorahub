/**
 * PDF de cotação personalizado (§5 do plano). Sai só do snapshot da oferta: nenhum número é digitado
 * à mão nem gerado pela IA. Helvetica com WinAnsi cobre os acentos do português (D14). Cores dos
 * tokens do Lite (ação, texto, apoio, superfície), sem token novo.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { AUTO_SALE_LIMITS, formatCents, type DealFacts, type OfferSnapshot, type Promotion } from "./contracts";
import { copartKind, isReadyExceptDocuments } from "./offer-strategy";
import { DUE_DAYS } from "./playbook";
import { documentsChecklist } from "./quote-messages";

export type NetworkHighlight = { planId: string; units: { name: string; type: string | null; neighborhood: string | null }[] };

export type QuotePdfInput = {
  offer: OfferSnapshot;
  facts: DealFacts;
  customerName: string;
  brokerage: { name: string; phone: string | null; units: readonly string[] };
  promotions: readonly Promotion[];
  network: NetworkHighlight | null;
  generatedAt: Date;
};

const COLOR = {
  action: rgb(0.18, 0.47, 0.96),
  text: rgb(0.043, 0.043, 0.07),
  secondary: rgb(0.294, 0.294, 0.349),
  muted: rgb(0.945, 0.945, 0.961),
  border: rgb(0.88, 0.88, 0.9),
  white: rgb(1, 1, 1),
};

/** Validade: 7 dias ou o fim da vigência do preço, o que vier primeiro (yyyy-mm-dd). */
export function offerValidUntil(offer: OfferSnapshot): string {
  const base = new Date(`${offer.catalogDate}T12:00:00Z`);
  const limit = new Date(base.getTime() + AUTO_SALE_LIMITS.quoteValidityDays * 86_400_000).toISOString().slice(0, 10);
  const priceEnds = offer.plans.flatMap((plan) => plan.perLife.map((life) => life.to?.slice(0, 10))).filter((value): value is string => Boolean(value));
  return [limit, ...priceEnds].sort()[0];
}

export const brDate = (value: string) => value.slice(0, 10).split("-").reverse().join("/");

/** Todo texto passa por aqui: o que a fonte padrão não codifica vira espaço (nunca quebra o PDF). */
export function encodable(font: PDFFont, text: string) {
  let out = "";
  for (const char of text.replace(/[—–]/g, ",")) {
    try { font.encodeText(char); out += char; } catch { out += " "; }
  }
  return out;
}

function lifeLabel(age: number, holder: boolean) {
  return `${holder ? "Titular" : "Dependente"}, ${age} anos`;
}

function modalityLabel(offer: OfferSnapshot) {
  const modality = offer.input.modality;
  if (modality.startsWith("PME")) return "Empresarial (MEI ou CNPJ)";
  if (modality.startsWith("ADESAO")) return offer.input.entity ? `Adesão (${offer.input.entity})` : "Adesão por entidade";
  return "Pessoa física";
}

export async function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Cotação ${input.brokerage.name}`);
  pdf.setLanguage("pt-BR");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595, height = 842, margin = 48, inner = width - margin * 2;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - margin;

  const ensure = (space: number) => { if (y - space < margin) { page = pdf.addPage([width, height]); y = height - margin; } };
  const wrap = (text: string, face: PDFFont, size: number, max: number) => {
    const lines: string[] = [];
    for (const paragraph of encodable(face, text).split("\n")) {
      let row = "";
      for (const word of paragraph.split(/\s+/)) {
        const next = row ? `${row} ${word}` : word;
        if (face.widthOfTextAtSize(next, size) > max && row) { lines.push(row); row = word; } else row = next;
      }
      lines.push(row);
    }
    return lines;
  };
  const text = (value: string, options: { size?: number; face?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; max?: number; gap?: number } = {}) => {
    const size = options.size ?? 10, face = options.face ?? font, x = options.x ?? margin, max = options.max ?? inner;
    for (const line of wrap(value, face, size, max)) {
      ensure(size + 4);
      page.drawText(line, { x, y: y - size, size, font: face, color: options.color ?? COLOR.text });
      y -= size + (options.gap ?? 4);
    }
  };
  const heading = (value: string) => { y -= 14; ensure(30); text(value, { size: 13, face: bold }); y -= 2; };

  // Capa
  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: COLOR.action });
  page.drawText(encodable(bold, input.brokerage.name), { x: margin, y: height - 56, size: 18, font: bold, color: COLOR.white });
  page.drawText(encodable(font, `Cotação de plano de saúde para ${input.customerName}`), { x: margin, y: height - 80, size: 12, font, color: COLOR.white });
  page.drawText(encodable(font, `Emitida em ${brDate(input.offer.catalogDate)} | Válida até ${brDate(offerValidUntil(input.offer))}`), { x: margin, y: height - 100, size: 10, font, color: COLOR.white });
  y = height - 144;

  // Perfil cotado
  heading("Seu perfil");
  const lives = input.offer.input.lives;
  text(`${lives.length === 1 ? "1 pessoa" : `${lives.length} pessoas`}: ${lives.map((life) => lifeLabel(life.age, life.holder)).join("; ")}`, { color: COLOR.secondary });
  text(`Cidade: ${input.offer.input.city}${input.facts.neighborhood ? `, ${input.facts.neighborhood}` : ""} | Modalidade: ${modalityLabel(input.offer)}`, { color: COLOR.secondary });

  // Opções lado a lado
  heading(input.offer.relaxed ? "Opções mais em conta" : "Opções para você");
  if (input.offer.relaxed) text(`Para baixar o valor, ${input.offer.relaxed.label}.`, { color: COLOR.secondary });
  const columns = Math.max(1, input.offer.plans.length);
  const gap = 10, cardWidth = (inner - gap * (columns - 1)) / columns, cardHeight = 150 + lives.length * 13;
  ensure(cardHeight + 10);
  const top = y;
  input.offer.plans.forEach((plan, index) => {
    const x = margin + index * (cardWidth + gap);
    const recommended = plan.id === input.offer.recommendedPlanId;
    page.drawRectangle({ x, y: top - cardHeight, width: cardWidth, height: cardHeight, color: recommended ? COLOR.white : COLOR.muted, borderColor: recommended ? COLOR.action : COLOR.border, borderWidth: recommended ? 2 : 1 });
    let cy = top - 16;
    const line = (value: string, size: number, face: PDFFont, color = COLOR.text) => {
      for (const row of wrap(value, face, size, cardWidth - 20).slice(0, 2)) { page.drawText(row, { x: x + 10, y: cy - size, size, font: face, color }); cy -= size + 3; }
    };
    if (recommended) line("Recomendado", 9, bold, COLOR.action);
    line(plan.operator, 11, bold);
    line(plan.name, 10, font, COLOR.secondary);
    cy -= 4;
    line(`${formatCents(plan.totalCents)} por mês`, 14, bold);
    line(plan.accommodation || "Acomodação conforme contrato", 9, font, COLOR.secondary);
    const copart = copartKind(plan);
    line(copart === "sem" ? "Sem coparticipação" : copart === "parcial" ? "Coparticipação parcial" : copart === "total" ? "Com coparticipação" : plan.coparticipation || "Coparticipação a confirmar", 9, font, COLOR.secondary);
    cy -= 2;
    plan.perLife.forEach((life) => line(`${lifeLabel(life.age, life.holder)}: ${formatCents(life.cents)}`, 8, font, COLOR.secondary));
  });
  y = top - cardHeight - 8;

  const recommended = input.offer.plans.find((plan) => plan.id === input.offer.recommendedPlanId);
  if (recommended && input.offer.recommendationReason) {
    heading("Nossa recomendação");
    text(input.offer.recommendationReason);
  }
  if (input.offer.previousTotalCents != null && input.offer.plans[0] && input.offer.previousTotalCents > input.offer.plans[0].totalCents) {
    text(`Em relação à cotação anterior: ${formatCents(input.offer.previousTotalCents - input.offer.plans[0].totalCents)} a menos por mês.`, { color: COLOR.secondary });
  }
  if (input.offer.plans.some((plan) => !isReadyExceptDocuments(plan))) {
    text("Valores da tabela da operadora; condições do produto em conferência pela corretora.", { size: 9, color: COLOR.secondary });
  } else if (input.offer.plans.some((plan) => plan.state !== "ready")) {
    text("Vínculo, entidade ou tempo de empresa são conferidos na documentação, como em toda contratação.", { size: 9, color: COLOR.secondary });
  }

  // Rede perto do cliente (só com fonte do catálogo)
  if (input.network?.units.length) {
    const plan = input.offer.plans.find((item) => item.id === input.network!.planId);
    heading(`Rede perto de você${plan ? ` (${plan.operator} ${plan.name})` : ""}`);
    for (const unit of input.network.units.slice(0, 8)) {
      text(`• ${unit.name}${unit.type ? `, ${unit.type.toLocaleLowerCase("pt-BR")}` : ""}${unit.neighborhood ? `, ${unit.neighborhood}` : ""}`, { color: COLOR.secondary });
    }
  }

  heading("Carências, em linguagem simples");
  text("Urgência e emergência: 24 horas. Cirurgia eletiva: até 180 dias. Parto: 300 dias. Consultas e exames: conforme o contrato da operadora.", { color: COLOR.secondary });
  if (input.facts.currentPlan) text("Quem já tem plano pode ter redução de carência (compra de carência ou portabilidade), conforme a regra da operadora.", { color: COLOR.secondary });

  if (input.promotions.length) {
    heading("Condição vigente");
    for (const promotion of input.promotions) text(`${promotion.operator}: ${promotion.title}. ${promotion.description} Válida até ${brDate(promotion.endsOn)}.`, { color: COLOR.secondary });
  }

  heading("Para contratar");
  for (const item of documentsChecklist(input.facts)) text(`• ${item}`, { color: COLOR.secondary });
  y -= 4;
  text(`Próximo passo: responda SIM e escolha o vencimento: ${DUE_DAYS.slice(0, -1).join(", ")} ou ${DUE_DAYS.at(-1)}.`, { face: bold });

  heading("Fale com a gente");
  text(`${input.brokerage.name}${input.brokerage.phone ? ` | WhatsApp ${input.brokerage.phone}` : ""}`, { color: COLOR.secondary });
  for (const unit of input.brokerage.units.slice(0, 4)) text(`Unidade: ${unit}`, { color: COLOR.secondary });

  y -= 8;
  text(`Valores da tabela da operadora em ${brDate(input.offer.catalogDate)}, sujeitos à análise e aceitação da operadora. Esta cotação não é proposta nem contrato. Referência: ${input.offer.id}.`, { size: 8, color: COLOR.secondary });

  return Buffer.from(await pdf.save());
}
