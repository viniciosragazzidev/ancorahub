import { formatLastAccessDetail, formatLastAccessMeta, isLastAccessStale } from "./last-access";
import styles from "./last-access-meta.module.css";

/**
 * Último acesso na linha das listas Lite do gestor e do supervisor (PeopleRow, campo meta). Mesmo tratamento da
 * coluna do diretor: quem está há mais de 7 dias sem entrar (ou nunca entrou) fica em texto secundário; data e
 * hora completas no title. Sem valor (consulta indisponível), não mostra nada.
 */
export function LastAccessMeta({ value, now }: { value: string | null | undefined; now: Date }) {
  if (value === undefined) return null;
  const stale = isLastAccessStale(value, now);
  return (
    <span className={stale ? styles.stale : styles.fresh} data-stale={stale || undefined} title={value ? `Último acesso em ${formatLastAccessDetail(value)}` : "Nunca entrou no sistema"}>
      {formatLastAccessMeta(value, now)}
    </span>
  );
}
