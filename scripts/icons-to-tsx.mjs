// node scripts/icons-to-tsx.mjs
// Lê os SVGs construídos pela skill draw-icons (`src/components/icons/*.svg`, nunca editar à mão) e escreve
// `src/components/icons/marker-icons.tsx`: um componente React por ícone, inline e em `currentColor`, com a
// textura de marcador (filtro `#marcador` de `MarkerFilterDefs`). Rodar depois de cada `icons.js build`.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "src/components/icons");
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".svg")).sort();
const pascal = (name) => name.replace(/(^|[-@])(\w)/g, (_, __, char) => char.toUpperCase());

const icons = files.map((file) => {
  const name = file.replace(/\.svg$/, "");
  const svg = fs.readFileSync(path.join(dir, file), "utf8");
  const attrs = Object.fromEntries([...svg.match(/<svg([^>]*)>/)[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/([a-z]+)-([a-z])(?=[\w-]*=)/g, (_, a, b) => `${a}${b.toUpperCase()}`);
  return { name, component: `${pascal(name)}Icon`, attrs, body };
});

const out = `/* Gerado por scripts/icons-to-tsx.mjs a partir de src/components/icons/*.svg. Não editar à mão. */
import type { SVGProps } from "react";

/**
 * Ícones de marcador (25/11/2026): desenhados com a skill draw-icons (\`icons.yaml\`, traço 2,5 com pontas redondas)
 * e com a textura de marcador de quadro branco aplicada igual em todos pelo filtro \`#marcador\`.
 * Tamanhos desenhados: 20 e 24 px. O traço é o do desenho; \`strokeWidth\` e \`weight\` vindos de outras bibliotecas são ignorados.
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
    style: plain ? style : { filter: \`url(#\${MARKER_FILTER_ID})\`, ...style },
    ...props,
  };
}

${icons.map((icon) => `export function ${icon.component}(props: MarkerIconProps) {
  return <svg {...base(props)} strokeWidth={${Number(icon.attrs["stroke-width"] ?? 2.5)}}>${icon.body}</svg>;
}`).join("\n\n")}
`;

fs.writeFileSync(path.join(dir, "marker-icons.tsx"), out);
console.log(`${icons.length} ícones em src/components/icons/marker-icons.tsx`);
