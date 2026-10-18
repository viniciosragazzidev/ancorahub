"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import styles from "./people-list.module.css";

/**
 * Lista "agenda telefônica" do Lite (Vinicios, 17/10): o desenho de Mensagens
 * da equipe para toda lista de pessoas (leads, clientes, corretores). Avatar
 * com a cor do nome, nome, um chip, uma linha de prévia e a hora/ponto à direita.
 */

export const peopleInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "?";
export const peopleHue = (text: string) => [...text].reduce((total, char) => total + char.charCodeAt(0), 0) % 360;

const enterStyle = (index: number) => ({ "--i": Math.min(index, 12) }) as CSSProperties;

export function PeoplePage({ title, hideTitle = false, subtitle, action, children, className }: { title?: ReactNode; /** Título só para leitor de tela (a barra do app já mostra). */ hideTitle?: boolean; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`arc-venancor ${styles.page}${className ? ` ${className}` : ""}`}>
      <div className={styles.inner}>
        {title || subtitle || action ? (
          <header className={`${styles.header} ${styles.enter}`}>
            <div>
              {title ? <h1 className={hideTitle ? "sr-only" : styles.title}>{title}</h1> : null}
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
            {action}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export type PeopleStat = { value: ReactNode; label: string; alert?: boolean; href?: string };

export function PeopleStats({ items, label = "Resumo" }: { items: PeopleStat[]; label?: string }) {
  return (
    <section className={`${styles.stats} ${styles.enter}`} style={{ "--i": 1, "--cols": items.length } as CSSProperties} aria-label={label}>
      {items.map((item) => {
        const body = <><strong>{item.value}</strong><span>{item.label}</span></>;
        return item.href
          ? <Link key={item.label} href={item.href} className={styles.stat} data-alert={Boolean(item.alert)}>{body}</Link>
          : <div key={item.label} className={styles.stat} data-alert={Boolean(item.alert)}>{body}</div>;
      })}
    </section>
  );
}

export type PeopleFilterOption<T extends string> = { id: T; label: string; count?: number };

export function PeopleFilters<T extends string>({
  options, value, onChange, label = "Filtrar", search, onSearch, searchPlaceholder = "Buscar", searchLabel, dataTourSegment, dataTourSearch,
}: {
  options?: PeopleFilterOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  label?: string;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  /** Nome do campo para leitor de tela (padrão: o placeholder). */
  searchLabel?: string;
  dataTourSegment?: string;
  dataTourSearch?: string;
}) {
  return (
    <div className={`${styles.filters} ${styles.enter}`} style={{ "--i": 2 } as CSSProperties}>
      {options?.length ? (
        <div className={styles.segment} role="group" aria-label={label} data-tour={dataTourSegment}>
          {options.map((item) => (
            <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange?.(item.id)}>
              {item.label}{item.count ? <span className={styles.count}>{item.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {onSearch ? (
        <input className={styles.search} type="search" placeholder={searchPlaceholder} aria-label={searchLabel ?? searchPlaceholder} value={search ?? ""} onChange={(event) => onSearch(event.target.value)} data-tour={dataTourSearch} />
      ) : null}
    </div>
  );
}

export function PeopleSection({ title, count, children, id, label }: { title?: string; count?: number; children: ReactNode; id?: string; /** Nome da lista para leitor de tela. */ label?: string }) {
  return (
    <section className={styles.section} aria-labelledby={title && id ? id : undefined}>
      {title ? <h2 id={id} className={styles.sectionTitle}>{title}{count !== undefined ? <span>{count}</span> : null}</h2> : null}
      <ul className={styles.list} aria-label={label ?? title}>{children}</ul>
    </section>
  );
}

export type PeopleRowProps = {
  name: string;
  href?: string;
  /** Texto que dá a cor do avatar (padrão: o nome). */
  seed?: string;
  avatar?: ReactNode;
  chip?: ReactNode;
  preview?: ReactNode;
  previewTone?: "muted" | "waiting" | "alert";
  meta?: ReactNode;
  dot?: "waiting" | "alert" | null;
  dotLabel?: string;
  /** Botão ao lado da linha (ex.: Aceitar), fora do link. */
  action?: ReactNode;
  index?: number;
  dataTour?: string;
  /** Linha discreta (ex.: lead de dias atrás), para o de hoje se destacar. */
  faded?: boolean;
};

export function PeopleRow({ name, href, seed, avatar, chip, preview, previewTone = "muted", meta, dot, dotLabel, action, index = 0, dataTour, faded = false }: PeopleRowProps) {
  const content = (
    <>
      {avatar ?? <span className={styles.avatar} style={{ "--hue": peopleHue(seed ?? name) } as CSSProperties} aria-hidden="true">{peopleInitials(name)}</span>}
      <span className={styles.rowMain}>
        <span className={styles.rowTop}>
          <span className={styles.name}>{name}</span>
          {typeof chip === "string" ? <span className={styles.chip}>{chip}</span> : chip}
        </span>
        {preview ? <span className={styles.preview} data-tone={previewTone}>{preview}</span> : null}
      </span>
      <span className={styles.meta}>
        {meta ? <span suppressHydrationWarning>{meta}</span> : null}
        {dot ? <span className={styles.dot} data-tone={dot} aria-label={dotLabel} role={dotLabel ? "img" : undefined} /> : null}
      </span>
    </>
  );
  return (
    <li className={styles.enter} style={enterStyle(index + 3)} data-tour={dataTour}>
      <div className={styles.row} data-has-action={Boolean(action)} data-faded={faded || undefined}>
        {href ? <Link href={href} className={styles.rowLink}>{content}</Link> : <div className={styles.rowLink}>{content}</div>}
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </li>
  );
}

export function PeopleEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={`${styles.empty} ${styles.enter}`}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
