/**
 * Seções por URL no visual Lite (troca o RouteSectionTabs nas telas Lite): chips de link de 44px numa linha que rola
 * dentro do próprio container no celular. A seção atual tem aria-current="page".
 */
import Link from "next/link";

import styles from "./route-tabs.module.css";

export type LiteRouteTab = { id: string; label: string; href: string };

export function LiteRouteTabs({ label, tabs, active }: { label: string; tabs: LiteRouteTab[]; active: string }) {
  return (
    <nav aria-label={label} className={styles.root}>
      <ul className={styles.list}>
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link href={tab.href} className={styles.tab} aria-current={tab.id === active ? "page" : undefined}>{tab.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
