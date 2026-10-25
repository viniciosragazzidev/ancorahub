"use client"

import { useEffect, useState } from "react"

import "@/components/arc/venancor-scope.css"

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
      <body className="arc-venancor" style={{ margin: 0, background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-body, system-ui, sans-serif)" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px 16px", boxSizing: "border-box" }}>
          <section aria-labelledby="global-error-title" style={{ maxWidth: "520px", width: "100%", display: "grid", gap: "16px" }}>
            <h1 id="global-error-title" style={{ fontSize: "var(--text-xl, 22px)", fontWeight: 500, lineHeight: 1.25, margin: 0 }}>O sistema encontrou um problema</h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm, 14px)", lineHeight: 1.5 }}>
              Toque em &quot;Limpar dados e recarregar&quot;. Se continuar, tire um print desta tela e envie ao suporte.
            </p>
            <p style={{ margin: 0, padding: "12px 16px", borderRadius: "var(--radius-panel, 24px)", background: "var(--surface-muted)", fontSize: "var(--text-xs, 12px)", color: "var(--text-secondary)", wordBreak: "break-word", lineHeight: 1.6 }}>
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Referência:</strong> {reference}
              <br />
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Horário:</strong> {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              {browser ? (
                <>
                  <br />
                  <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Navegador:</strong> {browser}
                </>
              ) : null}
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={clearing}
                onClick={() => void clearSiteDataAndReload()}
                style={{ minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "none", background: "var(--primary)", color: "var(--primary-foreground)", font: "inherit", fontSize: "var(--text-sm, 14px)", fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer" }}
              >
                {clearing ? "Limpando..." : "Limpar dados e recarregar"}
              </button>
              <button
                type="button"
                onClick={() => (typeof reset === "function" ? reset() : window.location.reload())}
                style={{ minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "none", background: "var(--surface-muted)", color: "var(--foreground)", font: "inherit", fontSize: "var(--text-sm, 14px)", fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer" }}
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
