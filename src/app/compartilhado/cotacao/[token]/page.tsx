import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadPublicQuote } from "@/features/auto-sale/public-quote";

import { PublicQuotePage } from "../_components/public-quote-page";

export const dynamic = "force-dynamic";
// Link pessoal do cliente: fora de busca e sem cache compartilhado.
export const metadata: Metadata = { title: "Sua cotação", robots: { index: false, follow: false, nocache: true } };

/** Cotação pública da Venda Automatizada (DEC-182): só pelo token, até a validade; vencido ou revogado, 404. */
export default async function PublicQuoteRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadPublicQuote(token);
  if (!view) notFound();
  return <PublicQuotePage view={view} pdfHref={`/compartilhado/cotacao/${token}/pdf`} />;
}
