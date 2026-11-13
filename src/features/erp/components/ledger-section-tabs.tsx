"use client";
import { usePathname } from "next/navigation";
import { LiteRouteTabs } from "@/components/lite/page/route-tabs";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

export type LedgerSection = { href: string; label: string };

/** The section whose href is the longest prefix of the current path (so /financeiro/recibos/x marks "Recibos"). */
export function activeSection(sections: readonly LedgerSection[], pathname: string) {
  const matches = sections.filter((section) => pathname === section.href || pathname.startsWith(`${section.href}/`));
  return matches.sort((left, right) => right.href.length - left.href.length)[0]?.href ?? "";
}

/** Finance sections as the system URL tabs: RouteSectionTabs in the standard skin, LiteRouteTabs in Lite. */
export function LedgerSectionTabs({ sections, lite }: { sections: LedgerSection[]; lite: boolean }) {
  const pathname = usePathname();
  if (sections.length < 2) return null;
  const tabs = sections.map((section) => ({ id: section.href, label: section.label, href: section.href }));
  const active = activeSection(sections, pathname);
  const label = "Seções do financeiro";
  if (lite) return <div data-slot="finance-tabs" className="px-4 pt-2"><LiteRouteTabs label={label} tabs={tabs} active={active} /></div>;
  return <div data-slot="finance-tabs" className="bg-background px-5 lg:px-6"><RouteSectionTabs label={label} tabs={tabs} active={active} /></div>;
}
