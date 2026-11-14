import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getErpSkin } from "./skin";
import { ErpSkinProvider } from "./skin-context";
import kit from "./erp-kit.module.css";

/**
 * Shell of every ERP screen, in the system of the viewer's skin.
 * - Director (Lite or standard) and standard users: the app header (title + actions) and the area tabs, like /equipe.
 * - Lite audiences (broker, supervisor, manager): the Lite frame already draws the header with back + title, so the
 *   screen's actions open the page body instead of a second header.
 */
export async function ErpPage({ pathname, breadcrumb, title, actions, children }: { pathname: string; breadcrumb: string; title: string; actions?: ReactNode; children: ReactNode }) {
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
  return <ErpSkinProvider skin={skin}>
    <DashboardHeader breadcrumb={breadcrumb} title={title} rightSlot={actions} />
    <main className={skin === "lite" ? litePage.stack : "flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6"}>{children}</main>
  </ErpSkinProvider>;
}
