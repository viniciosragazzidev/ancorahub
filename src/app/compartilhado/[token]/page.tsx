"use client";

import { useState, useMemo, useEffect } from "react";
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
import { motion } from "motion/react";
import { useParams } from "next/navigation";
import {
  ArrowsDownUp,
  ChevronDownIcon,
  ChevronUpIcon,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  ShieldCheck,
} from "@/components/huge-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ColumnDef = { key: string; label: string; type: "string" | "number" | "date" };

type PublicData = {
  name: string;
  description: string | null;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

export default function PublicSpreadsheetPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData(pwd?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/spreadsheets/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pwd ? { password: pwd } : {}),
      });

      if (res.status === 401) {
        const body = await res.json();
        if (body.needsPassword) {
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
      }

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 403) {
          setPasswordError(body.error ?? "Senha incorreta.");
          setLoading(false);
          return;
        }
        setError(body.error ?? "Erro ao carregar dados.");
        setLoading(false);
        return;
      }

      const result: PublicData = await res.json();
      setData(result);
      setNeedsPassword(false);
    } catch (e) {
      setError("Erro ao conectar com o servidor.");
    }
    setLoading(false);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setSubmitting(true);
    fetchData(password).finally(() => setSubmitting(false));
  }

  const columns = useMemo(() => {
    if (!data) return [];
    const colHelper = createColumnHelper<Record<string, unknown>>();
    return data.columns.map((col) =>
      colHelper.accessor(col.key, {
        id: col.key,
        header: () => col.label,
        cell: (info) => {
          const value = info.getValue();
          if (value == null || value === "") return <span className="text-muted-foreground/50">—</span>;
          if (col.type === "number" && typeof value === "number") {
            return <span className="font-mono tabular-nums">{value.toLocaleString("pt-BR")}</span>;
          }
          return <span className="text-sm">{String(value)}</span>;
        },
        enableSorting: true,
      }),
    );
  }, [data]);

  const table = useReactTable({
    data: data?.rows ?? [],
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

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="size-8 rounded-full border-2 border-primary border-t-transparent"
          />
          <p className="text-sm text-muted-foreground">Carregando visualização...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md border-border shadow-none">
          <CardHeader>
            <CardTitle>Visualização indisponível</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Password gate
  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border-border shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <CardTitle>Visualização protegida</CardTitle>
                <CardDescription>
                  Esta visualização exige uma senha para ser acessada.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="public-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="public-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha"
                    autoFocus
                    className="pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Verificando..." : "Acessar visualização"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Table
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
          {data.description && (
            <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.rowCount} linha{data.rowCount !== 1 ? "s" : ""} ·{" "}
            {data.columns.length} coluna{data.columns.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar na tabela..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{          asc: <ChevronUpIcon className="size-3" />,
          desc: <ChevronDownIcon className="size-3" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ArrowsDownUp className="size-3 opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-border transition-colors hover:bg-muted/20 ${
                    i % 2 === 0 ? "bg-background" : "bg-muted/10"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {table.getFilteredRowModel().rows.length} de {data.rowCount} linha
            {data.rowCount !== 1 ? "s" : ""}
            {" · "}
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 px-2 text-xs"
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 px-2 text-xs"
            >
              Próximo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
