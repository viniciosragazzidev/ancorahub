"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/leads${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-4">
      <p className="text-xs text-muted-foreground">
        Mostrando <strong className="font-semibold text-foreground">{startItem}</strong> a{" "}
        <strong className="font-semibold text-foreground">{endItem}</strong> de{" "}
        <strong className="font-semibold text-foreground">{totalItems}</strong> leads
      </p>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
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

        <span className="px-2 text-xs font-medium text-foreground">
          Página {currentPage} de {totalPages}
        </span>

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
