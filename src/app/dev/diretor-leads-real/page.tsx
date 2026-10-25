import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";
import "@/components/arc/director-chrome.css";

import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";

import pageStyles from "@/app/(dashboard)/leads/leads-lite-page.module.css";

import { LeadsFixtureList } from "./leads-fixture-list";
import { LEADS } from "./leads-fixtures";

/**
 * Dev-only: a lista de /leads (LeadsListSwitch, com a chave ligada) com dados de exemplo, dentro do mesmo canvas do app.
 * Não existe em produção. Mesmo padrão de /dev/diretor-dashboard-real.
 */

export default function DirectorLeadsRealPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const skin = { "--director-brand-color": "#3b2dff", "--director-brand-foreground": "#ffffff" } as CSSProperties;
  return (
    <ArcScopeProvider enabled>
      <div className="arc-venancor" data-skin="diretor" style={skin}>
        <div className="app-shell-canvas h-app overflow-y-auto overflow-x-hidden overscroll-contain arc-venancor" data-slot="app-scroll-frame" data-skin="diretor" style={{ ...skin, background: "var(--background)" }}>
          {/* Só um esboço do topo da moldura (o título mora nele, não no corpo); a página usa o container real de /leads. */}
          <div data-slot="app-content">
          <header className="flex h-16 items-center border-b border-[var(--border-subtle)] px-[clamp(16px,4vw,32px)]">
            <h1 className="text-base font-medium">Leads</h1>
          </header>
          <main className={pageStyles.page}>
            <LeadsFixtureList leads={LEADS} />
          </main>
          </div>
        </div>
      </div>
    </ArcScopeProvider>
  );
}
