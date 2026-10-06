"use client"

import { useEffect, useState } from "react"

/**
 * Last-resort screen when the root layout itself crashes. Errors raised in the
 * browser have no server digest, so the screen also shows the error name and a
 * short browser description: a screenshot is enough to diagnose. "Limpar dados"
 * clears this site's storage, caches and service workers (stale data from an
 * older deploy is the usual cause when only one device fails).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [browser, setBrowser] = useState("")
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    console.error("global_render_error", { digest: error.digest, name: error.name, message: error.message })
    setBrowser(navigator.userAgent.replace(/\s+/g, " ").slice(0, 160))
  }, [error])

  async function clearSiteDataAndReload() {
    setClearing(true)
    try {
      localStorage.clear()
      sessionStorage.clear()
      if ("caches" in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
    } catch {
      // Best effort: reload anyway.
    }
    window.location.reload()
  }

  const reference = error.digest ?? `${error.name || "Error"}: ${(error.message || "sem mensagem").slice(0, 140)}`

  return (
    <html lang="pt-BR">
      <body>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
          <section aria-labelledby="global-error-title" style={{ maxWidth: "520px", display: "grid", gap: "12px" }}>
            <h1 id="global-error-title" style={{ fontSize: "20px", margin: 0 }}>O sistema encontrou um problema</h1>
            <p style={{ margin: 0 }}>
              Toque em &quot;Limpar dados e recarregar&quot;. Se continuar, tire um print desta tela e envie ao suporte.
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#52525b", wordBreak: "break-word" }}>
              <strong>Referência:</strong> {reference}
              <br />
              <strong>Horário:</strong> {new Date().toLocaleString("pt-BR")}
              {browser ? (
                <>
                  <br />
                  <strong>Navegador:</strong> {browser}
                </>
              ) : null}
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={clearing}
                onClick={() => void clearSiteDataAndReload()}
                style={{ padding: "10px 16px", borderRadius: "999px", border: "none", background: "#3b2dff", color: "#fff", fontWeight: 600 }}
              >
                {clearing ? "Limpando..." : "Limpar dados e recarregar"}
              </button>
              <button
                type="button"
                onClick={() => (typeof reset === "function" ? reset() : window.location.reload())}
                style={{ padding: "10px 16px", borderRadius: "999px", border: "1px solid #e4e4e7", background: "#fff" }}
              >
                Tentar novamente
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
