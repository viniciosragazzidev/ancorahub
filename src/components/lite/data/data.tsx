"use client";

/**
 * Lista de registros no visual Lite (F3): `LiteDataTable` como tabela a partir de 768px e `LiteDataList` como cartões
 * abaixo disso. As mesmas linhas e as mesmas colunas alimentam as duas; só a apresentação muda.
 */
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import styles from "./data.module.css";

export type LiteColumn<T> = {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Coluna numérica: alinha à direita e usa números tabulares. */
  numeric?: boolean;
  /** Campo principal do cartão (título). Só uma coluna pode ter. */
  primary?: boolean;
  /** Campo de apoio do cartão (linha pequena abaixo do título). */
  secondary?: boolean;
  /** Nome curto (ex.: corretor): largura mínima, uma linha só e reticências, nunca quebra "Ana / Souza". */
  nowrap?: boolean;
};

/** Seleção em massa: uma caixa por linha (44px de alvo) e "selecionar todos" no cabeçalho da tabela. */
export type LiteSelection<T> = {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  /** Nome acessível da caixa da linha, por exemplo "Selecionar Maria Nova". */
  rowLabel: (row: T) => string;
};

export type LiteDataProps<T> = {
  caption: string;
  columns: LiteColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Abrir o registro (ex.: painel lateral). A linha inteira vira alvo, com Enter e espaço. */
  onRowOpen?: (row: T) => void;
  empty: ReactNode;
  selection?: LiteSelection<T>;
  /** Destaque da linha (ex.: devolvido sem aceite em atenção, investigação em cinza), sempre com texto junto. */
  rowTone?: (row: T) => "warning" | "muted" | undefined;
};

/** Caixa de seleção nativa dentro de um rótulo de 44px; o clique não abre a linha. */
function SelectBox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.selectBox} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <input type="checkbox" className={styles.checkbox} checked={checked} aria-label={label} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

const INTERACTIVE = "a, button, input, select, textarea, label, [role='combobox'], [role='menuitem']";

/** Clique na linha abre o registro, exceto quando nasce num controle dentro dela (link, botão, caixa). */
function openOnClick(onOpen: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget && event.currentTarget.contains(control)) return;
    onOpen();
  };
}

function activate(onOpen: () => void) {
  return (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
}

function cellClass<T>(column: LiteColumn<T>) {
  const names = [column.numeric ? styles.numeric : "", column.nowrap ? styles.nowrap : ""].filter(Boolean);
  return names.length ? names.join(" ") : undefined;
}

export function LiteDataTable<T>({ caption, columns, rows, rowKey, onRowOpen, empty, selection, rowTone }: LiteDataProps<T>) {
  if (!rows.length) return <div className={styles.empty}>{empty}</div>;
  return (
    <div className={styles.tableWrap} data-lite="table">
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            {selection ? (
              <th scope="col" className={styles.selectCell}>
                <SelectBox checked={selection.allSelected} label="Selecionar todos" onChange={selection.onToggleAll} />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cellClass(column)}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowOpen ? styles.clickable : undefined}
              data-selected={selection?.isSelected(row) ? "true" : undefined}
              data-tone={rowTone?.(row)}
              tabIndex={onRowOpen ? 0 : undefined}
              onClick={onRowOpen ? openOnClick(() => onRowOpen(row)) : undefined}
              onKeyDown={onRowOpen ? activate(() => onRowOpen(row)) : undefined}
            >
              {selection ? (
                <td className={styles.selectCell}>
                  <SelectBox checked={selection.isSelected(row)} label={selection.rowLabel(row)} onChange={() => selection.onToggle(row)} />
                </td>
              ) : null}
              {columns.map((column) => (
                <td key={column.id} className={cellClass(column)}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cartões abaixo de 768px: título (coluna `primary`), apoio (`secondary`) e as demais colunas em pares rótulo e valor. */
export function LiteDataList<T>({ caption, columns, rows, rowKey, onRowOpen, empty, selection, rowTone }: LiteDataProps<T>) {
  if (!rows.length) return <div className={styles.empty}>{empty}</div>;
  const primary = columns.find((column) => column.primary) ?? columns[0]!;
  const secondary = columns.find((column) => column.secondary);
  const details = columns.filter((column) => column !== primary && column !== secondary);
  return (
    <ul className={styles.cards} aria-label={caption} data-lite="list">
      {rows.map((row) => (
        <li
          key={rowKey(row)}
          className={onRowOpen ? styles.card : styles.cardStatic}
          tabIndex={onRowOpen ? 0 : undefined}
          onClick={onRowOpen ? openOnClick(() => onRowOpen(row)) : undefined}
          onKeyDown={onRowOpen ? activate(() => onRowOpen(row)) : undefined}
          data-selected={selection?.isSelected(row) ? "true" : undefined}
          data-tone={rowTone?.(row)}
        >
          {selection ? (
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>{primary.render(row)}</span>
              <SelectBox checked={selection.isSelected(row)} label={selection.rowLabel(row)} onChange={() => selection.onToggle(row)} />
            </div>
          ) : (
            <span className={styles.cardTitle}>{primary.render(row)}</span>
          )}
          {secondary ? <span className={styles.cardSub}>{secondary.render(row)}</span> : null}
          <dl className={styles.cardDetails}>
            {details.map((column) => (
              <div key={column.id}>
                <dt>{column.label}</dt>
                <dd className={column.numeric ? styles.numeric : undefined}>{column.render(row)}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Mostra a tabela ou os cartões conforme a largura. Renderiza os dois; o CSS escolhe o que aparece. */
export function LiteResponsiveData<T>(props: LiteDataProps<T>) {
  return (
    <>
      <div className={styles.onlyDesktop}><LiteDataTable {...props} /></div>
      <div className={styles.onlyPhone}><LiteDataList {...props} /></div>
    </>
  );
}
