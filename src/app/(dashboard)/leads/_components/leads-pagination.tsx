"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "@/components/huge-icons";

export function LeadsPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  storageKey,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  storageKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    if (onPageChange) {
      onPageChange(page);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", page.toString());
      const newUrl = `${pathname}?${params.toString()}`;
      router.push(newUrl);
    }
  }

  function handlePageSizeChange(newSize: number) {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", newSize.toString());
      params.set("page", "1");
      if (storageKey) {
        try {
          const stored = localStorage.getItem(storageKey);
          const parsed = stored ? JSON.parse(stored) : {};
          localStorage.setItem(storageKey, JSON.stringify({ ...parsed, pageSize: newSize.toString() }));
        } catch {}
      }
      router.push(`${pathname}?${params.toString()}`);
    }
  }

  function prefetchPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.prefetch(`${pathname}?${params.toString()}`);
  }

  // Generate page numbers array (up to 7 pages shown)
  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-3 px-3 pb-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <p>
          Mostrando <strong className="font-semibold text-foreground">{startItem}</strong> a{" "}
          <strong className="font-semibold text-foreground">{endItem}</strong> de{" "}
          <strong className="font-semibold text-foreground">{totalItems}</strong> leads
        </p>

        <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Exibir:</span>
          <select
            aria-label="Itens por página"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-border/80 bg-background px-2 text-xs font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          >
            <option value={10}>10 por pág.</option>
            <option value={20}>20 por pág.</option>
            <option value={50}>50 por pág.</option>
            <option value={100}>100 por pág.</option>
          </select>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            onPointerEnter={() => prefetchPage(currentPage - 1)}
          >
            <ArrowLeft className="size-3.5" />
            Anterior
          </Button>

          {pages.map((p, idx) =>
            typeof p === "number" ? (
              <Button
                key={`page-${p}`}
                size="sm"
                variant={p === currentPage ? "default" : "outline"}
                className="h-8 w-8 p-0 text-xs font-semibold"
                onClick={() => goToPage(p)}
                onPointerEnter={() => prefetchPage(p)}
              >
                {p}
              </Button>
            ) : (
              <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">
                {p}
              </span>
            )
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            onPointerEnter={() => prefetchPage(currentPage + 1)}
          >
            Próxima
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
