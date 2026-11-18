"use client";

import { useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { FileArrowDown, CheckCircle, XCircle, Clock, X, Plus } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { uploadMetaLeadsAction, type ImportHistoryItem } from "@/features/marketing-import/actions";

type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  history: ImportHistoryItem[];
  lastImport: ImportHistoryItem | null;
  role: string;
  jobTitle: string;
  branchId: string | null;
  isCentralMarketing: boolean;
};

export function MarketingImportClient({ branches, history, lastImport, role, branchId: userBranchId, isCentralMarketing }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState(userBranchId ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    importId: string;
    imported: number;
    duplicates: number;
    invalid: number;
    durationMs: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canChooseBranch = role === "director" || isCentralMarketing;

  async function handleSubmit() {
    if (!file) return toast.error("Selecione um arquivo.");
    setBusy(true);
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("branchId", branchId);

    const response = await uploadMetaLeadsAction(formData);
    setBusy(false);

    if (!('importId' in response) || !response.success) {
      return toast.error('error' in response ? response.error ?? "Erro ao importar." : "Erro ao importar.");
    }

    const r = response as { importId: string; imported: number; duplicates: number; invalid: number; durationMs: number; errors: Array<{ row: number; message: string }> };
    setResult({ importId: r.importId, imported: r.imported, duplicates: r.duplicates, invalid: r.invalid, durationMs: r.durationMs, errors: r.errors });
    toast.success(`${r.imported} lead(s) importado(s)!`);
    if (r.duplicates > 0) toast.info(`${r.duplicates} lead(s) duplicado(s) ignorado(s).`);
    if (r.invalid > 0) toast.warning(`${r.invalid} linha(s) inválida(s) — verifique o resumo para mais detalhes.`);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="size-4 text-emerald-400" />;
      case "failed": return <XCircle className="size-4 text-red-400" />;
      default: return <Clock className="size-4 text-amber-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Concluído";
      case "failed": return "Falhou";
      case "processing": return "Processando";
      default: return status;
    }
  };

  return (
    <>
      {/* Import Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="right">
        <DrawerContent className="w-full sm:max-w-xl border-l border-border/40 bg-background/95 backdrop-blur-2xl">
          <DrawerHeader className="border-b border-border/40 pb-6 pt-8 px-8">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-2xl font-bold tracking-tight">Nova importação</DrawerTitle>
                <DrawerDescription className="mt-1.5 text-base">Faça upload da planilha Meta Ads (.xlsx, .xls, .csv)</DrawerDescription>
              </div>
              <DrawerClose render={<Button size="icon-sm" variant="ghost" aria-label="Fechar" className="rounded-full hover:bg-muted" />}>
                <X className="size-5" />
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* Drop Zone */}
            <div
              className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-12 text-center transition-all duration-500 ease-out ${
                dragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-border/60 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileArrowDown className="mb-4 size-12 text-muted-foreground/60 transition-transform duration-500 group-hover:scale-110 group-hover:text-foreground" />
              {file ? (
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                    className="mt-2"
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Arraste a planilha aqui</p>
                  <p className="mt-1 text-xs text-muted-foreground">ou</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => inputRef.current?.click()}
                  >
                    Selecionar Arquivo
                  </Button>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Branch selector */}
            {canChooseBranch && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Unidade de destino</label>
                <Select value={branchId} labels={Object.fromEntries(branches.map((b) => [b.id, b.name]))} onValueChange={(v) => setBranchId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!canChooseBranch && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Os leads serão importados para sua unidade.
              </p>
            )}

            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Colunas esperadas: <code className="font-mono text-[11px]">ID</code>, <code className="font-mono text-[11px]">Data</code>, <code className="font-mono text-[11px]">Nome</code>, <code className="font-mono text-[11px]">E-mail</code>, <code className="font-mono text-[11px]">Telefone</code>, <code className="font-mono text-[11px]">Operadora</code>, <code className="font-mono text-[11px]">Nome da campanha</code>, <code className="font-mono text-[11px]">Nome do conjunto de anúncio</code>, <code className="font-mono text-[11px]">Nome do anúncio</code>. A coluna <code className="font-mono text-[11px]">Nome do formulário</code> é opcional — quando ausente, os leads são registrados como “Formulário Direct”.
            </p>

            <Button
              onClick={handleSubmit}
              disabled={busy || !file || (canChooseBranch && !branchId)}
              className="w-full h-12 text-base font-medium transition-transform duration-300 active:scale-[0.98] hover:-translate-y-0.5 shadow-sm"
            >
              {busy ? "Importando..." : "Importar leads"}
            </Button>

            {/* Result */}
            {result && (
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p className="font-semibold text-emerald-400">Importação concluída</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-400">{result.imported}</p>
                    <p className="text-xs text-muted-foreground">Importados</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-400">{result.duplicates}</p>
                    <p className="text-xs text-muted-foreground">Duplicados</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{result.invalid}</p>
                    <p className="text-xs text-muted-foreground">Inválidos</p>
                  </div>
                </div>
                {(result.durationMs ?? 0) > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Tempo: {(result.durationMs / 1000).toFixed(1)} segundos
                  </p>
                )}
                {result.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      {result.errors.length} erro(s) — clique para detalhes
                    </summary>
                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                      {result.errors.slice(0, 10).map((err, i) => (
                        <p key={i} className="text-xs text-red-400">Linha {err.row}: {err.message}</p>
                      ))}
                      {result.errors.length > 10 && (
                        <p className="text-xs text-muted-foreground">...e mais {result.errors.length - 10}</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Main Content */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Left column */}
        <div className="grid gap-6">
          {/* Action Card */}
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Importar Planilha Meta</CardTitle>
                  <CardDescription className="mt-1">
                    Formatos aceitos: .xlsx, .xls, .csv — Máximo 10 MB
                  </CardDescription>
                </div>
                <Button onClick={() => setDrawerOpen(true)}>
                  <Plus className="size-4" /> Nova importação
                </Button>
              </div>
            </CardHeader>
            {lastImport && (
              <CardContent className="grid gap-2 text-sm border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">ÚLTIMA IMPORTAÇÃO</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastImport.createdAt))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Arquivo</span>
                  <span className="truncate max-w-[200px] text-right">{lastImport.fileName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Responsável</span>
                  <span>{lastImport.userName ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resultado</span>
                  <span>
                    {lastImport.importedCount} importados · {lastImport.duplicateCount} dup. · {lastImport.invalidCount} inválidos
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={lastImport.status === "completed" ? "default" : "destructive"}>
                    {statusLabel(lastImport.status)}
                  </Badge>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right Column - History */}
        <Card className="h-fit border-transparent bg-transparent shadow-none">
          <CardHeader>
            <CardTitle>Histórico de importações</CardTitle>
            <CardDescription>Últimas 50 importações realizadas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <FileArrowDown className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                Nenhuma importação realizada ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {history.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="mt-0.5 shrink-0">{statusIcon(item.status)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.fileName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
                        {item.userName ? ` · ${item.userName}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-400">
                          {item.importedCount} importados
                        </span>
                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-400">
                          {item.duplicateCount} dup.
                        </span>
                        <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-400">
                          {item.invalidCount} invál.
                        </span>
                      </div>
                    </div>
                    <Badge variant={item.status === "completed" ? "default" : "destructive"} className="shrink-0">
                      {statusLabel(item.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
