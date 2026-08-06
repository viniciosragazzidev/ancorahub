"use client";

import { FileArrowDown } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";

export function ExportButtons() {
  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        size="sm"
        onClick={() => {
          window.open(
            `/api/internal/export/commissions?startMonth=${currentMonth}&endMonth=${currentMonth}&format=csv`,
            "_blank",
          );
        }}
      >
        <FileArrowDown /> Baixar comissões (CSV)
      </Button>
    </div>
  );
}
