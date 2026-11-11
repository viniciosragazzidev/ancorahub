import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";

import { notFound } from "next/navigation";

import { LivePanel } from "./_components/live-panel";

/**
 * Dev-only: exemplo do painel ao vivo da operação do dia para o diretor, com dados de exemplo (sem banco).
 * /dev/painel-ao-vivo?ritmo=parado|lento|rapido&suposicoes=1
 * ritmo: intervalo entre acontecimentos simulados (parado = sem simulação, bom para print).
 */
const RHYTHM: Record<string, number> = { parado: 0, lento: 9000, normal: 6000, rapido: 2500 };

export default async function PainelAoVivoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const ritmo = typeof params.ritmo === "string" && params.ritmo in RHYTHM ? params.ritmo : "normal";
  return <LivePanel intervalMs={RHYTHM[ritmo]} openAssumptions={params.suposicoes === "1"} />;
}
