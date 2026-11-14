"use client";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { PageLoading } from "@/components/page-loading";

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
