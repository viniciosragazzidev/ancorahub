import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getErpSkin } from "./skin";
import { ErpSkinProvider } from "./skin-context";
import kit from "./erp-kit.module.css";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";

/**
 * Shell of every ERP screen, in the system of the viewer's skin.
 * - Director (Lite or standard) and standard users: the app header (title + actions) and the area tabs, like /equipe.
 * - Lite audiences (broker, supervisor, manager): the Lite frame already draws the header with back + title, so the
 *   screen's actions open the page body instead of a second header.
 */
export async function ErpPage({ pathname, breadcrumb, title, summary, actions, children }: { pathname: string; breadcrumb: string; title: string; /** Resumo de uma linha ao lado do título (skill `interface-enxuta`). */ summary?: string; actions?: ReactNode; children: ReactNode }) {
  const [skin, audience] = await Promise.all([
    getErpSkin(pathname),
    getRequiredTenantContext().then((context) => getLiteAudience(context)).catch(() => null),
  ]);
  if (audience) return <ErpSkinProvider skin="lite">
    <main className={`${litePage.stack} ${kit.liteBody}`}>
      {actions ? <div className={kit.bodyActions}>{actions}</div> : null}
      {children}
    </main>
  </ErpSkinProvider>;
  // Direção limpa (28/11/2026): no visual Lite do diretor, a mesma moldura do Comercial (título de 28px, resumo, ações e
  // as abas da área pelo nav-registry), sem a faixa de topo antiga. Vale para Financeiro e Operação ERP de uma vez.
  if (skin === "lite") return <ErpSkinProvider skin="lite">
    <ComercialPage title={title} summary={summary} actions={actions}>{children}</ComercialPage>
  </ErpSkinProvider>;
  return <ErpSkinProvider skin={skin}>
    <DashboardHeader breadcrumb={breadcrumb} title={title} summary={summary} rightSlot={actions} />
    <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">{children}</main>
  </ErpSkinProvider>;
}
