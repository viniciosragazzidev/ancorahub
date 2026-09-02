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
    console.error("RouteError details:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      error,
    });
  }, [error]);

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

      {(error.message || error.digest) && (
        <details className="mt-6 w-full max-w-md text-left text-xs text-muted-foreground border border-border/50 rounded-lg p-2.5 bg-muted/30">
          <summary className="cursor-pointer font-medium hover:text-foreground">
            Detalhes técnicos do erro
          </summary>
          <div className="mt-2 space-y-1 font-mono text-[11px] break-all">
            {error.message && <p><span className="font-semibold text-foreground">Mensagem:</span> {error.message}</p>}
            {error.digest && <p><span className="font-semibold text-foreground">Digest:</span> {error.digest}</p>}
          </div>
        </details>
      )}
    </main>
  )
}
