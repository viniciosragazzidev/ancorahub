"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowsDownUp, ChevronDownIcon, ChevronUpIcon, MagnifyingGlass, ShieldCheck } from "@/components/huge-icons";

import "@/components/arc/venancor-scope.css";
import { Button } from "@/components/arc/button/button";
import { PasswordField } from "@/components/arc/password-field/password-field";
import styles from "./spreadsheet.module.css";

/**
 * Planilha compartilhada por link público (sem login) no visual Lite para todo mundo (Onda 8). Os quatro estados da
 * página (carregando, erro, senha e tabela) com a mesma busca, ordenação e paginação de 25 linhas de antes.
 */
export type SpreadsheetColumn = { key: string; label: string; type: "string" | "number" | "date" };

export type PublicSpreadsheet = {
  name: string;
  description: string | null;
  columns: SpreadsheetColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

const PASSWORD_MESSAGES = { showPassword: "Mostrar senha", hidePassword: "Ocultar senha" };

export function SpreadsheetLoading() {
  return (
    <div className={`arc-venancor ${styles.centered}`}>
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.text}>Carregando visualização...</p>
      </div>
    </div>
  );
}

export function SpreadsheetError({ message }: { message: string }) {
  return (
    <div className={`arc-venancor ${styles.centered}`}>
      <section className={styles.panel} aria-labelledby="spreadsheet-error-title">
        <div className={styles.heading}>
          <h1 id="spreadsheet-error-title" className={styles.title}>Visualização indisponível</h1>
          <p className={styles.text}>{message}</p>
        </div>
      </section>
    </div>
  );
}

export function SpreadsheetPasswordGate({ password, onPasswordChange, error, submitting, onSubmit }: {
  password: string;
  onPasswordChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className={`arc-venancor ${styles.centered}`}>
      <section className={styles.panel} aria-labelledby="spreadsheet-lock-title">
        <div className={styles.heading}>
          <span className={styles.lock}><ShieldCheck className="size-5" aria-hidden="true" />Link protegido</span>
          <h1 id="spreadsheet-lock-title" className={styles.title}>Visualização protegida</h1>
          <p className={styles.text}>Esta visualização exige uma senha para ser acessada.</p>
        </div>
        <form onSubmit={onSubmit} className={styles.form}>
          <PasswordField
            id="public-password"
            label="Senha"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Digite a senha"
            autoFocus
            messages={PASSWORD_MESSAGES}
          />
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
            {submitting ? "Verificando..." : "Acessar visualização"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export function SpreadsheetTable({ data }: { data: PublicSpreadsheet }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(() => {
    const colHelper = createColumnHelper<Record<string, unknown>>();
    return data.columns.map((col) =>
      colHelper.accessor(col.key, {
        id: col.key,
        header: () => col.label,
        cell: (info) => {
          const value = info.getValue();
          if (value == null || value === "") return <span className={styles.empty} aria-label="Vazio">-</span>;
          if (col.type === "number" && typeof value === "number") {
            return <span className={styles.numeric}>{value.toLocaleString("pt-BR")}</span>;
          }
          return <span>{String(value)}</span>;
        },
        enableSorting: true,
      }),
    );
  }, [data]);

  const table = useReactTable({
    data: data.rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className={`arc-venancor ${styles.frame}`}>
      <main className={styles.body}>
        <header className={styles.heading}>
          <h1 className={styles.title}>{data.name}</h1>
          {data.description ? <p className={styles.text}>{data.description}</p> : null}
          <p className={styles.meta}>
            {data.rowCount} linha{data.rowCount !== 1 ? "s" : ""} · {data.columns.length} coluna{data.columns.length !== 1 ? "s" : ""}
          </p>
        </header>

        <label className={styles.search}>
          <MagnifyingGlass className={`size-4 ${styles.searchIcon}`} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar na tabela..."
            aria-label="Buscar na tabela"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
          />
        </label>

        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <th key={header.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                          <button type="button" onClick={header.column.getToggleSortingHandler()} className={styles.sortButton}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? <ChevronUpIcon className="size-3" aria-hidden="true" /> : sorted === "desc" ? <ChevronDownIcon className="size-3" aria-hidden="true" /> : <ArrowsDownUp className="size-3 opacity-30" aria-hidden="true" />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.meta}>
            {table.getFilteredRowModel().rows.length} de {data.rowCount} linha{data.rowCount !== 1 ? "s" : ""} · Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <div className={styles.pages}>
            <button type="button" className={styles.pageButton} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</button>
            <button type="button" className={styles.pageButton} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Próximo</button>
          </div>
        </div>
      </main>
    </div>
  );
}
