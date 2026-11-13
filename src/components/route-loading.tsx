"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { Skeleton as ArcSkeleton } from "@/components/arc/skeleton/skeleton";

import styles from "./route-loading.module.css";

/** Barra de progresso indeterminada no topo da tela, na cor do tema. */
export function RouteLoadingBar() {
  return <div className={styles.bar} aria-hidden="true" />;
}

/** Linha de status com pontos animados; é o que o leitor de tela anuncia. */
function RouteLoadingStatus({ label }: { label: string }) {
  return (
    <p className={styles.status} role="status" aria-live="polite">
      <span className={styles.dots} aria-hidden="true"><span /><span /><span /></span>
      {label}
    </p>
  );
}

/**
 * Loading das trocas de rota (loading.tsx). Mostra a barra animada no topo e o esqueleto da
 * página, que só aparece depois de um instante para não piscar em navegações rápidas.
 */
export function RouteLoading({ label = "Carregando…" }: { label?: string }) {
  const directorLite = useArcScopeEnabled();
  if (directorLite) {
    return (
      <>
        <RouteLoadingBar />
        <main className={`arc-venancor director-route-loading ${styles.reveal}`} data-skin="diretor" aria-busy="true" aria-label="Carregando conteúdo">
          <RouteLoadingStatus label={label} />
          <div className="director-route-loading-tabs" aria-hidden="true"><span /><span /><span /></div>
          <div className="director-route-loading-grid">
            {Array.from({ length: 3 }, (_, index) => <div className="director-route-loading-surface" key={index}><ArcSkeleton label="Carregando" lines={3} avatar /></div>)}
          </div>
          <div className="director-route-loading-surface"><ArcSkeleton label="Carregando conteúdo" lines={4} /></div>
        </main>
      </>
    );
  }
  return (
    <>
      <RouteLoadingBar />
      <main
        aria-busy="true"
        aria-label="Carregando conteúdo"
        className={`mx-auto flex min-h-[60vh] w-full max-w-[1280px] flex-col gap-4 p-4 pb-8 lg:p-6 ${styles.reveal}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <RouteLoadingStatus label={label} />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} variant="compact">
              <CardHeader>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  )
}
