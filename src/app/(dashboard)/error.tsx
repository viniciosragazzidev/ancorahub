"use client"

import { RouteError } from "@/components/route-error"

export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <RouteError error={error} unstable_retry={unstable_retry} title="Não foi possível carregar esta operação" />
}
