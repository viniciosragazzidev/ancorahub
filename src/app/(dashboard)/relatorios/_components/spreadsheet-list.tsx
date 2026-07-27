"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChartBar, Copy, Eye, LinkSimple, PencilSimple, ShieldCheck, Trash, X } from "@/components/huge-icons";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteSpreadsheetAction,
  renameSpreadsheetAction,
  revokePublicLinkAction,
  type ImportedSpreadsheet,
} from "./spreadsheet-actions";
import { ShareDialog } from "./share-dialog";
import { SpreadsheetTableViewer } from "./spreadsheet-table-viewer";

export function SpreadsheetList({
  spreadsheets,
  onRefresh,
}: {
  spreadsheets: ImportedSpreadsheet[];
  onRefresh: () => void;
}) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    const result = await deleteSpreadsheetAction(id);
    setDeletingId(null);
    if (result.success) {
      toast.success("Planilha excluída.");
      onRefresh();
      if (viewingId === id) setViewingId(null);
    } else {
      toast.error(result.error ?? "Erro ao excluir.");
    }
  }, [onRefresh, viewingId]);

  const handleRename = useCallback(async (id: string) => {
    if (!editName.trim()) return;
    const formData = new FormData();
    formData.set("id", id);
    formData.set("name", editName.trim());
    const result = await renameSpreadsheetAction({}, formData);
    if (result.success) {
      toast.success("Renomeada.");
      setEditingId(null);
      onRefresh();
    } else {
      toast.error(result.error ?? "Erro ao renomear.");
    }
  }, [editName, onRefresh]);

  const handleRevokeLink = useCallback(async (id: string) => {
    const result = await revokePublicLinkAction(id);
    if (result.success) {
      toast.success("Link público revogado.");
      onRefresh();
    } else {
      toast.error(result.error ?? "Erro ao revogar link.");
    }
  }, [onRefresh]);

  if (spreadsheets.length === 0) return null;

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ChartBar className="size-4 text-primary" />
          <div>
            <CardTitle>Planilhas importadas</CardTitle>
            <CardDescription>
              {spreadsheets.length} planilha{spreadsheets.length !== 1 ? "s" : ""} — clique para visualizar.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence initial={false}>
          {spreadsheets.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              {/* Row */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <div className="min-w-0 flex-1">
                  {editingId === s.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRename(s.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                      />
                      <Button size="sm" type="submit" variant="ghost" className="h-7 px-2">
                        <ShieldCheck className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewingId(viewingId === s.id ? null : s.id)}
                      className="text-left"
                    >
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.rowCount} linha{s.rowCount !== 1 ? "s" : ""} ·{" "}
                        {s.columns.length} coluna{s.columns.length !== 1 ? "s" : ""} ·{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(s.createdAt))}
                      </p>
                    </button>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {s.publicToken ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <LinkSimple className="size-3" />
                      Público
                    </Badge>
                  ) : null}

                  {/* View */}
                  <button
                    type="button"
                    onClick={() => setViewingId(viewingId === s.id ? null : s.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="size-4" />
                  </button>

                  {/* Rename */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(s.id);
                      setEditName(s.name);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Renomear"
                  >
                    <PencilSimple className="size-4" />
                  </button>

                  {/* Share */}
                  <button
                    type="button"
                    onClick={() => setSharingId(sharingId === s.id ? null : s.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Compartilhar"
                  >
                    <Copy className="size-4" />
                  </button>

                  {/* Copy public link */}
                  {s.publicToken && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/compartilhado/${s.publicToken}`,
                        );
                        toast.success("Link copiado!");
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Copiar link"
                    >
                      <LinkSimple className="size-4" />
                    </button>
                  )}

                  {/* Revoke public link */}
                  {s.publicToken && (
                    <button
                      type="button"
                      onClick={() => handleRevokeLink(s.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Revogar link"
                    >
                      <X className="size-4" />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
              </div>

              {/* Expanded table viewer */}
              {viewingId === s.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border pt-2">
                    <SpreadsheetTableViewer
                      spreadsheetId={s.id}
                      columns={s.columns}
                    />
                  </div>
                </motion.div>
              )}

              {/* Share dialog */}
              {sharingId === s.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border pt-2 pb-1">
                    <ShareDialog
                      spreadsheetId={s.id}
                      existingToken={s.publicToken}
                      onShared={() => {
                        setSharingId(null);
                        onRefresh();
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
