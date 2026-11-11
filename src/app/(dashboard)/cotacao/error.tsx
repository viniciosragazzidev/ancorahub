"use client";
import { Button } from "@/components/arc/button/button";

export default function QuoteError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <section role="alert" className="arc-venancor mx-auto grid min-h-64 max-w-3xl content-center gap-4 px-4"><h1 className="text-xl font-semibold">Não foi possível carregar o cotador</h1><p className="text-sm text-muted-foreground">Tente novamente. Se o problema continuar, peça à administração para conferir a liberação e a atualização do catálogo.</p><div><Button onClick={unstable_retry}>Tentar novamente</Button></div></section>;
}
