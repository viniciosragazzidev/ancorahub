import Link from "next/link";

import styles from "./director-distribution-tabs.module.css";

const TABS = [
  { id: "resumo_dia", label: "Resumo" },
  { id: "roteamento", label: "Entradas e regras" },
  { id: "operar", label: "Operação" },
  { id: "filas", label: "Filas", directorOnly: true },
  { id: "plantao", label: "Plantões" },
  { id: "saude_historico", label: "Saúde" },
] as const;

type DirectorDistributionTabsProps = {
  activeView: string;
  showQueues: boolean;
  status?: string;
  escalaMes?: string;
};

export function canViewDistributionQueues(role: string) {
  return role === "director";
}

/** URL navigation keeps the active area on the server and never sends server-created JSX to a client component. */
export function DirectorDistributionTabs({ activeView, showQueues, status, escalaMes }: DirectorDistributionTabsProps) {
  const tabs = TABS.filter((tab) => !("directorOnly" in tab) || showQueues);

  return (
    <nav className={styles.root} aria-label="Áreas da distribuição">
      <ul className={styles.list}>
        {tabs.map((tab) => {
          const query = new URLSearchParams({ view: tab.id });
          if (status) query.set("status", status);
          if (escalaMes) query.set("escalaMes", escalaMes);

          return (
            <li key={tab.id} className={styles.item}>
              <Link
                className={styles.link}
                href={`/distribuicao?${query.toString()}`}
                aria-current={activeView === tab.id ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
