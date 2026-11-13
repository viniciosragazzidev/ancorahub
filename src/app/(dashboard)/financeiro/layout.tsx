import { getErpNavigation } from "@/features/erp/navigation";
import { LedgerSectionTabs } from "@/features/erp/components/ledger-section-tabs";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";

/**
 * Finance sections. Director and standard users get them as the area tabs of "Financeiro" (nav-registry), so this
 * layout adds nothing for them. Lite audiences (broker, supervisor, manager) have no area tabs: they get the same
 * sections here, ordered under the page header with CSS order.
 */
const ORDER_HEADER_FIRST = "[&>header]:-order-1 [&>[data-slot=dashboard-header]]:-order-1 [&>[data-slot=area-tabs]]:-order-1";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context).catch(() => null);
  if (!audience) return <div className="flex min-w-0 flex-1 flex-col">{children}</div>;
  const links = await getErpNavigation();
  const sections = links.filter((link) => link.href.startsWith("/financeiro"));
  return <div className={`flex min-w-0 flex-1 flex-col ${ORDER_HEADER_FIRST}`}>
    <LedgerSectionTabs sections={sections} lite />
    {children}
  </div>;
}
