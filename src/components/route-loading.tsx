"use client";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { PageLoading } from "@/components/page-loading";
import litePage from "@/components/lite/page/lite-page.module.css";
import { Skeleton } from "@/components/ui/skeleton";

import styles from "./route-loading.module.css";

/** Barra de progresso indeterminada no topo da tela, na cor do tema. */
export function RouteLoadingBar() {
  return <div className={styles.bar} aria-hidden="true" />;
}

/**
 * Loading das trocas de rota (loading.tsx): barra animada no topo e o carregamento centralizado
 * na área útil (anel na cor do tema + texto pequeno), que só aparece depois de um instante para
 * não piscar em navegações rápidas.
 */
export function RouteLoading({ label = "Carregando…" }: { label?: string }) {
  const directorLite = useArcScopeEnabled();
  if (directorLite) return <DirectorRouteSkeleton label={label} />;
  return (
    <>
      <RouteLoadingBar />
      <main
        aria-busy="true"
        aria-label="Carregando conteúdo"
        className={directorLite ? "arc-venancor w-full" : "w-full"}
        data-skin={directorLite ? "diretor" : undefined}
      >
        <PageLoading label={label} />
      </main>
    </>
  );
}

/**
 * Diretor Lite (plano de movimento 18/11/2026, etapa 3): no lugar do anel no meio da tela, a forma das telas
 * do diretor (título, grade de números e um painel) no mesmo container `.stack`, que já entra em sequência.
 * O shimmer é o do `Skeleton` e some com movimento reduzido. O leitor de tela ouve só o rótulo.
 */
function DirectorRouteSkeleton({ label }: { label: string }) {
  return (
    <>
      <RouteLoadingBar />
      <main aria-busy="true" aria-label="Carregando conteúdo" className="arc-venancor w-full" data-skin="diretor">
        <p role="status" className="sr-only">{label}</p>
        <div className={litePage.stack} aria-hidden="true">
          <div className="grid gap-2">
            <Skeleton className="h-7 w-48 rounded-full" />
            <Skeleton className="h-4 w-72 max-w-full rounded-full" />
          </div>
          <div className={litePage.stats}>
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[104px] rounded-[var(--radius-panel)]" />)}
          </div>
          <Skeleton className="h-72 rounded-[var(--radius-panel)]" />
        </div>
      </main>
    </>
  );
}
