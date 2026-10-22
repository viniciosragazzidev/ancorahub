import type { ReactNode } from "react";

import "@/components/arc/venancor-scope.css";
import { AncoraLogo } from "@/components/ancora-logo";

/**
 * Frame of every screen before the app (login, first access, password reset, 2FA)
 * in the Lite look (Vinicios, 22/10): one white sheet, the logo on top and a single
 * column that fits any phone, with the notch and the home bar respected. Without the
 * old floating card, nothing is wider than the screen, so phones never zoom out.
 */
export function LightAuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      className="arc-venancor light-canvas flex min-h-dvh w-full flex-col overflow-x-hidden"
      style={{ color: "var(--foreground)", fontFamily: "var(--font-body)" }}
    >
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-[calc(24px+var(--mobile-safe-bottom,0px))] pt-[calc(32px+var(--mobile-safe-top,0px))] sm:justify-center sm:pt-12">
        <header className="mb-8 flex justify-center">
          <AncoraLogo className="h-9 w-32 object-contain" />
        </header>
        <main className="flex flex-1 flex-col sm:flex-none">{children}</main>
        <footer className="mt-8 text-center text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {footer ?? "Âncora Saúde · Ambiente seguro de acesso"}
        </footer>
      </div>
    </div>
  );
}

/** Title block of an access screen: the Lite page title and its line of context. */
export function LightAuthTitle({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="lite-page-title">{title}</h1>
      {description ? <p className="lite-page-subtitle leading-relaxed">{description}</p> : null}
    </div>
  );
}
