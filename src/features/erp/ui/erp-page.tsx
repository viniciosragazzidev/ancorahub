import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getErpSkin } from "./skin";
import { ErpSkinProvider } from "./skin-context";

/**
 * Shell of every ERP screen: the same header, then the page body in the system of the viewer's skin.
 * Standard: `flex flex-col gap-5 p-(--mobile-page-padding) lg:p-6` like /equipe. Lite: `lite-page` stack.
 */
export async function ErpPage({ pathname, breadcrumb, title, actions, children }: { pathname: string; breadcrumb: string; title: string; actions?: ReactNode; children: ReactNode }) {
  const skin = await getErpSkin(pathname);
  return <ErpSkinProvider skin={skin}>
    <DashboardHeader breadcrumb={breadcrumb} title={title} rightSlot={actions} />
    <main className={skin === "lite" ? litePage.stack : "flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6"}>{children}</main>
  </ErpSkinProvider>;
}
