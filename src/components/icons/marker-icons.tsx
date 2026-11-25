/* Gerado por scripts/icons-to-tsx.mjs a partir de src/components/icons/*.svg. Não editar à mão. */
import type { SVGProps } from "react";

/**
 * Ícones de marcador (25/11/2026): desenhados com a skill draw-icons (`icons.yaml`, traço 2,5 com pontas redondas)
 * e com a textura de marcador de quadro branco aplicada igual em todos pelo filtro `#marcador`.
 * Tamanhos desenhados: 20 e 24 px. O traço é o do desenho; `strokeWidth` e `weight` vindos de outras bibliotecas são ignorados.
 */
export type MarkerIconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  size?: number | string;
  /** Ignorado: o traço é parte do desenho. Aceito para trocar ícones de outras bibliotecas sem mexer no uso. */
  strokeWidth?: number | string;
  /** Ignorado (Phosphor). */
  weight?: string;
  /** Sem textura de marcador (ex.: impressão). */
  plain?: boolean;
};

export const MARKER_FILTER_ID = "marcador";

/** Filtro da textura de marcador. Uma vez por página, no layout raiz. */
export function MarkerFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id={MARKER_FILTER_ID} x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={7} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

function base({ size = 24, strokeWidth: _stroke, weight: _weight, plain = false, style, ...props }: MarkerIconProps) {
  void _stroke;
  void _weight;
  return {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": props["aria-label"] ? undefined : true,
    style: plain ? style : { filter: `url(#${MARKER_FILTER_ID})`, ...style },
    ...props,
  };
}

export function BanknoteIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 5.25L18.5 5.25A3 3 0 0 1 21.5 8.25L21.5 15.75A3 3 0 0 1 18.5 18.75L5.5 18.75A3 3 0 0 1 2.5 15.75L2.5 8.25A3 3 0 0 1 5.5 5.25Z"/><circle cx="12" cy="12" r="2.25"/></svg>;
}

export function ChatCircleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M7.9 20A9 9 0 1 0 4 16.1L2.75 21.25Z"/><path d="M7.5 12h.01"/><path d="M12 12h.01"/><path d="M16.5 12h.01"/></svg>;
}

export function ChevronDownIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="m6 9 6 6 6-6"/></svg>;
}

export function DotsIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M5 12h.01"/><path d="M12 12h.01"/><path d="M19 12h.01"/></svg>;
}

export function HouseIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M7.2 6.35L10.2 4.1A3 3 0 0 1 13.8 4.1L19.8 8.6A3 3 0 0 1 21 11L21 18A3 3 0 0 1 18 21L6 21A3 3 0 0 1 3 18L3 11A3 3 0 0 1 4.2 8.6Z"/><path d="M9.5 21L9.5 16A1.5 1.5 0 0 1 11 14.5L13 14.5A1.5 1.5 0 0 1 14.5 16L14.5 21"/></svg>;
}

export function LightbulbIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M9.5 15.5 7.034 11.867A6 6 0 1 1 16.966 11.867L14.5 15.5Z"/><path d="M10 20h4"/></svg>;
}

export function ListChecksIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13.5 6h7.5"/><path d="M13.5 12h7.5"/><path d="M13.5 18h7.5"/></svg>;
}

export function MegaphoneIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M7.081 8.5L9.661 8.5A1.5 1.5 0 0 0 10.306 8.354L18.355 4.521A1.5 1.5 0 0 1 20.5 5.876L20.5 16.124A1.5 1.5 0 0 1 18.355 17.479L10.306 13.646A1.5 1.5 0 0 0 9.661 13.5L4.5 13.5A1.5 1.5 0 0 1 3 12L3 10A1.5 1.5 0 0 1 4.5 8.5Z"/><path d="M5 13.5L6.246 19.314A1.5 1.5 0 0 0 7.713 20.5L9.145 20.5A1.5 1.5 0 0 0 10.611 18.686L9.5 13.5"/></svg>;
}

export function MessageSquareIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 3L18 3A3 3 0 0 1 21 6L21 14A3 3 0 0 1 18 17L8.982 17A2.559 2.559 0 0 0 7.27 17.657A2.559 2.559 0 0 1 3 15.755L3 6A3 3 0 0 1 6 3Z"/><path d="M7.5 8h9"/><path d="M7.5 12.5h5.5"/></svg>;
}

