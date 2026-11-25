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

export function ArrowLeftIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></svg>;
}

export function ArrowRightIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>;
}

export function ArrowUpRightIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M6 18 18 6"/><path d="M7.5 6H18v10.5"/></svg>;
}

export function BanknoteIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 5.25L18.5 5.25A3 3 0 0 1 21.5 8.25L21.5 15.75A3 3 0 0 1 18.5 18.75L5.5 18.75A3 3 0 0 1 2.5 15.75L2.5 8.25A3 3 0 0 1 5.5 5.25Z"/><circle cx="12" cy="12" r="2.25"/></svg>;
}

export function BellIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M4 16.5h16c-1.5-1.5-2.5-3-2.5-7.5a5.5 5.5 0 0 0-11 0c0 4.5-1 6-2.5 7.5Z"/><path d="M10 21h4"/></svg>;
}

export function BuildingIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 2.5L16 2.5A3 3 0 0 1 19 5.5L19 18.25A3 3 0 0 1 16 21.25L8 21.25A3 3 0 0 1 5 18.25L5 5.5A3 3 0 0 1 8 2.5Z"/><path d="M9.5 7.5h.01M14.5 7.5h.01"/><path d="M9.5 12h.01M14.5 12h.01"/><path d="M12 21.25V17"/></svg>;
}

export function CalendarIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 4.5L18 4.5A3 3 0 0 1 21 7.5L21 18.5A3 3 0 0 1 18 21.5L6 21.5A3 3 0 0 1 3 18.5L3 7.5A3 3 0 0 1 6 4.5Z"/><path d="M8 2.25V5.5M16 2.25V5.5"/><path d="M3 10h18"/></svg>;
}

export function ChartBarIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21"/><path d="M8 16.5v-4"/><path d="M12.5 16.5v-9"/><path d="M17 16.5v-6"/></svg>;
}

export function ChatCircleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M7.9 20A9 9 0 1 0 4 16.1L2.75 21.25Z"/><path d="M7.5 12h.01"/><path d="M12 12h.01"/><path d="M16.5 12h.01"/></svg>;
}

export function CheckCircleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="9.75"/><path d="m7.75 12.25 3 3 5.5-5.5"/></svg>;
}

export function CheckIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M20 6.5 9 17.5l-5-5"/></svg>;
}

export function ChevronDownIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="m6 9 6 6 6-6"/></svg>;
}

export function ClockIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="9.75"/><path d="M12 7v5l3 3"/></svg>;
}

export function CopyIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M15 8.5L18.5 8.5A3 3 0 0 1 21.5 11.5L21.5 18.5A3 3 0 0 1 18.5 21.5L11.5 21.5A3 3 0 0 1 8.5 18.5L8.5 11.5A3 3 0 0 1 11.5 8.5Z"/><path d="M4 15.5L4 7A3 3 0 0 1 7 4L15.5 4"/></svg>;
}

export function DotsIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M5 12h.01"/><path d="M12 12h.01"/><path d="M19 12h.01"/></svg>;
}

export function DownloadIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M3 15L3 18A3 3 0 0 0 6 21L18 21A3 3 0 0 0 21 18L21 15"/><path d="M12 3v11"/><path d="m7.5 9.5 4.5 4.5 4.5-4.5"/></svg>;
}

export function FileTextIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M10.129 2.5L12.757 2.5A3 3 0 0 1 14.879 3.379L18.621 7.121A3 3 0 0 1 19.5 9.243L19.5 18.5A3 3 0 0 1 16.5 21.5L7.5 21.5A3 3 0 0 1 4.5 18.5L4.5 5.5A3 3 0 0 1 7.5 2.5Z"/><path d="M13.5 2.5v4a1.5 1.5 0 0 0 1.5 1.5h4.5"/><path d="M9 12.5h6"/><path d="M9 17h4"/></svg>;
}

export function GearIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.28 5.28l2.12 2.12M16.6 16.6l2.12 2.12M5.28 18.72l2.12-2.12M16.6 7.4l2.12-2.12"/></svg>;
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

