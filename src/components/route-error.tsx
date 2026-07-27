"use client"

import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type RouteErrorProps = {
  error: Error & { digest?: string }
  unstable_retry: () => void
  title?: string
}

export function RouteError({ error, unstable_retry, title = "Não foi possível carregar esta área" }: RouteErrorProps) {
  useEffect(() => {
    // O digest permite correlacionar o erro no servidor sem expor a mensagem interna.
    if (error.digest) console.error("route_render_error", { digest: error.digest })
  }, [error])

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6" aria-labelledby="route-error-title">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle id="route-error-title">{title}</CardTitle>
          <CardDescription>
            O problema pode ser temporário. Tente novamente ou volte para o painel sem expor dados internos do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={unstable_retry}>Tentar novamente</Button>
          <Button render={<Link href="/dashboard" />} variant="outline">Voltar ao painel</Button>
          {error.digest ? <p className="basis-full text-xs text-muted-foreground" role="status">Referência: {error.digest}</p> : null}
        </CardContent>
      </Card>
    </main>
  )
}