export function PresentationIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M2.25 3h19.5"/><path d="M20.75 3L20.75 13A3 3 0 0 1 17.75 16L6.25 16A3 3 0 0 1 3.25 13L3.25 3"/><path d="M7.5 20.5 12 16l4.5 4.5"/></svg>;
}

export function ShieldCheckIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M19.75 12.5c0 5-3.4 7.4-7.4 8.8a1 1 0 0 1-.7 0C7.65 19.9 4.25 17.5 4.25 12.5V6.25A1.25 1.25 0 0 1 5.5 5c2 0 4.4-1.15 6.05-2.6a.75.75 0 0 1 .9 0C14.1 3.85 16.5 5 18.5 5a1.25 1.25 0 0 1 1.25 1.25z"/><path d="m9 12 2 2 4-4"/></svg>;
}

export function SignOutIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H4.5A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3H9"/></svg>;
}

export function SlidersIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="15" cy="7" r="2.25"/><circle cx="9" cy="17" r="2.25"/><path d="M3 7h9.75M17.25 7H21"/><path d="M3 17h3.75M11.25 17H21"/></svg>;
}

export function SmartphoneIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 2.5L15 2.5A3 3 0 0 1 18 5.5L18 18.5A3 3 0 0 1 15 21.5L9 21.5A3 3 0 0 1 6 18.5L6 5.5A3 3 0 0 1 9 2.5Z"/><path d="M12 17h.01"/></svg>;
}

export function SparkleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M13.95 7.287L14.512 8.665A1.5 1.5 0 0 0 15.335 9.488L18.09 10.611A1.5 1.5 0 0 1 18.09 13.389L15.335 14.512A1.5 1.5 0 0 0 14.512 15.335L13.389 18.09A1.5 1.5 0 0 1 10.611 18.09L9.488 15.335A1.5 1.5 0 0 0 8.665 14.512L5.91 13.389A1.5 1.5 0 0 1 5.91 10.611L8.665 9.488A1.5 1.5 0 0 0 9.488 8.665L10.611 5.91A1.5 1.5 0 0 1 13.389 5.91Z"/></svg>;
}

export function SquaresFourIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M6.375 3L8.25 3A1.5 1.5 0 0 1 9.75 4.5L9.75 8.25A1.5 1.5 0 0 1 8.25 9.75L4.5 9.75A1.5 1.5 0 0 1 3 8.25L3 4.5A1.5 1.5 0 0 1 4.5 3Z"/><path d="M17.625 3L19.5 3A1.5 1.5 0 0 1 21 4.5L21 8.25A1.5 1.5 0 0 1 19.5 9.75L15.75 9.75A1.5 1.5 0 0 1 14.25 8.25L14.25 4.5A1.5 1.5 0 0 1 15.75 3Z"/><path d="M6.375 14.25L8.25 14.25A1.5 1.5 0 0 1 9.75 15.75L9.75 19.5A1.5 1.5 0 0 1 8.25 21L4.5 21A1.5 1.5 0 0 1 3 19.5L3 15.75A1.5 1.5 0 0 1 4.5 14.25Z"/><path d="M17.625 14.25L19.5 14.25A1.5 1.5 0 0 1 21 15.75L21 19.5A1.5 1.5 0 0 1 19.5 21L15.75 21A1.5 1.5 0 0 1 14.25 19.5L14.25 15.75A1.5 1.5 0 0 1 15.75 14.25Z"/></svg>;
}

export function UserCircleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="9.75"/><circle cx="12" cy="9.6" r="2.75"/><path d="M6.73 20.2a6 6 0 0 1 10.54 0"/></svg>;
}

export function UsersIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="9" cy="7" r="3.5"/><path d="M2.5 21v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1.5"/><path d="M17.5 3.5a3.5 3.5 0 0 1 0 6.5"/><path d="M21.5 21v-1a4 4 0 0 0-2-3.46"/></svg>;
}

export function WalletIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 7L18 7A3 3 0 0 1 21 10L21 18.5A3 3 0 0 1 18 21.5L6 21.5A3 3 0 0 1 3 18.5L3 10A3 3 0 0 1 6 7Z"/><path d="M17.75 11.5L19.5 11.5A1.5 1.5 0 0 1 21 13L21 15.5A1.5 1.5 0 0 1 19.5 17L16 17A1.5 1.5 0 0 1 14.5 15.5L14.5 13A1.5 1.5 0 0 1 16 11.5Z"/></svg>;
}
