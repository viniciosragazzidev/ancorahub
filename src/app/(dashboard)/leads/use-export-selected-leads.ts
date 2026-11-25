"use client";

import { useCallback, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { selectedLeadsExportMessage } from "@/features/leads/selected-lead-export";

import { exportSelectedLeadsAction } from "./export-actions";

function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de começar o download antes de soltar o arquivo.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Exportar CSV" da seleção em /leads. Feedback nível 1 (FEEDBACK.md): o toque vibra, o botão mostra
 * "Exportando…" e fica travado; a confirmação só vem depois que o servidor devolve o arquivo. O erro diz
 * a causa, lembra que nada mudou nos leads e oferece "Tentar de novo".
 */
export function useExportSelectedLeads() {
  const [exporting, setExporting] = useState(false);
  const running = useRef(false);
  const fire = useFeedback();

  const exportLeads = useCallback(async (ids: string[]) => {
    if (running.current || ids.length === 0) return;
    running.current = true;
    setExporting(true);
    fire("tap");
    const snapshot = [...ids];
    const failed = (message: string) => {
      fire("error");
      toast.error(`${message} Seus leads seguem iguais.`, {
        action: { label: "Tentar de novo", onClick: () => { void exportLeads(snapshot); } },
      });
    };
    try {
      const result = await exportSelectedLeadsAction(snapshot);
      if (!result.ok) {
        failed(result.error);
        return;
      }
      downloadCsv(result.csv, result.filename);
      fire("confirm");
      toast.success(selectedLeadsExportMessage(result.exported, result.requested));
    } catch {
      failed("Não consegui gerar o arquivo agora.");
    } finally {
      running.current = false;
      setExporting(false);
    }
  }, [fire]);

  return { exporting, exportLeads };
}
