"use client"

import { RouteError } from "@/components/route-error"

export default function QualificacaoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não foi possível carregar a qualificação"
      description="A área de qualificação está temporariamente indisponível. Tente novamente ou volte para o Dashboard."
    />
  )
}
