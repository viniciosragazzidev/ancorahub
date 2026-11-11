import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { AceiteContadorPreview } from "./preview";

/**
 * Prévia do intervalo de início de plantão e do aceite com contador (plano 2026-11-11), só em
 * desenvolvimento. Dados falsos: nenhuma chamada ao banco nem ao WhatsApp.
 * Parâmetros para prints: ?tela=aceite|presenca|diretor&estado=contando|falhou
 */
export default async function AceiteContadorPage({ searchParams }: { searchParams: Promise<{ tela?: string; estado?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <AceiteContadorPreview tela={params.tela ?? "aceite"} estado={params.estado ?? "contando"} />;
}
