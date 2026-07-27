"use client"

import { useEffect } from "react"

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    if (error.digest) console.error("global_render_error", { digest: error.digest })
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
          <section aria-labelledby="global-error-title" style={{ maxWidth: "520px" }}>
            <h1 id="global-error-title">O sistema encontrou um problema</h1>
            <p>Tente novamente. Se o problema continuar, informe o horário e a referência exibida ao suporte.</p>
            {error.digest ? <p>Referência: {error.digest}</p> : null}
            <button type="button" onClick={unstable_retry}>Tentar novamente</button>
          </section>
        </main>
      </body>
    </html>
  )
}
