"use client"

import { RouteError } from "@/components/route-error"

export default function PlatformAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="Não foi possível carregar a administração" />
}
