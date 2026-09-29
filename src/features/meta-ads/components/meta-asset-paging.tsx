"use client";

import { useState } from "react";

import { ArrowLeft, ArrowRight } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";

/** Paginação simples (15 por página) compartilhada pelas listas de ativos da Meta. */
export const PAGE_SIZE = 15;

export function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    total: items.length,
    start,
    end: Math.min(start + PAGE_SIZE, items.length),
    visible: items.slice(start, start + PAGE_SIZE),
    setPage,
  };
}

export function PaginationFooter({
  page,
  totalPages,
  total,
  start,
  end,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-mono text-xs text-muted-foreground">
        {start + 1}–{end} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" variant="outline">
          <ArrowLeft className="size-4" />
          Anterior
        </Button>
        <Button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} size="sm" variant="outline">
          Próxima
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
