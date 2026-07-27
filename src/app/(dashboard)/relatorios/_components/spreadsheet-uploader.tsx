"use client";

import { useActionState, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle, FileArrowDown, FileText, Trash } from "@/components/huge-icons";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importSpreadsheetAction, type SpreadsheetActionState, type ImportedSpreadsheet, type DelimiterOption } from "./spreadsheet-actions";
import { parseCsv } from "@/shared/utils/csv";

type PreviewData = {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
};

const DELIMITERS: { value: DelimiterOption; label: string }[] = [
  { value: ",", label: "Vírgula (,)" },
  { value: ";", label: "Ponto e vírgula (;)" },
  { value: "\t", label: "Tab (⇥)" },
  { value: "|", label: "Pipe (|)" },
];

export function SpreadsheetUploader({
  onImported,
}: {
  onImported: (spreadsheet: ImportedSpreadsheet) => void;
}) {
  const [state, action, pending] = useActionState<SpreadsheetActionState & { spreadsheet?: ImportedSpreadsheet }, FormData>(
    importSpreadsheetAction,
    {},
  );

  // Step 1: file selection
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [isCsv, setIsCsv] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2: preview
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedDelimiter, setSelectedDelimiter] = useState<DelimiterOption>(",");

  // Handle import result
  useEffect(() => {
    if (state.success && state.spreadsheet) {
      onImported(state.spreadsheet);
      resetForm();
      toast.success("Planilha importada com sucesso!");
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.success, state.error, state.spreadsheet, onImported]);

  function resetForm() {
    setFile(null);
    setName("");
    setPreview(null);
    setPreviewLoading(false);
    setIsCsv(false);
    setSelectedDelimiter(",");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  }

  function validateAndSetFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("Formato não suportado. Use .xlsx, .xls ou .csv.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10 MB.");
      return;
    }
    setIsCsv(ext === "csv");
    setFile(f);
    if (!name) setName(f.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    setPreview(null);
    setSelectedDelimiter(",");
  }

  /** Parse the file client-side for preview */
  const parsePreview = useCallback(async (delim: DelimiterOption) => {
    if (!file) return;
    setPreviewLoading(true);
    setPreview(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const buffer = await file.arrayBuffer();

      let allRows: Record<string, unknown>[];

      if (ext === "csv") {
        const text = new TextDecoder("utf-8").decode(buffer);
        allRows = parseCsv(text, delim);
      } else {
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          toast.error("O arquivo não contém nenhuma planilha.");
          setPreviewLoading(false);
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
        });
      }

      if (allRows.length === 0) {
        toast.error("A planilha está vazia.");
        setPreviewLoading(false);
        return;
      }

      if (allRows.length > 50_000) {
        toast.error("A planilha tem mais de 50.000 linhas. Importe um arquivo menor.");
        setPreviewLoading(false);
        return;
      }

      const columns = Object.keys(allRows[0]);
      if (columns.length === 0) {
        toast.error("A planilha não tem colunas identificáveis.");
        setPreviewLoading(false);
        return;
      }

      setPreview({
        columns,
        rows: allRows.slice(0, 10),
        totalRows: allRows.length,
      });
    } catch (err) {
      toast.error("Erro ao processar o arquivo. Verifique se o formato está correto.");
    }
    setPreviewLoading(false);
  }, [file]);

  // Auto-parse when file or delimiter changes
  useEffect(() => {
    if (!file) return;
    parsePreview(isCsv ? selectedDelimiter : ",");
  }, [file, isCsv, selectedDelimiter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImport() {
    if (!file || !name.trim() || !preview) return;

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("fileExtension", file.name.split(".").pop()?.toLowerCase() ?? "");

    if (isCsv && selectedDelimiter !== ",") {
      formData.set("delimiter", selectedDelimiter);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      formData.set("fileBase64", base64);
      action(formData);
    };
    reader.onerror = () => toast.error("Erro ao ler o arquivo.");
    reader.readAsDataURL(file);
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <div>
            <CardTitle>Importar planilha</CardTitle>
            <CardDescription>
              Faça upload de um arquivo XLSX, XLS ou CSV para visualizar os dados em uma tabela interativa.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* ── Step 1: Drop zone ── */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
              dragOver
                ? "border-primary bg-primary/5"
                : file
                  ? "border-primary/40 bg-primary/[0.03]"
                  : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate max-w-60">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); resetForm(); }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Trash className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <FileArrowDown className="size-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Arraste um arquivo ou clique para selecionar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    XLSX, XLS ou CSV — até 10 MB
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── CSV Delimiter selector ── */}
          {file && isCsv && (
            <div className="flex items-center gap-3">
              <Label className="text-xs shrink-0">Delimitador:</Label>
              <div className="flex gap-1">
                {DELIMITERS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setSelectedDelimiter(d.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedDelimiter === d.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {previewLoading && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="size-3.5 rounded-full border-2 border-primary border-t-transparent shrink-0"
                />
              )}
            </div>
          )}

          {/* ── Step 2: Preview table ── */}
          {previewLoading && !preview && (
            <div className="flex items-center justify-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="size-6 rounded-full border-2 border-primary border-t-transparent"
              />
            </div>
          )}

          <AnimatePresence>
            {preview && !previewLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Preview header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-success" />
                    <span className="text-sm font-medium">
                      {preview.columns.length} colunas · {preview.totalRows} linha{preview.totalRows !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Mostrando as primeiras {Math.min(10, preview.totalRows)} linha{Math.min(10, preview.totalRows) !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Mini table */}
                <div className="overflow-x-auto rounded-lg border border-border max-h-64 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-muted/90 z-10">
                      <tr className="border-b border-border">
                        {preview.columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-border ${
                            i % 2 === 0 ? "bg-background" : "bg-muted/10"
                          }`}
                        >
                          {preview.columns.map((col) => (
                            <td key={col} className="px-3 py-1 text-xs truncate max-w-48">
                              {row[col] != null && row[col] !== ""
                                ? String(row[col])
                                : <span className="text-muted-foreground/50">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Name + import button */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="preview-name" className="text-xs">
                      Nome da planilha
                    </Label>
                    <Input
                      id="preview-name"
                      placeholder="Ex: Relatório de vendas mensal"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-8 text-sm"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetForm}
                      disabled={pending}
                      className="h-8"
                    >
                      <ArrowLeft className="size-3.5" />
                      Trocar arquivo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleImport}
                      disabled={pending || !name.trim()}
                      className="h-8"
                    >
                      {pending ? (
                        <>
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="inline-block size-3.5 border-2 border-current border-t-transparent rounded-full"
                          />
                          Importando...
                        </>
                      ) : (
                        <>
                          <FileArrowDown className="size-3.5" />
                          Importar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
