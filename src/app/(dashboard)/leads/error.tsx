"use client"

import { RouteError } from "@/components/route-error"

export default function LeadsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não foi possível carregar a lista de leads"
      description="A área de leads está temporariamente indisponível. Tente novamente ou volte para o Dashboard."
    />
  )
}
