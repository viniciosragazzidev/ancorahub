"use client";

/**
 * Lista de registros no visual Lite (F3): `LiteDataTable` como tabela a partir de 768px e `LiteDataList` como cartões
 * abaixo disso. As mesmas linhas e as mesmas colunas alimentam as duas; só a apresentação muda.
 */
import type { KeyboardEvent, ReactNode } from "react";

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
};

export type LiteDataProps<T> = {
  caption: string;
  columns: LiteColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Abrir o registro (ex.: painel lateral). A linha inteira vira alvo, com Enter e espaço. */
  onRowOpen?: (row: T) => void;
  empty: ReactNode;
};

function activate(onOpen: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
}

export function LiteDataTable<T>({ caption, columns, rows, rowKey, onRowOpen, empty }: LiteDataProps<T>) {
  if (!rows.length) return <div className={styles.empty}>{empty}</div>;
  return (
    <div className={styles.tableWrap} data-lite="table">
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={column.numeric ? styles.numeric : undefined}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowOpen ? styles.clickable : undefined}
              tabIndex={onRowOpen ? 0 : undefined}
              onClick={onRowOpen ? () => onRowOpen(row) : undefined}
              onKeyDown={onRowOpen ? activate(() => onRowOpen(row)) : undefined}
            >
              {columns.map((column) => (
                <td key={column.id} className={column.numeric ? styles.numeric : undefined}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cartões abaixo de 768px: título (coluna `primary`), apoio (`secondary`) e as demais colunas em pares rótulo e valor. */
export function LiteDataList<T>({ caption, columns, rows, rowKey, onRowOpen, empty }: LiteDataProps<T>) {
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
          onClick={onRowOpen ? () => onRowOpen(row) : undefined}
          onKeyDown={onRowOpen ? activate(() => onRowOpen(row)) : undefined}
        >
          <span className={styles.cardTitle}>{primary.render(row)}</span>
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
