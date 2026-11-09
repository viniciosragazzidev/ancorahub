import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { RoteiroPresencaPreview } from "./roteiro-preview";

/**
 * Protótipo navegável do roteiro guiado de presença (plano 2026-11-09) — só em desenvolvimento.
 * Dados falsos: nenhuma chamada ao WhatsApp (WAHA) nem ao banco.
 * Parâmetros para prints: ?aparelho=celular|computador&passo=…&erro=…&modo=online|presencial&limpo=1
 */
export default function RoteiroPresencaPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RoteiroPresencaPreview />;
}
