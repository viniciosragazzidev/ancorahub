"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "@/components/huge-icons";

export function LeadsPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1 && totalItems <= pageSize) {
    return (
      <div className="flex items-center justify-between border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <span>Mostrando <strong>{totalItems}</strong> lead{totalItems === 1 ? "" : "s"}</span>
      </div>
    );
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    const newUrl = `${pathname}?${params.toString()}`;
    router.push(newUrl);
    router.refresh();
  }

  // Generate page numbers array (up to 5 pages shown)
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-4">
      <p className="text-xs text-muted-foreground">
        Mostrando <strong className="font-semibold text-foreground">{startItem}</strong> a{" "}
        <strong className="font-semibold text-foreground">{endItem}</strong> de{" "}
        <strong className="font-semibold text-foreground">{totalItems}</strong> leads
      </p>

      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2.5 text-xs"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
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
        >
          Próxima
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
