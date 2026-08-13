"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect } from "react"
import { LayoutDashboard, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
  title?: string
  description?: string
  imageSrc?: string
}

export function RouteError({
  error,
  reset,
  unstable_retry,
  title = "Ops! Não foi possível carregar esta área",
  description = "Ocorreu um problema inesperado ao carregar os dados. Tente novamente ou volte para o Dashboard.",
  imageSrc = "/404.png",
}: RouteErrorProps) {
  useEffect(() => {
    // O digest permite correlacionar o erro no servidor sem expor a mensagem interna.
    if (error.digest) console.error("route_render_error", { digest: error.digest })
  }, [error])

  const handleRetry = () => {
    if (typeof reset === "function") {
      reset();
    } else if (typeof unstable_retry === "function") {
      unstable_retry();
    } else {
      window.location.reload();
    }
  }

  return (
    <main
      className="mx-auto flex min-h-[75vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-8 text-center"
      aria-labelledby="route-error-title"
    >
      <div className="relative mb-6 flex items-center justify-center w-full">
        <Image
          src={imageSrc}
          alt="Erro ao carregar a página"
          width={560}
          height={460}
          priority
          className="h-auto max-w-[360px] sm:max-w-[520px] md:max-w-[580px] object-contain transition-transform duration-300 hover:scale-[1.02]"
        />
      </div>

      <div className="space-y-2.5 max-w-lg">
        <h1 id="route-error-title" role="alert" className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" size="lg" onClick={handleRetry} className="gap-2 px-6 shadow-sm hover:shadow transition-all">
          <RotateCcw className="size-4" />
          <span>Tentar novamente</span>
        </Button>
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "gap-2 px-6 shadow-sm hover:shadow transition-all"
          )}
        >
          <LayoutDashboard className="size-4" />
          <span>Voltar para o Dashboard</span>
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-4 text-xs text-muted-foreground" role="status">
          Código de referência: {error.digest}
        </p>
      ) : null}
    </main>
  )
}
