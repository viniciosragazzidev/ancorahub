"use client"

import { RouteError } from "@/components/route-error"

export default function LeadDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Não foi possível carregar este lead"
      description="O perfil do lead está temporariamente indisponível. Tente novamente ou volte para a lista de leads."
    />
  )
}
