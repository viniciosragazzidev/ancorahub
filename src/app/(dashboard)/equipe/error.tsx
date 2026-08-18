"use client"

import { RouteError } from "@/components/route-error"

export default function EquipeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não foi possível carregar a equipe"
      description="A área de gestão de equipe está temporariamente indisponível. Tente novamente ou volte para o Dashboard."
    />
  )
}