export function LockIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 10.5L17 10.5A3 3 0 0 1 20 13.5L20 18.5A3 3 0 0 1 17 21.5L7 21.5A3 3 0 0 1 4 18.5L4 13.5A3 3 0 0 1 7 10.5Z"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/><path d="M12 16h.01"/></svg>;
}

export function MagnifierIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="10.5" cy="10.5" r="7.5"/><path d="m21 21-5.2-5.2"/></svg>;
}

export function MegaphoneIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M7.081 8.5L9.661 8.5A1.5 1.5 0 0 0 10.306 8.354L18.355 4.521A1.5 1.5 0 0 1 20.5 5.876L20.5 16.124A1.5 1.5 0 0 1 18.355 17.479L10.306 13.646A1.5 1.5 0 0 0 9.661 13.5L4.5 13.5A1.5 1.5 0 0 1 3 12L3 10A1.5 1.5 0 0 1 4.5 8.5Z"/><path d="M5 13.5L6.246 19.314A1.5 1.5 0 0 0 7.713 20.5L9.145 20.5A1.5 1.5 0 0 0 10.611 18.686L9.5 13.5"/></svg>;
}

export function MessageSquareIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M12 3L18 3A3 3 0 0 1 21 6L21 14A3 3 0 0 1 18 17L8.982 17A2.559 2.559 0 0 0 7.27 17.657A2.559 2.559 0 0 1 3 15.755L3 6A3 3 0 0 1 6 3Z"/><path d="M7.5 8h9"/><path d="M7.5 12.5h5.5"/></svg>;
}

export function PencilIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M16.5 3.5 4 16 3 20.5 7.5 19.5 20 7a2.475 2.475 0 0 0-3.5-3.5Z"/><path d="M14.5 5.5 18 9"/></svg>;
}

export function PhoneIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M8.5 3.5H6A2.5 2.5 0 0 0 3.5 6c0 7.73 6.77 14.5 14.5 14.5a2.5 2.5 0 0 0 2.5-2.5v-2.5l-4.5-1.5-2 2a11 11 0 0 1-5.5-5.5l2-2Z"/></svg>;
}

export function PlusIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M5 12h14M12 5v14"/></svg>;
}

export function PresentationIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M2.25 3h19.5"/><path d="M20.75 3L20.75 13A3 3 0 0 1 17.75 16L6.25 16A3 3 0 0 1 3.25 13L3.25 3"/><path d="M7.5 20.5 12 16l4.5 4.5"/></svg>;
}

export function RefreshIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M18 2.5V6h-3.5"/></svg>;
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

export function TargetIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="9.75"/><circle cx="12" cy="12" r="5.25"/><path d="M12 12h.01"/></svg>;
}

export function TrashIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M3 7h18"/><path d="M10 2.5h4"/><path d="M5.5 7L6.402 19.855A1.5 1.5 0 0 0 7.898 21.25L16.102 21.25A1.5 1.5 0 0 0 17.598 19.855L18.5 7"/></svg>;
}

export function TrendUpIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="m21.5 7-8 8-4.5-4.5-6.5 6.5"/><path d="M15.5 7h6v6"/></svg>;
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

export function WarningCircleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="9.75"/><path d="M12 7v4.5"/><path d="M12 16h.01"/></svg>;
}

export function WarningIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M16.982 11.958L20.629 19.065A1.5 1.5 0 0 1 19.294 21.25L4.706 21.25A1.5 1.5 0 0 1 3.371 19.065L10.665 4.851A1.5 1.5 0 0 1 13.335 4.851Z"/><path d="M12 12.25v4.5"/></svg>;
}

export function XCircleIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><circle cx="12" cy="12" r="9.75"/><path d="m15 9-6 6M9 9l6 6"/></svg>;
}

export function XIcon(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={2.5}><path d="M18 6 6 18M6 6l12 12"/></svg>;
}
