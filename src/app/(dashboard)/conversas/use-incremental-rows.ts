"use client";

import { useEffect, useRef, useState } from "react";

/** Rows drawn at first; more come in as the list scrolls near its end. */
export const CONVERSATION_ROWS_PAGE = 60;

/**
 * Velocidade (25/11/2026): a lista desenhava as até 800 conversas de uma vez. Em produção eram
 * 532 linhas e cerca de 2 MB de HTML só da lista. Agora desenha 60 e acrescenta mais 60 quando
 * o fim da lista chega perto. Busca e filtros continuam sobre todas; `resetKey` volta às 60.
 */
export function useIncrementalRows(total: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, count: CONVERSATION_ROWS_PAGE });
  let count = state.count;
  if (state.key !== resetKey) {
    setState({ key: resetKey, count: CONVERSATION_ROWS_PAGE });
    count = CONVERSATION_ROWS_PAGE;
  }
  const hasMore = total > count;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setState((current) => ({ ...current, count: current.count + CONVERSATION_ROWS_PAGE }));
      }
    }, { rootMargin: "600px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, count]);

  return { count, hasMore, sentinelRef };
}
