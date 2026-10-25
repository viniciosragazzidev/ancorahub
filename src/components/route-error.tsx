"use client"

import Link from "next/link"
import { useEffect } from "react"
import { LayoutDashboard, RotateCcw } from "lucide-react"

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context"
import styles from "./route-state.module.css"

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
  title?: string
  description?: string
  /** Mantido por compatibilidade: o visual Lite não usa ilustração. */
  imageSrc?: string
  /** Fora da moldura do app (erro na raiz): a tela ocupa a página inteira com o fundo Lite. */
  standalone?: boolean
}

/** Erro de rota no visual Lite para todo mundo (Onda 8): mesmos textos, mesmo "Tentar novamente" e o mesmo link de volta. Fora do diretor com a chave segue o tema do usuário. */
export function RouteError({
  error,
  reset,
  unstable_retry,
  title = "Ops! Não foi possível carregar esta área",
  description = "Ocorreu um problema inesperado ao carregar os dados. Tente novamente ou volte para o Dashboard.",
  standalone = false,
}: RouteErrorProps) {
  const directorSkin = useArcScopeEnabled()
  useEffect(() => {
    console.error("RouteError details:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      error,
    })
  }, [error])

  const handleRetry = () => {
    if (typeof reset === "function") {
      reset()
    } else if (typeof unstable_retry === "function") {
      unstable_retry()
    } else {
      window.location.reload()
    }
  }

  return (
    <main
      className={[directorSkin ? "arc-venancor" : "", styles.state, standalone ? styles.page : ""].filter(Boolean).join(" ")}
      data-skin={directorSkin ? "diretor" : undefined}
      aria-labelledby="route-error-title"
    >
      <span className={styles.icon} aria-hidden="true"><RotateCcw size={20} strokeWidth={1.75} /></span>
      <div className={styles.copy}>
        <h1 id="route-error-title" role="alert" className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.retry} onClick={handleRetry}><RotateCcw size={16} aria-hidden="true" />Tentar novamente</button>
        <Link className={styles.link} href="/dashboard"><LayoutDashboard size={16} aria-hidden="true" />Voltar para o Dashboard</Link>
      </div>
      {(error.message || error.digest) ? (
        <details className={styles.details}>
          <summary>Detalhes técnicos do erro</summary>
          {error.message ? <p>Mensagem: {error.message}</p> : null}
          {error.digest ? <p>Digest: {error.digest}</p> : null}
        </details>
      ) : null}
    </main>
  )
}
