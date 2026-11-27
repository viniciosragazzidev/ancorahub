/**
 * Ícones das áreas da barra lateral (27/11/2026), copiados do artifact "Painel da gestão no estilo do corretor":
 * traço de 1,8 em caixa de 24, na cor do texto. Mesmo desenho em todas as telas do Lite.
 */
import type { SVGProps } from "react";

type AreaIconProps = { className?: string; weight?: string } & Omit<SVGProps<SVGSVGElement>, "ref">;

function makeAreaIcon(d: string, name: string) {
  function AreaIcon({ className, weight, ...rest }: AreaIconProps) {
    void weight;
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
        <path d={d} />
      </svg>
    );
  }
  AreaIcon.displayName = name;
  return AreaIcon;
}

export const AreaIconInicio = makeAreaIcon("M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5", "AreaIconInicio");
export const AreaIconConversas = makeAreaIcon("M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z", "AreaIconConversas");
export const AreaIconLeads = makeAreaIcon("M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", "AreaIconLeads");
export const AreaIconDistribuicao = makeAreaIcon("M4 6h10M4 12h16M4 18h7M18 4l3 2-3 2M14 16l3 2-3 2", "AreaIconDistribuicao");
export const AreaIconComercial = makeAreaIcon("M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18", "AreaIconComercial");
export const AreaIconFinanceiro = makeAreaIcon("M12 2v20M17 6.5A4.5 4.5 0 0 0 12.5 4h-1a3.5 3.5 0 0 0 0 7h1a3.5 3.5 0 0 1 0 7h-1A4.5 4.5 0 0 1 7 15.5", "AreaIconFinanceiro");
export const AreaIconErp = makeAreaIcon("M4 20V10M10 20V4M16 20v-7M22 20H2", "AreaIconErp");
export const AreaIconIa = makeAreaIcon("M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z", "AreaIconIa");
export const AreaIconMarketing = makeAreaIcon("M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1ZM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14", "AreaIconMarketing");
export const AreaIconEquipe = makeAreaIcon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0", "AreaIconEquipe");
export const AreaIconConfig = makeAreaIcon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z", "AreaIconConfig");
