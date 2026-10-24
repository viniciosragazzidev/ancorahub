/** Gradientes legados dos gráficos fora do modo Lite do Diretor. */
export function LegacyChartGradient({
  id,
  color,
  vertical = false,
  fromOpacity = 0.35,
  toOpacity = 1,
}: {
  id: string;
  color: string;
  vertical?: boolean;
  fromOpacity?: number;
  toOpacity?: number;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" x2={vertical ? "0" : "1"} y1="0" y2={vertical ? "1" : "0"}>
        <stop offset="0%" stopColor={color} stopOpacity={fromOpacity} />
        <stop offset="100%" stopColor={color} stopOpacity={toOpacity} />
      </linearGradient>
    </defs>
  );
}

export function legacyGradientFill(id: string) {
  return "url(#" + id + ")";
}
