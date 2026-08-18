"use client"

import { RouteError } from "@/components/route-error"

export default function ConversasError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não foi possível carregar as conversas"
      description="A área de conversas está temporariamente indisponível. Tente novamente ou volte para o Dashboard."
    />
  )
}
