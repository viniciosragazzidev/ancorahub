"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasCapability } from "@/shared/auth/permissions";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { getSpreadsheetsAction, type ImportedSpreadsheet } from "./spreadsheet-actions";
import { SpreadsheetUploader } from "./spreadsheet-uploader";
import { SpreadsheetList } from "./spreadsheet-list";

export function SpreadsheetSection() {
  const [canImport, setCanImport] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<ImportedSpreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    getUserDisplayInfo().then((user) => {
      setCanImport(hasCapability(user.roleKey, "importar_planilhas", user.jobTitle));
      setRoleLoaded(true);
    });
  }, []);

  const loadSpreadsheets = useCallback(async () => {
    const result = await getSpreadsheetsAction();
    setSpreadsheets(result.spreadsheets);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSpreadsheets();
  }, [loadSpreadsheets]);

  // Brokers don't have access to this section
  if (!roleLoaded || !canImport) return null;

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">DADOS EXTERNOS</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
            Planilhas importadas
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
            Importe arquivos XLSX, XLS ou CSV para visualizar, filtrar e compartilhar os dados.
          </p>
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <svg className="size-2.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L15 5V11L8 15L1 11V5L8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M8 5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.8" fill="currentColor"/>
              </svg>
              Diretores e Gestores
            </Badge>
          </div>
        </div>
        {!showUploader && (
          <Button
            size="sm"
            onClick={() => setShowUploader(true)}
          >
            <FileText className="size-3.5" />
            Nova importação
          </Button>
        )}
      </div>

      {showUploader && (
        <div className="min-w-0 rounded-xl outline-none focus-within:ring-2 focus-within:ring-primary/20">
          <SpreadsheetUploader
          onImported={() => {
            setShowUploader(false);
            loadSpreadsheets();
          }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <SpreadsheetList spreadsheets={spreadsheets} onRefresh={loadSpreadsheets} />
      )}

      {!loading && spreadsheets.length === 0 && !showUploader && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhuma planilha importada ainda
          </p>
          <p className="text-xs text-muted-foreground">
            Importe um arquivo XLSX, XLS ou CSV para começar.
          </p>
        </div>
      )}
    </section>
  );
}
