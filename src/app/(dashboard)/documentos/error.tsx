"use client";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { Button } from "@/components/arc/button/button";

export default function DocumentsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ArcScopeProvider enabled>
      <section className="arc-venancor mx-auto flex min-h-64 max-w-3xl flex-col items-start justify-center gap-4 px-4" data-skin="diretor" role="alert">
        <div>
          <h1 className="text-xl font-semibold text-(--foreground)">Não foi possível carregar os documentos</h1>
          <p className="mt-2 text-sm text-(--text-secondary)">Tente atualizar. Se o problema continuar, os documentos de cada lead seguem disponíveis na página do lead.</p>
        </div>
        <Button onClick={reset} size="lg">Tentar novamente</Button>
      </section>
    </ArcScopeProvider>
  );
}
