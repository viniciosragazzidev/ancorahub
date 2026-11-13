import { getErpNavigation } from "@/features/erp/navigation";
import { getErpSkin } from "@/features/erp/ui/skin";
import { LedgerSectionTabs } from "@/features/erp/components/ledger-section-tabs";

/**
 * Finance sections as system tabs. The page header (and the area tabs) are ordered before them with CSS order, so the
 * tabs sit under the page header like the AreaTabs of other areas, while every page keeps rendering its own header.
 */
const ORDER_HEADER_FIRST = "[&>header]:-order-1 [&>[data-slot=dashboard-header]]:-order-1 [&>[data-slot=area-tabs]]:-order-1";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const [links, skin] = await Promise.all([getErpNavigation(), getErpSkin("/financeiro")]);
  const sections = links.filter((link) => link.href.startsWith("/financeiro"));
  return <div className={`flex min-w-0 flex-1 flex-col ${ORDER_HEADER_FIRST}`}>
    <LedgerSectionTabs sections={sections} lite={skin === "lite"} />
    {children}
  </div>;
}
