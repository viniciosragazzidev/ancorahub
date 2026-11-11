import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { CotacaoLitePreview } from "@/features/global-catalog/pilot/cotacao-lite/cotacao-lite-preview";

/**
 * Prévia do fluxo guiado Lite da cotação, só em desenvolvimento. Dados falsos: nenhuma chamada
 * ao catálogo, ao banco nem à operadora. Parâmetro para prints: ?estado=ok|vazio|erro
 */
export default async function CotacaoLitePreviewPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <CotacaoLitePreview estado={params.estado ?? "ok"} />;
}
