import "server-only";

import sharp from "sharp";

import { formatCents, type OfferSnapshot } from "./contracts";
import { copartKind } from "./offer-strategy";

const escape = (value: string) => value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);

/** SVG do cartão do plano (preço do snapshot), para quem não abre PDF. Cores do Lite. */
export function planCardSvg(plan: OfferSnapshot["plans"][number], options: { index: number; recommended: boolean; brokerageName: string }) {
  const copart = copartKind(plan);
  const copartText = copart === "sem" ? "Sem coparticipação" : copart === "parcial" ? "Coparticipação parcial" : copart === "total" ? "Com coparticipação" : "Coparticipação a confirmar";
  const lives = plan.perLife.length === 1 ? "1 pessoa" : `${plan.perLife.length} pessoas`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#f7f7f9"/>
  <rect x="60" y="60" width="960" height="960" rx="48" fill="#ffffff" stroke="${options.recommended ? "#2f78f5" : "#e0e0e6"}" stroke-width="${options.recommended ? 6 : 2}"/>
  <text x="120" y="170" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#4b4b59">Opção ${options.index + 1}${options.recommended ? " · recomendada" : ""}</text>
  <text x="120" y="280" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="500" fill="#0b0b12">${escape(plan.operator).slice(0, 28)}</text>
  <text x="120" y="360" font-family="Helvetica, Arial, sans-serif" font-size="48" fill="#4b4b59">${escape(plan.name).slice(0, 36)}</text>
  <text x="120" y="560" font-family="Helvetica, Arial, sans-serif" font-size="120" font-weight="500" fill="#0b0b12">${escape(formatCents(plan.totalCents))}</text>
  <text x="120" y="630" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#4b4b59">por mês, ${lives}</text>
  <text x="120" y="760" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#0b0b12">${escape(copartText)}</text>
  <text x="120" y="830" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#0b0b12">${escape(plan.accommodation || "Acomodação conforme contrato").slice(0, 40)}</text>
  <text x="120" y="950" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#666674">${escape(options.brokerageName).slice(0, 40)} · valores da tabela da operadora</text>
</svg>`;
}

export async function renderPlanImage(plan: OfferSnapshot["plans"][number], options: { index: number; recommended: boolean; brokerageName: string }) {
  return sharp(Buffer.from(planCardSvg(plan, options))).png().toBuffer();
}
