"use client"

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context"
import { EmptyState } from "@/components/arc/empty-state/empty-state"
import { RouteError } from "@/components/route-error"

/** Erro do painel: no padrão Lite quando a chave do diretor está ligada; senão, o erro de hoje. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lite = useArcScopeEnabled()
  if (!lite) return <RouteError error={error} reset={reset} title="Não foi possível carregar esta operação" />
  return (
    <EmptyState
      title="Não deu para carregar o painel"
      description="Confira a conexão e tente de novo."
      action={<button type="button" onClick={reset}>Tentar de novo</button>}
    />
  )
}
