"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Fingerprint, LockKey, PencilSimple, Plus, Trash, WarningCircle } from "@/components/huge-icons";

import { formatDate } from "@/features/quotes/utils";
import { authClient } from "@/shared/auth/client";
import { recordSecurityAuditAction } from "../security-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Passkey = {
  id: string;
  name: string | null;
  userId: string;
  publicKey: string;
  credentialID: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  aaguid: string | null;
  createdAt: string;
  updatedAt: string;
};



const DEVICE_LABELS: Record<string, string> = {
  platform: "Biometria (Face ID / Digital)",
  "cross-platform": "Chave de segurança USB",
};

export function PasskeySection() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attachmentType, setAttachmentType] = useState<"platform" | "cross-platform" | "">("platform");

  const refresh = useCallback(async () => {
    const result = await authClient.passkey.listUserPasskeys();
    if (result.data) setPasskeys(result.data as unknown as Passkey[]);
  }, []);

  useEffect(() => {
    refresh();
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, [refresh]);

  async function addBiometricsPasskey(customType?: "platform" | "cross-platform") {
    setBusy("add");
    try {
      const defaultName = isMobile ? "Biometria Celular" : "Biometria do Dispositivo";
      const finalName = name.trim() || defaultName;

      // On mobile or by default, force platform biometrics
      const targetAttachment = customType ?? (isMobile ? "platform" : attachmentType || "platform");

      const result = await authClient.passkey.addPasskey({
        name: finalName,
        authenticatorAttachment: targetAttachment || undefined,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Não foi possível cadastrar a biometria.");
      }

      await recordSecurityAuditAction("cadastrou_passkey");
      toast.success("Biometria cadastrada com sucesso! 🎉");
      setName("");
      await refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Não foi possível cadastrar a biometria.";
      toast.error(msg);
    } finally {
      setBusy("");
    }
  }

  async function renamePasskey() {
    if (!editingId || !editingName.trim()) return;
    setBusy("rename");
    try {
      const result = await authClient.passkey.updatePasskey({
        id: editingId,
        name: editingName.trim(),
      });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível renomear.");
      await recordSecurityAuditAction("renomeou_passkey");
      toast.success("Nome atualizado.");
      setEditingId(null);
      setEditingName("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível renomear.");
    } finally {
      setBusy("");
    }
  }

  async function deletePasskey(id: string, label: string) {
    setBusy(id);
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível excluir.");
      await recordSecurityAuditAction("excluiu_passkey");
      toast.success(`Biometria "${label}" removida.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-5">
      {/* Dynamic Action Hero Card for Mobile & Touch Devices */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
              <Fingerprint className={`size-8 ${busy === "add" ? "animate-pulse text-primary scale-110" : ""}`} />
              {busy === "add" && (
                <span className="absolute inset-0 rounded-2xl border-2 border-primary animate-ping opacity-75" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {isMobile ? "Biometria do Celular" : "Acesso por Biometria"}
                </h3>
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  Face ID / Digital
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-md">
                Cadastre o leitor de digital ou reconhecimento facial do seu aparelho para entrar no sistema com 1 toque, sem precisar de senha.
              </p>
            </div>
          </div>

          <div className="mt-2 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              type="button"
              size="lg"
              onClick={() => addBiometricsPasskey(isMobile ? "platform" : undefined)}
              disabled={busy === "add"}
              className="h-12 w-full sm:w-auto rounded-xl bg-primary text-primary-foreground font-semibold px-6 shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Fingerprint className={`size-5 ${busy === "add" ? "animate-spin" : ""}`} />
              {busy === "add" ? "Aguardando leitura..." : "Cadastrar Biometria"}
            </Button>
          </div>
        </div>

        {/* Dynamic Scan Feedback Alert when actively waiting for touch/face */}
        {busy === "add" && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs font-medium text-primary animate-fade-in">
            <span className="relative flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-3 bg-primary"></span>
            </span>
            <span>Siga as instruções na tela do seu aparelho para confirmar a leitura do Face ID ou digital.</span>
          </div>
        )}

        {/* Optional Name & Advanced Options Toggle for Desktop */}
        {!isMobile && (
          <div className="mt-4 border-t border-border/50 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              {showAdvanced ? "Ocultar opções avançadas" : "Opções avançadas (nome, tipo de chave)"}
            </button>

            {showAdvanced && (
              <div className="mt-3 flex flex-wrap items-end gap-3 animate-fade-in">
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="passkey-name">
                    Nome personalizado (opcional)
                  </label>
                  <Input
                    id="passkey-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Meu iPhone"
                    className="w-56 h-9 text-xs"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="passkey-type">
                    Tipo de autenticador
                  </label>
                  <select
                    id="passkey-type"
                    value={attachmentType}
                    onChange={(e) => setAttachmentType(e.target.value as "platform" | "cross-platform" | "")}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="platform">Biometria / Aparelho local (Recomendado)</option>
                    <option value="cross-platform">Chave de segurança USB (YubiKey / Externa)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Registered Passkeys List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Biometrias Cadastradas ({passkeys.length})
        </h4>

        {passkeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            <LockKey className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">Nenhuma biometria cadastrada ainda</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
              Clique no botão acima para cadastrar a digital ou Face ID do seu dispositivo.
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {passkeys.map((pk) => {
              const label = pk.name || "Biometria Cadastrada";
              const isEditing = editingId === pk.id;

              return (
                <div
                  key={pk.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-border/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Fingerprint className="size-5" />
                    </span>
                    <div className="min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 w-44 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renamePasskey();
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setEditingName("");
                              }
                            }}
                          />
                          <Button size="sm" variant="default" onClick={renamePasskey} disabled={busy === "rename"} className="h-8 text-xs">
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-foreground truncate max-w-56">{label}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium">
                          {DEVICE_LABELS[pk.deviceType] ?? pk.deviceType}
                        </Badge>
                        {pk.backedUp && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="size-3" /> Sincronizado
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          Criado em {formatDate(pk.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Renomear"
                        className="rounded-lg text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(pk.id);
                          setEditingName(pk.name || "");
                        }}
                      >
                        <PencilSimple className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Excluir"
                        className="rounded-lg text-muted-foreground hover:text-destructive"
                        disabled={busy === pk.id}
                        onClick={() => {
                          if (window.confirm(`Remover a biometria "${label}"?`)) {
                            deletePasskey(pk.id, label);
                          }
                        }}
                      >
                        <Trash className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
